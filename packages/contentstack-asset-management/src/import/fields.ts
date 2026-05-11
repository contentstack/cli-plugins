import { existsSync } from 'node:fs';
import { join } from 'node:path';
import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';
import { log } from '@contentstack/cli-utilities';

import type { AssetManagementAPIConfig, ImportContext } from '../types/asset-management-api';
import { AssetManagementImportAdapter } from './base';
import { FALLBACK_FIELDS_IMPORT_INVALID_KEYS, PROCESS_NAMES, PROCESS_STATUS } from '../constants/index';
import { runInBatches } from '../utils/concurrent-batch';
import { forEachChunkedJsonStore } from '../utils/chunked-json-reader';

type FieldToCreate = { uid: string; payload: Record<string, unknown> };

/**
 * Reads shared fields from `spaces/fields/fields.json` and POSTs each to the
 * target org-level AM fields endpoint (`POST /api/fields`).
 *
 * Strategy: Fetch → Diff → Create only missing, warn on conflict
 * 1. Fetch fields that already exist in the target org.
 * 2. Skip entries where is_system=true (platform-owned, cannot be created via API).
 * 3. If uid already exists and definition differs → warn and skip.
 * 4. If uid already exists and definition matches → silently skip.
 * 5. Strip read-only/computed keys from the POST body before creating new fields.
 */
export default class ImportFields extends AssetManagementImportAdapter {
  protected processName: string = PROCESS_NAMES.AM_IMPORT_FIELDS;
  private successCount = 0;
  private failureCount = 0;
  private skippedCount = 0;

  constructor(apiConfig: AssetManagementAPIConfig, importContext: ImportContext) {
    super(apiConfig, importContext);
  }

  async start(): Promise<void> {
    await this.init();

    log.debug('Starting shared fields import process...', this.importContext.context);

    const stripKeys = this.importContext.fieldsImportInvalidKeys ?? [...FALLBACK_FIELDS_IMPORT_INVALID_KEYS];
    const dir = this.getFieldsDir();
    const indexName = this.importContext.fieldsFileName ?? 'fields.json';
    const indexPath = join(dir, indexName);

    if (!existsSync(indexPath)) {
      log.info('No shared fields to import (index missing)', this.importContext.context);
      // Single aggregate tick so the shared row in the multibar still completes
      // even when there is nothing to import.
      this.tick(true, 'fields (0)', null);
      return;
    }

    const existingByUid = await this.loadExistingFieldsMap();

    this.updateStatus(PROCESS_STATUS[PROCESS_NAMES.AM_IMPORT_FIELDS].IMPORTING);

    await forEachChunkedJsonStore<Record<string, unknown>>(
      dir,
      indexName,
      {
        context: this.importContext.context,
        chunkReadLogLabel: 'fields',
        onOpenError: (e) => log.warn(`Could not open chunked fields index: ${e}`, this.importContext.context),
        onEmptyIndexer: () => log.debug('No shared fields to import (empty indexer)', this.importContext.context),
      },
      async (records) => {
        const toCreate = this.buildFieldsToCreate(records, existingByUid, stripKeys);
        await this.importFieldsCreates(toCreate);
      },
    );

    // Aggregate tick at end so the single-row shared bootstrap bar reaches 100%
    // regardless of how many chunks/items were processed; the per-field outcome
    // is still captured in logs.
    this.tick(
      this.failureCount === 0,
      `fields: ${this.successCount} created, ${this.skippedCount} skipped, ${this.failureCount} failed`,
      this.failureCount > 0 ? PROCESS_STATUS[PROCESS_NAMES.AM_IMPORT_FIELDS].FAILED : null,
    );
  }

  /** Org-level fields keyed by uid for diff; empty map if list API fails. */
  private async loadExistingFieldsMap(): Promise<Map<string, Record<string, unknown>>> {
    const existingByUid = new Map<string, Record<string, unknown>>();
    try {
      const existing = await this.getWorkspaceFields('');
      for (const f of existing.fields ?? []) {
        existingByUid.set(f.uid, f as Record<string, unknown>);
      }
      log.debug(`Target org has ${existingByUid.size} existing field(s)`, this.importContext.context);
    } catch (e) {
      log.debug(`Could not fetch existing fields, will attempt to create all: ${e}`, this.importContext.context);
    }
    return existingByUid;
  }

  private buildFieldsToCreate(
    items: Record<string, unknown>[],
    existingByUid: Map<string, Record<string, unknown>>,
    stripKeys: string[],
  ): FieldToCreate[] {
    const toCreate: FieldToCreate[] = [];

    for (const field of items) {
      const uid = field.uid as string;

      if (field.is_system) {
        log.debug(`Skipping system field: ${uid}`, this.importContext.context);
        continue;
      }

      const existing = existingByUid.get(uid);
      if (existing) {
        const exportedClean = omit(field, stripKeys);
        const existingClean = omit(existing, stripKeys);
        if (!isEqual(exportedClean, existingClean)) {
          log.warn(
            `Field "${uid}" already exists in the target org with a different definition. Skipping — to apply the exported definition, delete the field from the target org first.`,
            this.importContext.context,
          );
        } else {
          log.debug(`Field "${uid}" already exists with matching definition, skipping`, this.importContext.context);
        }
        this.skippedCount += 1;
        continue;
      }

      toCreate.push({ uid, payload: omit(field, stripKeys) as Record<string, unknown> });
    }

    return toCreate;
  }

  private async importFieldsCreates(toCreate: FieldToCreate[]): Promise<void> {
    await runInBatches(toCreate, this.apiConcurrency, async ({ uid, payload }) => {
      try {
        await this.createField(payload as any);
        this.successCount += 1;
        log.debug(`Imported field: ${uid}`, this.importContext.context);
      } catch (e) {
        this.failureCount += 1;
        log.debug(`Failed to import field ${uid}: ${e}`, this.importContext.context);
      }
    });
  }
}
