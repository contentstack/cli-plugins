import { resolve as pResolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { log } from '@contentstack/cli-utilities';

import type { AssetManagementAPIConfig, LinkedWorkspace } from '../types/asset-management-api';
import type { ExportContext } from '../types/export-types';
import { AssetManagementExportAdapter } from './base';
import ExportAssets from './assets';
import { PROCESS_NAMES } from '../constants/index';

export default class ExportWorkspace extends AssetManagementExportAdapter {
  constructor(apiConfig: AssetManagementAPIConfig, exportContext: ExportContext) {
    super(apiConfig, exportContext);
  }

  async start(workspace: LinkedWorkspace, spaceDir: string, branchName: string): Promise<void> {
    await this.init();

    log.debug(`Starting export for AM space ${workspace.space_uid}`, this.exportContext.context);

    const spaceResponse = await this.getSpace(workspace.space_uid);
    const space = spaceResponse.space;
    await mkdir(spaceDir, { recursive: true });

    const metadata = {
      ...space,
      workspace_uid: workspace.uid,
      is_default: workspace.is_default,
      branch: branchName || 'main',
    };
    const metadataPath = pResolve(spaceDir, 'metadata.json');
    try {
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (e) {
      log.warn(`Could not write ${metadataPath}: ${e}`, this.exportContext.context);
      throw e;
    }
    this.tick(true, `space: ${workspace.space_uid}`, null);
    log.debug(`Space metadata written for ${workspace.space_uid}`, this.exportContext.context);

    const assetsExporter = new ExportAssets(this.apiConfig, this.exportContext);
    if (this.progressOrParent) assetsExporter.setParentProgressManager(this.progressOrParent);
    await assetsExporter.start(workspace, spaceDir);
    log.debug(`Exported workspace structure for space ${workspace.space_uid}`, this.exportContext.context);
  }
}
