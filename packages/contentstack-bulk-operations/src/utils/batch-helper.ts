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

type PublishItem = EntryPublishData | AssetPublishData;

/** A batch as emitted by TargetBatcher — totalBatches is only known once batching finishes. */
export type PendingBatch = Omit<BatchedItems, 'totalBatches'>;

/**
 * Group an item's own publish_details into locale -> sorted environments.
 * A publish_details entry without an environment is unusable; one without a locale uses the item's.
 */
function targetsOf(item: PublishItem): Map<string, string[]> {
  const byLocale = new Map<string, Set<string>>();

  for (const pd of item.publish_details ?? []) {
    if (!pd?.environment) continue;
    const locale = pd.locale || item.locale;
    if (!locale) continue;

    let envs = byLocale.get(locale);
    if (!envs) {
      envs = new Set<string>();
      byLocale.set(locale, envs);
    }
    envs.add(pd.environment);
  }

  return new Map([...byLocale].map(([locale, envs]) => [locale, [...envs].sort()]));
}

/** True when an item carries at least one usable (locale, environment) publish target. */
export function hasPublishTargets(item: PublishItem): boolean {
  return targetsOf(item).size > 0;
}

/**
 * Batches items by publish target: one locale and one environment set per batch.
 *
 * The API expands `{ items[], environments[], locales[] }` into one record per
 * (item x locale x environment), so mixing targets in a batch publishes each item to the union.
 *
 * Buckets are bounded by the number of distinct targets, not by item count, so this also works
 * for streaming callers.
 */
export class TargetBatcher {
  private readonly buckets = new Map<string, { locale: string; environments: string[]; items: PublishItem[] }>();
  private batchCount = 0;
  private skipped = 0;

  constructor(
    private readonly emit: (batch: PendingBatch) => void,
    private readonly config: BatchConfig = DEFAULT_BATCH_CONFIG
  ) {}

  /** Items dropped for carrying no usable publish target. */
  get skippedCount(): number {
    return this.skipped;
  }

  /** Batches emitted so far. */
  get emittedCount(): number {
    return this.batchCount;
  }

  add(item: PublishItem): void {
    const targets = targetsOf(item);
    if (targets.size === 0) {
      this.skipped++;
      return;
    }

    for (const [locale, environments] of targets) {
      // An environment set past the API cap becomes several batches, each still single-locale.
      for (const envChunk of chunkArray(environments, this.config.maxEnvironments)) {
        const key = JSON.stringify([locale, envChunk]);

        let bucket = this.buckets.get(key);
        if (!bucket) {
          bucket = { locale, environments: envChunk, items: [] };
          this.buckets.set(key, bucket);
        }

        // Narrow publish_details to this batch's target so payload building cannot re-widen it.
        // `item.locale` is left alone: for entries it is the resolution hint, which can legitimately
        // differ from the requested locale this batch publishes to.
        bucket.items.push({
          ...item,
          publish_details: envChunk.map((environment) => ({ environment, locale, version: item.version })),
        });

        if (bucket.items.length >= this.config.maxItems) this.flush(key, bucket);
      }
    }
  }

  /** Emit every partially filled bucket. */
  end(): void {
    for (const [key, bucket] of this.buckets) this.flush(key, bucket);
  }

  private flush(key: string, bucket: { locale: string; environments: string[]; items: PublishItem[] }): void {
    if (bucket.items.length === 0) return;

    this.batchCount++;
    this.emit({
      items: bucket.items,
      locales: [bucket.locale],
      environments: bucket.environments,
      batchNumber: this.batchCount,
    });

    this.buckets.delete(key);
  }
}

export function batchItems(items: PublishItem[], config: BatchConfig = DEFAULT_BATCH_CONFIG): BatchedItems[] {
  const pending: PendingBatch[] = [];
  const batcher = new TargetBatcher((batch) => pending.push(batch), config);

  for (const item of items) batcher.add(item);
  batcher.end();

  return pending.map((batch) => ({ ...batch, totalBatches: pending.length }));
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
