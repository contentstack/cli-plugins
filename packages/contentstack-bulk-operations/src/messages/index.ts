import memoize from 'lodash/memoize';

const errors = {
  // Stack and Configuration Errors
  STACK_SETUP_REQUIRED: 'Stack setup required for: {identifier}',
  INVALID_CONFIGURATION: 'Invalid configuration: {errors}',
  COMMAND_EXECUTION_FAILED: 'Command execution failed',

  // Entry-specific Errors
  FETCH_ENTRIES_FAILED: 'Failed to fetch entries for content type {contentType}',
  FETCH_PUBLISHED_VERSIONS_FAILED: 'Failed to fetch published versions',
  FETCH_PUBLISHED_ENTRIES_FAILED: 'Failed to fetch published entries from {environment}',
  FILTER_MODIFIED_ENTRIES_FAILED: 'Failed to filter modified entries',

  // Validation Errors
  CONTENT_TYPE_REQUIRED: 'At least one content type is required for entry operations',
  CONTENT_TYPE_LIST_EMPTY: 'Content type list cannot be empty',
  LOCALE_LIST_EMPTY: 'Locale list cannot be empty',
  ENVIRONMENT_LIST_EMPTY: 'Environment list cannot be empty',
  ENVIRONMENTS_REQUIRED: 'Environments are required for {operation} operation',
  INVALID_BRANCH: "Branch '{branch}' does not exist in the stack",
  INVALID_ENVIRONMENT: "Environment '{environment}' does not exist in the stack",
  SOURCE_ALIAS_REQUIRED:
    'Cross-publish requires --source-alias flag with a delivery token. Add one using: csdx auth:tokens:add -a <alias> --delivery-token <token> --api-key <api-key> --environment <source-env> --type delivery',
  SOURCE_ALIAS_NOT_FOUND: "No token found for alias '{alias}'. Please add a delivery token using: csdx auth:tokens:add",
  SOURCE_ALIAS_INVALID_TYPE:
    "Alias '{alias}' is not a delivery token (type: {type}). Cross-publish requires a delivery token.",
  SOURCE_ENV_MISMATCH:
    'Warning: source-alias environment ({aliasEnv}) does not match --source-env ({flagEnv}). Using environment from alias: {using}',

  // Operation Errors
  OPERATION_CANCELLED: 'Operation cancelled by user',
  NO_ITEMS_FOUND: 'No {resourceType} found matching the criteria',

  // Asset-specific Errors
  ASSET_NOT_FOUND: 'Asset not found: {uid} ({locale})',
  FETCH_ASSETS_FAILED: 'Failed to fetch assets',

  // Revert/Retry Errors
  REVERT_ONLY_FOR_PUBLISH:
    'Revert operation can only be performed on "publish" logs. Found "{operation}" operation in log file.',
  NO_FAILED_ITEMS_IN_LOG: 'No failed {resourceType}s found in log to retry',
  NO_SUCCESS_ITEMS_IN_LOG: 'No {resourceType}s found in success log to revert',
};

/**
 * Common messages
 */
