import chalk from 'chalk';
import { configHandler } from '@contentstack/cli-utilities';
import messages, { $t } from '../messages';
import { BulkOperationConfig, FilterType, OperationType, CommandFlags, PublishMode, StackConfig } from '../interfaces';

/**
 * Custom error class to indicate the error has already been displayed to the user
 */
class DisplayedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DisplayedError';
  }
}

/**
 * Oclif `multiple` string flags pass each CLI occurrence as one array entry, so
 * `--locales en-us,hi-in` becomes `['en-us,hi-in']`. Interactive prompts split on commas.
 * This flattens comma-separated segments in each entry to match that behavior.
 */
function expandFlagStringList(values: string[] | undefined): string[] {
  if (!values?.length) {
    return [];
  }
  const out: string[] = [];
  for (const raw of values) {
    if (raw == null || raw === '') {
      continue;
    }
    for (const segment of raw.split(',')) {
      const trimmed = segment.trim();
      if (trimmed.length > 0) {
        out.push(trimmed);
      }
    }
  }
  return out;
}

/**
 * Determine if the input is a config object or flags object
 */
function isConfigObject(input: CommandFlags | BulkOperationConfig): boolean {
  const hasConfigKeys =
    'stackApiKey' in input || 'apiKey' in input || 'managementToken' in input || 'contentTypes' in input;
  const hasCliFlags = Object.keys(input).some((key) => key.includes('-'));

  if (hasConfigKeys) return true;
  if (hasCliFlags) return false;
  return true; // Default to config for backward compatibility
}

/**
 * Validate config object
 */
function validateConfig(config: BulkOperationConfig): string[] {
  const errors: string[] = [];

  // Skip validation for revert/retry operations
  if (config.revert || config.retryFailed) {
    return errors;
  }

  // Operation validation
  const operation = config.operation as OperationType;
  if (!config.operation) {
    errors.push('Operation is required');
  } else if (operation !== OperationType.PUBLISH && operation !== OperationType.UNPUBLISH) {
    errors.push(`Invalid operation type: ${config.operation}. Must be 'publish' or 'unpublish'`);
  }

  // Environments validation
  if (
    (operation === OperationType.PUBLISH || operation === OperationType.UNPUBLISH) &&
    (!config.environments || config.environments.length === 0)
  ) {
    errors.push('Environments are required for publish/unpublish operations');
  }
  if (config.environments?.some((env) => !env || env.trim() === '')) {
    errors.push('Environment list cannot contain empty values');
  }

  // Locales validation
  const isNonLocalized = config.filter === FilterType.NON_LOCALIZED;
  if (!isNonLocalized && (!config.locales || config.locales.length === 0)) {
    errors.push('Locales are required');
  }
  if (config.locales?.some((locale) => !locale || locale.trim() === '')) {
    errors.push('Locale list cannot contain empty values');
  }

  // Filter validation
  if (config.filter) {
    const validFilters = [FilterType.DRAFT, FilterType.MODIFIED, FilterType.UNPUBLISHED, FilterType.NON_LOCALIZED];
    if (!validFilters.includes(config.filter as FilterType)) {
      errors.push(
        `Invalid filter value: ${config.filter}. Must be one of: draft, modified, unpublished, non-localized`
      );
    }
  }

  // API version validation
  if (config.apiVersion && !['3', '3.2'].includes(config.apiVersion)) {
    errors.push(`Invalid API version: ${config.apiVersion}. Supported versions: 3, 3.2`);
  }

  // Publish mode validation
  if (config.publishMode && config.publishMode !== PublishMode.BULK && config.publishMode !== PublishMode.SINGLE) {
    errors.push(`Invalid publish mode: ${String(config.publishMode)}. Must be 'bulk' or 'single'`);
  }

  // Content types validation
  if (config.contentTypes !== undefined) {
    if (config.contentTypes.length === 0 || config.contentTypes.some((ct) => !ct || ct.trim() === '')) {
      errors.push('Content type list cannot be empty or contain empty values');
    }
  }

  return errors;
}

