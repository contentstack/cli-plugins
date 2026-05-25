import {
  readBulkFailedLog,
  readBulkSuccessLog,
  readSingleFailedLog,
  readSingleSuccessLog,
} from './bulk-operation-log-handler';
import {
  LogItem,
  EntryPublishData,
  AssetPublishData,
  ResourceType,
  OperationType,
  BulkOperationResult,
  BulkModeLogEntry,
  SingleModeLogEntry,
} from '../interfaces';
import { confirmOperation } from './operation-confirmation';
import { $t, messages } from './index';

/**
 * Load log entries and extract configuration
 */
export interface LogFileConfig {
  operation: OperationType;
  environments: string[];
  locales: string[];
  publishMode?: 'bulk' | 'single';
  apiKey?: string;
  branch?: string;
  items: (EntryPublishData | AssetPublishData)[];
}

/**
 * Validate that log file can be used for revert operation
 * Revert only works for "publish" operations (to unpublish them)
 */
export function validateRevertOperation(
  bulkLogs: BulkModeLogEntry[],
  singleLogs: SingleModeLogEntry[]
): { valid: boolean; error?: string } {
  for (const log of bulkLogs) {
    if (log.operation !== 'publish') {
      return {
        valid: false,
        error: $t(messages.REVERT_ONLY_FOR_PUBLISH, { operation: log.operation }),
      };
    }
  }

  // Check single logs
  for (const log of singleLogs) {
    if (log.operation !== 'publish') {
      return {
        valid: false,
        error: $t(messages.REVERT_ONLY_FOR_PUBLISH, { operation: log.operation }),
      };
    }
  }

  return { valid: true };
}

/**
 * Load configuration from log file
 * Returns config values that can be used/overridden by command flags
 */
export function loadConfigFromLogFile(
  logPath: string,
  isRetry: boolean,
  resourceType: ResourceType
): LogFileConfig | null {
  // Read both bulk and single mode logs
  const bulkLogEntries = isRetry ? readBulkFailedLog(logPath) : readBulkSuccessLog(logPath);
  const singleLogEntries = isRetry ? readSingleFailedLog(logPath) : readSingleSuccessLog(logPath);

  if (bulkLogEntries.length === 0 && singleLogEntries.length === 0) {
    return null;
  }

  // Extract items from bulk logs
  const bulkItems: LogItem[] = bulkLogEntries.flatMap((entry) => entry.items);

  // Extract items from single logs
  const singleItems: LogItem[] = singleLogEntries.map((entry) => entry.item);

  // Get config from first available log entry
  const firstBulk = bulkLogEntries[0];
  const firstSingle = singleLogEntries[0];

  const operation = (firstBulk?.operation || firstSingle?.operation || 'publish') as OperationType;
  const environments = firstBulk?.environments || firstSingle?.environments || [];
  // For single mode, extract locales from items; for bulk mode, use log entry locales
  const locales =
    firstBulk?.locales || (singleItems.length > 0 ? Array.from(new Set(singleItems.map((i) => i.locale))) : []);
  const apiKey = firstBulk?.apiKey || firstSingle?.apiKey;
  const branch = firstBulk?.branch || firstSingle?.branch;

  // Determine publish mode based on which log has entries
  const publishMode = singleLogEntries.length > 0 ? 'single' : 'bulk';

  // Combine all items
  const allItems = [...bulkItems, ...singleItems];

  const items =
    resourceType === ResourceType.ENTRY
      ? convertToEntryData(allItems, environments)
      : convertToAssetData(allItems, environments);

  return {
    operation,
    environments,
    locales,
    publishMode,
    apiKey,
    branch,
    items,
  };
}

/**
 * Load items from log file and convert to processable format
 */
export function loadItemsFromLog(
  logPath: string,
  isRetry: boolean,
  resourceType: ResourceType
): (EntryPublishData | AssetPublishData)[] {
  const config = loadConfigFromLogFile(logPath, isRetry, resourceType);
  return config?.items || [];
}

/**
 * Convert log items to entry publish data
 */
function convertToEntryData(logItems: LogItem[], environments: string[]): EntryPublishData[] {
  return logItems
    .filter((item) => item.type === 'entry')
    .map((item) => ({
      type: 'entry' as const,
      uid: item.uid,
      locale: item.locale,
      content_type: item.contentType || '',
      contentTypeUid: item.contentType || '',
      version: item.version || 1,
      publish_details: environments.map((env: string) => ({
        environment: env,
        locale: item.locale,
        version: item.version || 1,
      })),
    }));
}