const commonMsg = {
  // Initialization
  INITIALIZING: 'Initializing bulk operation command for {resourceType}',
  CONFIGURATION_BUILT: 'Configuration built successfully',
  CLEANUP_COMPLETED: 'Cleanup completed',
  COMPONENTS_INITIALIZED: 'Components initialized successfully',
  INITIALIZED_OPERATION_EXECUTOR: 'Initialized OperationExecutor for SINGLE mode',
  SETUP_BATCH_QUEUE_LISTENERS: 'Setup batch queue listeners for BULK mode',

  // Confirmation
  CONTINUE_WITH_CONFIG: 'Continue with this configuration?',

  // Progress
  EXECUTING_OPERATION: 'Executing bulk operation on {count} items...',
  OPERATION_COMPLETED: 'Operation completed: {success} succeeded, {failed} failed',
  ENQUEUEING_ITEMS_SINGLE_MODE: 'Enqueueing items for single-mode processing...',
  RATE_LIMITER_METRICS: 'Rate limiter metrics',

  // Stack and client
  NO_CONTENT_TYPES_SPECIFIED: 'No content types specified. Fetching all content types from stack...',
  FAILED_TO_FETCH_CONTENT_TYPES: 'Failed to fetch content types',
  NO_LOCALES_SPECIFIED: 'No locales specified. Using default locale: en-us',
  NO_ENVIRONMENTS_SPECIFIED: 'No environments specified for {resourceType} operations',

  // Delivery SDK
  USING_DELIVERY_SDK_FETCH: 'Using Delivery SDK to fetch {resourceType}',
  FETCHING_ALL_ASSETS: 'Fetching all assets',

  // Errors
  DELIVERY_STACK_REQUIRED: 'Delivery stack client is required for cross-publish operation',
  DELIVERY_STACK_SYNC_REQUIRED: 'Delivery stack client is required for cross-publish sync',
  STACK_API_KEY_NOT_FOUND: 'Stack API key not found. Please provide valid apiKey.',
  ERROR_READING_LOG: 'Error reading {logType} log from {path}',
  ERROR_WRITING_LOG: 'Error writing {logType} log to {path}',
  ERROR_CLEARING_LOGS: 'Error clearing logs at {path}',
  NO_CONFIG_IN_LOG: 'No configuration found in log file. Please verify the log file path.',

  // Rate Limiter
  RATE_LIMIT_SERVER_WAIT: 'Server rate limit exhausted. Waiting {seconds}s until reset...',
  RATE_LIMIT_LOW_REMAINING: 'Low server rate limit ({remaining}/{limit} remaining). Throttling to {rate} req/sec',
  RATE_LIMIT_WARNING: 'Rate limit warning: {remaining}/{limit} requests remaining',
  RATE_LIMIT_INCREASED: 'Rate increased to {rate} req/sec ({successes} successes)',
  RATE_LIMIT_THROTTLED: 'Rate limit detected. Throttling to {rate} req/sec (avg: {avgRate})',
  RATE_LIMIT_CIRCUIT_BREAKER: 'Circuit breaker triggered! Rate reduced to {rate} req/sec ({errors} consecutive errors)',
  RATE_LIMIT_RESET: 'Rate limiter reset to {rate} req/sec',

  // Operation Confirmation
  OPERATION_CONFIG_HEADER: 'Configuration to be used for bulk operation:',
  OPERATION_LABEL: 'Operation',
  RESOURCE_TYPE_LABEL: 'Resource Type',
  TOTAL_ITEMS_LABEL: 'Total Items',
  LOCALES_LABEL: 'Locales',
  ENVIRONMENTS_LABEL: 'Environments',
  PROCESSING_MODE_LABEL: 'Processing Mode',
  JOB_DETAILS_LABEL: 'Job details',

  // Final Summary Output
  BULK_JOBS_SUBMITTED: 'Bulk jobs submitted successfully!',
  TAXONOMY_PUBLISH_SUBMITTED: 'Taxonomy publish job submitted.',
  TAXONOMY_PUBLISH_JOB_ID: 'Job ID:',
  CHECK_STATUS_AT: 'Check bulk publish status at:',
  LOG_FILE_PATH: 'Log file:',
  BULK_OPERATION_FILE_PATH: 'Bulk operation file:',
  JOBS_SUBMITTED_COUNT: '{count} bulk job(s) submitted',
};

/**
 * Entry service messages
 */
