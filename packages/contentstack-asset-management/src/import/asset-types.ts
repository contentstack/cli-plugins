import { existsSync } from 'node:fs';
import { join } from 'node:path';
import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';
import { log } from '@contentstack/cli-utilities';

import type { AssetManagementAPIConfig, ImportContext } from '../types/asset-management-api';
import { AssetManagementImportAdapter } from './base';
import { FALLBACK_ASSET_TYPES_IMPORT_INVALID_KEYS, PROCESS_NAMES, PROCESS_STATUS } from '../constants/index';
import { runInBatches } from '../utils/concurrent-batch';
import { forEachChunkedJsonStore } from '../utils/chunked-json-reader';

type AssetTypeToCreate = { uid: string; payload: Record<string, unknown> };

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
  protected processName: string = PROCESS_NAMES.AM_IMPORT_ASSET_TYPES;
  private successCount = 0;
  private failureCount = 0;
  private skippedCount = 0;

  constructor(apiConfig: AssetManagementAPIConfig, importContext: ImportContext) {
    super(apiConfig, importContext);
  }

  async start(): Promise<void> {
    await this.init();

    log.debug('Starting shared asset types import process...', this.importContext.context);

    const stripKeys = this.importContext.assetTypesImportInvalidKeys ?? [...FALLBACK_ASSET_TYPES_IMPORT_INVALID_KEYS];
    const dir = this.getAssetTypesDir();
    const indexName = this.importContext.assetTypesFileName ?? 'asset-types.json';
    const indexPath = join(dir, indexName);

    if (!existsSync(indexPath)) {
      log.info('No shared asset types to import (index missing)', this.importContext.context);
      this.tick(true, 'asset_types (0)', null);
      return;
    }

    const existingByUid = await this.loadExistingAssetTypesMap();

    this.updateStatus(PROCESS_STATUS[PROCESS_NAMES.AM_IMPORT_ASSET_TYPES].IMPORTING);

    await forEachChunkedJsonStore<Record<string, unknown>>(
      dir,
      indexName,
      {
        context: this.importContext.context,
        chunkReadLogLabel: 'asset-types',
        onOpenError: (e) => log.warn(`Could not open chunked asset-types index: ${e}`, this.importContext.context),
        onEmptyIndexer: () => log.debug('No shared asset types to import (empty indexer)', this.importContext.context),
      },
      async (records) => {
        const toCreate = this.buildAssetTypesToCreate(records, existingByUid, stripKeys);
        await this.importAssetTypesCreates(toCreate);
      },
    );

    this.tick(
      this.failureCount === 0,
      `asset_types: ${this.successCount} created, ${this.skippedCount} skipped, ${this.failureCount} failed`,
      this.failureCount > 0 ? PROCESS_STATUS[PROCESS_NAMES.AM_IMPORT_ASSET_TYPES].FAILED : null,
    );
  }

  /** Org-level asset types keyed by uid for diff; empty map if list API fails. */
  private async loadExistingAssetTypesMap(): Promise<Map<string, Record<string, unknown>>> {
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
    return existingByUid;
  }

  private buildAssetTypesToCreate(
    items: Record<string, unknown>[],
    existingByUid: Map<string, Record<string, unknown>>,
    stripKeys: string[],
  ): AssetTypeToCreate[] {
    const toCreate: AssetTypeToCreate[] = [];

    for (const assetType of items) {
      const uid = assetType.uid as string;

      if (assetType.is_system) {
        log.debug(`Skipping system asset type: ${uid}`, this.importContext.context);
        continue;
      }

      const existing = existingByUid.get(uid);
      if (existing) {
        const exportedClean = omit(assetType, stripKeys);
        const existingClean = omit(existing, stripKeys);
        if (!isEqual(exportedClean, existingClean)) {
          log.warn(
            `Asset type "${uid}" already exists in the target org with a different definition. Skipping — to apply the exported definition, delete the asset type from the target org first.`,
            this.importContext.context,
          );
        } else {
          log.debug(
            `Asset type "${uid}" already exists with matching definition, skipping`,
            this.importContext.context,
          );
        }
        this.skippedCount += 1;
        continue;
      }

      toCreate.push({ uid, payload: omit(assetType, stripKeys) as Record<string, unknown> });
    }

    return toCreate;
  }

  private async importAssetTypesCreates(toCreate: AssetTypeToCreate[]): Promise<void> {
    await runInBatches(toCreate, this.apiConcurrency, async ({ uid, payload }) => {
      try {
        await this.createAssetType(payload as any);
        this.successCount += 1;
        log.debug(`Imported asset type: ${uid}`, this.importContext.context);
      } catch (e) {
        this.failureCount += 1;
        log.debug(`Failed to import asset type ${uid}: ${e}`, this.importContext.context);
      }
    });
  }
}
