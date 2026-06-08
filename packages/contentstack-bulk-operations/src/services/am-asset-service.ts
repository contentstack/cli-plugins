import { CSAssetsAdapter } from '@contentstack/cli-asset-management';

import type { CsAssetsBulkDeleteItem, CsAssetsBulkOperationResult } from '../interfaces';

/**
 * Thin wrapper around {@link CSAssetsAdapter} for CS Assets bulk delete/move used by bulk-operations CLI.
 */
export class CsAssetsService {
  private readonly adapter: CSAssetsAdapter;

  constructor(csAssetsBaseUrl: string, spaceUid: string, orgUid: string) {
    this.adapter = new CSAssetsAdapter({
      baseURL: csAssetsBaseUrl,
      headers: { organization_uid: orgUid, space_key: spaceUid },
    });
  }

  async bulkDelete(
    spaceUid: string,
    workspaceUid: string | undefined,
    items: CsAssetsBulkDeleteItem[]
  ): Promise<CsAssetsBulkOperationResult> {
    try {
      const response = await this.adapter.bulkDeleteAssets(spaceUid, workspaceUid ?? 'main', {
        assets: items,
      });
      return {
        success: true,
        notice: typeof response.notice === 'string' ? response.notice : undefined,
        jobId: typeof response.job_id === 'string' ? response.job_id : undefined,
      };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async bulkMove(
    spaceUid: string,
    workspaceUid: string | undefined,
    assetUids: string[],
    targetFolderUid: string
  ): Promise<CsAssetsBulkOperationResult> {
    try {
      const response = await this.adapter.bulkMoveAssets(spaceUid, workspaceUid ?? 'main', {
        asset_uids: assetUids,
        target_folder_uid: targetFolderUid,
      });
      return {
        success: true,
        notice: typeof response.notice === 'string' ? response.notice : undefined,
      };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
