import { log } from '@contentstack/cli-utilities';

import type { CSAssetsAPIConfig } from '../types/cs-assets-api';
import type { ExportContext } from '../types/export-types';
import { CSAssetsExportAdapter } from './base';
import { getArrayFromResponse } from '../utils/export-helpers';
import { PROCESS_NAMES } from '../constants/index';

export default class ExportAssetTypes extends CSAssetsExportAdapter {
  protected processName: string = PROCESS_NAMES.AM_ASSET_TYPES;

  constructor(apiConfig: CSAssetsAPIConfig, exportContext: ExportContext) {
    super(apiConfig, exportContext);
  }

  async start(spaceUid: string): Promise<void> {
    await this.init();

    log.debug('Starting shared asset types export process...', this.exportContext.context);

    const assetTypesData = await this.getWorkspaceAssetTypes(spaceUid, this.apiPageSize, this.apiFetchConcurrency);
    const items = getArrayFromResponse(assetTypesData, 'asset_types');
    const dir = this.getAssetTypesDir();
    if (items.length === 0) {
      log.info('No asset types to export, writing empty asset-types', this.exportContext.context);
    } else {
      log.debug(`Writing ${items.length} shared asset types`, this.exportContext.context);
    }
    await this.writeItemsToChunkedJson(
      dir,
      'asset-types.json',
      'asset_types',
      ['uid', 'title', 'category', 'file_extension'],
      items,
    );
    this.tick(true, `asset_types (${items.length})`, null);
  }
}
