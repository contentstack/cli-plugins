import { resolve as pResolve } from 'node:path';
import { Readable } from 'node:stream';
import { mkdir, writeFile } from 'node:fs/promises';
import { configHandler, log } from '@contentstack/cli-utilities';

import type { AssetManagementAPIConfig, LinkedWorkspace } from '../types/asset-management-api';
import type { ExportContext } from '../types/export-types';
import { AssetManagementExportAdapter } from './base';
import { getAssetItems, writeStreamToFile } from '../utils/export-helpers';
import { runInBatches } from '../utils/concurrent-batch';
import { PROCESS_NAMES, PROCESS_STATUS } from '../constants/index';

export default class ExportAssets extends AssetManagementExportAdapter {
  constructor(apiConfig: AssetManagementAPIConfig, exportContext: ExportContext) {
    super(apiConfig, exportContext);
  }

  async start(workspace: LinkedWorkspace, spaceDir: string): Promise<void> {
    await this.init();

    log.debug(`Starting assets export for space ${workspace.space_uid}`, this.exportContext.context);
    log.info(`Exporting asset folders, metadata, and files for space ${workspace.space_uid}`, this.exportContext.context);

    const assetsDir = pResolve(spaceDir, 'assets');
    await mkdir(assetsDir, { recursive: true });
    log.debug(`Assets directory ready: ${assetsDir}`, this.exportContext.context);

    log.debug(`Fetching folders and assets for space ${workspace.space_uid}`, this.exportContext.context);

    const [folders, assetsData] = await Promise.all([
      this.getWorkspaceFolders(workspace.space_uid, workspace.uid),
      this.getWorkspaceAssets(workspace.space_uid, workspace.uid),
    ]);

    const assetItems = getAssetItems(assetsData);
    const downloadableCount = assetItems.filter((asset) => Boolean(asset.url && (asset.uid ?? asset._uid))).length;
    // Per-space total: 1 folder write + 1 metadata write + N per-asset downloads.
    // The shared module-level total is just a placeholder before this point; update
    // it now so the multibar row shows real progress as downloads tick in.
    this.progressOrParent?.updateProcessTotal?.(this.processName, 2 + downloadableCount);

    await writeFile(pResolve(assetsDir, 'folders.json'), JSON.stringify(folders, null, 2));
    this.tick(true, `folders: ${workspace.space_uid}`, null);
    log.debug(`Wrote folders.json for space ${workspace.space_uid}`, this.exportContext.context);

    log.debug(
      assetItems.length === 0
        ? `No assets for space ${workspace.space_uid}, wrote empty assets.json`
        : `Writing ${assetItems.length} assets metadata for space ${workspace.space_uid}`,
      this.exportContext.context,
    );
    await this.writeItemsToChunkedJson(
      assetsDir,
      'assets.json',
      'assets',
      ['uid', 'url', 'filename', 'file_name', 'parent_uid'],
      assetItems,
    );
    log.debug(
      `Finished writing chunked assets metadata (${assetItems.length} item(s)) under ${assetsDir}`,
      this.exportContext.context,
    );
    log.info(
      assetItems.length === 0
        ? `Wrote empty asset metadata for space ${workspace.space_uid}`
        : `Wrote ${assetItems.length} asset metadata record(s) for space ${workspace.space_uid}`,
      this.exportContext.context,
    );
    this.tick(true, `metadata: ${workspace.space_uid} (${assetItems.length})`, null);

    log.debug(`Starting binary downloads for space ${workspace.space_uid}`, this.exportContext.context);
    await this.downloadWorkspaceAssets(assetsData, assetsDir, workspace.space_uid);
  }

  private async downloadWorkspaceAssets(assetsData: unknown, assetsDir: string, spaceUid: string): Promise<void> {
    const items = getAssetItems(assetsData);
    if (items.length === 0) {
      log.info(`No asset files to download for space ${spaceUid}`, this.exportContext.context);
      log.debug('No assets to download', this.exportContext.context);
      return;
    }

    this.updateStatus(PROCESS_STATUS[PROCESS_NAMES.AM_DOWNLOADS].DOWNLOADING);
    log.info(`Downloading asset files for space ${spaceUid} (${items.length} in metadata)`, this.exportContext.context);
    log.debug(`Downloading ${items.length} asset file(s) for space ${spaceUid}...`, this.exportContext.context);
    const filesDir = pResolve(assetsDir, 'files');
    await mkdir(filesDir, { recursive: true });
    log.debug(`Asset files directory ready: ${filesDir}`, this.exportContext.context);

    const securedAssets = this.exportContext.securedAssets ?? false;
    const authtoken = securedAssets ? configHandler.get('authtoken') : null;
    log.debug(
      `Asset downloads: securedAssets=${securedAssets}, concurrency=${this.downloadAssetsBatchConcurrency}`,
      this.exportContext.context,
    );
    let downloadOk = 0;
    let downloadFail = 0;

    const validItems = items.filter((asset) => Boolean(asset.url && (asset.uid ?? asset._uid)));
    const skipped = items.length - validItems.length;
    if (skipped > 0) {
      log.debug(
        `Skipping ${skipped} asset row(s) without url or uid (${validItems.length} file download(s) scheduled)`,
        this.exportContext.context,
      );
    }
    await runInBatches(validItems, this.downloadAssetsBatchConcurrency, async (asset) => {
      const uid = asset.uid ?? asset._uid;
      const url = asset.url;
      const filename = asset.filename ?? asset.file_name ?? 'asset';
      if (!url || !uid) return;
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
        const filePath = pResolve(assetFolderPath, filename);
        await writeStreamToFile(nodeStream, filePath);
        downloadOk += 1;
        // Per-asset tick so the per-space progress bar moves in real time.
        this.tick(true, `asset: ${filename}`, null);
        log.debug(`Downloaded asset ${uid} → ${filePath}`, this.exportContext.context);
      } catch (e) {
        downloadFail += 1;
        const err = (e as Error)?.message ?? PROCESS_STATUS[PROCESS_NAMES.AM_DOWNLOADS].FAILED;
        this.tick(false, `asset: ${filename}`, err);
        log.debug(`Failed to download asset ${uid}: ${e}`, this.exportContext.context);
      }
    });

    log.info(
      downloadFail === 0
        ? `Finished downloading ${downloadOk} asset file(s) for space ${spaceUid}`
        : `Asset downloads for space ${spaceUid} completed with errors: ${downloadOk} succeeded, ${downloadFail} failed`,
      this.exportContext.context,
    );
    log.debug(
      `Asset downloads finished for space ${spaceUid}: ok=${downloadOk}, failed=${downloadFail}`,
      this.exportContext.context,
    );
  }
}
