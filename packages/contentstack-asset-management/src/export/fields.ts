import { log } from '@contentstack/cli-utilities';

import type { AssetManagementAPIConfig } from '../types/asset-management-api';
import type { ExportContext } from '../types/export-types';
import { AssetManagementExportAdapter } from './base';
import { getArrayFromResponse } from '../utils/export-helpers';
import { PROCESS_NAMES } from '../constants/index';

export default class ExportFields extends AssetManagementExportAdapter {
  protected processName: string = PROCESS_NAMES.AM_FIELDS;

  constructor(apiConfig: AssetManagementAPIConfig, exportContext: ExportContext) {
    super(apiConfig, exportContext);
  }

  async start(spaceUid: string): Promise<void> {
    await this.init();

    log.debug('Starting shared fields export process...', this.exportContext.context);

    const fieldsData = await this.getWorkspaceFields(spaceUid);
    const items = getArrayFromResponse(fieldsData, 'fields');
    const dir = this.getFieldsDir();
    if (items.length === 0) {
      log.info('No field items to export, writing empty fields', this.exportContext.context);
    } else {
      log.debug(`Writing ${items.length} shared fields`, this.exportContext.context);
    }
    await this.writeItemsToChunkedJson(dir, 'fields.json', 'fields', ['uid', 'title', 'display_type'], items);
    this.tick(true, `fields (${items.length})`, null);
  }
}
