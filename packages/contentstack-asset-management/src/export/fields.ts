import { log } from '@contentstack/cli-utilities';

import type { CSAssetsAPIConfig } from '../types/cs-assets-api';
import type { ExportContext } from '../types/export-types';
import { CSAssetsExportAdapter } from './base';
import { getArrayFromResponse } from '../utils/export-helpers';
import { PROCESS_NAMES } from '../constants/index';

export default class ExportFields extends CSAssetsExportAdapter {
  protected processName: string = PROCESS_NAMES.AM_FIELDS;

  constructor(apiConfig: CSAssetsAPIConfig, exportContext: ExportContext) {
    super(apiConfig, exportContext);
  }

  async start(spaceUid: string): Promise<number> {
    await this.init();

    log.debug('Starting shared fields export process...', this.exportContext.context);
    log.info('Exporting shared fields...', this.exportContext.context);

    const fieldsData = await this.getWorkspaceFields(spaceUid, this.apiPageSize, this.apiFetchConcurrency);
    const items = getArrayFromResponse(fieldsData, 'fields');
    const dir = this.getFieldsDir();
    await this.writeItemsToChunkedJson(dir, 'fields.json', 'fields', ['uid', 'title', 'display_type'], items);
    log.info(
      items.length === 0 ? 'No fields to export' : `Exported ${items.length} shared field(s)`,
      this.exportContext.context,
    );
    this.tick(true, `fields (${items.length})`, null);
    return items.length;
  }
}
