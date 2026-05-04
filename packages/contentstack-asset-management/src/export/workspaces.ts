import { resolve as pResolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { log } from '@contentstack/cli-utilities';

import type { AssetManagementAPIConfig, LinkedWorkspace } from '../types/asset-management-api';
import type { ExportContext } from '../types/export-types';
import { AssetManagementExportAdapter } from './base';
import ExportAssets from './assets';

export default class ExportWorkspace extends AssetManagementExportAdapter {
  constructor(apiConfig: AssetManagementAPIConfig, exportContext: ExportContext) {
    super(apiConfig, exportContext);
  }

  /**
   * Run the export pipeline for a single space.
   *
   * The optional `spaceProcessName` is the multibar row label that ticks
   * (folder write + metadata write + per-asset downloads) should land on. The
   * orchestrator passes the per-space row produced by `getSpaceProcessName`;
   * if omitted the default {@link processName} (the AM main row) is used so
   * direct callers keep working.
   */
  async start(
    workspace: LinkedWorkspace,
    spaceDir: string,
    branchName: string,
    spaceProcessName?: string,
  ): Promise<void> {
    await this.init();

    if (spaceProcessName) {
      this.setProcessName(spaceProcessName);
    }

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
    log.debug(`Space metadata written for ${workspace.space_uid}`, this.exportContext.context);

    const assetsExporter = new ExportAssets(this.apiConfig, this.exportContext);
    if (this.progressOrParent) assetsExporter.setParentProgressManager(this.progressOrParent);
    if (spaceProcessName) {
      assetsExporter.setProcessName(spaceProcessName);
    }
    await assetsExporter.start(workspace, spaceDir);
    log.debug(`Exported workspace structure for space ${workspace.space_uid}`, this.exportContext.context);
  }
}
