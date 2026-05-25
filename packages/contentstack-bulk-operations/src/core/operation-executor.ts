import { handleAndLogError } from '@contentstack/cli-utilities';
import { RetryStrategy, AdaptiveRateLimiter, QueueManager } from './index';
import {
  QueueItem,
  OperationType,
  OperationResult,
  OperationStatus,
  EntryPublishData,
  AssetPublishData,
  ManagementStack,
  ResourceType,
  SingleModeLogEntry,
} from '../interfaces';
import { sleep, isRateLimitError } from '../utils';
import { writeSingleSuccessLog, writeSingleFailedLog } from '../utils/bulk-operation-log-handler';

/**
 * OperationExecutor - Executes individual publish/unpublish operations
 */
export class OperationExecutor {
  private logFolderPath?: string;
  private apiKey?: string;
  private branch?: string;

  constructor(
    private rateLimiter: AdaptiveRateLimiter,
    private queueManager: QueueManager,
    private retryStrategy: RetryStrategy,
    private logger: any,
    private stack: ManagementStack,
    config?: { logFolderPath?: string; apiKey?: string; branch?: string }
  ) {
    this.logFolderPath = config?.logFolderPath;
    this.apiKey = config?.apiKey;
    this.branch = config?.branch;
    this.setupQueueListeners();
  }

  /**
   * Setup queue listeners to process items
   * Only processes individual items (not batches for BULK mode)
   */
  private setupQueueListeners() {
    this.queueManager.on('processing', (item: QueueItem, done: (error?: Error) => void) => {
      // Skip batch items - they are handled by batch-queue-handler
      if (item.data?.batchNumber) {
        done();
        return;
      }

      // Execute operation and call done when complete
      this.executeOperation(item)
        .then(() => done())
        .catch((error) => done(error));
    });

    // Handle errors from queue processing
    this.queueManager.on('error', ({ item, error }: { item: QueueItem; error: any }) => {
      handleAndLogError(error, { itemId: item.data?.uid });
    });
  }

