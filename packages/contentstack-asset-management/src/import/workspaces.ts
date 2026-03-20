import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { log } from '@contentstack/cli-utilities';

import type { AssetManagementAPIConfig, ImportContext, SpaceMapping } from '../types/asset-management-api';
import { AssetManagementImportAdapter } from './base';
import ImportAssets from './assets';
import { PROCESS_NAMES } from '../constants/index';

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

  async start(
    oldSpaceUid: string,
    spaceDir: string,
    existingSpaceUids: Set<string> = new Set(),
  ): Promise<WorkspaceResult> {
    await this.init();

    // Read exported metadata
    const metadataPath = join(spaceDir, 'metadata.json');
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as Record<string, unknown>;
    } catch (e) {
      log.debug(`Could not read metadata.json for space ${oldSpaceUid}: ${e}`, this.importContext.context);
    }

    const exportedTitle = (metadata.title as string) ?? oldSpaceUid;
    const description = metadata.description as string | undefined;
    const isDefault = (metadata.is_default as boolean) ?? false;
    const workspaceUid = 'main';

    const assetsImporter = new ImportAssets(this.apiConfig, this.importContext);
    if (this.progressOrParent) assetsImporter.setParentProgressManager(this.progressOrParent);

    // Reuse: target org already has a space with the same uid as the export directory.
    if (existingSpaceUids.has(oldSpaceUid)) {
      log.info(
        `Reusing existing AM space "${oldSpaceUid}" (uid matches export directory); skipping create and upload.`,
        this.importContext.context,
      );
      const newSpaceUid = oldSpaceUid;
      const { uidMap, urlMap } = await assetsImporter.buildIdentityMappersFromExport(spaceDir);
      this.tick(true, `space: ${oldSpaceUid} → ${newSpaceUid} (reused)`, null, PROCESS_NAMES.AM_SPACE_METADATA);
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
    this.tick(true, `space: ${oldSpaceUid} → ${newSpaceUid}`, null, PROCESS_NAMES.AM_SPACE_METADATA);

    const { uidMap, urlMap } = await assetsImporter.start(newSpaceUid, spaceDir);

    return { oldSpaceUid, newSpaceUid, workspaceUid, isDefault, uidMap, urlMap };
  }
}
