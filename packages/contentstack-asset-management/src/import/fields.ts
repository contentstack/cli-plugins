import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';
import { log } from '@contentstack/cli-utilities';

import type { AssetManagementAPIConfig, ImportContext } from '../types/asset-management-api';
import { AssetManagementImportAdapter } from './base';
import { PROCESS_NAMES, PROCESS_STATUS } from '../constants/index';
import { runInBatches } from '../utils/concurrent-batch';

const STRIP_KEYS = ['created_at', 'created_by', 'updated_at', 'updated_by', 'is_system', 'asset_types_count'];

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
  constructor(apiConfig: AssetManagementAPIConfig, importContext: ImportContext) {
    super(apiConfig, importContext);
  }

  async start(): Promise<void> {
    await this.init();

    const dir = this.getFieldsDir();
    const items = await this.readAllChunkedJson<Record<string, unknown>>(dir, 'fields.json');

    if (items.length === 0) {
      log.debug('No shared fields to import', this.importContext.context);
      return;
    }

    // Fetch existing fields from the target org keyed by uid for diff comparison.
    // Fields are org-level; the spaceUid param in getWorkspaceFields is unused in the path.
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

    this.updateStatus(PROCESS_STATUS[PROCESS_NAMES.AM_IMPORT_FIELDS].IMPORTING, PROCESS_NAMES.AM_IMPORT_FIELDS);

    type ToCreate = { uid: string; payload: Record<string, unknown> };
    const toCreate: ToCreate[] = [];

    for (const field of items) {
      const uid = field.uid as string;

      if (field.is_system) {
        log.debug(`Skipping system field: ${uid}`, this.importContext.context);
        continue;
      }

      const existing = existingByUid.get(uid);
      if (existing) {
        const exportedClean = omit(field, STRIP_KEYS);
        const existingClean = omit(existing, STRIP_KEYS);
        if (!isEqual(exportedClean, existingClean)) {
          log.warn(
            `Field "${uid}" already exists in the target org with a different definition. Skipping — to apply the exported definition, delete the field from the target org first.`,
            this.importContext.context,
          );
        } else {
          log.debug(`Field "${uid}" already exists with matching definition, skipping`, this.importContext.context);
        }
        this.tick(true, `field: ${uid} (skipped, already exists)`, null, PROCESS_NAMES.AM_IMPORT_FIELDS);
        continue;
      }

      toCreate.push({ uid, payload: omit(field, STRIP_KEYS) as Record<string, unknown> });
    }

    await runInBatches(toCreate, this.apiConcurrency, async ({ uid, payload }) => {
      try {
        await this.createField(payload as any);
        this.tick(true, `field: ${uid}`, null, PROCESS_NAMES.AM_IMPORT_FIELDS);
        log.debug(`Imported field: ${uid}`, this.importContext.context);
      } catch (e) {
        this.tick(
          false,
          `field: ${uid}`,
          (e as Error)?.message ?? PROCESS_STATUS[PROCESS_NAMES.AM_IMPORT_FIELDS].FAILED,
          PROCESS_NAMES.AM_IMPORT_FIELDS,
        );
        log.debug(`Failed to import field ${uid}: ${e}`, this.importContext.context);
      }
    });
  }
}
