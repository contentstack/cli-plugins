import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';
import { log } from '@contentstack/cli-utilities';

import type { AssetManagementAPIConfig, ImportContext } from '../types/asset-management-api';
import { AssetManagementImportAdapter } from './base';
import { PROCESS_NAMES, PROCESS_STATUS } from '../constants/index';

const STRIP_KEYS = ['created_at', 'created_by', 'updated_at', 'updated_by', 'is_system', 'category', 'preview_image_url', 'category_detail'];

/**
 * Reads shared asset types from `spaces/asset_types/asset-types.json` and POSTs
 * each to the target org-level AM endpoint (`POST /api/asset_types`).
 *
 * Strategy: Fetch → Diff → Create only missing, warn on conflict
 * 1. Fetch asset types that already exist in the target org.
 * 2. Skip entries where is_system=true (platform-owned, cannot be created via API).
 * 3. If uid already exists and definition differs → warn and skip.
 * 4. If uid already exists and definition matches → silently skip.
 * 5. Strip read-only/computed keys from the POST body before creating new asset types.
 */
export default class ImportAssetTypes extends AssetManagementImportAdapter {
  constructor(apiConfig: AssetManagementAPIConfig, importContext: ImportContext) {
    super(apiConfig, importContext);
  }

  async start(): Promise<void> {
    await this.init();

    const dir = this.getAssetTypesDir();
    const items = await this.readAllChunkedJson<Record<string, unknown>>(dir, 'asset-types.json');

    if (items.length === 0) {
      log.debug('No shared asset types to import', this.importContext.context);
      return;
    }

    // Fetch existing asset types from the target org keyed by uid for diff comparison.
    // Asset types are org-level; the spaceUid param in getWorkspaceAssetTypes is unused in the path.
    const existingByUid = new Map<string, Record<string, unknown>>();
    try {
      const existing = await this.getWorkspaceAssetTypes('');
      for (const at of existing.asset_types ?? []) {
        existingByUid.set(at.uid, at as Record<string, unknown>);
      }
      log.debug(`Target org has ${existingByUid.size} existing asset type(s)`, this.importContext.context);
    } catch (e) {
      log.debug(`Could not fetch existing asset types, will attempt to create all: ${e}`, this.importContext.context);
    }

    this.updateStatus(PROCESS_STATUS[PROCESS_NAMES.AM_IMPORT_ASSET_TYPES].IMPORTING, PROCESS_NAMES.AM_IMPORT_ASSET_TYPES);

    for (const assetType of items) {
      const uid = assetType.uid as string;

      if (assetType.is_system) {
        log.debug(`Skipping system asset type: ${uid}`, this.importContext.context);
        continue;
      }

      const existing = existingByUid.get(uid);
      if (existing) {
        const exportedClean = omit(assetType, STRIP_KEYS);
        const existingClean = omit(existing, STRIP_KEYS);
        if (!isEqual(exportedClean, existingClean)) {
          log.warn(
            `Asset type "${uid}" already exists in the target org with a different definition. Skipping — to apply the exported definition, delete the asset type from the target org first.`,
            this.importContext.context,
          );
        } else {
          log.debug(`Asset type "${uid}" already exists with matching definition, skipping`, this.importContext.context);
        }
        this.tick(true, `asset-type: ${uid} (skipped, already exists)`, null, PROCESS_NAMES.AM_IMPORT_ASSET_TYPES);
        continue;
      }

      const payload = omit(assetType, STRIP_KEYS);
      try {
        await this.createAssetType(payload as any);
        this.tick(true, `asset-type: ${uid}`, null, PROCESS_NAMES.AM_IMPORT_ASSET_TYPES);
        log.debug(`Imported asset type: ${uid}`, this.importContext.context);
      } catch (e) {
        this.tick(false, `asset-type: ${uid}`, (e as Error)?.message ?? PROCESS_STATUS[PROCESS_NAMES.AM_IMPORT_ASSET_TYPES].FAILED, PROCESS_NAMES.AM_IMPORT_ASSET_TYPES);
        log.debug(`Failed to import asset type ${uid}: ${e}`, this.importContext.context);
      }
    }
  }
}
