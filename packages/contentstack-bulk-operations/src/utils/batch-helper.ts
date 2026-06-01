/**
 * Batch Helper - Handles batching of items according to Contentstack API limits
 *
 * Contentstack API Limits:
 * - Maximum 50 entries/assets per bulk operation
 * - Maximum 10 locales per bulk operation
 * - Maximum 10 environments per bulk operation
 */

import { chunkArray } from './helpers';
import { BATCH_CONSTANTS } from './constants';
import { EntryPublishData, AssetPublishData, BatchConfig, BatchedItems } from '../interfaces';

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxItems: BATCH_CONSTANTS.maxItems,
  maxLocales: BATCH_CONSTANTS.maxLocales,
  maxEnvironments: BATCH_CONSTANTS.maxEnvironments,
};

export function batchItems(
  items: Array<EntryPublishData | AssetPublishData>,
  environments: string[],
  locales: string[],
  config: BatchConfig = DEFAULT_BATCH_CONFIG
): BatchedItems[] {
  const batches: BatchedItems[] = [];

  const itemBatches = chunkArray(items, config.maxItems);

  // Combine locale + environment into publish targets
  const publishTargets = locales.flatMap((locale) => environments.map((environment) => ({ locale, environment })));

  const targetBatchSize = config.maxLocales * config.maxEnvironments;
  const targetBatches = chunkArray(publishTargets, targetBatchSize);

  let batchNumber = 0;
  const totalBatches = itemBatches.length * targetBatches.length;

  for (const itemBatch of itemBatches) {
    for (const targetBatch of targetBatches) {
      batchNumber++;

      const targetSet = new Set(targetBatch.map((t) => `${t.locale}:${t.environment}`));

      const filteredItems = itemBatch
        .map((item) => {
          const publish_details = item.publish_details?.filter((pd) => targetSet.has(`${pd.locale}:${pd.environment}`));

          if (!publish_details || publish_details.length === 0) return null;

          return {
            ...item,
            publish_details,
          };
        })
        .filter(Boolean) as Array<EntryPublishData | AssetPublishData>;

      if (filteredItems.length > 0) {
        batches.push({
          items: filteredItems,
          locales: [...new Set(targetBatch.map((t) => t.locale))],
          environments: [...new Set(targetBatch.map((t) => t.environment))],
          batchNumber,
          totalBatches,
        });
      }
    }
  }

  return batches;
}

/**
 * Calculate estimated batch count before creating batches
 * Useful for displaying operation summary and confirmation dialogs
 */
export function estimateBatchCount(
  itemCount: number,
  localeCount: number,
  environmentCount: number,
  config: BatchConfig = DEFAULT_BATCH_CONFIG
): {
  batchCount: number;
  itemBatches: number;
  localeBatches: number;
  environmentBatches: number;
} {
  const itemBatches = Math.ceil(itemCount / config.maxItems);
  const localeBatches = Math.ceil(localeCount / config.maxLocales);
  const environmentBatches = Math.ceil(environmentCount / config.maxEnvironments);
  const batchCount = itemBatches * localeBatches * environmentBatches;

  return {
    batchCount,
    itemBatches,
    localeBatches,
    environmentBatches,
  };
}

/**
 * Calculate batch summary for display purposes
 * Provides formatted information about batch distribution
 */
export function calculateBatchSummary(
  itemCount: number,
  localeCount: number,
  environmentCount: number,
  config: BatchConfig = DEFAULT_BATCH_CONFIG
): {
  estimate: ReturnType<typeof estimateBatchCount>;
  totalOperations: number;
  needsBatching: boolean;
  summary: string;
} {
  const estimate = estimateBatchCount(itemCount, localeCount, environmentCount, config);
  const totalOperations = itemCount * localeCount * environmentCount;
  const maxOperations = config.maxItems * config.maxLocales * config.maxEnvironments;
  const needsBatching = estimate.batchCount > 1;

  const summary = needsBatching
    ? `Will create ${estimate.batchCount} batches (${estimate.itemBatches} item batches × ${estimate.localeBatches} locale batches × ${estimate.environmentBatches} environment batches)`
    : `Single batch operation (${totalOperations} operations within limit of ${maxOperations})`;

  return {
    estimate,
    totalOperations,
    needsBatching,
    summary,
  };
}

export function validateBatch(
  batch: BatchedItems,
  config: BatchConfig = DEFAULT_BATCH_CONFIG
): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (batch.items.length > config.maxItems) {
    warnings.push(`Batch contains ${batch.items.length} items, exceeds limit of ${config.maxItems}`);
  }

  if (batch.locales.length > config.maxLocales) {
    warnings.push(`Batch contains ${batch.locales.length} locales, exceeds limit of ${config.maxLocales}`);
  }

  if (batch.environments.length > config.maxEnvironments) {
    warnings.push(
      `Batch contains ${batch.environments.length} environments, exceeds limit of ${config.maxEnvironments}`
    );
  }

  const totalOperations = batch.items.length * batch.locales.length * batch.environments.length;
  const maxOperations = config.maxItems * config.maxLocales * config.maxEnvironments;

  if (totalOperations > maxOperations) {
    warnings.push(`Batch has ${totalOperations} total operations, exceeds recommended limit of ${maxOperations}`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
