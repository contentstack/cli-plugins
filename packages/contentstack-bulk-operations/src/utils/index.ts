/**
 * Utility functions barrel export
 * This file only handles imports and exports - implementations are in individual utility files
 */
import messages, { $t } from '../messages';
import { getStacks } from './client';
import * as bulkOperationLogHandler from './bulk-operation-log-handler';
import { getLogPaths, clearLogs } from './bulk-operation-log-handler';
import { handleRevertOrRetry, loadConfigFromLogFile } from './revert-retry-handler';
import { buildConfig, validateFlags, setupStackConfig } from './config-builder';
import * as crossPublishHandler from './cross-publish-handler';
import {
  chunkArray,
  getUniqueEnvironments,
  getUniqueLocales,
  sleep,
  formatDuration,
  formatCompletionMessage,
  isRateLimitError,
  getErrorCode,
  aggregateBatchResults,
  createOperationResult,
  logSummary,
  categorizeByScanStatus,
} from './helpers';
import { setupBatchQueueListeners } from './batch-queue-handler';
import { confirmOperation } from './operation-confirmation';
import { batchItems, validateBatch } from './batch-helper';
import { handleCrossPublishOperation } from './cross-publish-handler';
import { fetchAssets, fetchEntries, fetchTaxonomyList } from './item-fetcher';
import {
  logOperationInfo,
  enqueueIndividualItems,
  buildSingleModeResult,
  enqueueBatches,
  buildBulkModeResult,
  handleOperationError,
} from './command-helpers';
import { fillMissingFlags } from './interactive';
import {
  RATE_LIMITER_CONSTANTS,
  RETRY_STRATEGY_CONSTANTS,
  BATCH_CONSTANTS,
  PAGINATION_CONSTANTS,
  API_CONSTANTS,
} from './constants';
import { generateBulkPublishStatusUrl } from './bulk-publish-url-generator';
import { validateBranch, validateEnvironments } from './validators';
import {
  loadAssetUidsFromFile,
  loadBulkDeleteItemsFromFile,
  validateAndBuildBulkDeleteItems,
  LoadAssetUidsError,
} from './asset-uids-from-file';
import { scanDataDirStats } from './data-dir-asset-fetcher';
import type { DataDirScanStats } from './data-dir-asset-fetcher';
import {
  compareFieldValues,
  compareNonLocalizedFields,
  checkReferenceFieldChanges,
  hasNonLocalizedFields,
  checkNonLocalizedFieldChanges,
  identifyNonLocalizedFields,
} from './non-localized-field-handler';

export {
  getStacks,
  messages,
  $t,
  bulkOperationLogHandler,
  getLogPaths,
  clearLogs,
  handleRevertOrRetry,
  loadConfigFromLogFile,
  crossPublishHandler,
  buildConfig,
  validateFlags,
  setupStackConfig,
  chunkArray,
  getUniqueEnvironments,
  getUniqueLocales,
  sleep,
  formatDuration,
  formatCompletionMessage,
  isRateLimitError,
  getErrorCode,
  aggregateBatchResults,
  createOperationResult,
  setupBatchQueueListeners,
  confirmOperation,
  batchItems,
  handleCrossPublishOperation,
  fetchAssets,
  fetchEntries,
  logSummary,
  categorizeByScanStatus,
  logOperationInfo,
  validateBatch,
  enqueueIndividualItems,
  buildSingleModeResult,
  enqueueBatches,
  buildBulkModeResult,
  handleOperationError,
  fillMissingFlags,
  fetchTaxonomyList,
  RATE_LIMITER_CONSTANTS,
  RETRY_STRATEGY_CONSTANTS,
  BATCH_CONSTANTS,
  PAGINATION_CONSTANTS,
  API_CONSTANTS,
  generateBulkPublishStatusUrl,
  validateBranch,
  validateEnvironments,
  compareFieldValues,
  compareNonLocalizedFields,
  checkReferenceFieldChanges,
  hasNonLocalizedFields,
  checkNonLocalizedFieldChanges,
  identifyNonLocalizedFields,
  loadAssetUidsFromFile,
  loadBulkDeleteItemsFromFile,
  validateAndBuildBulkDeleteItems,
  LoadAssetUidsError,
  scanDataDirStats,
};
export type { DataDirScanStats };
