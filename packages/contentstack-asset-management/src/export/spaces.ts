import { resolve as pResolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { log, CLIProgressManager, handleAndLogError } from '@contentstack/cli-utilities';

import type { AssetManagementExportOptions, CSAssetsAPIConfig } from '../types/cs-assets-api';
import type { ExportContext } from '../types/export-types';
import { CS_ASSETS_MAIN_PROCESS_NAME, PROCESS_NAMES, getSpaceProcessName } from '../constants/index';
import ExportAssetTypes from './asset-types';
import ExportFields from './fields';
import ExportWorkspace from './workspaces';

/**
 * Real entity counts for the export summary (Bug 3 — "everything under ASSETS"):
 * assets = downloaded binaries, folders = folder entities, plus shared asset_types and fields.
 */
export type AssetExportCounts = {
  assets: number;
  folders: number;
  assetTypes: number;
  fields: number;
  /** Assets missing from the export: permanently failed metadata pages + failed binary downloads. */
  failedAssets: number;
};

/**
 * Orchestrates the full Contentstack Assets export: shared asset types and fields,
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

  async start(): Promise<AssetExportCounts> {
    const {
      linkedWorkspaces,
      exportDir,
      branchName,
      csAssetsUrl,
      org_uid,
      apiKey,
      context,
      securedAssets,
      chunkFileSizeMb,
    } = this.options;

    if (!linkedWorkspaces.length) {
      log.debug('No linked workspaces to export', context);
      return { assets: 0, folders: 0, assetTypes: 0, fields: 0, failedAssets: 0 };
    }

    log.debug('Starting Contentstack Assets export process...', context);
    log.info('Started Contentstack Assets export', context);
    log.debug(`Exporting Contentstack Assets (${linkedWorkspaces.length} space(s))`, context);
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

    const apiConfig: CSAssetsAPIConfig = {
      baseURL: csAssetsUrl,
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
      pageSize: this.options.pageSize,
      fetchConcurrency: this.options.fetchConcurrency,
    };

    const sharedFieldsDir = pResolve(spacesRootPath, 'fields');
    const sharedAssetTypesDir = pResolve(spacesRootPath, 'asset_types');
    await mkdir(sharedFieldsDir, { recursive: true });
    await mkdir(sharedAssetTypesDir, { recursive: true });

    const firstSpaceUid = linkedWorkspaces[0].space_uid;
    let bootstrapFailed = false;
    let anySpaceFailed = false;
    // Real entity counts accumulated for the summary (Bug 3).
    let assetsTotal = 0;
    let foldersTotal = 0;
    let failedAssetsTotal = 0;
    let assetTypesCount = 0;
    let fieldsCount = 0;
    try {
      progress.startProcess(PROCESS_NAMES.AM_FIELDS);
      progress.startProcess(PROCESS_NAMES.AM_ASSET_TYPES);

      const exportAssetTypes = new ExportAssetTypes(apiConfig, exportContext);
      exportAssetTypes.setParentProgressManager(progress);
      const exportFields = new ExportFields(apiConfig, exportContext);
      exportFields.setParentProgressManager(progress);
      try {
        [assetTypesCount, fieldsCount] = await Promise.all([
          exportAssetTypes.start(firstSpaceUid),
          exportFields.start(firstSpaceUid),
        ]);
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
          const spaceCounts = await exportWorkspace.start(ws, spaceDir, branchName || 'main', spaceProcess);
          assetsTotal += spaceCounts.assets;
          foldersTotal += spaceCounts.folders;
          failedAssetsTotal += spaceCounts.failedAssets;
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
        anySpaceFailed || failedAssetsTotal > 0
          ? 'Contentstack Assets export completed with errors in one or more spaces'
          : 'Contentstack Assets export completed successfully',
        context,
      );
      log.debug('Contentstack Assets export completed', context);

      return {
        assets: assetsTotal,
        folders: foldersTotal,
        assetTypes: assetTypesCount,
        fields: fieldsCount,
        failedAssets: failedAssetsTotal,
      };
    } catch (err) {
      if (!bootstrapFailed) {
        // Mark any spaces that hadn't been processed as failed so the multibar
        // doesn't leave dangling pending rows.
        for (const [, spaceProcess] of spaceProcessNames) {
          progress.completeProcess(spaceProcess, false);
        }
      }
      handleAndLogError(err, { ...(context as Record<string, unknown>) }, 'Contentstack Assets export failed');
      throw err;
    }
  }

  private createProgress(): CLIProgressManager {
    if (this.parentProgressManager) {
      this.progressManager = this.parentProgressManager;
      return this.parentProgressManager;
    }
    this.progressManager = CLIProgressManager.createNested(CS_ASSETS_MAIN_PROCESS_NAME);
    return this.progressManager;
  }
}

/**
 * Entry point for callers that prefer a function. Delegates to ExportSpaces.
 */
export async function exportSpaceStructure(options: AssetManagementExportOptions): Promise<AssetExportCounts> {
  return new ExportSpaces(options).start();
}
