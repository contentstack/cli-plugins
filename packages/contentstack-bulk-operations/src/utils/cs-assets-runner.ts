import * as fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { log, createLogContext, cliux, handleAndLogError, authenticationHandler } from '@contentstack/cli-utilities';

import messages, { $t } from '../messages';
import { CsAssetsService } from '../services';
import { loadAssetUidsFromFile, loadBulkDeleteItemsFromFile, LoadAssetUidsError } from './asset-uids-from-file';
import { generateCsAssetsJobStatusUrl } from './bulk-publish-url-generator';
import { ensureLogFolder } from './bulk-operation-log-handler';
import { CsAssetsFlags, CsAssetsBulkOperationResult, OperationType } from '../interfaces';

/**
 * Execution path for CS Assets bulk delete/move — deliberately independent of the
 * BaseBulkCommand pipeline. CS Assets operations use a different API surface with
 * no stack setup, queue managers, or rate limiters, and authenticate via OAuth/Token
 * against the region's csAssetsUrl.
 */

interface CsAssetsRunnerOptions {
  flags: CsAssetsFlags;
  csAssetsBaseUrl: string | undefined;
  commandId: string;
  loggerContext: { module: string };
}

/** Per-operation execution plan; the shared flow below drives it. */
interface CsAssetsOperationPlan {
  summaryLines: string[];
  logStart: () => void;
  execute: (service: CsAssetsService) => Promise<CsAssetsBulkOperationResult>;
  failureFallback: string;
  successOpts: (result: CsAssetsBulkOperationResult) => Parameters<typeof printCsAssetsSummary>[1];
}

interface CsAssetsSummaryOpts {
  jobId?: string;
  jobIds?: string[];
  count?: number;
  folderUid?: string;
  notice?: string;
  error?: string;
  spaceUid?: string;
  batchesTotal?: number;
  batchesSucceeded?: number;
}

function printCsAssetsSummary(
  op: 'delete' | 'move',
  opts: CsAssetsSummaryOpts,
  loggerContext: { module: string }
): void {
  if (opts.error) {
    log.error($t(messages.CS_ASSETS_OPERATION_FAILED, { operation: op }), loggerContext);
    log.error(opts.error, loggerContext);
    return;
  }

  if (op === 'delete') {
    const jobIds = opts.jobIds?.length ? opts.jobIds : opts.jobId ? [opts.jobId] : [];
    log.success($t(messages.CS_ASSETS_DELETE_SUCCESS), loggerContext);
    // Delete is async: a submitted job is not a completed deletion. Say so, and point at the status URL.
    log.info($t(messages.CS_ASSETS_DELETE_JOBS_SUBMITTED, { count: jobIds.length }), loggerContext);
    for (const jobId of jobIds) {
      log.info($t(messages.CS_ASSETS_DELETE_JOB_ID, { jobId }), loggerContext);
    }
  } else {
    log.success($t(messages.CS_ASSETS_MOVE_SUCCESS), loggerContext);
    if (opts.count !== undefined && opts.folderUid) {
      log.info(
        $t(messages.CS_ASSETS_MOVE_ASSETS_COUNT, { count: opts.count, folderUid: opts.folderUid }),
        loggerContext
      );
    }
  }

  const batchesTotal = opts.batchesTotal ?? 0;
  if (batchesTotal > 1) {
    log.info(
      $t(messages.CS_ASSETS_BATCH_SUMMARY, {
        batchesTotal,
        batchesSucceeded: opts.batchesSucceeded ?? batchesTotal,
      }),
      loggerContext
    );
  }

  const statusUrl = generateCsAssetsJobStatusUrl(opts.spaceUid);
  if (statusUrl) log.info(statusUrl, loggerContext);
  if (opts.notice) log.info(opts.notice, loggerContext);
}

/**
 * Writes the uids from all failed batches to a `{ "uids": [...] }` file (deduped) so the
 * user can re-run just the failures via `--asset-uids-file`. Returns the path, or undefined
 * if there were no failed uids or the write failed.
 */
