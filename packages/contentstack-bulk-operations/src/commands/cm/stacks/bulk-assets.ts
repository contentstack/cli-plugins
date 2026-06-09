import * as fs from 'fs';
import * as path from 'path';

import { flags, handleAndLogError, log } from '@contentstack/cli-utilities';

import { AssetPublishData, BulkOperationResult, OperationType, ResourceType } from '../../../interfaces';
import { BaseBulkCommand } from '../../../base-bulk-command';
import {
  $t,
  messages,
  fetchAssets,
  scanDataDirStats,
  BATCH_CONSTANTS,
  categorizeByScanStatus,
  fillMissingFlags,
} from '../../../utils';
import type { DataDirScanStats } from '../../../utils';
import { AssetService } from '../../../services';

/**
 * Bulk operations command for assets
 * Supports publish, unpublish, cross-publish, and data-dir publish operations
 */
export default class BulkAssets extends BaseBulkCommand {
  static description = messages.BULK_ASSETS_DESCRIPTION;

  static examples = [
    // Publish assets
    '<%= config.bin %> <%= command.id %> --operation publish --environments dev,staging --locales en-us -k blt123',

    // Unpublish assets
    '<%= config.bin %> <%= command.id %> --operation unpublish --environments prod --locales en-us -a myAlias',

    // Publish assets from specific folder
    '<%= config.bin %> <%= command.id %> --operation publish --folder-uid cs_root --environments prod --locales en-us -k blt123',

    // Publish with bulk API
    '<%= config.bin %> <%= command.id %> --operation publish --environments prod --locales en-us --publish-mode bulk -k blt123',

    // Cross-publish assets (requires delivery token alias)
    '<%= config.bin %> <%= command.id %> --operation publish --source-env production --source-alias prod-delivery --environments staging,dev --locales en-us -a myAlias',

    // Retry failed assets from a log file
    '<%= config.bin %> <%= command.id %> --retry-failed ./bulk-operation -a myAlias',

    // Revert (unpublish) previously published assets using success log
    '<%= config.bin %> <%= command.id %> --revert ./bulk-operation -a myAlias',

    // Publish assets from exported content folder (e.g. after asset scanning clears)
    '<%= config.bin %> <%= command.id %> --data-dir ./content --operation publish -k blt123',
  ];

  static flags = {
    ...BaseBulkCommand.baseFlags,
    'folder-uid': flags.string({
      description: messages.FOLDER_UID,
    }),
    'data-dir': flags.string({
      char: 'd',
      description: messages.DATA_DIR_FLAG_DESC,
    }),
    'dry-run': flags.boolean({
      description: messages.DRY_RUN_FLAG_DESC,
      default: false,
    }),
  };

  protected resourceType: ResourceType = ResourceType.ASSET;

  protected async resolveFlagsInteractively(flags: any): Promise<any> {
    if (flags['data-dir']) {
      return flags;
    }
    return fillMissingFlags(flags, { promptDataDir: true });
  }

  async run(): Promise<void> {
    try {
      if (this.bulkOperationConfig.sourceEnv) {
        await this.handleCrossPublish(this.parsedFlags);
        return;
      }

      if (this.bulkOperationConfig.dataDir) {
        await this.runDataDirFlow();
        return;
      }

      const assets = await this.fetchItems();

      if (assets.length === 0) {
        this.logger.warn($t(messages.NO_ITEMS_FOUND, { resourceType: ResourceType.ASSET }));
        return;
      }

      const { clean, pending, quarantined, noStatus } = categorizeByScanStatus(assets);
      const scanningEnabled = clean.length + pending.length + quarantined.length > 0;
      const publishable = scanningEnabled ? clean : [...clean, ...noStatus];

      if (scanningEnabled) {
        // Log individual skipped assets
        pending.forEach((a) => this.logger.warn($t(messages.SCAN_STATUS_SKIPPED_PENDING, { uid: a.uid })));
        quarantined.forEach((a) => this.logger.warn($t(messages.SCAN_STATUS_SKIPPED_QUARANTINED, { uid: a.uid })));

        this.printScanningDashboard({
          total: assets.length,
          clean: clean.length,
          pending: pending.length,
          quarantined: quarantined.length,
        });

        if (publishable.length === 0) {
          this.logger.warn($t(messages.NO_PUBLISHABLE_ASSETS));
          return;
        }
      } else {
        log.info(
          $t(messages.FOUND_ASSETS_TO_OPERATE, { count: assets.length, operation: this.parsedFlags.operation || '' })
        );
      }

      const confirmed = await this.confirmOperation(publishable);
      if (!confirmed) {
        this.logger.warn($t(messages.OPERATION_CANCELLED));
        return;
      }

      const result = await this.executeBulkOperation(publishable);
      this.printOperationSummary(result);
    } catch (error) {
      handleAndLogError(error);
    } finally {
      await this.finally(undefined);
    }
  }

