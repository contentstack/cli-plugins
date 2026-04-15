/**
 * Linked workspace from CMA branch settings (am_v2.linked_workspaces).
 * Consumed by export/import after fetching branch with include_settings: true.
 */
export type LinkedWorkspace = {
  uid: string;
  space_uid: string;
  is_default: boolean;
};

/**
 * Space details from GET /api/spaces/{space_uid}.
 */
export type Space = {
  uid: string;
  title?: string;
  description?: string;
  org_uid?: string;
  owner_uid?: string;
  default_locale?: string;
  default_workspace?: string;
  tags?: string[];
  settings?: Record<string, unknown>;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
  meta_info?: {
    assets_count?: number;
    folders_count?: number;
    storage?: number;
    last_modified_at?: string;
  };
};

/** Response shape of GET /api/spaces/{space_uid}. */
export type SpaceResponse = { space: Space };

/** Response shape of GET /api/spaces (list all spaces in the org). */
export type SpacesListResponse = { spaces: Space[]; count?: number };

/**
 * Field structure from GET /api/fields (org-level).
 */
export type FieldStruct = {
  uid: string;
  title?: string;
  description?: string | null;
  display_type?: string;
  is_system?: boolean;
  is_multiple?: boolean;
  is_mandatory?: boolean;
  asset_types_count?: number;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
};

/** Response shape of GET /api/fields. */
export type FieldsResponse = {
  count: number;
  relation: string;
  fields: FieldStruct[];
};

/**
 * Options object for asset type (from GET /api/asset_types).
 */
export type AssetTypeOptions = {
  title?: string;
  publishable?: boolean;
  is_page?: boolean;
  singleton?: boolean;
  sub_title?: string[];
  url_pattern?: string;
  url_prefix?: string;
};

/**
 * Asset type structure from GET /api/asset_types (org-level).
 */
export type AssetTypeStruct = {
  uid: string;
  title?: string;
  is_system?: boolean;
  fields?: string[];
  options?: AssetTypeOptions;
  description?: string;
  content_type?: string;
  file_extension?: string;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
  category?: string;
  preview_image_url?: string;
  category_detail?: string;
};

/** Response shape of GET /api/asset_types. */
export type AssetTypesResponse = {
  count: number;
  relation: string;
  asset_types: AssetTypeStruct[];
};

/**
 * Configuration for AssetManagementAdapter constructor.
 */
export type AssetManagementAPIConfig = {
  baseURL: string;
  headers?: Record<string, string>;
  /** Optional context for logging (e.g. exportConfig.context) */
  context?: Record<string, unknown>;
};

/**
 * Adapter interface for Asset Management API calls.
 * Used by export and (future) import.
 */
export interface IAssetManagementAdapter {
  init(): Promise<void>;
  listSpaces(): Promise<SpacesListResponse>;
  getSpace(spaceUid: string): Promise<SpaceResponse>;
  getWorkspaceFields(spaceUid: string): Promise<FieldsResponse>;
  getWorkspaceAssets(spaceUid: string, workspaceUid?: string): Promise<unknown>;
  getWorkspaceFolders(spaceUid: string, workspaceUid?: string): Promise<unknown>;
  getWorkspaceAssetTypes(spaceUid: string): Promise<AssetTypesResponse>;
}

/**
 * Options for exporting space structure (used by export app after fetching linked workspaces).
 */
export type AssetManagementExportOptions = {
  linkedWorkspaces: LinkedWorkspace[];
  exportDir: string;
  branchName: string;
  assetManagementUrl: string;
  org_uid: string;
  context?: Record<string, unknown>;
  /** When true, the AM package will add authtoken to asset download URLs. */
  securedAssets?: boolean;
  /**
   * API key of the stack being exported.
   * Saved to `spaces/export-metadata.json` so that during import the URL mapper
   * can reconstruct old CMA proxy URLs (format: /v3/assets/{apiKey}/{amUid}/...).
   */
  apiKey?: string;
  /**
   * FsUtility `chunkFileSize` in MB for AM export chunked writes.
   */
  chunkFileSizeMb?: number;
  /**
   * Max parallel AM API/export tasks for export (shared module bootstrap default).
   */
  apiConcurrency?: number;
  /**
   * Max parallel asset file downloads per workspace.
   */
  downloadAssetsConcurrency?: number;
};

// ---------------------------------------------------------------------------
// Import types
// ---------------------------------------------------------------------------

