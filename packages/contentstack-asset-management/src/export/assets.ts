import { resolve as pResolve } from 'node:path';
import { Readable } from 'node:stream';
import { mkdir, writeFile } from 'node:fs/promises';
import chunk from 'lodash/chunk';
import { configHandler, log, FsUtility } from '@contentstack/cli-utilities';

import type { CSAssetsAPIConfig, LinkedWorkspace } from '../types/cs-assets-api';
import type { ExportContext } from '../types/export-types';
import { CSAssetsExportAdapter } from './base';
import { writeStreamToFile } from '../utils/export-helpers';
import { forEachChunkedJsonStore } from '../utils/chunked-json-reader';
import { withRetry, RetryableHttpError, isRetryableStatus, parseRetryAfterMs } from '../utils/retry';
import type { CustomPromiseHandler } from '../utils/cs-assets-api-adapter';
import { PROCESS_NAMES, PROCESS_STATUS } from '../constants/index';

const ASSET_META_KEYS = ['uid', 'url', 'filename', 'file_name', 'parent_uid'];

type AssetRecord = { uid?: string; _uid?: string; url?: string; filename?: string; file_name?: string };

export default class ExportAssets extends CSAssetsExportAdapter {
  constructor(apiConfig: CSAssetsAPIConfig, exportContext: ExportContext) {
    super(apiConfig, exportContext);
  }

  private isDownloadable(asset: AssetRecord): boolean {
    return Boolean(asset?.url && (asset?.uid ?? asset?._uid));
  }

  async start(workspace: LinkedWorkspace, spaceDir: string): Promise<void> {
    await this.init();

    log.debug(`Starting assets export for space ${workspace.space_uid}`, this.exportContext.context);
    log.info(`Exporting asset folders, metadata, and files for space ${workspace.space_uid}`, this.exportContext.context);

    const assetsDir = pResolve(spaceDir, 'assets');
    await mkdir(assetsDir, { recursive: true });
    log.debug(`Assets directory ready: ${assetsDir}`, this.exportContext.context);

    // Stream asset metadata straight to chunked JSON as pages arrive — never hold the full set in
    // memory. The writer is created lazily so an empty space writes an empty index instead of chunks.
    let fsWriter: FsUtility | undefined;
    let totalStreamed = 0;
    let downloadableCount = 0;
    const onPage = (items: unknown[]) => {
      if (items.length === 0) return;
      if (!fsWriter) fsWriter = this.createChunkedJsonWriter(assetsDir, 'assets.json', 'assets', ASSET_META_KEYS);
      fsWriter.writeIntoFile(items as Record<string, string>[], { mapKeyVal: true });
      totalStreamed += items.length;
      for (const asset of items as AssetRecord[]) if (this.isDownloadable(asset)) downloadableCount += 1;
    };

    log.debug(`Fetching folders and streaming assets for space ${workspace.space_uid}`, this.exportContext.context);
    const [folders] = await Promise.all([
      this.getWorkspaceFolders(workspace.space_uid, workspace.uid, this.apiPageSize, this.apiFetchConcurrency),
      this.streamWorkspaceAssets(workspace.space_uid, workspace.uid, onPage, this.apiPageSize, this.apiFetchConcurrency),
    ]);

    if (fsWriter) fsWriter.completeFile(true);
    else await this.writeEmptyChunkedJson(assetsDir, 'assets.json');
    log.debug(`Wrote chunked assets metadata (${totalStreamed} item(s)) under ${assetsDir}`, this.exportContext.context);

    // Per-space total: 1 folder write + 1 metadata write + N per-asset downloads.
    this.progressOrParent?.updateProcessTotal?.(this.processName, 2 + downloadableCount);

    await writeFile(pResolve(assetsDir, 'folders.json'), JSON.stringify(folders, null, 2));
    this.tick(true, `folders: ${workspace.space_uid}`, null);
    log.debug(`Wrote folders.json for space ${workspace.space_uid}`, this.exportContext.context);

    log.info(
      totalStreamed === 0
        ? `Wrote empty asset metadata for space ${workspace.space_uid}`
        : `Wrote ${totalStreamed} asset metadata record(s) for space ${workspace.space_uid}`,
      this.exportContext.context,
    );
    this.tick(true, `metadata: ${workspace.space_uid} (${totalStreamed})`, null);

    log.debug(`Starting binary downloads for space ${workspace.space_uid}`, this.exportContext.context);
    await this.downloadWorkspaceAssets(assetsDir, workspace.space_uid, downloadableCount);
  }

