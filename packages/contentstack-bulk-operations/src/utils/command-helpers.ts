import { handleAndLogError } from '@contentstack/cli-utilities';
import { QueueManager } from '../core';
import messages, { $t } from '../messages';
import { getUniqueEnvironments, getUniqueLocales, createOperationResult, formatCompletionMessage } from './helpers';
import { BulkOperationResult, OperationType, ResourceType, BulkJobResult } from '../interfaces';

/**
 * Log operation info (items, environments, locales)
 */
export function logOperationInfo(items: any[], logger: any): void {
  const environments = getUniqueEnvironments(items);
  const locales = getUniqueLocales(items);

  logger.info(
    `Processing ${items.length} items across ${locales.length} locales and ${environments.length} environments`
  );
}

/**
 * Enqueue individual items for SINGLE mode processing
 */
export function enqueueIndividualItems(items: any[], queueManager: QueueManager, operation: OperationType): void {
  for (const item of items) {
    const itemType: ResourceType = 'content_type' in item ? ResourceType.ENTRY : ResourceType.ASSET;
    queueManager.enqueue(itemType, operation, item);
  }
}

/**
 * Build result object for SINGLE mode operation
 */
export function buildSingleModeResult(
  items: any[],
  startTime: number,
  queueManager: QueueManager,
  logger: any
): BulkOperationResult {
  const stats = queueManager.getStats();
  const duration = Date.now() - startTime;

  logger.info(formatCompletionMessage('SINGLE', duration, stats.succeeded, stats.failed, items.length));

  return createOperationResult(stats.succeeded, stats.failed, items.length, duration);
}

/**
 * Enqueue all batches for BULK mode processing
 */
export function enqueueBatches(batches: any[], queueManager: QueueManager, operation: OperationType): void {
  for (const batch of batches) {
    queueManager.enqueue(ResourceType.ENTRY, operation, {
      items: batch.items,
      environments: batch.environments,
      locales: batch.locales,
      batchNumber: batch.batchNumber,
      totalBatches: batch.totalBatches,
      operation: operation,
    });
  }
}

/**
 * Build result object for BULK mode operation
 * Note: For bulk mode, we don't have immediate success/fail counts
 * since jobs are submitted asynchronously. The result contains job IDs instead.
 */
export function buildBulkModeResult(
  batches: any[],
  startTime: number,
  batchResults: Map<string, BulkJobResult>,
  logger: any
): BulkOperationResult {
  const duration = Date.now() - startTime;

  // Collect all job IDs from batch results
  const jobIds: string[] = [];
  batchResults.forEach((result) => {
    if (result.jobId) {
      jobIds.push(result.jobId);
    }
  });

  logger.debug(`Submitted ${batches.length} batches in ${(duration / 1000).toFixed(2)}s`);

  return {
    success: 0, // Not known immediately for bulk mode
    failed: 0, // Not known immediately for bulk mode
    total: batches.reduce((sum, b) => sum + b.items.length, 0),
    duration,
    jobIds, // Include job IDs for final summary
  };
}

/**
 * Handle operation error and return failure result
 */
export function handleOperationError(error: any, items: any[], startTime: number): BulkOperationResult {
  const duration = Date.now() - startTime;

  // Use handleAndLogError for user-friendly error display
  handleAndLogError(error, {
    message: $t(messages.BULK_OPERATION_FAILED),
    itemCount: items.length,
  });

  return createOperationResult(0, items.length, items.length, duration);
}
