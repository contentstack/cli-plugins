import * as fs from 'fs';
import * as path from 'path';

import { flags, handleAndLogError, log, FlagInput } from '@contentstack/cli-utilities';

import {
  AssetPublishData,
  BulkOperationResult,
  ResourceType,
  OperationType,
  CsAssetsFlags,
  PendingScanLogEntry,
} from '../../../interfaces';
import { BaseBulkCommand } from '../../../base-bulk-command';
import {
  $t,
  messages,
  fetchAssets,
  scanBackupDirStats,
  assetPublishTargets,
  TargetBatcher,
  categorizeByScanStatus,
  fillMissingCsAssetsFlags,
  promptForOperation,
  runCsAssetsOperation,
  enforceOperationFlagMatrix,
  getOperationFromArgv,
  OperationFlagMatrixError,
  RETRY_REVERT_CONTEXT,
} from '../../../utils';
import {
  appendPendingScanLog,
  getLogPaths,
  readPendingScanLog,
  writePendingScanLog,
} from '../../../utils/bulk-operation-log-handler';
import type { BackupDirScanStats } from '../../../utils';
import { AssetService } from '../../../services';

type RegionWithOptionalCsAssetsUrl = { csAssetsUrl?: string };

const ALL_OPERATION_CHOICES = [
  { name: 'Publish', value: OperationType.PUBLISH },
  { name: 'Unpublish', value: OperationType.UNPUBLISH },
  { name: 'Delete (CS Assets bulk delete)', value: OperationType.DELETE },
  { name: 'Move (CS Assets bulk move)', value: OperationType.MOVE },
];

