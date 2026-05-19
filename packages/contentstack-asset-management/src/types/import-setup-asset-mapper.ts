export type RunAssetMapperImportSetupParams = {
  contentDir: string;
  /** Parent of the assets mapper directory (typically import-setup `backupDir`). */
  mapperBaseDir: string;
  assetManagementUrl?: string;
  org_uid?: string;
  source_stack?: string;
  apiKey: string;
  host: string;
  context: Record<string, unknown>;
  /**
   * Max parallel AM API calls for list/read paths.
   * Takes precedence over {@link fetchConcurrency}.
   */
  apiConcurrency?: number;
  /**
   * @deprecated Use {@link apiConcurrency}.
   */
  fetchConcurrency?: number;
  /** Relative dir under content dir for AM export root (default `spaces`). */
  spacesDirName?: string;
  fieldsDir?: string;
  assetTypesDir?: string;
  fieldsFileName?: string;
  assetTypesFileName?: string;
  foldersFileName?: string;
  assetsFileName?: string;
  fieldsImportInvalidKeys?: string[];
  assetTypesImportInvalidKeys?: string[];
  mapperRootDir?: string;
  mapperAssetsModuleDir?: string;
  mapperUidFileName?: string;
  mapperUrlFileName?: string;
  mapperSpaceUidFileName?: string;
  uploadAssetsConcurrency?: number;
  importFoldersConcurrency?: number;
};

export type AssetMapperImportSetupResult =
  | { kind: 'skipped'; reason: 'missing_asset_management_url' | 'missing_organization_uid' }
  | { kind: 'success' }
  | { kind: 'error'; errorMessage: string };