/**
 * Validate flags object
 */
function validateCommandFlags(flags: CommandFlags): string[] {
  const errors: string[] = [];

  // Stack credentials validation
  if (!flags.alias && !flags['stack-api-key']) {
    errors.push('Either --alias or --stack-api-key is required');
  }

  // Skip operation validation if retry-failed or revert is provided
  if (flags['retry-failed'] || flags['revert']) {
    return errors;
  }

  // Operation validation
  if (!flags.operation) {
    errors.push('Operation is required');
  } else if (flags.operation !== 'publish' && flags.operation !== 'unpublish') {
    errors.push(`Invalid operation type: ${flags.operation}. Must be 'publish' or 'unpublish'`);
  }

  const operation = flags.operation as OperationType;

  // Environment validation
  if (
    (operation === OperationType.PUBLISH || operation === OperationType.UNPUBLISH) &&
    (!flags.environments || flags.environments.length === 0)
  ) {
    errors.push('Environments are required for publish/unpublish operations');
  }
  if (flags.environments?.some((env) => !env || env.trim() === '')) {
    errors.push('Environment list cannot contain empty values');
  }

  // Locale validation
  const isNonLocalized = flags.filter === FilterType.NON_LOCALIZED;
  if (!isNonLocalized && (!flags.locales || flags.locales.length === 0)) {
    errors.push('Locales are required');
  }
  if (flags.locales?.some((locale) => !locale || locale.trim() === '')) {
    errors.push('Locale list cannot contain empty values');
  }

  // Content types validation
  if (flags['content-types'] !== undefined) {
    if (flags['content-types'].length === 0 || flags['content-types'].some((ct) => !ct || ct.trim() === '')) {
      errors.push('Content type list cannot be empty or contain empty values');
    }
  }

  // Filter validation
  if (flags.filter) {
    const validFilters = ['draft', 'modified', 'unpublished', 'non-localized'];
    if (!validFilters.includes(flags.filter)) {
      errors.push(`Invalid filter value: ${flags.filter}. Must be one of: draft, modified, unpublished, non-localized`);
    }
  }

  // API version validation
  if (flags['api-version'] && !['3', '3.2'].includes(flags['api-version'])) {
    errors.push(`Invalid API version: ${flags['api-version']}. Supported versions: 3, 3.2`);
  }

  // Publish mode validation
  if (flags['publish-mode'] && !['bulk', 'single'].includes(flags['publish-mode'])) {
    errors.push(`Invalid publish mode: ${flags['publish-mode']}. Must be 'bulk' or 'single'`);
  }

  // Cross-publish with source-env validation
  if (flags['source-env'] && !flags['source-alias']) {
    errors.push(
      'Cross-publish requires --source-alias flag with a delivery token. Add one using: csdx auth:tokens:add'
    );
  }
  if (flags['source-alias'] && !flags['source-env']) {
    errors.push('--source-alias can only be used with --source-env for cross-publish operations');
  }

  // Variants require api-version 3.2
  if (flags['include-variants'] && flags['api-version'] !== '3.2') {
    errors.push('--include-variants requires --api-version 3.2');
  }

  return errors;
}

/**
 * Validate command flags or configuration
 */
