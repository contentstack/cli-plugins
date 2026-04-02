import { resolve as pResolve, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { FsUtility, log } from '@contentstack/cli-utilities';

import type { AssetManagementAPIConfig, ImportContext } from '../types/asset-management-api';
import { AssetManagementImportAdapter } from './base';
import { getArrayFromResponse } from '../utils/export-helpers';
import { runInBatches } from '../utils/concurrent-batch';
import { forEachChunkRecordsFromFs } from '../utils/chunked-json-reader';
import { PROCESS_NAMES, PROCESS_STATUS } from '../constants/index';

type FolderRecord = {
  uid: string;
  title: string;
  description?: string;
  parent_uid?: string;
};

type AssetRecord = {
  uid: string;
  url: string;
  filename?: string;
  file_name?: string;
  parent_uid?: string;
  title?: string;
  description?: string;
};

type UploadJob = {
  asset: AssetRecord;
  filePath: string;
  mappedParentUid: string | undefined;
  oldUid: string;
};

/**
 * Imports folders and assets for a single AM space.
 * - Reads `spaces/{spaceUid}/assets/folders.json` → creates folders, builds folderUidMap
 * - Reads chunked `assets.json` → uploads each file from `files/{oldUid}/{filename}`
 * - Builds UID and URL mapper entries for entries.ts consumption
 * Mirrors ExportAssets.
 */
export default class ImportAssets extends AssetManagementImportAdapter {
  constructor(apiConfig: AssetManagementAPIConfig, importContext: ImportContext) {
    super(apiConfig, importContext);
  }

  private resolveAssetsChunkedLocation(spaceDir: string): { assetsDir: string; indexName: string } | null {
    const assetsDir = pResolve(spaceDir, 'assets');
    const indexName = this.importContext.assetsFileName ?? 'assets.json';
    if (!existsSync(join(assetsDir, indexName))) {
      return null;
    }
    return { assetsDir, indexName };
  }

  /**
   * Build identity uid/url mappers from export JSON only (reuse path — no upload).
   * Keys and values are equal so lookupAssets contract is satisfied without remapping.
   */
  async buildIdentityMappersFromExport(
    spaceDir: string,
  ): Promise<{ uidMap: Record<string, string>; urlMap: Record<string, string> }> {
    const uidMap: Record<string, string> = {};
    const urlMap: Record<string, string> = {};

    const loc = this.resolveAssetsChunkedLocation(spaceDir);
    if (!loc) {
      log.debug(
        `No assets.json index in ${pResolve(spaceDir, 'assets')}, identity mappers empty`,
        this.importContext.context,
      );
      return { uidMap, urlMap };
    }

    const fs = new FsUtility({ basePath: loc.assetsDir, indexFileName: loc.indexName });
    let totalRows = 0;

    await forEachChunkRecordsFromFs<AssetRecord>(
      fs,
      { context: this.importContext.context, chunkReadLogLabel: 'assets' },
      async (records) => {
        totalRows += records.length;
        for (const asset of records) {
          if (asset.uid) {
            uidMap[asset.uid] = asset.uid;
          }
          if (asset.url) {
            urlMap[asset.url] = asset.url;
          }
        }
      },
    );

    log.debug(
      `Built identity mappers for ${totalRows} exported asset row(s) (reuse path, chunked read)`,
      this.importContext.context,
    );

    return { uidMap, urlMap };
  }

  async start(
    newSpaceUid: string,
    spaceDir: string,
  ): Promise<{ uidMap: Record<string, string>; urlMap: Record<string, string> }> {
    const assetsDir = pResolve(spaceDir, 'assets');
    const uidMap: Record<string, string> = {};
    const urlMap: Record<string, string> = {};

    // -----------------------------------------------------------------------
    // 1. Import folders
    // -----------------------------------------------------------------------
    const folderUidMap: Record<string, string> = {};
    const foldersFileName = this.importContext.foldersFileName ?? 'folders.json';
    const foldersFilePath = join(assetsDir, foldersFileName);

    if (existsSync(foldersFilePath)) {
      let foldersData: unknown;
      try {
        foldersData = JSON.parse(readFileSync(foldersFilePath, 'utf8'));
      } catch (e) {
        log.debug(`Could not read ${foldersFileName}: ${e}`, this.importContext.context);
      }

      if (foldersData) {
        const folders = getArrayFromResponse(foldersData, 'folders') as FolderRecord[];
        this.updateStatus(PROCESS_STATUS[PROCESS_NAMES.AM_IMPORT_FOLDERS].IMPORTING, PROCESS_NAMES.AM_IMPORT_FOLDERS);
        log.debug(`Importing ${folders.length} folder(s) for space ${newSpaceUid}`, this.importContext.context);
        await this.importFolders(newSpaceUid, folders, folderUidMap);
      }
    }

    // -----------------------------------------------------------------------
    // 2. Import assets (chunked on disk — process one chunk file at a time)
    // -----------------------------------------------------------------------
    const loc = this.resolveAssetsChunkedLocation(spaceDir);
    if (!loc) {
      log.debug(`No assets.json index found in ${assetsDir}, skipping asset upload`, this.importContext.context);
      return { uidMap, urlMap };
    }

    this.updateStatus(PROCESS_STATUS[PROCESS_NAMES.AM_IMPORT_ASSETS].IMPORTING, PROCESS_NAMES.AM_IMPORT_ASSETS);
    log.debug(
      `Uploading assets for space ${newSpaceUid} from chunked export (incremental chunks)`,
      this.importContext.context,
    );

    const assetFs = new FsUtility({ basePath: loc.assetsDir, indexFileName: loc.indexName });
    let exportRowCount = 0;

    await forEachChunkRecordsFromFs<AssetRecord>(
      assetFs,
      { context: this.importContext.context, chunkReadLogLabel: 'assets' },
      async (assetChunk) => {
        exportRowCount += assetChunk.length;
        const uploadJobs: UploadJob[] = [];

        for (const asset of assetChunk) {
          const oldUid = asset.uid;
          const filename = asset.filename ?? asset.file_name ?? 'asset';
          const filePath = pResolve(assetsDir, 'files', oldUid, filename);

          if (!existsSync(filePath)) {
            log.debug(`Asset file not found: ${filePath}, skipping`, this.importContext.context);
            this.tick(false, `asset: ${oldUid}`, 'File not found on disk', PROCESS_NAMES.AM_IMPORT_ASSETS);
            continue;
          }

          const assetParent = asset.parent_uid && asset.parent_uid !== 'root' ? asset.parent_uid : undefined;
          const mappedParentUid = assetParent ? folderUidMap[assetParent] ?? undefined : undefined;

          uploadJobs.push({ asset, filePath, mappedParentUid, oldUid });
        }

        await runInBatches(
          uploadJobs,
          this.uploadAssetsBatchConcurrency,
          async ({ asset, filePath, mappedParentUid, oldUid }) => {
            const filename = asset.filename ?? asset.file_name ?? 'asset';
            try {
              const { asset: created } = await this.uploadAsset(newSpaceUid, filePath, {
                title: asset.title ?? filename,
                description: asset.description,
                parent_uid: mappedParentUid,
              });

              uidMap[oldUid] = created.uid;

              if (asset.url && created.url) {
                urlMap[asset.url] = created.url;
              }

              this.tick(true, `asset: ${oldUid}`, null, PROCESS_NAMES.AM_IMPORT_ASSETS);
              log.debug(`Uploaded asset ${oldUid} → ${created.uid}`, this.importContext.context);
            } catch (e) {
              this.tick(
                false,
                `asset: ${oldUid}`,
                (e as Error)?.message ?? PROCESS_STATUS[PROCESS_NAMES.AM_IMPORT_ASSETS].FAILED,
                PROCESS_NAMES.AM_IMPORT_ASSETS,
              );
              log.debug(`Failed to upload asset ${oldUid}: ${e}`, this.importContext.context);
            }
          },
        );
      },
    );

    log.debug(
      `Finished asset uploads for space ${newSpaceUid} (${exportRowCount} row(s) read from export chunks)`,
      this.importContext.context,
    );

    return { uidMap, urlMap };
  }

  /**
   * Creates folders respecting hierarchy: parents before children.
   * Uses multiple passes to handle arbitrary depth without requiring sorted input.
   */
  private async importFolders(
    newSpaceUid: string,
    folders: FolderRecord[],
    folderUidMap: Record<string, string>,
  ): Promise<void> {
    let remaining = [...folders];
    let prevLength = -1;

    while (remaining.length > 0 && remaining.length !== prevLength) {
      prevLength = remaining.length;
      const ready: FolderRecord[] = [];
      const nextPass: FolderRecord[] = [];

      for (const folder of remaining) {
        const { parent_uid: parentUid } = folder;
        const isRootParent = !parentUid || parentUid === 'root';
        const parentMapped = isRootParent || folderUidMap[parentUid] !== undefined;

        if (!parentMapped) {
          nextPass.push(folder);
        } else {
          ready.push(folder);
        }
      }

      await runInBatches(ready, this.importFoldersBatchConcurrency, async (folder) => {
        const { parent_uid: parentUid } = folder;
        const isRootParent = !parentUid || parentUid === 'root';
        try {
          const { folder: created } = await this.createFolder(newSpaceUid, {
            title: folder.title,
            description: folder.description,
            parent_uid: isRootParent ? undefined : folderUidMap[parentUid!],
          });
          folderUidMap[folder.uid] = created.uid;
          this.tick(true, `folder: ${folder.uid}`, null, PROCESS_NAMES.AM_IMPORT_FOLDERS);
          log.debug(`Created folder ${folder.uid} → ${created.uid}`, this.importContext.context);
        } catch (e) {
          this.tick(
            false,
            `folder: ${folder.uid}`,
            (e as Error)?.message ?? PROCESS_STATUS[PROCESS_NAMES.AM_IMPORT_FOLDERS].FAILED,
            PROCESS_NAMES.AM_IMPORT_FOLDERS,
          );
          log.debug(`Failed to create folder ${folder.uid}: ${e}`, this.importContext.context);
        }
      });

      remaining = nextPass;
    }

    if (remaining.length > 0) {
      log.debug(
        `${remaining.length} folder(s) could not be imported (unresolved parent UIDs)`,
        this.importContext.context,
      );
    }
  }
}