function writeFailedUidsFile(
  op: 'delete' | 'move',
  result: CsAssetsBulkOperationResult,
  loggerContext: { module: string }
): string | undefined {
  const uids = [...new Set((result.failures ?? []).flatMap((f) => f.uids))];
  if (uids.length === 0) return undefined;

  const fileName = `cs-assets-${op}-failed-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  try {
    // Co-locate with the other bulk-operation logs rather than polluting cwd.
    const filePath = path.join(ensureLogFolder(), fileName);
    fs.writeFileSync(filePath, JSON.stringify({ uids }), 'utf8');
    return filePath;
  } catch (e) {
    log.warn(`Could not write failed-uids file: ${e instanceof Error ? e.message : String(e)}`, loggerContext);
    return undefined;
  }
}

/**
 * True if at least one ≤100-item batch was accepted by the server, so there is a real
 * (full or partial) outcome to report. When the operation ran, `batchesSucceeded` reflects it.
 * A total transport failure before any batch leaves `batchesSucceeded` undefined and `success`
 * false → falls through to false, and the caller reports it as a full failure.
 */
function didAnyBatchCommit(result: CsAssetsBulkOperationResult): boolean {
  if (result.batchesSucceeded !== undefined) return result.batchesSucceeded > 0;
  return result.success;
}

/** Warns about failed batches after a partial success (some batches committed, some did not). */
function printCsAssetsPartialFailure(
  op: 'delete' | 'move',
  result: CsAssetsBulkOperationResult,
  loggerContext: { module: string }
): void {
  log.warn(
    $t(messages.CS_ASSETS_PARTIAL_FAILURE, {
      operation: op,
      batchesFailed: result.batchesFailed ?? result.failures?.length ?? 0,
      batchesTotal: result.batchesTotal ?? 0,
    }),
    loggerContext
  );
  for (const f of result.failures ?? []) {
    log.error(
      $t(messages.CS_ASSETS_FAILED_BATCH, { batchIndex: f.batchIndex, count: f.count, error: f.error }),
      loggerContext
    );
  }

  const failedFile = writeFailedUidsFile(op, result, loggerContext);
  if (failedFile) {
    log.info($t(messages.CS_ASSETS_FAILED_UIDS_WRITTEN, { operation: op, path: failedFile }), loggerContext);
    log.info($t(messages.CS_ASSETS_RETRY_HINT, { operation: op, path: failedFile }), loggerContext);
  }
}

function handleAssetUidsFileError(e: LoadAssetUidsError, loggerContext: { module: string }): void {
  const pathShown = e.filePath;
  if (e.kind === 'READ') {
    log.error(
      $t(messages.CS_ASSETS_ASSET_UIDS_FILE_READ_FAILED, { path: pathShown, detail: e.message }),
      loggerContext
    );
  } else {
    log.error($t(messages.CS_ASSETS_ASSET_UIDS_FILE_INVALID, { path: pathShown, detail: e.message }), loggerContext);
  }
  process.exitCode = 1;
}

/**
 * Loads rows from the asset UIDs file, reporting errors and setting the exit code.
 * Returns undefined when loading failed.
 */
function tryLoadFromFile<T>(loader: () => T, loggerContext: { module: string }): T | undefined {
  try {
    return loader();
  } catch (e: unknown) {
    if (e instanceof LoadAssetUidsError) {
      handleAssetUidsFileError(e, loggerContext);
    } else {
      handleAndLogError(e as Error);
      process.exitCode = 1;
    }
    return undefined;
  }
}

/**
 * Pre-flight auth check: CS Assets operations require an OAuth session or auth token.
 * Fails before any confirmation prompt so users don't confirm a destructive operation
 * that would only fail at the API call.
 */
async function ensureCsAssetsAuth(operation: string, loggerContext: { module: string }): Promise<boolean> {
  try {
    await authenticationHandler.getAuthDetails();
    if (!authenticationHandler.accessToken) {
      log.error($t(messages.CS_ASSETS_AUTH_REQUIRED, { operation }), loggerContext);
      process.exitCode = 1;
      return false;
    }
    return true;
  } catch (error) {
    log.error($t(messages.CS_ASSETS_AUTH_REQUIRED, { operation }), loggerContext);
    handleAndLogError(error as Error);
    process.exitCode = 1;
    return false;
  }
}

/** Prints the operation summary and asks for confirmation (skipped with --yes). */
async function confirmProceed(
  summaryLines: string[],
  yes: boolean,
  loggerContext: { module: string }
): Promise<boolean> {
  if (yes) return true;

  console.log(chalk.yellow(`\n${$t(messages.OPERATION_CONFIG_HEADER)}\n`));
  for (const line of summaryLines) {
    console.log(`   ${line}`);
  }
  console.log('');

  const confirmed: boolean = await cliux.inquire({
    type: 'confirm',
    name: 'proceed',
    message: chalk.grey($t(messages.CONTINUE_WITH_CONFIG)),
    default: false,
  });
  if (!confirmed) {
    log.warn($t(messages.OPERATION_CANCELLED), loggerContext);
  }
  return confirmed;
}

/**
 * Runs a CS Assets bulk delete or move. Flags are expected to be pre-validated
 * (operation flag matrix) and pre-filled (fillMissingCsAssetsFlags).
 */
export async function runCsAssetsOperation(options: CsAssetsRunnerOptions): Promise<void> {
  const { flags: f, csAssetsBaseUrl: rawBaseUrl, commandId, loggerContext } = options;

  try {
    const csAssetsBaseUrl = rawBaseUrl?.trim();
    if (!csAssetsBaseUrl) {
      log.error($t(messages.CS_ASSETS_URL_NOT_CONFIGURED), loggerContext);
      process.exitCode = 1;
      return;
    }

    const op = f.operation;
    if (op !== OperationType.DELETE && op !== OperationType.MOVE) {
      log.error($t(messages.CS_ASSETS_INVALID_OPERATION, { operation: String(op ?? '') }), loggerContext);
      process.exitCode = 1;
      return;
    }

    if (!(await ensureCsAssetsAuth(op, loggerContext))) {
      return;
    }

    const spaceUid = f['space-uid'].trim();
    const orgUid = f['org-uid'].trim();
    const assetUidsPath = f['asset-uids-file'].trim();
    const workspace = f.workspace ?? 'main';

    const commonSummaryLines = [`Space UID: ${spaceUid}`, `Organization UID: ${orgUid}`, `Workspace: ${workspace}`];

    let plan: CsAssetsOperationPlan;

    if (op === OperationType.DELETE) {
      const locale = (f.locale ?? '').trim();
      if (!locale) {
        log.error($t(messages.CS_ASSETS_LOCALE_REQUIRED), loggerContext);
        process.exitCode = 1;
        return;
      }

      const deleteRows = tryLoadFromFile(() => loadBulkDeleteItemsFromFile(assetUidsPath, locale), loggerContext);
      if (!deleteRows) return;

      plan = {
        summaryLines: [
          'Operation: CS Assets bulk delete',
          ...commonSummaryLines,
          `Locale: ${locale}`,
          `Asset UIDs file: ${assetUidsPath}`,
          `Total CS Assets delete entries: ${deleteRows.length}`,
        ],
        logStart: () =>
          log.info($t(messages.CS_ASSETS_DELETING_ASSETS, { count: deleteRows.length, spaceUid }), loggerContext),
        execute: (service) => service.bulkDelete(spaceUid, workspace, deleteRows),
        failureFallback: 'CS Assets bulk delete failed',
        successOpts: (result) => ({
          jobId: result.jobId,
          jobIds: result.jobIds,
          notice: result.notice,
          spaceUid,
          batchesTotal: result.batchesTotal,
          batchesSucceeded: result.batchesSucceeded,
        }),
      };
    } else {
      if (f.locale) {
        log.error($t(messages.CS_ASSETS_LOCALE_NOT_ALLOWED_FOR_MOVE), loggerContext);
        process.exitCode = 1;
        return;
      }

      const moveFolderUid = (f['target-folder-uid'] ?? '').trim();
      if (!moveFolderUid) {
        log.error($t(messages.TARGET_FOLDER_REQUIRED), loggerContext);
        process.exitCode = 1;
        return;
      }

      const uids = tryLoadFromFile(() => loadAssetUidsFromFile(assetUidsPath), loggerContext);
      if (!uids) return;

      plan = {
        summaryLines: [
          'Operation: CS Assets bulk move',
          ...commonSummaryLines,
          `Target folder UID: ${moveFolderUid}`,
          `Asset UIDs file: ${assetUidsPath}`,
          `Assets: ${uids.length}`,
        ],
        logStart: () =>
          log.info(
            $t(messages.CS_ASSETS_MOVING_ASSETS, { count: uids.length, targetFolderUid: moveFolderUid }),
            loggerContext
          ),
        execute: (service) => service.bulkMove(spaceUid, workspace, uids, moveFolderUid),
        failureFallback: 'CS Assets bulk move failed',
        successOpts: (result) => ({
          count: uids.length,
          folderUid: moveFolderUid,
          notice: result.notice,
          spaceUid,
          batchesTotal: result.batchesTotal,
          batchesSucceeded: result.batchesSucceeded,
        }),
      };
    }

    createLogContext(commandId, spaceUid, 'OAuth/Token');
    const csAssetsService = new CsAssetsService(csAssetsBaseUrl, spaceUid, orgUid);

    if (!(await confirmProceed(plan.summaryLines, f.yes, loggerContext))) {
      return;
    }

    plan.logStart();
    const result = await plan.execute(csAssetsService);

    if (!didAnyBatchCommit(result)) {
      printCsAssetsSummary(op, { error: result.error ?? plan.failureFallback, spaceUid }, loggerContext);
      process.exitCode = 1;
      return;
    }

    // Full or partial success: report what committed, then flag any failed batches.
    printCsAssetsSummary(op, plan.successOpts(result), loggerContext);
    if (!result.success) {
      printCsAssetsPartialFailure(op, result, loggerContext);
      process.exitCode = 1;
    }
  } catch (error) {
    handleAndLogError(error as Error);
  }
}
