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
      const failures = response.failures ?? [];
      return {
        success: failures.length === 0,
        notice: typeof response.notice === 'string' ? response.notice : undefined,
        jobId: typeof response.primaryJobId === 'string' ? response.primaryJobId : undefined,
        jobIds: response.job_ids,
        batchesTotal: response.batchesTotal,
        batchesSucceeded: response.batchesSucceeded,
        batchesFailed: failures.length,
        failures: failures.map((f) => ({ batchIndex: f.batchIndex, count: f.count, error: f.error, uids: f.uids })),
        error: failures.length > 0 ? failures.map((f) => f.error).join('; ') : undefined,
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
      const failures = response.failures ?? [];
      return {
        success: failures.length === 0,
        notice: typeof response.notice === 'string' ? response.notice : undefined,
        batchesTotal: response.batchesTotal,
        batchesSucceeded: response.batchesSucceeded,
        batchesFailed: failures.length,
        failures: failures.map((f) => ({ batchIndex: f.batchIndex, count: f.count, error: f.error, uids: f.uids })),
        error: failures.length > 0 ? failures.map((f) => f.error).join('; ') : undefined,
      };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