  private async runDataDirFlow(): Promise<void> {
    const { dataDir, dryRun } = this.bulkOperationConfig;

    // Capture original CLI locales/envs before pass 1 overwrites them on the config.
    const cliLocales = [...(this.bulkOperationConfig.locales || [])];
    const cliEnvs = [...(this.bulkOperationConfig.environments || [])];

    // Pass 1 — count-only scan: no AssetPublishData objects built, one chunk in memory at a time.
    let stats: DataDirScanStats;
    try {
      stats = await scanDataDirStats(dataDir!, cliEnvs, cliLocales, this.logger);
    } catch (err: any) {
      this.logger.error($t(messages.DATA_DIR_READ_ERROR, { path: dataDir!, error: err.message || String(err) }));
      return;
    }

    this.bulkOperationConfig.environments = stats.environments;
    this.bulkOperationConfig.locales = stats.locales;

    // Pass 1.5 — fetch scan status for all target UIDs (post-import UIDs on the destination stack).
    const targetUids = Object.values(stats.assetUidMapper);
    const assetService = new AssetService(this.managementStack, this.deliveryStack, this.logger);
    const scanStatusMap = await assetService.fetchScanStatusByUIDs(targetUids);

    let cleanCount = 0;
    let pendingCount = 0;
    let quarantinedCount = 0;
    for (const uid of targetUids) {
      const status = scanStatusMap.get(uid);
      if (status === 'pending') pendingCount++;
      else if (status === 'quarantined') quarantinedCount++;
      else cleanCount++; // clean or undefined (scanning disabled) — both are publishable
    }

    this.printScanningDashboard({
      total: stats.eligible + stats.skipped + stats.unmapped,
      localSkipped: stats.skipped,
      unmapped: stats.unmapped,
      clean: cleanCount,
      pending: pendingCount,
      quarantined: quarantinedCount,
    });

    if (cleanCount === 0) {
      this.logger.warn($t(messages.NO_PUBLISHABLE_ASSETS));
      return;
    }

    // new Array(n) has .length === n but allocates no elements — just for the count.
    const confirmed = await this.confirmOperation(new Array(cleanCount));
    if (!confirmed) {
      this.logger.warn($t(messages.OPERATION_CANCELLED));
      return;
    }

    if (dryRun) {
      log.info($t(messages.DATA_DIR_DRY_RUN));
      return;
    }

    // Pass 2 — stream and publish: one chunk at a time, batches of ≤50 items enqueued directly.
    // stats.assetUidMapper and stats.assetsIndex are reused from pass 1 — no second disk read.
    const result = await this.streamAndPublish(
      dataDir!,
      cliLocales,
      stats.totalItems,
      stats.assetUidMapper,
      stats.assetsIndex,
      scanStatusMap
    );
    this.printOperationSummary(result);
  }