const entryServiceMsg = {
  // Fetching
  FETCHING_ENTRIES: 'Fetching entries for content type: {contentType}',
  FETCHED_ENTRIES_BATCH: 'Fetched {count} entries (total: {total})',
  FETCHED_TOTAL_ENTRIES: 'Fetched {total} total entries for {contentType}',
  FETCHING_BY_UID: 'Fetching {count} entries by UID for content type: {contentType}',
  FETCHED_BY_UID: 'Fetched {count} entries by UID',

  // Filtering
  COMPARING_WITH_SOURCE: 'Comparing {count} entries with source environment: {sourceEnv}',
  FILTERED_DRAFT: 'Filtered to {count} draft entries (from {total} total)',
  FILTERED_MODIFIED: 'Filtered to {count} modified entries (from {total} total)',
  FILTERED_UNPUBLISHED: 'Filtered to {count} unpublished entries (from {total} total)',
  FILTERED_NON_LOCALIZED:
    'Filtered to {count} entries with non-localized field inconsistencies across locales (from {total} total)',
  IDENTIFYING_NON_LOCALIZED_FIELDS: 'Identifying non-localized fields for content type: {contentType}',
  FOUND_NON_LOCALIZED_FIELDS: 'Found {count} non-localized fields: {fields}',
  NO_NON_LOCALIZED_FIELDS: 'Content type {contentType} has no non-localized fields',
  COMPARING_NON_LOCALIZED_FIELDS: 'Comparing non-localized fields between master locale and other locales',

  // Published versions
  FETCHING_PUBLISHED_VERSIONS: 'Fetching published versions from environment: {sourceEnv}',
  FETCHED_PUBLISHED_VERSIONS: 'Fetched {count} published versions from {sourceEnv}',
  FETCHED_PUBLISHED_ENTRIES: 'Fetched {count} published entries for {contentType} from {environment}',

  // Multi-content type
  FETCHING_ALL_ENTRIES: 'Fetching entries for {count} content types',
  FETCHED_ALL_ENTRIES: 'Fetched {total} total entries',
  FETCH_CONTENT_TYPE_FAILED: 'Failed to fetch entries for content type {contentType}, skipping',

  // Variants
  FETCHING_VARIANTS: 'Fetching variants for {count} entries',
  ATTACHED_VARIANTS: 'Attached variants to {count} of {total} entries',
};

/**
 * Bulk entries command messages
 */
const bulkEntriesMsg = {
  FETCHING: 'Fetching entries...',
  FOUND_ENTRIES: 'Found {count} entries for {contentType} ({locale})',
  FETCH_FOR_CONTENT_TYPES: 'Fetch entries for {contentTypesCount} content types and {localesCount} locales',
  FOUND_ENTRIES_TO_OPERATE: 'Found {count} entries to {operation}',

  // Cross-publish
  CROSS_PUBLISHING: 'Cross-publishing from {sourceEnv} to {targetEnvs}',
  SYNCED_ENTRIES: 'Synced {count} entries from {sourceEnv}',
  ENTRIES_READY_FOR_CROSS_PUBLISH: '{count} entries ready for cross-publish',
};

/**
 * Asset service messages
 */
const assetServiceMsg = {
  // Fetching
  FETCHING_ASSETS: 'Fetching all assets',
  FETCHING_ASSETS_BY_UID: 'Fetching {count} assets by UID',
  FETCHED_ASSETS_BY_UID: 'Fetched {count} assets by UID',
  FETCHING_ASSETS_BY_FOLDER: 'Fetching assets from folder: {folderUid}',
  FETCHED_ASSETS_BY_FOLDER: 'Fetched {total} total assets from folder {folderUid}',
  FETCHED_ASSETS_BATCH: 'Fetched {count} assets (total: {total})',
  FETCHED_TOTAL_ASSETS: 'Fetched {total} total assets',

  // Published assets
  FETCHING_PUBLISHED_ASSETS: 'Fetching published assets from environment: {environment}',
  FETCHED_PUBLISHED_ASSETS: 'Fetched {total} total published assets from {environment}',
  FETCHED_PUBLISHED_ASSETS_BY_UID: 'Fetched {count} published assets from {environment}',

  // Filtering
  FILTERED_UNPUBLISHED_ASSETS: 'Filtered to {count} unpublished assets (from {total} total)',
  FILTERED_MODIFIED_ASSETS: 'Filtered to {count} modified assets (modified after {date})',

  // Errors
  FETCH_ASSET_FAILED: 'Failed to fetch asset {uid}',
  FETCH_PUBLISHED_ASSETS_BY_UID_FAILED: 'Failed to fetch published assets from {environment}',
  FETCH_ALL_PUBLISHED_ASSETS_FAILED: 'Failed to fetch published assets from {environment}',
  FETCH_ASSETS_BY_FOLDER_FAILED: 'Failed to fetch assets from folder {folderUid}',
  FETCH_ASSETS_BY_UIDS_FAILED: 'Failed to fetch assets by UIDs',
  ASSET_NOT_FOUND_OR_UNPUBLISHED: 'Asset {uid} not found or not published to {environment}',
};

