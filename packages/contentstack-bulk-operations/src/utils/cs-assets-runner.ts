import chalk from 'chalk';
import { log, createLogContext, cliux, handleAndLogError, authenticationHandler } from '@contentstack/cli-utilities';

import messages, { $t } from '../messages';
import { CsAssetsService } from '../services';
import { loadAssetUidsFromFile, loadBulkDeleteItemsFromFile, LoadAssetUidsError } from './asset-uids-from-file';
import { generateCsAssetsJobStatusUrl } from './bulk-publish-url-generator';
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

function printCsAssetsSummary(
  op: 'delete' | 'move',
  opts: { jobId?: string; count?: number; folderUid?: string; notice?: string; error?: string; spaceUid?: string },
  loggerContext: { module: string }
): void {
  if (opts.error) {
    log.error($t(messages.CS_ASSETS_OPERATION_FAILED, { operation: op }), loggerContext);
    log.error(opts.error, loggerContext);
  } else if (op === 'delete') {
    log.success($t(messages.CS_ASSETS_DELETE_SUCCESS), loggerContext);
    if (opts.jobId) log.info($t(messages.CS_ASSETS_DELETE_JOB_ID, { jobId: opts.jobId }), loggerContext);
    log.info($t(messages.CS_ASSETS_DELETE_ASYNC_NOTE), loggerContext);
    const statusUrl = generateCsAssetsJobStatusUrl(opts.spaceUid);
    if (statusUrl) log.info(statusUrl, loggerContext);
  } else {
    log.success($t(messages.CS_ASSETS_MOVE_SUCCESS), loggerContext);
    if (opts.count !== undefined && opts.folderUid) {
      log.info(
        $t(messages.CS_ASSETS_MOVE_ASSETS_COUNT, { count: opts.count, folderUid: opts.folderUid }),
        loggerContext
      );
    }
    const statusUrl = generateCsAssetsJobStatusUrl(opts.spaceUid);
    if (statusUrl) log.info(statusUrl, loggerContext);
  }
  if (opts.notice) log.info(opts.notice, loggerContext);
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
        successOpts: (result) => ({ jobId: result.jobId, notice: result.notice, spaceUid }),
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
        successOpts: (result) => ({ count: uids.length, folderUid: moveFolderUid, notice: result.notice, spaceUid }),
      };
    }

    createLogContext(commandId, spaceUid, 'OAuth/Token');
    const csAssetsService = new CsAssetsService(csAssetsBaseUrl, spaceUid, orgUid);

    if (!(await confirmProceed(plan.summaryLines, f.yes, loggerContext))) {
      return;
    }

    plan.logStart();
    const result = await plan.execute(csAssetsService);
    if (!result.success) {
      printCsAssetsSummary(op, { error: result.error ?? plan.failureFallback, spaceUid }, loggerContext);
      process.exitCode = 1;
      return;
    }
    printCsAssetsSummary(op, plan.successOpts(result), loggerContext);
  } catch (error) {
    handleAndLogError(error as Error);
  }
}