/**
 * Context passed down to every import adapter class.
 * Mirrors ExportContext but carries the import-specific fields needed for
 * URL mapper reconstruction and API calls.
 */
export type ImportContext = {
  /** Absolute path to the root `spaces/` directory inside the backup/content dir. */
  spacesRootPath: string;
  /** Source stack API key — used to reconstruct old CMA proxy URLs. */
  sourceApiKey?: string;
  /** Target stack API key — used to build new CMA proxy URLs. */
  apiKey: string;
  /** Target CMA host (may include /v3), e.g. "https://api.contentstack.io/v3". */
  host: string;
  /** Target org UID — required as `x-organization-uid` header when creating spaces. */
  org_uid: string;
  /** Optional logging context (same shape as ExportConfig.context). */
  context?: Record<string, unknown>;
  /**
   * Max parallel AM API calls for import (fields, asset types, and default for folders/uploads).
   * Set from `ImportSpacesOptions.apiConcurrency` (or host wiring).
   */
  apiConcurrency?: number;
  /** Overrides parallel limit for asset uploads when set (import `modules['asset-management'].uploadAssetsConcurrency`). */
  uploadAssetsConcurrency?: number;
  /** Overrides parallel limit for folder creation batches when set (import `modules['asset-management'].importFoldersConcurrency`). */
  importFoldersConcurrency?: number;
  /** Relative dir under content dir for AM export root (e.g. `spaces`). */
  spacesDirName?: string;
  fieldsDir?: string;
  assetTypesDir?: string;
  fieldsFileName?: string;
  assetTypesFileName?: string;
  foldersFileName?: string;
  assetsFileName?: string;
  fieldsImportInvalidKeys?: string[];
  assetTypesImportInvalidKeys?: string[];
  /** `{backupDir}/{mapperRootDir}/{mapperAssetsModuleDir}/` for AM mapper JSON. */
  mapperRootDir?: string;
  mapperAssetsModuleDir?: string;
  mapperUidFileName?: string;
  mapperUrlFileName?: string;
  mapperSpaceUidFileName?: string;
};

/**
 * Single options object for `ImportSpaces` (matches the export-side pattern: one flat shape from the host,
 * then AM splits API vs context internally like `ExportSpaces`).
 */
export type ImportSpacesOptions = {
  /** Absolute path to the root content / backup directory. */
  contentDir: string;
  /** AM 2.0 base URL (e.g. "https://am.contentstack.io"). */
  assetManagementUrl: string;
  org_uid: string;
  apiKey: string;
  host: string;
  sourceApiKey?: string;
  context?: Record<string, unknown>;
  /** When set, mapper JSON is written after import under `{backupDir}/mapper/...`. */
  backupDir?: string;
  apiConcurrency?: number;
  uploadAssetsConcurrency?: number;
  importFoldersConcurrency?: number;
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
};

/**
 * Maps an old source-org space UID to the newly created target-org space UID.
 */
export type SpaceMapping = {
  oldSpaceUid: string;
  newSpaceUid: string;
  /** Workspace identifier inside the space (typically "main"). */
  workspaceUid: string;
  isDefault: boolean;
};

/**
 * The value returned by `ImportSpaces.start()`.
 * When `ImportSpacesOptions.backupDir` is set, the AM package also writes these maps under
 * `mapper/assets/` for `entries.ts` to resolve asset references.
 */
export type ImportResult = {
  uidMap: Record<string, string>;
  urlMap: Record<string, string>;
  spaceMappings: SpaceMapping[];
  /** old space UID → new space UID, written to mapper/assets/space-uid-mapping.json */
  spaceUidMap: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Import payload types (confirmed from Postman collection)
// ---------------------------------------------------------------------------

export type CreateSpacePayload = {
  title: string;
  description?: string;
};

export type CreateFolderPayload = {
  title: string;
  description?: string;
  parent_uid?: string;
};

export type CreateAssetMetadata = {
  title?: string;
  description?: string;
  parent_uid?: string;
};

export type CreateFieldPayload = {
  uid: string;
  title: string;
  display_type?: string;
  child?: unknown[];
  is_mandatory?: boolean;
  is_multiple?: boolean;
  [key: string]: unknown;
};

export type CreateAssetTypePayload = {
  uid: string;
  title: string;
  description?: string;
  content_type?: string;
  file_extension?: string | string[];
  fields?: string[];
  [key: string]: unknown;
};
