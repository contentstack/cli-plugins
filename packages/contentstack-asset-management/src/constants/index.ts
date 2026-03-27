/** Fallback when export/import do not pass `chunkWriteBatchSize`. */
export const FALLBACK_AM_CHUNK_WRITE_BATCH_SIZE = 50;
/** Fallback when export/import do not pass `chunkFileSizeMb`. */
export const FALLBACK_AM_CHUNK_FILE_SIZE_MB = 1;
/** Fallback when import does not pass `apiConcurrency`. */
export const FALLBACK_AM_API_CONCURRENCY = 5;
/** @deprecated Use FALLBACK_AM_API_CONCURRENCY */
export const DEFAULT_AM_API_CONCURRENCY = FALLBACK_AM_API_CONCURRENCY;

/** Fallback strip lists when import options omit `fieldsImportInvalidKeys` / `assetTypesImportInvalidKeys`. */
export const FALLBACK_FIELDS_IMPORT_INVALID_KEYS = [
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'is_system',
  'asset_types_count',
] as const;
export const FALLBACK_ASSET_TYPES_IMPORT_INVALID_KEYS = [
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
  'is_system',
  'category',
  'preview_image_url',
  'category_detail',
] as const;

/** @deprecated Use FALLBACK_AM_CHUNK_WRITE_BATCH_SIZE */
export const BATCH_SIZE = FALLBACK_AM_CHUNK_WRITE_BATCH_SIZE;
/** @deprecated Use FALLBACK_AM_CHUNK_FILE_SIZE_MB */
export const CHUNK_FILE_SIZE_MB = FALLBACK_AM_CHUNK_FILE_SIZE_MB;

/**
 * Main process name for Asset Management 2.0 export (single progress bar).
 * Use this when adding/starting the process and for all ticks.
 */
export const AM_MAIN_PROCESS_NAME = 'Asset Management 2.0';

/**
 * Process names for Asset Management 2.0 export progress (for tick labels).
 */
export const PROCESS_NAMES = {
  AM_SPACE_METADATA: 'Space metadata',
  AM_FOLDERS: 'Folders',
  AM_ASSETS: 'Assets',
  AM_FIELDS: 'Fields',
  AM_ASSET_TYPES: 'Asset types',
  AM_DOWNLOADS: 'Asset downloads',
  // Import process names
  AM_IMPORT_FIELDS: 'Import fields',
  AM_IMPORT_ASSET_TYPES: 'Import asset types',
  AM_IMPORT_FOLDERS: 'Import folders',
  AM_IMPORT_ASSETS: 'Import assets',
} as const;

/**
 * Status messages for each process (exporting, fetching, importing, failed).
 */
export const PROCESS_STATUS = {
  [PROCESS_NAMES.AM_SPACE_METADATA]: {
    EXPORTING: 'Exporting space metadata...',
    FAILED: 'Failed to export space metadata.',
  },
  [PROCESS_NAMES.AM_FOLDERS]: {
    FETCHING: 'Fetching folders...',
    FAILED: 'Failed to fetch folders.',
  },
  [PROCESS_NAMES.AM_ASSETS]: {
    FETCHING: 'Fetching assets...',
    FAILED: 'Failed to fetch assets.',
  },
  [PROCESS_NAMES.AM_FIELDS]: {
    FETCHING: 'Fetching fields...',
    FAILED: 'Failed to fetch fields.',
  },
  [PROCESS_NAMES.AM_ASSET_TYPES]: {
    FETCHING: 'Fetching asset types...',
    FAILED: 'Failed to fetch asset types.',
  },
  [PROCESS_NAMES.AM_DOWNLOADS]: {
    DOWNLOADING: 'Downloading asset files...',
    FAILED: 'Failed to download assets.',
  },
  [PROCESS_NAMES.AM_IMPORT_FIELDS]: {
    IMPORTING: 'Importing shared fields...',
    FAILED: 'Failed to import fields.',
  },
  [PROCESS_NAMES.AM_IMPORT_ASSET_TYPES]: {
    IMPORTING: 'Importing shared asset types...',
    FAILED: 'Failed to import asset types.',
  },
  [PROCESS_NAMES.AM_IMPORT_FOLDERS]: {
    IMPORTING: 'Importing folders...',
    FAILED: 'Failed to import folders.',
  },
  [PROCESS_NAMES.AM_IMPORT_ASSETS]: {
    IMPORTING: 'Importing assets...',
    FAILED: 'Failed to import assets.',
  },
} as const;