/**
 * Bulk assets command messages
 */
const bulkAssetsMsg = {
  FETCHING: 'Fetching assets...',
  FOUND_ASSETS: 'Found {count} assets ({locale})',
  FETCH_FOR_LOCALES: 'Fetch assets for {count} locales',
  FETCH_BY_UIDS: 'Fetch {count} assets by UIDs for {localesCount} locales',
  FOUND_ASSETS_TO_OPERATE: 'Found {count} assets to {operation}',

  // Cross-publish
  CROSS_PUBLISHING: 'Cross-publishing from {sourceEnv} to {targetEnvs}',
  SYNCED_ASSETS: 'Synced {count} assets from {sourceEnv}',
  ASSETS_READY_FOR_CROSS_PUBLISH: '{count} assets ready for cross-publish',
};

/**
 * AM bulk delete/move (CS Assets API) messages
 */
const amBulkAssetsMsg = {
  BULK_AM_ASSETS_DESCRIPTION:
    'Bulk delete or move assets via Asset Management API (AM-enabled regions). Loads asset UIDs from a JSON file `{ "uids": [...] }`; pass organization via `--org-uid`.',
  AM_URL_NOT_CONFIGURED:
    'AM operations require assetManagementUrl in your region settings. Ensure your region is configured correctly.',
  SPACE_UID_REQUIRED: '--space-uid is required for AM operations',
  ORG_UID_REQUIRED: '--org-uid is required for AM operations (organization_uid header)',
  TARGET_FOLDER_REQUIRED: '--target-folder-uid is required for bulk move',
  AM_LOCALE_REQUIRED: '--locale is required for bulk delete (AM deletes per asset and locale)',
  AM_ASSET_UIDS_FILE_REQUIRED: '--asset-uids-file is required (path to JSON `{ "uids": string[] }`)',
  AM_ASSET_UIDS_FILE_READ_FAILED: 'Failed to read asset UIDs file "{path}": {detail}',
  AM_ASSET_UIDS_FILE_INVALID: 'Invalid asset UIDs file "{path}": {detail}',
  AM_DELETING_ASSETS: 'Deleting {count} asset/locale pair(s) from space {spaceUid}...',
  AM_MOVING_ASSETS: 'Moving {count} asset(s) to folder {targetFolderUid}...',
  AM_DELETE_SUBMITTED: 'Bulk delete job submitted. Job ID: {jobId}',
  AM_MOVE_SUBMITTED: 'Bulk move initiated successfully.',
  AM_OPERATION_NOTICE: '{notice}',
  AM_OPERATION_FLAG: 'Operation: delete (AM bulk delete) or move (AM bulk move)',
  AM_SPACE_UID_FLAG: 'Asset Management space UID',
  AM_ORG_UID_FLAG: 'Organization UID for AM API (organization_uid header)',
  AM_WORKSPACE_FLAG: 'AM workspace query parameter (default: main)',
  AM_ASSET_UIDS_FILE_FLAG:
    'Path to UTF-8 JSON file: exactly `{ "uids": ["uid1", "uid2"] }` (non-empty string array, no trimming; large lists: see docs for NODE_OPTIONS)',
  AM_LOCALE_FLAG: 'Locale code for bulk delete only (single locale per run). Not applicable for move — move always relocates all locale variants of an asset.',
  AM_LOCALE_NOT_ALLOWED_FOR_MOVE: '--locale is not applicable for the move operation. Move always relocates all locale variants of an asset. Remove --locale and try again.',
  AM_TARGET_FOLDER_FLAG: 'Destination AM folder UID for bulk move. Use "root" to move assets to the root folder.',
  AM_INVALID_OPERATION: 'Invalid operation: {operation}. Must be delete or move',
  AM_CONFIRM_SUMMARY: 'Proceed with AM {operation} on {count} item(s)?',
  AM_DELETE_SUCCESS: 'AM bulk delete job submitted successfully!',
  AM_DELETE_JOB_ID: 'Job ID: {jobId}',
  AM_DELETE_ASYNC_NOTE: 'The job runs asynchronously — check the Asset Management console for status.',
  AM_MOVE_SUCCESS: 'AM bulk move completed successfully!',
  AM_MOVE_ASSETS_COUNT: '{count} asset(s) moved to folder: {folderUid}',
  AM_OPERATION_FAILED: 'AM {operation} failed.',

  // Interactive prompts
  AM_SELECT_OPERATION: 'Select AM operation:',
  AM_ENTER_SPACE_UID: 'Enter AM space UID:',
  AM_ENTER_ORG_UID: 'Enter organization UID:',
  AM_ENTER_ASSET_UIDS_FILE: 'Enter path to asset UIDs JSON file (e.g. ./assets.json):',
  AM_ENTER_LOCALE: 'Enter locale code for bulk delete (e.g. en-us):',
  AM_ENTER_TARGET_FOLDER: 'Enter target folder UID for bulk move (use "root" to move to the root folder):',
};