/**
 * Convert log items to asset publish data
 */
function convertToAssetData(logItems: LogItem[], environments: string[]): AssetPublishData[] {
  return logItems
    .filter((item) => item.type === 'asset')
    .map((item) => ({
      type: 'asset' as const,
      uid: item.uid,
      locale: item.locale,
      version: item.version || 1,
      publish_details: environments.map((env: string) => ({
        environment: env,
        locale: item.locale,
        version: item.version || 1,
      })),
    }));
}

/**
 * Handle revert or retry operations
 * Orchestrates loading items from logs, confirming, and executing operations
 *
 * @param logPath - Path to the log file/folder
 * @param isRetry - true for retry, false for revert
 * @param resourceType - Type of resource (entry or asset)
 * @param config - Bulk operation configuration (can be overridden by log file values)
 * @param skipConfirmation - Skip confirmation prompt
 * @param executeBulkOperation - Function to execute the operation
 * @param logger - Logger instance
 * @returns The operation result, or undefined if operation was cancelled or no items found
 */
export async function handleRevertOrRetry(
  logPath: string,
  isRetry: boolean,
  resourceType: ResourceType,
  config: any,
  skipConfirmation: boolean,
  executeBulkOperation: (items: any[]) => Promise<BulkOperationResult>,
  logger: any
): Promise<BulkOperationResult | undefined> {
  logger.info(
    isRetry ? $t(messages.READING_FAILED_LOG, { path: logPath }) : $t(messages.READING_SUCCESS_LOG, { path: logPath })
  );

  // Load config from log file
  const logFileConfig = loadConfigFromLogFile(logPath, isRetry, resourceType);

  if (!logFileConfig || logFileConfig.items.length === 0) {
    logger.warn(
      isRetry
        ? $t(messages.NO_FAILED_ITEMS_IN_LOG, { resourceType })
        : $t(messages.NO_SUCCESS_ITEMS_IN_LOG, { resourceType })
    );
    if (isRetry) {
      logger.info(
        'Note: For BULK mode operations, partial failures within a job are not logged individually. ' +
          'Check the bulk publish status URL for detailed job results.'
      );
    } else {
      logger.info('No items to revert.');
    }
    return undefined;
  }

  // For revert, validate that log contains publish operations only
  if (!isRetry) {
    const bulkLogs = readBulkSuccessLog(logPath);
    const singleLogs = readSingleSuccessLog(logPath);
    const validation = validateRevertOperation(bulkLogs, singleLogs);

    if (!validation.valid) {
      logger.error(validation.error);
      return undefined;
    }
  }

  // Merge log file config with provided config (user flags override log values)
  const mergedConfig = {
    ...config,
    // Use log file values as defaults, allow user flags to override
    environments: config.environments?.length > 0 ? config.environments : logFileConfig.environments,
    locales: config.locales?.length > 0 ? config.locales : logFileConfig.locales,
    apiKey: config.apiKey || config.stackApiKey || logFileConfig.apiKey,
    branch: config.branch || logFileConfig.branch,
    operation: isRetry ? config.operation || logFileConfig.operation : OperationType.UNPUBLISH,
    // Preserve publish mode from log file (single mode operations should retry/revert in single mode)
    publishMode: logFileConfig.publishMode || config.publishMode,
  };

  logger.info(
    `Using ${logFileConfig.publishMode?.toUpperCase() || 'BULK'} mode for ${isRetry ? 'retry' : 'revert'} operation (from log file)`
  );

  const items = logFileConfig.items;

  logger.info(
    isRetry
      ? $t(messages.RETRYING_OPERATIONS, { count: items.length })
      : $t(messages.REVERTING_OPERATIONS, { count: items.length })
  );

  const confirmed = await confirmOperation(mergedConfig, items.length, resourceType, skipConfirmation);
  if (!confirmed) {
    logger.warn($t(messages.OPERATION_CANCELLED));
    return undefined;
  }

  // Execute operation
  const result = await executeBulkOperation(items);
  logger.info($t(messages.OPERATION_COMPLETED, { success: result.success, failed: result.failed }));

  return result;
}
