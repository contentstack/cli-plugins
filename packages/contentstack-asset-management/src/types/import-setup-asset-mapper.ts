export type RunAssetMapperImportSetupParams = {
  contentDir: string;
  /** Parent of `mapper/assets` (typically import-setup `backupDir`). */
  mapperBaseDir: string;
  assetManagementUrl?: string;
  org_uid?: string;
  source_stack?: string;
  apiKey: string;
  host: string;
  context: Record<string, unknown>;
  fetchConcurrency?: number;
};

export type AssetMapperImportSetupResult =
  | { kind: 'skipped'; reason: 'missing_asset_management_url' | 'missing_organization_uid' }
  | { kind: 'success' }
  | { kind: 'error'; errorMessage: string };
