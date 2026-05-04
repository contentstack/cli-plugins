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

/** @deprecated Use FALLBACK_AM_CHUNK_FILE_SIZE_MB */
export const CHUNK_FILE_SIZE_MB = FALLBACK_AM_CHUNK_FILE_SIZE_MB;

/**
 * Main process name for Asset Management 2.0 export (single progress bar).
 * Use this when adding/starting the process and for all ticks.
 */
export const AM_MAIN_PROCESS_NAME = 'Asset Management 2.0';

/**
 * Process names for Asset Management 2.0 export/import progress.
 *
 * In the new per-space layout each entry below corresponds to a single row in
 * the multibar:
 *   - {@link AM_FIELDS} / {@link AM_ASSET_TYPES} are the shared bootstrap rows
 *     (one execution per org, ahead of per-space work).
 *   - {@link AM_IMPORT_FIELDS} / {@link AM_IMPORT_ASSET_TYPES} are the import
 *     equivalents.
 *   - One additional row per space is added dynamically via
 *     {@link getSpaceProcessName} and ticks include folders + metadata + asset
 *     transfer for that space.
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
 * Maximum visual length of a per-space process row label. The CLIProgressManager
 * truncates anything over 20 characters; reserve 6 chars for the `Space ` prefix
 * so the trailing space uid keeps 14 chars before truncation.
 */
const SPACE_PROCESS_NAME_PREFIX = 'Space ';
const SPACE_PROCESS_NAME_MAX_UID_LEN = 14;

/**
 * Returns the multibar row label for a single AM 2.0 space.
 * The label is bounded so CLIProgressManager.formatProcessName doesn't truncate
 * it mid-string; the full uid is still used for tick item labels and structured
 * logs, only the row label itself is shortened for display.
 */
export function getSpaceProcessName(spaceUid: string): string {
  const safeUid = spaceUid ?? '';
  const trimmed =
    safeUid.length > SPACE_PROCESS_NAME_MAX_UID_LEN
      ? safeUid.substring(0, SPACE_PROCESS_NAME_MAX_UID_LEN)
      : safeUid;
  return `${SPACE_PROCESS_NAME_PREFIX}${trimmed}`;
}

/**
 * Detects whether a process name belongs to a per-space progress row, used by
 * the export/import strategy registries to aggregate counts for the final
 * summary across all spaces.
 */
export function isSpaceProcessName(processName: string): boolean {
  return typeof processName === 'string' && processName.startsWith(SPACE_PROCESS_NAME_PREFIX);
}

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