/**
 * Bulk operations command for assets
 * Supports publish, unpublish, cross publish, and backup-dir publish operations (CMS),
 * plus delete and move operations (CS Assets).
 *
 * The two families use fully separate execution paths:
 * - publish/unpublish run through the BaseBulkCommand pipeline (stack setup,
 *   queue, rate limiter, retry) authenticated via stack API key or alias.
 * - delete/move run through the CS Assets runner (OAuth/Token against the
 *   region's csAssetsUrl) with no bulk-publish infrastructure at all.
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

    // Re-check scan status and publish assets a previous run skipped as still scanning
    '<%= config.bin %> <%= command.id %> --retry-pending ./bulk-operation -a myAlias',

    // Revert (unpublish) previously published assets using success log
    '<%= config.bin %> <%= command.id %> --revert ./bulk-operation -a myAlias',

    // Publish imported assets to their original environments (e.g. after asset scanning clears)
    '<%= config.bin %> <%= command.id %> --backup-dir ./content --operation publish -k blt123',

    // CS Assets bulk delete (asset UIDs from a JSON file `{ "uids": [...] }`)
    '<%= config.bin %> <%= command.id %> --operation delete --space-uid am123 --org-uid bltOrg --locale en-us --asset-uids-file ./assets.json',

    // CS Assets bulk move to a target folder
    '<%= config.bin %> <%= command.id %> --operation move --space-uid am123 --org-uid bltOrg --target-folder-uid amFolder --asset-uids-file ./assets.json',
  ];

  static flags: FlagInput = {
    ...BaseBulkCommand.baseFlags,
    operation: flags.string({
      description: messages.BULK_ASSETS_OPERATION,
      options: [OperationType.PUBLISH, OperationType.UNPUBLISH, OperationType.DELETE, OperationType.MOVE],
      required: false, // Not required if retry-failed or revert is used
    }),
    'folder-uid': flags.string({
      description: messages.FOLDER_UID,
    }),
    'backup-dir': flags.string({
      description: messages.BACKUP_DIR_FLAG_DESC,
      // Environments and locales are always derived per-asset from the backup.
      exclusive: ['source-env', 'folder-uid', 'environments', 'locales'],
    }),
    'dry-run': flags.boolean({
      description: messages.DRY_RUN_FLAG_DESC,
      default: false,
    }),
    'retry-pending': flags.string({
      description: messages.RETRY_PENDING,
    }),

    // CS Assets delete/move flags
    'space-uid': flags.string({
      description: messages.CS_ASSETS_SPACE_UID_FLAG,
    }),
    'org-uid': flags.string({
      description: messages.CS_ASSETS_ORG_UID_FLAG,
    }),
    workspace: flags.string({
      default: 'main',
      description: messages.CS_ASSETS_WORKSPACE_FLAG,
    }),
    'asset-uids-file': flags.string({
      description: messages.CS_ASSETS_ASSET_UIDS_FILE_FLAG,
    }),
    locale: flags.string({
      description: messages.CS_ASSETS_LOCALE_FLAG,
    }),
    'target-folder-uid': flags.string({
      description: messages.CS_ASSETS_TARGET_FOLDER_FLAG,
    }),
  };

  protected resourceType: ResourceType = ResourceType.ASSET;

  /** True when the resolved operation is a CS Assets one (delete/move). */
  private csAssetsMode = false;
  private csAssetsFlags!: CsAssetsFlags;

  protected shouldSkipBulkPipeline(): boolean {
    return this.csAssetsMode;
  }

  protected async init(): Promise<void> {
    // Resolve the operation from raw argv BEFORE any pipeline work: the two
    // operation families use disjoint flags and auth, so the pipeline choice
    // (and flag validation) depends on it. Raw argv is also what lets us reject
    // explicitly-passed CMS flags that carry defaults (--branch, --publish-mode).
    let operation = getOperationFromArgv(this.argv);
    const isRevertOrRetry = this.argv.some(
      (token) =>
        token === '--retry-failed' ||
        token.startsWith('--retry-failed=') ||
        token === '--revert' ||
        token.startsWith('--revert=') ||
        token === '--retry-pending' ||
        token.startsWith('--retry-pending=')
    );

    if (!operation && !isRevertOrRetry) {
      if (!process.stdin.isTTY) {
        throw new Error(
          'Missing required flag: --operation. Provide it when running in a non-interactive environment.'
        );
      }
      operation = await promptForOperation(ALL_OPERATION_CHOICES);
      // Feed the answer back into argv so both pipelines parse it like any other flag
      this.argv.push('--operation', operation);
    }

    enforceOperationFlagMatrix(operation ?? RETRY_REVERT_CONTEXT, this.argv, { module: this.id });

    this.csAssetsMode = operation === OperationType.DELETE || operation === OperationType.MOVE;

    // For delete/move, shouldSkipBulkPipeline() makes super.init() stop right after
    // the framework-level Command init — no stack setup, queue, or rate limiter.
    await super.init();

    if (this.csAssetsMode) {
      const { flags: parsed } = await this.parse(this.constructor as typeof BulkAssets);
      this.loggerContext = { module: this.id ?? 'cm:stacks:bulk-assets' };
      this.csAssetsFlags = (await fillMissingCsAssetsFlags(parsed)) as CsAssetsFlags;
      this.parsedFlags = this.csAssetsFlags;
    }
  }

  async catch(error: Error): Promise<void> {
    // Matrix violations are already logged (with exitCode set) by
    // enforceOperationFlagMatrix — the throw only aborts init().
    if (error instanceof OperationFlagMatrixError) {
      return;
    }
    return super.catch(error);
  }

  async run(): Promise<void> {
    if (this.csAssetsMode) {
      await runCsAssetsOperation({
        flags: this.csAssetsFlags,
        csAssetsBaseUrl: (this.region as RegionWithOptionalCsAssetsUrl).csAssetsUrl,
        commandId: this.context?.info?.command || this.id || 'cm:stacks:bulk-assets',
        loggerContext: this.loggerContext,
      });
      return;
    }

    try {
      if (this.bulkOperationConfig.sourceEnv) {
        await this.handleCrossPublish(this.parsedFlags);
        return;
      }

      if (this.bulkOperationConfig.backupDir) {
        await this.runBackupDirFlow();
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

        // Persist the pending ones so --retry-pending can publish them once the scan clears.
        // fetchAssets() builds one row per uid x locale, so each carries its own locale/version.
        appendPendingScanLog(
          pending.map((a) =>
            this.buildPendingScanEntry({
              uid: a.uid,
              locale: a.locale,
              version: a.version ?? a._version,
              environments: (a.publish_details || []).map((pd: any) => pd.environment),
            })
          ),
          this.bulkOperationConfig.bulkOperationFolder
        );

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

  private async runBackupDirFlow(): Promise<void> {
    const { backupDir, dryRun } = this.bulkOperationConfig;

    // Pass 1 — count-only scan: no AssetPublishData objects built, one chunk in memory at a time.
    let stats: BackupDirScanStats;
    try {
      stats = await scanBackupDirStats(backupDir!, this.logger);
    } catch (err: any) {
      this.logger.error($t(messages.BACKUP_DIR_READ_ERROR, { path: backupDir!, error: err.message || String(err) }));
      return;
    }

    // Unions for the dashboard and confirmation prompt only — pass 2 derives each asset's own targets.
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
      log.info($t(messages.BACKUP_DIR_DRY_RUN));
      return;
    }

    // Pass 2 — stream and publish: one chunk at a time, batches of ≤50 items enqueued directly.
    // stats.assetUidMapper and stats.assetsIndex are reused from pass 1 — no second disk read.
    const result = await this.streamAndPublish(backupDir!, stats, scanStatusMap);
    this.printOperationSummary(result);
  }

  /**
   * Pass 2 of the backup-dir flow.
   * Reads chunk files one at a time, feeding each asset's own publish targets into a
   * TargetBatcher that enqueues batches directly, without ever holding the full asset list in
   * memory. Peak memory: one chunk file + one open bucket per distinct (locale, environment set).
   *
   * assetUidMapper and assetsIndex are passed in from pass 1 to avoid re-reading those files.
   * scanStatusMap filters out non-clean assets before enqueueing.
   */
  private async streamAndPublish(
    backupDir: string,
    stats: BackupDirScanStats,
    scanStatusMap: Map<string, string | undefined>
  ): Promise<BulkOperationResult> {
    const { assetUidMapper, assetsIndex, environmentsMap, totalBatches } = stats;
    const operation = this.bulkOperationConfig.operation as OperationType;
    const startTime = Date.now();

    // Warn early if the mapper is empty — all assets will be skipped and the user needs to know why.
    if (Object.keys(assetUidMapper).length === 0) {
      this.logger.warn(
        'Asset UID mapper is empty — all assets will be skipped. Ensure the import completed successfully.'
      );
    }

    let totalSubmitted = 0;
    // Collected across the whole stream and written once at the end — a per-asset
    // write would defeat the one-chunk-at-a-time design of this pass.
    const pendingScanEntries: PendingScanLogEntry[] = [];

    this.batchResults.clear();

    // Batches are keyed on their publish target, so each asset reaches only its own
    // environments and locales.
    const batcher = new TargetBatcher((batch) => {
      this.queueManager.enqueue(ResourceType.ASSET, operation, {
        items: batch.items,
        environments: batch.environments,
        locales: batch.locales,
        batchNumber: batch.batchNumber,
        totalBatches,
        operation,
      });
      totalSubmitted += batch.items.length;
    });

    for (const chunkFilename of Object.values(assetsIndex)) {
      const chunkPath = path.join(backupDir, 'assets', chunkFilename);
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

        const targets = assetPublishTargets(asset, environmentsMap);

        if (scanStatus === 'pending') {
          this.logger.warn($t(messages.SCAN_STATUS_SKIPPED_PENDING, { uid: targetUid }));
          // Record per target so --retry-pending republishes exactly the rows this run would have.
          for (const [locale, environments] of targets) {
            pendingScanEntries.push(
              this.buildPendingScanEntry({ uid: targetUid, locale, version: asset._version, environments })
            );
          }
          continue;
        }

        for (const [locale, environments] of targets) {
          batcher.add({
            type: 'asset',
            uid: targetUid,
            locale,
            version: asset._version,
            publish_details: environments.map((environment) => ({ environment, locale })),
          });
        }
      }
      // chunkData falls out of scope here — GC can reclaim it before the next chunk is read.
    }

    batcher.end();

    // One write for the whole streamed run.
    appendPendingScanLog(pendingScanEntries, this.bulkOperationConfig.bulkOperationFolder);

    if (batcher.skippedCount > 0) {
      this.logger.warn(`Skipped ${batcher.skippedCount} asset item(s) with no resolvable publish target.`);
    }

    // Invariant: pass 1 and pass 2 use identical target logic (excluding scan status filtering).
    // If fewer batches were emitted, scan status filtering reduced the published count — expected.
    if (batcher.emittedCount !== totalBatches) {
      this.logger.debug(
        `Batch count: predicted ${totalBatches}, actual ${batcher.emittedCount}. Difference is expected when assets are skipped due to scan status.`
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
    log.info(`  ${messages.BACKUP_DIR_ASSET_SCANNING_HEADER}`);
    log.info('  ' + SEP);
    log.info(`  ${messages.BACKUP_DIR_TOTAL.padEnd(38)} ${total}`);
    if (localSkipped !== undefined) {
      log.warn(`  ${messages.BACKUP_DIR_NO_PUBLISH_DETAILS.padEnd(38)} ${localSkipped}`);
    }
    if (unmapped !== undefined) {
      log.warn(`  ${messages.BACKUP_DIR_UNMAPPED.padEnd(38)} ${unmapped}`);
    }
    log.info('  ' + SEP);
    log.info(`  ${messages.SCAN_STATUS_CLEAN.padEnd(38)} ${clean}`);
    if (pending > 0) log.warn(`  ${messages.SCAN_STATUS_PENDING.padEnd(38)} ${pending}`);
    if (quarantined > 0) log.warn(`  ${messages.SCAN_STATUS_QUARANTINED.padEnd(38)} ${quarantined}`);
    log.info('  ' + SEP);
    log.info(`  ${messages.BACKUP_DIR_WILL_PUBLISH.padEnd(38)} ${clean}`);
    log.info('');
  }

  protected async fetchItems(): Promise<any[]> {
    return await fetchAssets(this.bulkOperationConfig, this.managementStack, this.deliveryStack, this.logger);
  }

  protected async handleResourceSpecificRetryFlow(flags: any): Promise<boolean> {
    if (!flags['retry-pending']) {
      return false;
    }
    await this.initForRetryPendingScan(flags);
    return true;
  }

  /**
   * Initialize the --retry-pending run. Mirrors initForRevertOrRetry: everything
   * needed comes from the pending-scan log, with any CLI flag overriding it.
   */
  private async initForRetryPendingScan(flags: any): Promise<void> {
    const logPath = flags['retry-pending'];
    const pendingEntries = readPendingScanLog(logPath);

    if (pendingEntries.length === 0) {
      log.warn($t(messages.NO_PENDING_SCAN_ITEMS_IN_LOG, { path: getLogPaths(logPath).pendingScan }));
      this.finalizeProgressSummary();
      process.exit(0);
    }

    const [first] = pendingEntries;
    const mergedFlags = {
      ...flags,
      'stack-api-key': flags['stack-api-key'] || first.apiKey,
      environments:
        flags.environments?.length > 0
          ? flags.environments
          : [...new Set(pendingEntries.flatMap((entry) => entry.environments))],
      locales: flags.locales?.length > 0 ? flags.locales : [...new Set(pendingEntries.map((entry) => entry.locale))],
      branch: flags.branch !== 'main' ? flags.branch : first.branch || 'main',
      // Scan status only ever gates publish.
      operation: OperationType.PUBLISH,
      'publish-mode': flags['publish-mode'] || 'bulk',
    };

    this.parsedFlags = mergedFlags;
    await this.buildConfiguration(mergedFlags);
    await this.setupStack();
    await this.initializeComponents();

    await this.retryPendingScan(logPath, pendingEntries);

    // Mirrors initForRevertOrRetry: this early exit bypasses finally().
    this.finalizeProgressSummary();
    process.exit(0);
  }

  /**
   * Stamp a pending-scan skip with the run metadata --retry-pending needs to
   * rebuild the publish call later without re-fetching the asset.
   */
  private buildPendingScanEntry(item: {
    uid: string;
    locale: string;
    version?: number;
    environments: string[];
  }): PendingScanLogEntry {
    return {
      ...item,
      operation: 'publish',
      timestamp: new Date().toISOString(),
      apiKey: this.bulkOperationConfig.apiKey || this.bulkOperationConfig.stackApiKey || '',
      branch: this.bulkOperationConfig.branch,
    };
  }

  /**
   * Re-check the scan status of assets a previous run skipped as still scanning,
   * publish the ones now clean, and prune the log down to those still pending.
   */
  private async retryPendingScan(logPath: string, pendingEntries: PendingScanLogEntry[]): Promise<void> {
    const uids = [...new Set(pendingEntries.map((entry) => entry.uid))];
    const assetService = new AssetService(this.managementStack, this.deliveryStack, this.logger);
    const scanStatusMap = await assetService.fetchScanStatusByUIDs(uids);

    const nowClean: PendingScanLogEntry[] = [];
    const stillPending: PendingScanLogEntry[] = [];
    const nowQuarantined: PendingScanLogEntry[] = [];

    for (const entry of pendingEntries) {
      const status = scanStatusMap.get(entry.uid);
      if (status === 'pending') stillPending.push(entry);
      else if (status === 'quarantined') nowQuarantined.push(entry);
      else nowClean.push(entry); // clean, or undefined when scanning is disabled
    }

    log.info(
      $t(messages.SCAN_RECHECK_SUMMARY, {
        total: pendingEntries.length,
        clean: nowClean.length,
        pending: stillPending.length,
        quarantined: nowQuarantined.length,
      })
    );
    nowQuarantined.forEach((entry) =>
      this.logger.warn($t(messages.SCAN_STATUS_SKIPPED_QUARANTINED, { uid: entry.uid }))
    );

    if (nowClean.length === 0) {
      this.logger.warn($t(messages.NO_PUBLISHABLE_ASSETS));
      // Still prune: the quarantined ones will never become publishable.
      writePendingScanLog(stillPending, logPath);
      return;
    }

    const items: AssetPublishData[] = nowClean.map((entry) => ({
      type: 'asset',
      uid: entry.uid,
      locale: entry.locale,
      version: entry.version,
      publish_details: entry.environments.map((environment) => ({ environment, locale: entry.locale })),
    }));

    const confirmed = await this.confirmOperation(items);
    if (!confirmed) {
      this.logger.warn($t(messages.OPERATION_CANCELLED));
      // Leave the log untouched so the next run sees the same set.
      return;
    }

    const result = await this.executeBulkOperation(items);
    this.printOperationSummary(result);

    writePendingScanLog(stillPending, logPath);
  }
}