/**
 * Bulk operation service messages
 */
const bulkOperationServiceMsg = {
  // Bulk job submission
  SUBMITTING_BULK_JOB: 'Submitting bulk {operation} job for {count} items',
  BULK_JOB_CREATED: 'Bulk job created: {jobId}',
  BULK_JOB_SUBMIT_FAILED: 'Failed to submit bulk job',
  BULK_JOB_SUBMISSION_ERROR: 'Bulk job submission failed: {error}',

  // Polling
  POLLING_JOB_STATUS: 'Polling bulk job status: {jobId}',
  JOB_STATUS_UPDATE: 'Bulk job {jobId} status: {status}',
  JOB_STILL_PROCESSING: 'Job {jobId} still processing... ({elapsed}s elapsed) - Status: {status}',
  POLL_ERROR: 'Error polling job status: {error}',

  // Completion
  BULK_JOB_COMPLETED: 'Bulk job completed: {success}/{total} succeeded',
  BULK_JOB_FAILED_STATUS: 'Bulk job failed with status: {status}',
  BULK_JOB_TIMEOUT:
    'Bulk job timeout after {timeout}s. Job ID: {jobId} - Check status manually using: csdx cm:bulk:job {jobId}',

  // Results
  FETCHING_JOB_RESULTS: 'Fetching job results for: {jobId}',
  BULK_JOB_RESULTS_FETCHED: 'Fetched job results: {success} succeeded, {failed} failed (total: {total})',
  FETCH_JOB_RESULTS_FAILED: 'Failed to fetch job results for {jobId}',
  FETCH_JOB_RESULTS_ERROR: 'Failed to fetch bulk job results: {error}',
  FETCH_RESULTS_ERROR: 'Error fetching results for job {jobId}: {error}',

  // Operation errors
  UNSUPPORTED_OPERATION: 'Unsupported operation: {operation}',
  BULK_OPERATION_FAILED: 'Bulk operation failed',

  // Threshold
  USING_BULK_API: 'Using Bulk API for {count} items (threshold: {threshold})',
  USING_INDIVIDUAL_API: 'Using individual API for {count} items (threshold: {threshold})',

  // Cross-publish sync
  SYNCING_FROM_ENVIRONMENT: 'Syncing {resourceType}s from source environment: {environment}',
  SYNCED_ITEMS_COUNT: 'Synced {count} items from {environment}',
  SYNCED_ENTRIES_FOR_CONTENT_TYPE_LOCALE: 'Synced {count} entries for content type {contentType} in locale {locale}',
  CROSS_PUBLISHING_FROM_TO: 'Cross-publishing from {sourceEnv} to {targetEnvs}',
  SYNCED_RESOURCES_FROM_SOURCE: 'Synced {count} {resourceType}s from {sourceEnv}',
  RESOURCES_READY_FOR_CROSS_PUBLISH: '{count} {resourceType}s ready for cross-publish',
  SYNC_FROM_ENVIRONMENT_FAILED: 'Failed to sync from {environment}: {error}',
};

/**
 * Summary and logging messages
 */