  private async executeOperation(item: QueueItem): Promise<OperationResult> {
    const startTime = Date.now();

    // Step 1: Acquire rate limit token
    const token = await this.rateLimiter.acquire();

    try {
      let response;

      // Step 2: Execute operation based on type
      switch (item.type) {
        case ResourceType.ENTRY:
          response = await this.executeEntryOperation(item.operation, item.data as EntryPublishData);
          break;
        case ResourceType.ASSET:
          response = await this.executeAssetOperation(item.operation, item.data as AssetPublishData);
          break;
        default:
          throw new Error(`Unknown item type: ${String(item.type)}`);
      }

      // Step 3: Success handling
      const headers = this.extractHeaders(response);
      token.success(headers);
      token.release();

      this.queueManager.updateItemStatus(item.id, OperationStatus.SUCCESS);

      this.logger.debug(`Successfully processed ${item.type} ${item.data?.uid}`);

      // Log success to file
      this.logSuccess(item);

      return {
        success: true,
        item,
        response,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      const is429 = error.errorCode === 429 || error.status === 429;
      const errorHeaders = this.extractHeaders(error);
      token.failure(is429, errorHeaders);
      token.release();

      await this.handleError(item, error);

      return {
        success: false,
        item,
        error: error as Error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Handle operation error with retry logic
   * Uses RetryStrategy to determine if/when to retry
   */
  private async handleError(item: QueueItem, error: any): Promise<void> {
    const shouldRetry = await this.retryStrategy.shouldRetry(item, error);

    if (shouldRetry) {
      const delay = isRateLimitError(error)
        ? this.retryStrategy.getRateLimitDelay(item.retryCount)
        : this.retryStrategy.getDelay(item.retryCount);

      this.logger.warn(
        `Operation failed, retrying in ${delay}ms ` +
          `(attempt ${item.retryCount + 1}/${this.retryStrategy.maxRetries})`,
        { itemId: item.id, error: this.sanitizeError(error) }
      );

      // Wait before requeue
      await sleep(delay);

      // Requeue with priority
      this.queueManager.requeue(item, true);
    } else {
      item.status = OperationStatus.FAILED;
      item.error = error;

      this.queueManager.updateItemStatus(item.id, OperationStatus.FAILED, error);

      // Use handleAndLogError for user-friendly error display
      handleAndLogError(error, {
        message: `✗ Failed to process ${item.type} ${item.data.uid}`,
        itemId: item.data.uid,
        contentType: item.data.content_type,
        locale: item.data.locale,
      });

      // Log failure to file
      this.logFailure(item, error);
    }
  }

  /**
   * Execute entry publish/unpublish operation
   */
  private async executeEntryOperation(operation: OperationType, data: EntryPublishData): Promise<any> {
    const { uid, content_type, locale, version, publish_details } = data;

    const entry = this.stack.contentType(content_type).entry(uid);

    switch (operation) {
      case OperationType.PUBLISH:
        return await entry.publish({
          publishDetails: {
            environments: publish_details?.map((pd) => pd.environment) || [],
            locales: publish_details?.map((pd) => pd.locale) || [locale || 'en-us'],
          },
          version: version,
          locale: locale || 'en-us',
        });

      case OperationType.UNPUBLISH:
        return await entry.unpublish({
          publishDetails: {
            environments: publish_details?.map((pd) => pd.environment) || [],
            locales: publish_details?.map((pd) => pd.locale) || [locale || 'en-us'],
          },
          locale: locale || 'en-us',
        });

      default:
        throw new Error(`Unknown operation: ${String(operation)}`);
    }
  }

  /**
   * Execute asset publish/unpublish operation
   */
  private async executeAssetOperation(operation: OperationType, data: AssetPublishData): Promise<any> {
    const { uid, locale, version, publish_details } = data;

    const asset = this.stack.asset(uid);

    switch (operation) {
      case OperationType.PUBLISH:
        return await asset.publish({
          publishDetails: {
            environments: publish_details?.map((pd) => pd.environment) || [],
            locales: publish_details?.map((pd) => pd.locale) || [locale || 'en-us'],
          },
          version: version,
        });

      case OperationType.UNPUBLISH:
        return await asset.unpublish({
          publishDetails: {
            environments: publish_details?.map((pd) => pd.environment) || [],
            locales: publish_details?.map((pd) => pd.locale) || [locale || 'en-us'],
          },
        });

      default:
        throw new Error(`Unknown operation: ${String(operation)}`);
    }
  }

  /**
   * Log successful operation to file
   */
  private logSuccess(item: QueueItem): void {
    this.logOperation(item, 'success');
  }

  /**
   * Log failed operation to file
   */
  private logFailure(item: QueueItem, error: any): void {
    this.logOperation(item, 'failed', error);
  }

  /**
   * Log operation result to file (success or failure)
   */
  private logOperation(item: QueueItem, status: 'success' | 'failed', error?: any): void {
    if (!this.logFolderPath || !this.apiKey) {
      return;
    }

    // Extract environments from publish_details
    const environments = item.data.publish_details?.map((pd: any) => pd.environment) || [];

    const logEntry: SingleModeLogEntry = {
      mode: 'single',
      operation: item.operation,
      timestamp: new Date().toISOString(),
      item: {
        uid: item.data.uid,
        contentType: item.data.content_type,
        locale: item.data.locale,
        version: item.data.version,
        type: item.type,
      },
      environments,
      status,
      ...(error && { error: this.sanitizeError(error) }),
      apiKey: this.apiKey,
      branch: this.branch,
    };

    // Write to appropriate log file based on status
    if (status === 'success') {
      writeSingleSuccessLog(logEntry, this.logFolderPath);
    } else {
      writeSingleFailedLog(logEntry, this.logFolderPath);
    }
  }

  /**
   * Extract rate limit headers from response or error object
   * Contentstack SDK may return headers in different locations
   */
  private extractHeaders(obj: any): any {
    if (!obj) return null;

    return obj.headers || obj.response?.headers || obj._headers || obj.rawHeaders || null;
  }

  private sanitizeError(error: any): any {
    if (typeof error !== 'object') return error;

    const sanitized: any = {
      code: error.errorCode || error.status || error.code,
      message: error.message,
    };

    if (error.errors) {
      sanitized.details = error.errors;
    }
    if (error.error_message) {
      sanitized.details = error.error_message;
    }

    return sanitized;
  }
}
