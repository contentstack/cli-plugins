import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { log } from '@contentstack/cli-utilities';

import type { AssetManagementAPIConfig, ImportContext, SpaceMapping } from '../types/asset-management-api';
import { AssetManagementImportAdapter } from './base';
import ImportAssets from './assets';

type WorkspaceResult = SpaceMapping & {
  uidMap: Record<string, string>;
  urlMap: Record<string, string>;
};

/**
 * Handles import for a single AM 2.0 space directory.
 * Reads `metadata.json`, creates the space in the target org when its uid is not
 * already present, or reuses the existing space and emits identity mappers only.
 * Returns the SpaceMapping plus UID/URL maps for the mapper files.
 */
export default class ImportWorkspace extends AssetManagementImportAdapter {
  constructor(apiConfig: AssetManagementAPIConfig, importContext: ImportContext) {
    super(apiConfig, importContext);
  }

  /**
   * Run the import pipeline for a single space.
   *
   * The optional `spaceProcessName` is the multibar row label that ticks
   * (folder creates + per-asset uploads) should land on. The orchestrator
   * passes the per-space row produced by `getSpaceProcessName`; if omitted the
   * default {@link processName} is used so direct callers keep working.
   */
  async start(
    oldSpaceUid: string,
    spaceDir: string,
    existingSpaceUids: Set<string> = new Set(),
    spaceProcessName?: string,
  ): Promise<WorkspaceResult> {
    await this.init();

    if (spaceProcessName) {
      this.setProcessName(spaceProcessName);
    }

    log.debug(`Starting import for AM space directory ${oldSpaceUid}`, this.importContext.context);

    // Read exported metadata
    const metadataPath = join(spaceDir, 'metadata.json');
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as Record<string, unknown>;
    } catch (e) {
      log.warn(`Could not read ${metadataPath} for space ${oldSpaceUid}: ${e}`, this.importContext.context);
    }

    const exportedTitle = (metadata.title as string) ?? oldSpaceUid;
    const description = metadata.description as string | undefined;
    const isDefault = (metadata.is_default as boolean) ?? false;
    const workspaceUid = 'main';

    const assetsImporter = new ImportAssets(this.apiConfig, this.importContext);
    if (this.progressOrParent) assetsImporter.setParentProgressManager(this.progressOrParent);
    if (spaceProcessName) {
      assetsImporter.setProcessName(spaceProcessName);
    }

    // Reuse: target org already has a space with the same uid as the export directory.
    if (existingSpaceUids.has(oldSpaceUid)) {
      log.info(
        `Reusing existing AM space "${oldSpaceUid}" (uid matches export directory); skipping create and upload.`,
        this.importContext.context,
      );
      const newSpaceUid = oldSpaceUid;
      const { uidMap, urlMap } = await assetsImporter.buildIdentityMappersFromExport(spaceDir);
      // Reused spaces do no folder/asset work; tick the per-space row once so it
      // completes in the multibar.
      this.tick(true, `space: ${oldSpaceUid} → ${newSpaceUid} (reused)`, null);
      return {
        oldSpaceUid,
        newSpaceUid,
        workspaceUid,
        isDefault,
        uidMap,
        urlMap,
      };
    }

    // Create new space with exact exported title
    log.debug(`Creating space "${exportedTitle}" (old uid: ${oldSpaceUid})`, this.importContext.context);

    const { space } = await this.createSpace({ title: exportedTitle, description });
    const newSpaceUid = space.uid;

    log.debug(`Created space ${newSpaceUid} (old: ${oldSpaceUid})`, this.importContext.context);

    const { uidMap, urlMap } = await assetsImporter.start(newSpaceUid, spaceDir);

    return { oldSpaceUid, newSpaceUid, workspaceUid, isDefault, uidMap, urlMap };
  }
}
