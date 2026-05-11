import { resolve as pResolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { log, CLIProgressManager, configHandler, handleAndLogError } from '@contentstack/cli-utilities';

import type { AssetManagementExportOptions, AssetManagementAPIConfig } from '../types/asset-management-api';
import type { ExportContext } from '../types/export-types';
import { AM_MAIN_PROCESS_NAME, PROCESS_NAMES, getSpaceProcessName } from '../constants/index';
import ExportAssetTypes from './asset-types';
import ExportFields from './fields';
import ExportWorkspace from './workspaces';

/**
 * Orchestrates the full Asset Management 2.0 export: shared asset types and fields,
 * then per-workspace metadata and assets (including internal download).
 * Progress and download are fully owned by this package.
 */
export class ExportSpaces {
  private readonly options: AssetManagementExportOptions;
  private parentProgressManager: CLIProgressManager | null = null;
  private progressManager: CLIProgressManager | null = null;

  constructor(options: AssetManagementExportOptions) {
    this.options = options;
  }

  public setParentProgressManager(parent: CLIProgressManager): void {
    this.parentProgressManager = parent;
  }

  async start(): Promise<void> {
    const {
      linkedWorkspaces,
      exportDir,
      branchName,
      assetManagementUrl,
      org_uid,
      apiKey,
      context,
      securedAssets,
      chunkFileSizeMb,
    } = this.options;

    if (!linkedWorkspaces.length) {
      log.debug('No linked workspaces to export', context);
      return;
    }

    log.debug('Starting Asset Management export process...', context);
    log.info('Started Asset Management export', context);
    log.debug(`Exporting Asset Management 2.0 (${linkedWorkspaces.length} space(s))`, context);
    log.debug(`Spaces: ${linkedWorkspaces.map((ws) => ws.space_uid).join(', ')}`, context);

    const spacesRootPath = pResolve(exportDir, 'spaces');
    await mkdir(spacesRootPath, { recursive: true });
    log.debug(`Spaces root path: ${spacesRootPath}`, context);

    const progress = this.createProgress();
    // Multibar layout: two shared bootstrap rows + one row per space. Per-space
    // totals start at 1 and are bumped to (2 + downloadableCount) inside
    // ExportAssets.start once we know the asset count for that space.
    progress.addProcess(PROCESS_NAMES.AM_FIELDS, 1);
    progress.addProcess(PROCESS_NAMES.AM_ASSET_TYPES, 1);
    const spaceProcessNames = new Map<string, string>();
    for (const ws of linkedWorkspaces) {
      const spaceProcess = getSpaceProcessName(ws.space_uid);
      spaceProcessNames.set(ws.space_uid, spaceProcess);
      progress.addProcess(spaceProcess, 1);
    }

    const apiConfig: AssetManagementAPIConfig = {
      baseURL: assetManagementUrl,
      headers: { organization_uid: org_uid },
      context,
    };
    const exportContext: ExportContext = {
      spacesRootPath,
      context,
      securedAssets,
      chunkFileSizeMb,
      apiConcurrency: this.options.apiConcurrency,
      downloadAssetsConcurrency: this.options.downloadAssetsConcurrency,
    };

    const sharedFieldsDir = pResolve(spacesRootPath, 'fields');
    const sharedAssetTypesDir = pResolve(spacesRootPath, 'asset_types');
    await mkdir(sharedFieldsDir, { recursive: true });
    await mkdir(sharedAssetTypesDir, { recursive: true });

    const firstSpaceUid = linkedWorkspaces[0].space_uid;
    let bootstrapFailed = false;
    let anySpaceFailed = false;
    try {
      progress.startProcess(PROCESS_NAMES.AM_FIELDS);
      progress.startProcess(PROCESS_NAMES.AM_ASSET_TYPES);

      const exportAssetTypes = new ExportAssetTypes(apiConfig, exportContext);
      exportAssetTypes.setParentProgressManager(progress);
      const exportFields = new ExportFields(apiConfig, exportContext);
      exportFields.setParentProgressManager(progress);
      try {
        await Promise.all([exportAssetTypes.start(firstSpaceUid), exportFields.start(firstSpaceUid)]);
        progress.completeProcess(PROCESS_NAMES.AM_FIELDS, true);
        progress.completeProcess(PROCESS_NAMES.AM_ASSET_TYPES, true);
      } catch (bootstrapErr) {
        bootstrapFailed = true;
        progress.completeProcess(PROCESS_NAMES.AM_FIELDS, false);
        progress.completeProcess(PROCESS_NAMES.AM_ASSET_TYPES, false);
        throw bootstrapErr;
      }

      for (const ws of linkedWorkspaces) {
        const spaceProcess = spaceProcessNames.get(ws.space_uid)!;
        progress.startProcess(spaceProcess);
        log.debug(`Exporting space: ${ws.space_uid}`, context);
        const spaceDir = pResolve(spacesRootPath, ws.space_uid);
        try {
          const exportWorkspace = new ExportWorkspace(apiConfig, exportContext);
          exportWorkspace.setParentProgressManager(progress);
          await exportWorkspace.start(ws, spaceDir, branchName || 'main', spaceProcess);
          progress.completeProcess(spaceProcess, true);
          log.debug(`Exported workspace structure for space ${ws.space_uid}`, context);
        } catch (err) {
          // Per-space failure: mark the row failed and continue with the next
          // space so partial export results are preserved (matches import).
          anySpaceFailed = true;
          log.debug(`Failed to export workspace for space ${ws.space_uid}: ${err}`, context);
          handleAndLogError(
            err,
            { ...(context as Record<string, unknown>), spaceUid: ws.space_uid },
            `Failed to export space ${ws.space_uid}`,
          );
          progress.completeProcess(spaceProcess, false);
        }
      }

      log.info(
        anySpaceFailed
          ? 'Asset Management export completed with errors in one or more spaces'
          : 'Asset Management export completed successfully',
        context,
      );
      log.debug('Asset Management 2.0 export completed', context);
    } catch (err) {
      if (!bootstrapFailed) {
        // Mark any spaces that hadn't been processed as failed so the multibar
        // doesn't leave dangling pending rows.
        for (const [, spaceProcess] of spaceProcessNames) {
          progress.completeProcess(spaceProcess, false);
        }
      }
      handleAndLogError(err, { ...(context as Record<string, unknown>) }, 'Asset Management export failed');
      throw err;
    }
  }

  private createProgress(): CLIProgressManager {
    if (this.parentProgressManager) {
      this.progressManager = this.parentProgressManager;
      return this.parentProgressManager;
    }
    const logConfig = configHandler.get('log') || {};
    const showConsoleLogs = logConfig.showConsoleLogs ?? false;
    this.progressManager = CLIProgressManager.createNested(AM_MAIN_PROCESS_NAME, showConsoleLogs);
    return this.progressManager;
  }
}

/**
 * Entry point for callers that prefer a function. Delegates to ExportSpaces.
 */
export async function exportSpaceStructure(options: AssetManagementExportOptions): Promise<void> {
  await new ExportSpaces(options).start();
}