  /**
   * Pass 2 of the data-dir flow.
   * Reads chunk files one at a time, fills a working batch of ≤50 AssetPublishData items,
   * and enqueues each batch directly into the queue manager without ever holding the full
   * asset list in memory. Peak memory: one chunk file + one batch of ≤50 items.
   *
   * assetUidMapper and assetsIndex are passed in from pass 1 to avoid re-reading those files.
   * scanStatusMap filters out non-clean assets before enqueueing.
   */
  private async streamAndPublish(
    dataDir: string,
    cliLocales: string[],
    totalItemCount: number,
    assetUidMapper: Record<string, string>,
    assetsIndex: Record<string, string>,
    scanStatusMap: Map<string, string | undefined>
  ): Promise<BulkOperationResult> {
    // Snapshot both arrays so in-flight mutations to bulkOperationConfig can't corrupt payloads.
    const environments = [...this.bulkOperationConfig.environments!];
    const locales = [...this.bulkOperationConfig.locales!];
    const operation = this.bulkOperationConfig.operation as OperationType;
    const startTime = Date.now();

    // Warn early if the mapper is empty — all assets will be skipped and the user needs to know why.
    if (Object.keys(assetUidMapper).length === 0) {
      this.logger.warn(
        'Asset UID mapper is empty — all assets will be skipped. Ensure the import completed successfully.'
      );
    }

    const useOverrideLocales = cliLocales.length > 0;
    const BATCH_SIZE = BATCH_CONSTANTS.maxItems;
    // totalItemCount comes from pass 1 using identical counting logic — used as upper bound for totalBatches.
    // Scan status filtering may reduce the actual count; the invariant check below will log any mismatch.
    const totalBatches = Math.ceil(totalItemCount / BATCH_SIZE);

    let workingBatch: AssetPublishData[] = [];
    let batchNumber = 0;
    let totalSubmitted = 0;

    this.batchResults.clear();

    const flushBatch = (): void => {
      if (workingBatch.length === 0) return;
      batchNumber++;
      this.queueManager.enqueue(ResourceType.ASSET, operation, {
        items: [...workingBatch],
        environments,
        locales,
        batchNumber,
        totalBatches,
        operation,
      });
      totalSubmitted += workingBatch.length;
      workingBatch = [];
    };

    for (const chunkFilename of Object.values(assetsIndex)) {
      const chunkPath = path.join(dataDir, 'assets', chunkFilename);
      const chunkData: Record<string, any> = JSON.parse(fs.readFileSync(chunkPath, 'utf-8'));

      for (const asset of Object.values(chunkData)) {
        if (!asset.publish_details || asset.publish_details.length === 0) continue;
        const targetUid = assetUidMapper[asset.uid as string];
        if (!targetUid) continue;

        // Skip assets that did not pass scanning.
        const scanStatus = scanStatusMap.get(targetUid);
        if (scanStatus === 'quarantined') {
          this.logger.warn($t(messages.SCAN_STATUS_SKIPPED_QUARANTINED, { uid: targetUid }));
          continue;
        }
        if (scanStatus === 'pending') {
          this.logger.warn($t(messages.SCAN_STATUS_SKIPPED_PENDING, { uid: targetUid }));
          continue;
        }

        const assetLocales: string[] = useOverrideLocales
          ? cliLocales
          : [...new Set<string>(asset.publish_details.map((pd: any) => pd.locale as string))];

        for (const locale of assetLocales) {
          workingBatch.push({ type: 'asset', uid: targetUid, locale, version: asset._version });
          if (workingBatch.length >= BATCH_SIZE) {
            flushBatch();
          }
        }
      }
      // chunkData falls out of scope here — GC can reclaim it before the next chunk is read.
    }

    flushBatch();

    // Invariant: pass 1 and pass 2 use identical counting logic (excluding scan status filtering).
    // If batchNumber < totalBatches, scan status filtering reduced the published count — expected.
    if (batchNumber !== totalBatches) {
      this.logger.debug(
        `Batch count: predicted ${totalBatches}, actual ${batchNumber}. Difference is expected when assets are skipped due to scan status.`
      );
    }

    await this.queueManager.waitForCompletion();

    const duration = Date.now() - startTime;
    const jobIds = [...this.batchResults.values()].map((r) => r.jobId).filter((id): id is string => !!id);

    return { success: 0, failed: 0, total: totalSubmitted, duration, jobIds };
  }

  private printScanningDashboard(opts: {
    total: number;
    clean: number;
    pending: number;
    quarantined: number;
    localSkipped?: number;
    unmapped?: number;
  }): void {
    const { total, clean, pending, quarantined, localSkipped, unmapped } = opts;
    const SEP = '─'.repeat(42);

    log.info('');
    log.info(`  ${messages.DATA_DIR_ASSET_SCANNING_HEADER}`);
    log.info('  ' + SEP);
    log.info(`  ${messages.DATA_DIR_TOTAL.padEnd(38)} ${total}`);
    if (localSkipped !== undefined) {
      log.warn(`  ${messages.DATA_DIR_NO_PUBLISH_DETAILS.padEnd(38)} ${localSkipped}`);
    }
    if (unmapped !== undefined) {
      log.warn(`  ${messages.DATA_DIR_UNMAPPED.padEnd(38)} ${unmapped}`);
    }
    log.info('  ' + SEP);
    log.info(`  ${messages.SCAN_STATUS_CLEAN.padEnd(38)} ${clean}`);
    if (pending > 0) log.warn(`  ${messages.SCAN_STATUS_PENDING.padEnd(38)} ${pending}`);
    if (quarantined > 0) log.warn(`  ${messages.SCAN_STATUS_QUARANTINED.padEnd(38)} ${quarantined}`);
    log.info('  ' + SEP);
    log.info(`  ${messages.DATA_DIR_WILL_PUBLISH.padEnd(38)} ${clean}`);
    log.info('');
  }

  protected async fetchItems(): Promise<any[]> {
    return await fetchAssets(this.bulkOperationConfig, this.managementStack, this.deliveryStack, this.logger);
  }
}