  /**
   * Download asset binaries by reading the just-written chunked `assets.json` back from disk
   * (one chunk at a time), so we never re-materialize the whole asset list in memory.
   */
  private async downloadWorkspaceAssets(assetsDir: string, spaceUid: string, expectedDownloads: number): Promise<void> {
    const filesDir = pResolve(assetsDir, 'files');
    await mkdir(filesDir, { recursive: true });

    const securedAssets = this.exportContext.securedAssets ?? false;
    const authtoken = securedAssets ? configHandler.get('authtoken') : null;
    log.debug(
      `Asset downloads: securedAssets=${securedAssets}, concurrency=${this.downloadAssetsBatchConcurrency}, expected=${expectedDownloads}`,
      this.exportContext.context,
    );
    this.updateStatus(PROCESS_STATUS[PROCESS_NAMES.AM_DOWNLOADS].DOWNLOADING);

    let downloadOk = 0;
    let downloadFail = 0;

    await forEachChunkedJsonStore<AssetRecord>(
      assetsDir,
      'assets.json',
      {
        context: this.exportContext.context,
        chunkReadLogLabel: 'assets',
        onOpenError: (err) => log.debug(`Could not open assets.json for download: ${err}`, this.exportContext.context),
        onEmptyIndexer: () => log.info(`No asset files to download for space ${spaceUid}`, this.exportContext.context),
      },
      async (records) => {
        const valid = records.filter((asset) => this.isDownloadable(asset));
        if (valid.length === 0) return;
        const apiBatches = chunk(valid, this.downloadAssetsBatchConcurrency);
        const promisifyHandler: CustomPromiseHandler = async ({ index, batchIndex }) => {
          const asset = apiBatches[batchIndex][index] as AssetRecord;
          const uid = (asset.uid ?? asset._uid) as string;
          const url = asset.url as string;
          const filename = asset.filename ?? asset.file_name ?? 'asset';
          if (!url || !uid) return;
          try {
            const separator = url.includes('?') ? '&' : '?';
            const downloadUrl = securedAssets && authtoken ? `${url}${separator}authtoken=${authtoken}` : url;
            // Binary GET is idempotent — retry transient failures with backoff.
            const response = await withRetry(
              async () => {
                let resp: Response;
                try {
                  resp = await fetch(downloadUrl);
                } catch (e) {
                  throw new RetryableHttpError(`download network error: ${(e as Error)?.message ?? String(e)}`);
                }
                if (!resp.ok) {
                  if (isRetryableStatus(resp.status)) {
                    throw new RetryableHttpError(`HTTP ${resp.status}`, resp.status, parseRetryAfterMs(resp.headers.get('retry-after')));
                  }
                  throw new Error(`HTTP ${resp.status}`);
                }
                return resp;
              },
              { context: this.exportContext.context, label: `download ${filename}` },
            );
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
        };

        await this.makeConcurrentCall({ apiBatches, module: 'asset downloads' }, promisifyHandler);
      },
    );

    // Completeness check: a chunk that fails to read back is skipped (logged at debug) by
    // forEachChunkedJsonStore, which would silently drop those downloads. Reconcile attempts
    // (ok + failed) against what streaming counted as downloadable.
    const attempted = downloadOk + downloadFail;
    if (attempted < expectedDownloads) {
      log.warn(
        `Asset downloads for space ${spaceUid} incomplete: expected ${expectedDownloads}, attempted ${attempted}` +
          ` — ${expectedDownloads - attempted} asset(s) were never read back for download.`,
        this.exportContext.context,
      );
    }

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