const summaryMsg = {
  OPERATION_SUMMARY: 'Operation Summary:',
  SUCCESSFUL: '✓ Successful: {count}',
  FAILED: '✗ Failed: {count}',
  SKIPPED: '⊘ Skipped: {count}',
  LOG_FILES: 'Log files:',
  LOG_SUCCESS: 'Success: {path}',
  LOG_FAILURE: 'Failure: {path}',
  LOG_FOLDER: 'Log folder: {path}',
  LOG_FOLDER_CREATED: 'Created log folder: {path}',
  READING_SUCCESS_LOG: 'Reading success log from: {path}',
  READING_FAILED_LOG: 'Reading failed log from: {path}',
  REVERTING_OPERATIONS: 'Reverting {count} successful operations from log',
  RETRYING_OPERATIONS: 'Retrying {count} failed operations from log',
};

/**
 * Interactive prompt messages
 */
const interactiveMsg = {
  // Header
  INTERACTIVE_MODE_START: '\nInteractive Mode - Please provide required information:\n',
  INTERACTIVE_MODE_COMPLETE: 'All required information collected!\n',

  // Prompts
  SELECT_OPERATION: 'Select operation:',
  ENTER_ENVIRONMENTS: 'Enter target environments (comma-separated):',
  ENTER_LOCALES: 'Enter locales (comma-separated):',
  SELECT_ALIAS: 'Select alias:',
  ENTER_API_KEY: 'Enter stack API key:',
  ENTER_SOURCE_ENV: 'Enter source environment name:',
  SELECT_SOURCE_ALIAS: 'Select delivery token alias for source environment:',

  // Validation messages
  ENVIRONMENT_REQUIRED: 'At least one environment is required',
  LOCALE_REQUIRED: 'At least one locale is required',
  API_KEY_REQUIRED: 'Stack API key is required',
  API_KEY_INVALID_FORMAT: 'Stack API key should start with "blt"',
  SOURCE_ENV_REQUIRED: 'Source environment is required for cross-publish',
  FETCHING_TAXONOMIES_LIST: 'Fetching taxonomies from the stack...',
  NO_TAXONOMIES_IN_STACK: 'No taxonomies found in this stack for the current branch.',
  TAXONOMY_ITEMS_REQUIRED: 'Provide at least one valid taxonomy UID in --taxonomies (comma-separated).',
  TAXONOMY_ALL_FROM_STACK:
    '--taxonomies not provided; including all {count} taxonomy UID(s) from the stack in this job.',
  FOUND_TAXONOMIES_TO_OPERATE: 'Found {count} taxonomies to {operation}',
  TAXONOMY_UNSUPPORTED_RETRY: 'Retry and revert are not supported for bulk-taxonomies.',
  TAXONOMY_UNSUPPORTED_CROSS_PUBLISH: 'Cross-publish is not supported for bulk-taxonomies.',

  // Errors
  NO_DELIVERY_TOKENS_FOUND:
    'No delivery token aliases found. Add one using: csdx auth:tokens:add -a <alias> --delivery-token <token> --api-key <api-key> --environment <source-env> --type delivery',
};

/**
 * Flag descriptions for CLI commands
 */
