import { handleAndLogError } from '@contentstack/cli-utilities';
import { sleep, isRateLimitError, getErrorCode } from '../utils';
import { writeBulkSuccessLog, writeBulkFailedLog } from './bulk-operation-log-handler';
import { OperationStatus, BulkModeLogEntry, LogItem, BatchQueueConfig, ResourceType } from '../interfaces';

/**
 * Sets up batch processing event listeners for queue manager
 * Handles batch execution and result tracking for BULK mode operations
 *
 * @param config - Configuration object containing all dependencies
 */
export function setupBatchQueueListeners(config: BatchQueueConfig) {
  const { queueManager, bulkService, batchResults, logger, resourceType, logFolderPath, apiKey, branch } = config;

  queueManager.on('processing', (item: any, done: (error?: Error) => void) => {
    const batch = getBatchMeta(item?.data);

    if (!batch?.batchNumber) {
      done();
      return;
    }

    logger.info(
      `Processing batch ${batch.batchNumber ?? 0}/${batch.totalBatches ?? 0}: ` +
        `${batch.items.length} items, ` +
        `${batch.locales.length} locales, ` +
        `${batch.environments.length} environments`
    );

    (async () => {
      try {
        const result = await bulkService.executeBulkPublish(batch.items, batch.operation, resourceType);

        batchResults.set(item.id, result);
        queueManager.updateItemStatus(item.id, OperationStatus.SUCCESS);

        if (apiKey) {
          writeBulkLog(
            {
              mode: 'bulk',
              jobId: result.jobId,
              batchNumber: batch.batchNumber,
              operation: batch.operation!,
              timestamp: new Date().toISOString(),
              environments: batch.environments,
              locales: batch.locales,
              items: buildLogItems(batch.items, resourceType),
              status: 'success',
              apiKey,
              branch,
            },
            logFolderPath,
            true
          );
        }

        done();
      } catch (error: any) {
        await handleRetryOrFailure({
          error,
          item,
          batch,
          config,
          done,
        });
      }
    })();
  });

  queueManager.on('completed', () => {
    logger.debug('All batches have been submitted to the bulk API');
  });

  queueManager.on('error', ({ item, error }: { item: any; error: any }) => {
    const batch = getBatchMeta(item?.data);
    if (!batch) return;

    handleAndLogError(error, {
      batchNumber: `${batch.batchNumber ?? 0}/${batch.totalBatches ?? 0}`,
      itemCount: batch.items.length,
    });

    recordPermanentFailure(item, batch, error, config);
  });
}

async function handleRetryOrFailure({
  error,
  item,
  batch,
  config,
  done,
}: {
  error: any;
  item: any;
  batch: ReturnType<typeof getBatchMeta>;
  config: BatchQueueConfig;
  done: (error?: Error) => void;
}) {
  if (!batch) return done(error);

  const { retryStrategy, logger, queueManager } = config;
  const shouldRetry = await retryStrategy.shouldRetry(item, error);

  if (shouldRetry) {
    const isRateLimit = isRateLimitError(error);
    const delay = isRateLimit
      ? retryStrategy.getRateLimitDelay(item.retryCount)
      : retryStrategy.getDelay(item.retryCount);

    logger.warn(
      `Batch ${batch.batchNumber ?? 0}/${batch.totalBatches ?? 0} failed with ${
        isRateLimit ? '429 Rate Limit' : getErrorCode(error)
      }, retrying in ${Math.ceil(delay / 1000)}s`
    );

    await sleep(delay);
    queueManager.requeue(item, true);
    done();
    return;
  }

  recordPermanentFailure(item, batch, error, config);
  done(error);
}

function recordPermanentFailure(
  item: any,
  batch: NonNullable<ReturnType<typeof getBatchMeta>>,
  error: any,
  config: BatchQueueConfig
) {
  const { batchResults, queueManager, resourceType, logFolderPath, apiKey, branch } = config;

  batchResults.set(item.id, {
    jobId: item.id,
    status: 'failed',
    success: 0,
    failed: batch.items.length,
  });

  if (apiKey) {
    writeBulkLog(
      {
        mode: 'bulk',
        jobId: item.id,
        batchNumber: batch.batchNumber,
        operation: batch.operation!,
        timestamp: new Date().toISOString(),
        environments: batch.environments,
        locales: batch.locales,
        items: buildLogItems(batch.items, resourceType),
        status: 'failed',
        error: error?.message ?? 'Unknown error',
        apiKey,
        branch,
      },
      logFolderPath,
      false
    );
  }

  queueManager.updateItemStatus(item.id, OperationStatus.FAILED, error);
}

function getBatchMeta(data: any) {
  if (!data || typeof data !== 'object') return null;

  return {
    batchNumber: data.batchNumber as number | undefined,
    totalBatches: data.totalBatches as number | undefined,
    items: Array.isArray(data.items) ? data.items : [],
    locales: Array.isArray(data.locales) ? data.locales : [],
    environments: Array.isArray(data.environments) ? data.environments : [],
    operation: data.operation as 'publish' | 'unpublish' | undefined,
  };
}

function buildLogItems(items: unknown[], resourceType: ResourceType): LogItem[] {
  return items
    .filter((item): item is any => typeof item === 'object' && item !== null)
    .map((item) => ({
      uid: item.uid,
      locale: item.locale,
      contentType: item.content_type,
      version: item.version,
      type: resourceType === ResourceType.ENTRY ? 'entry' : 'asset',
    }));
}

function writeBulkLog(entry: BulkModeLogEntry, logFolderPath?: string, success = true) {
  if (!logFolderPath) return;
  if (success) {
    writeBulkSuccessLog(entry, logFolderPath);
    return;
  }
  writeBulkFailedLog(entry, logFolderPath);
}
