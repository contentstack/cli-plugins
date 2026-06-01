import { resolve as pResolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { log, handleAndLogError, configHandler } from '@contentstack/cli-utilities';

import type { CsAssetsQueryExportOptions, CSAssetsAPIConfig, LinkedWorkspace } from '../types/cs-assets-api';
import type { ExportContext } from '../types/export-types';
import ExportAssetTypes from '../export/asset-types';
import ExportFields from '../export/fields';
import { CSAssetsExportAdapter } from '../export/base';
import { getAssetItems, writeStreamToFile } from '../utils/export-helpers';
import { runInBatches } from '../utils/concurrent-batch';

const DEFAULT_ASSET_BATCH_SIZE = 100;
const SEARCH_PAGE_LIMIT = 100;

/**
 * Query-based Contentstack Assets exporter.
 * Exports only referenced asset UIDs from entries into the `spaces/` directory layout.
 */
export class CsAssetsQueryExporter {
  private readonly options: CsAssetsQueryExportOptions;

  constructor(options: CsAssetsQueryExportOptions) {
    this.options = options;
  }

  async export(assetUIDs: string[]): Promise<void> {
    const { linkedWorkspaces, exportDir, context } = this.options;

    if (!assetUIDs.length) {
      log.info('No asset UIDs to export for Contentstack Assets query export', context);
      return;
    }

    if (!linkedWorkspaces.length) {
      log.warn('No linked workspaces configured for Contentstack Assets query export', context);
      return;
    }

    log.info(
      `Starting Contentstack Assets query export (${assetUIDs.length} UID(s), ${linkedWorkspaces.length} space(s))`,
      context,
    );

    const spacesRootPath = pResolve(exportDir, 'spaces');
    await mkdir(spacesRootPath, { recursive: true });

    const apiConfig: CSAssetsAPIConfig = {
      baseURL: this.options.csAssetsUrl,
      headers: { organization_uid: this.options.org_uid },
      context,
    };

    const exportContext: ExportContext = {
      spacesRootPath,
      context,
      securedAssets: this.options.securedAssets,
      chunkFileSizeMb: this.options.chunkFileSizeMb,
      apiConcurrency: this.options.apiConcurrency,
      downloadAssetsConcurrency: this.options.downloadAssetsConcurrency,
    };

    const batchSize = this.options.assetBatchSize ?? DEFAULT_ASSET_BATCH_SIZE;

    try {
      await this.bootstrapSharedModules(apiConfig, exportContext, linkedWorkspaces[0].space_uid);

      for (const workspace of linkedWorkspaces) {
        try {
          await this.exportWorkspaceAssets(apiConfig, exportContext, workspace, assetUIDs, batchSize);
        } catch (err) {
          handleAndLogError(
            err,
            { ...(context as Record<string, unknown>), spaceUid: workspace.space_uid },
            `Failed Contentstack Assets query export for space ${workspace.space_uid}`,
          );
        }
      }

      log.success('Contentstack Assets query export completed', context);
    } catch (err) {
      handleAndLogError(err, context as Record<string, unknown>, 'Contentstack Assets query export failed');
      throw err;
    }
  }

  private async bootstrapSharedModules(
    apiConfig: CSAssetsAPIConfig,
    exportContext: ExportContext,
    firstSpaceUid: string,
  ): Promise<void> {
    const sharedFieldsDir = pResolve(exportContext.spacesRootPath, 'fields');
    const sharedAssetTypesDir = pResolve(exportContext.spacesRootPath, 'asset_types');
    await mkdir(sharedFieldsDir, { recursive: true });
    await mkdir(sharedAssetTypesDir, { recursive: true });

    const exportAssetTypes = new ExportAssetTypes(apiConfig, exportContext);
    const exportFields = new ExportFields(apiConfig, exportContext);
    await Promise.all([exportAssetTypes.start(firstSpaceUid), exportFields.start(firstSpaceUid)]);
  }

  private async exportWorkspaceAssets(
    apiConfig: CSAssetsAPIConfig,
    exportContext: ExportContext,
    workspace: LinkedWorkspace,
    assetUIDs: string[],
    batchSize: number,
  ): Promise<void> {
    const { branchName, context } = this.options;
    const workspaceExporter = new QueryExportWorkspaceAdapter(apiConfig, exportContext);
    await workspaceExporter.start(workspace, assetUIDs, branchName || 'main', batchSize);
    log.debug(`Contentstack Assets query export finished for space ${workspace.space_uid}`, context);
  }
}

/**
 * Per-space export: search by UID, write metadata/files, download binaries.
 */
class QueryExportWorkspaceAdapter extends CSAssetsExportAdapter {
  async start(
    workspace: LinkedWorkspace,
    assetUIDs: string[],
    branchName: string,
    uidBatchSize: number,
  ): Promise<void> {
    await this.init();

    const spaceDir = pResolve(this.exportContext.spacesRootPath, workspace.space_uid);
    await mkdir(spaceDir, { recursive: true });

    const spaceResponse = await this.getSpace(workspace.space_uid);
    const space = spaceResponse.space;
    const metadata = {
      ...space,
      workspace_uid: workspace.uid,
      is_default: workspace.is_default,
      branch: branchName,
    };
    await writeFile(pResolve(spaceDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

    const assetsDir = pResolve(spaceDir, 'assets');
    await mkdir(assetsDir, { recursive: true });

    const spaceRef = { space_uid: workspace.space_uid, workspace: workspace.uid };
    const assetItems = await this.searchAllAssets(assetUIDs, spaceRef, uidBatchSize);

    const folders = assetItems.filter((item) => (item as { is_dir?: boolean }).is_dir === true);
    const files = assetItems.filter((item) => (item as { is_dir?: boolean }).is_dir !== true);

    await writeFile(pResolve(assetsDir, 'folders.json'), JSON.stringify(folders, null, 2));

    await this.writeItemsToChunkedJson(
      assetsDir,
      'assets.json',
      'assets',
      ['uid', 'url', 'filename', 'file_name', 'parent_uid'],
      files,
    );

    await this.downloadAssets(files, assetsDir, workspace.space_uid);
  }

  private async searchAllAssets(
    assetUIDs: string[],
    spaceRef: { space_uid: string; workspace: string },
    uidBatchSize: number,
  ): Promise<Array<Record<string, unknown>>> {
    const seen = new Set<string>();
    const results: Array<Record<string, unknown>> = [];

    for (let i = 0; i < assetUIDs.length; i += uidBatchSize) {
      const uidBatch = assetUIDs.slice(i, i + uidBatchSize);
      let skip = 0;
      let pageItems: unknown[];

      do {
        const response = await this.searchAssets({
          assetUIDs: uidBatch,
          spaces: [spaceRef],
          skip,
          limit: SEARCH_PAGE_LIMIT,
        });
        pageItems = getAssetItems(response);

        if (pageItems.length === 0 && skip === 0) {
          log.warn(
            `Search returned 0 assets in space ${spaceRef.space_uid} for UID(s): [${uidBatch.join(', ')}]`,
            this.exportContext.context,
          );
        }

        for (const item of pageItems) {
          const record = item as Record<string, unknown>;
          const key = String(record.uid ?? record.asset_id ?? record._uid ?? '');
          if (key && !seen.has(key)) {
            seen.add(key);
            results.push(record);
          }
        }

        skip += pageItems.length;
      } while (pageItems.length === SEARCH_PAGE_LIMIT);
    }

    return results;
  }

  private async downloadAssets(
    items: Array<Record<string, unknown>>,
    assetsDir: string,
    spaceUid: string,
  ): Promise<void> {
    const downloadable = items.filter((asset) => Boolean(asset.url && (asset.uid ?? asset._uid)));
    if (downloadable.length === 0) {
      log.debug(`No downloadable assets for space ${spaceUid}`, this.exportContext.context);
      return;
    }

    const filesDir = pResolve(assetsDir, 'files');
    await mkdir(filesDir, { recursive: true });

    const securedAssets = this.exportContext.securedAssets ?? false;
    const authtoken = securedAssets ? configHandler.get('authtoken') : null;

    await runInBatches(downloadable, this.downloadAssetsBatchConcurrency, async (asset) => {
      const uid = String(asset.uid ?? asset._uid);
      const url = String(asset.url);
      const filename = String(asset.filename ?? asset.file_name ?? 'asset');
      try {
        const separator = url.includes('?') ? '&' : '?';
        const downloadUrl = securedAssets && authtoken ? `${url}${separator}authtoken=${authtoken}` : url;
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = response.body;
        if (!body) throw new Error('No response body');
        const nodeStream = Readable.fromWeb(body as Parameters<typeof Readable.fromWeb>[0]);
        const assetFolderPath = pResolve(filesDir, uid);
        await mkdir(assetFolderPath, { recursive: true });
        await writeStreamToFile(nodeStream, pResolve(assetFolderPath, filename));
      } catch (e) {
        log.debug(`Failed to download asset ${uid} in space ${spaceUid}: ${e}`, this.exportContext.context);
      }
    });
  }
}