export function validateFlags(flagsOrConfig: CommandFlags | BulkOperationConfig): { valid: boolean; errors: string[] } {
  const isConfig = isConfigObject(flagsOrConfig);
  const errors = isConfig ? validateConfig(flagsOrConfig) : validateCommandFlags(flagsOrConfig);

  // Display errors in red if validation failed
  if (errors.length > 0) {
    console.error(chalk.red.bold('\n✗ Validation Error:'));
    errors.forEach((error) => {
      console.error(chalk.red(`  • ${error}`));
    });
    console.error('');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Build configuration from command flags and options
 * Supports both CLI flags and config file format
 */
export function buildConfig(flags: CommandFlags): BulkOperationConfig {
  const config: BulkOperationConfig = {
    alias: flags.alias,
    stackApiKey: flags['stack-api-key'],
    operation: flags.operation,
    environments: expandFlagStringList(flags.environments),
    locales: expandFlagStringList(flags.locales),
    contentTypes: flags['content-types'] !== undefined ? expandFlagStringList(flags['content-types']) : undefined,
    includeVariants: flags['include-variants'],
    folderUid: flags['folder-uid'],
    sourceEnv: flags['source-env'],
    publishMode: (flags['publish-mode'] as PublishMode) || PublishMode.BULK,
    apiVersion: flags['api-version'] || '3',
    branch: flags.branch || 'main',
    filter: flags.filter,
    maxRetries: flags['max-retries'] || 3,
    retryFailed: flags['retry-failed'],
    revert: flags['revert'],
    bulkOperationFolder: flags['bulk-operation-file'],
  };

  // Build filters object if filter flag is provided
  if (flags.filter) {
    config.filters = {
      filterType: flags.filter as FilterType,
    };
  }

  return config;
}

/**
 * Setup stack configuration with token retrieval from aliases
 * Similar to export-config-handler pattern
 *
 * @param flags - Command flags
 * @param cmaHost - CMA host from region config
 * @param cdaHost - CDA host from region config (optional, for cross-publish)
 * @returns Stack configuration with resolved tokens
 */
export function setupStackConfig(flags: CommandFlags, cmaHost?: string, cdaHost?: string): StackConfig {
  const stackConfig: StackConfig = {
    apiKey: flags['stack-api-key'],
    alias: flags.alias,
    host: cmaHost || 'api.contentstack.io',
    cda: cdaHost || 'cdn.contentstack.io',
    branch: flags.branch,
  };

  // Get management token from alias if provided
  if (flags.alias) {
    const tokenData = configHandler.get(`tokens.${flags.alias}`);
    if (!tokenData) {
      const errorMsg = `No token found for alias '${flags.alias}'. Please add a token using: csdx auth:tokens:add -a ${flags.alias}`;
      throw new DisplayedError(errorMsg);
    }

    if (!tokenData.apiKey || !tokenData.token) {
      const errorMsg = `Invalid token data for alias '${flags.alias}'. Token is missing required fields. Please re-add the token using: csdx auth:tokens:add -a ${flags.alias}`;
      throw new DisplayedError(errorMsg);
    }

    stackConfig.apiKey = tokenData.apiKey as string;
    stackConfig.managementToken = tokenData.token as string;
  }

  // Get delivery token from source-alias for cross-publish
  if (flags['source-alias']) {
    const sourceTokenData = configHandler.get(`tokens.${flags['source-alias']}`);

    if (!sourceTokenData) {
      const errorMsg = $t(messages.SOURCE_ALIAS_NOT_FOUND, { alias: flags['source-alias'] });
      throw new DisplayedError(errorMsg);
    }

    if (sourceTokenData.type !== 'delivery') {
      const errorMsg = $t(messages.SOURCE_ALIAS_INVALID_TYPE, {
        alias: flags['source-alias'],
        type: sourceTokenData.type,
      });
      throw new DisplayedError(errorMsg);
    }

    // Check if delivery token has expired
    if (sourceTokenData.expiresAt && new Date(sourceTokenData.expiresAt as string) < new Date()) {
      const errorMsg = `Delivery token for alias '${flags['source-alias']}' has expired. Please refresh or add a new token.`;
      throw new DisplayedError(errorMsg);
    }

    stackConfig.deliveryToken = sourceTokenData.token as string;
    stackConfig.environment = sourceTokenData.environment as string;

    // Validate that source-alias environment matches source-env flag
    if (flags['source-env'] && stackConfig.environment !== flags['source-env']) {
      // Use environment from alias as it's tied to the delivery token
      stackConfig.environment = sourceTokenData.environment as string;
    }
  } else if (flags['source-env']) {
    // If only source-env is provided without source-alias, use it
    stackConfig.environment = flags['source-env'];
  }

  return stackConfig;
}