const flagDescriptions = {
  // Common flags
  ALIAS:
    'Uses the name of a saved Management Token to authenticate the command. The command can only access the branches allowed for that token. This option can be used as an alternative to` --stack-api-key.`',
  STACK_API_KEY: 'API key of the source stack. You must use either the --stack-api-key flag or the --alias flag.',
  OPERATION: 'Specifies whether to `publish` or `unpublish` content.',
  ENVIRONMENTS:
    'Specifies one or more environments where the entries or assets should be published. Separate multiple environments with spaces.',
  LOCALES:
    'Specifies one or more locale codes for which the entries or assets should be published. Separate multiple locales with spaces.',
  SOURCE_ENV: 'Source environment for cross-publish',
  SOURCE_ALIAS:
    'Alias name for source environment delivery token (required for cross-publish). Add delivery token using: csdx auth:tokens:add',
  BRANCH:
    "The name of the branch where you want to perform the bulk publish operation. If you don't mention the branch name, then by default the content from main branch will be published.",
  CONFIG:
    '(optional) Specifies the path to a JSON configuration file that defines the options for the command. Use this file instead of passing multiple CLI flags for a single run.',
  YES: 'Skips interactive confirmation prompts and runs the command immediately using the provided options. Useful for automation and scripts.',
  RETRY_FAILED:
    '(optional) Use this option to retry publishing the failed entries/assets from the logfile. Specify the name of the logfile that lists failed publish calls. If this option is used, it will override all other flags.',

  // Entry-specific flags
  CONTENT_TYPES: 'Content type UIDs to perform operation on. If not provided, operates on all content types.',
  FILTER: 'Filter entries by status',
  INCLUDE_VARIANTS:
    'Includes entry variants (alternate versions of a base entry) in the bulk operation. By default, only base entries are processed.',

  // Asset-specific flags
  FOLDER_UID:
    "(optional) The UID of the Assets' folder from which the assets need to be published. The default value is cs_root.",

  // Operation and log flags
  PUBLISH_MODE: 'Publish mode: bulk (uses Bulk Publish API) or single (individual API calls)',
  REVERT:
    '(optional) Revert publish operations from a log folder. Specify the folder path containing success logs. Works similar to retry-failed.',
  BULK_OPERATION_FOLDER:
    '(optional) Folder path to store operation logs. Creates separate files for success and failed operations. Default: bulk-operation',
  API_VERSION:
    'Specifies the Content Management API version used for publishing. Use version `3.2` when publishing entries with nested references, otherwise, use the default version 3.2',
  TAXONOMY_API_VERSION:
    'Content Management API version for taxonomy publish (default: `3.2`; required for the `items` + locales/environments body on POST /v3/taxonomies/publish).',
  TAXONOMY_ITEMS:
    'Comma-separated taxonomy UIDs to include in the job. If omitted, all taxonomies in the stack (current branch) are included. Example: products_tax,brands_tax',
};

/**
 * Command descriptions and examples
 */
const commandInfo = {
  BULK_ENTRIES_DESCRIPTION: 'Bulk operations for entries (publish/unpublish/cross-publish)',
  BULK_ASSETS_DESCRIPTION: 'Bulk operations for assets (publish/unpublish/cross-publish)',
  BULK_TAXONOMIES_DESCRIPTION:
    'Publish taxonomies to environments and locales (CMA POST /v3/taxonomies/publish; initiates a publish job)',
  BULK_AM_ASSETS_DESCRIPTION: amBulkAssetsMsg.BULK_AM_ASSETS_DESCRIPTION,
};

/**
 * Combined messages type
 */
const messages: typeof errors &
  typeof commonMsg &
  typeof entryServiceMsg &
  typeof assetServiceMsg &
  typeof bulkEntriesMsg &
  typeof bulkAssetsMsg &
  typeof bulkOperationServiceMsg &
  typeof summaryMsg &
  typeof interactiveMsg &
  typeof flagDescriptions &
  typeof commandInfo &
  typeof amBulkAssetsMsg = {
  ...errors,
  ...commonMsg,
  ...entryServiceMsg,
  ...assetServiceMsg,
  ...bulkEntriesMsg,
  ...bulkAssetsMsg,
  ...bulkOperationServiceMsg,
  ...summaryMsg,
  ...interactiveMsg,
  ...flagDescriptions,
  ...commandInfo,
  ...amBulkAssetsMsg,
};

/**
 * Message interpolation function
 * Replaces placeholders like {key} with values from the args object
 *
 * @param msg - The message string with placeholders
 * @param args - Object containing key-value pairs for placeholder replacement
 * @returns The formatted message with placeholders replaced
 *
 * @example
 * $t(messages.FETCHING_ENTRIES, { contentType: 'blog' })
 * // Returns: "Fetching entries for content type: blog"
 */
export function $t(msg: string, args: Record<string, string | number> = {}): string {
  const transfer = memoize(function (msg: string, args: Record<string, string | number>) {
    if (!msg) return '';

    for (const key of Object.keys(args)) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const placeholder = `{${escapedKey}}`;
      msg = msg.split(placeholder).join(String(args[key]));
    }

    return msg;
  });

  return transfer(msg, args);
}

export default messages;
