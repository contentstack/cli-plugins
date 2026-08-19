import { Command } from '@contentstack/cli-command';
import {
  flags,
  log,
  createLogContext,
  getLogPath,
  handleAndLogError,
  cliErrorHandler,
  cliux,
  FlagInput,
  getChalk,
  loadChalk,
  CLIProgressManager,
} from '@contentstack/cli-utilities';

import config from './config';
import messages, { $t } from './messages';
import { BulkOperationService } from './services';
import { QueueManager, RetryStrategy, AdaptiveRateLimiter, OperationExecutor } from './core';
import {
  getStacks,
  logSummary,
  handleRevertOrRetry,
  loadConfigFromLogFile,
  buildConfig,
  validateFlags,
  setupStackConfig,
  setupBatchQueueListeners,
  confirmOperation as confirmOperationUtil,
  getUniqueEnvironments,
  getUniqueLocales,
  batchItems,
  handleCrossPublishOperation,
  logOperationInfo,
  validateBatch,
  enqueueIndividualItems,
  buildSingleModeResult,
  enqueueBatches,
  buildBulkModeResult,
  handleOperationError,
  fillMissingFlags,
  getLogPaths,
  clearLogs,
  generateBulkPublishStatusUrl,
  validateBranch,
  validateEnvironments,
  aggregateBatchResults,
} from './utils';
import {
  OperationType,
  ResourceType,
  PublishMode,
  BulkOperationConfig,
  BulkOperationResult,
  ManagementStack,
  DeliveryStack,
  RateLimitConfig,
  BulkJobResult,
} from './interfaces';

/**
 * Base command for bulk operations
 * Provides common functionality for bulk-entries and bulk-assets
 */
export abstract class BaseBulkCommand extends Command {
  protected abstract resourceType: ResourceType;

  // Common flags for all bulk operations
  static baseFlags: FlagInput = {
    alias: flags.string({
      char: 'a',
      description: messages.ALIAS,
    }),
    'stack-api-key': flags.string({
      char: 'k',
      description: messages.STACK_API_KEY_placeholder,
    }),
    operation: flags.string({
      description: messages.OPERATION,
      options: [OperationType.PUBLISH, OperationType.UNPUBLISH],
      required: false, // Not required if retry-failed or revert is used
    }),

    // Target environments and locales
    environments: flags.string({
      description: messages.ENVIRONMENTS,
      multiple: true,
    }),
    locales: flags.string({
      description: messages.LOCALES,
      multiple: true,
    }),

    // Cross-publish specific
    'source-env': flags.string({
      description: messages.SOURCE_ENV,
    }),
    'source-alias': flags.string({
      description: messages.SOURCE_ALIAS,
    }),

    // Publish mode configuration
    'publish-mode': flags.string({
      description: messages.PUBLISH_MODE,
      options: ['bulk', 'single'],
      default: 'bulk',
    }),

    // Filtering and selection
    branch: flags.string({
      default: 'main',
      description: messages.BRANCH,
    }),

    // Configuration and control
    config: flags.string({
      char: 'c',
      description: messages.CONFIG,
    }),
    yes: flags.boolean({
      char: 'y',
      description: messages.YES,
      default: false,
    }),
    'retry-failed': flags.string({
      description: messages.RETRY_FAILED,
    }),
    revert: flags.string({
      description: messages.REVERT,
    }),
    'bulk-operation-file': flags.string({
      description: messages.BULK_OPERATION_FOLDER,
      default: 'bulk-operation',
    }),
  };

  protected managementStack!: ManagementStack;
  protected deliveryStack!: DeliveryStack | null;
  protected logger: any;
  protected loggerContext: any;
  protected bulkOperationConfig!: BulkOperationConfig;
  protected bulkService!: BulkOperationService;
  protected queueManager!: QueueManager;
  protected rateLimiter!: AdaptiveRateLimiter;
  protected retryStrategy!: RetryStrategy;
  protected operationExecutor!: OperationExecutor;
  protected batchResults: Map<string, BulkJobResult> = new Map();
  protected parsedFlags: any;

  /**
   * Hook for subclasses to bypass the bulk-publish pipeline (stack setup, queue,
   * rate limiter) when an operation uses a different execution path entirely.
   * The subclass is then responsible for its own initialization after super.init().
   */
  protected shouldSkipBulkPipeline(): boolean {
    return false;
  }

  /**
   * Initialize common components
   */
  protected async init(): Promise<void> {
    await super.init();

    // Load chalk (ESM) up-front. The progress-module flag is set in buildConfig()
    // (config layer, mirrors export-config-handler) before the first log call.
    await loadChalk();
    if (this.shouldSkipBulkPipeline()) {
      return;
    }

    let { flags } = await this.parse(this.constructor as typeof BaseBulkCommand);

    this.parsedFlags = flags;

    createLogContext(
      this.context?.info?.command || this.id,
      flags['stack-api-key'] || '',
      flags.alias ? 'Management Token' : 'Basic Auth'
    );

    this.logger = log;
    this.loggerContext = { module: this.id };

    // Check for revert/retry EARLY - all config comes from log file
    const isRevertOrRetry = flags.revert || flags['retry-failed'];

    if (isRevertOrRetry) {
      // Handle revert/retry: load ALL config from log file
      await this.initForRevertOrRetry(flags);
      return;
    }

    // Fill missing required flags via interactive prompts
    flags = await this.resolveFlagsInteractively(flags);
    this.parsedFlags = flags;

    await this.buildConfiguration(flags);

    // Clear old logs when starting a NEW operation (so user can only revert the latest)
    clearLogs(this.bulkOperationConfig.bulkOperationFolder);
    this.logger.debug('Cleared previous operation logs', this.loggerContext);

    await this.setupStack();
    await this.initializeComponents();

    this.logger.debug($t(messages.INITIALIZING, { resourceType: this.resourceType }), this.loggerContext);
  }

  /**
   * Initialize for revert/retry operations
   * All configuration is loaded from the log file - no other flags needed
   */
  private async initForRevertOrRetry(flags: any): Promise<void> {
    const logPath = flags.revert || flags['retry-failed'];
    const isRetry = !!flags['retry-failed'];

    // Load config from log file
    const logFileConfig = loadConfigFromLogFile(logPath, isRetry, this.resourceType);

    if (!logFileConfig) {
      throw new Error($t(messages.NO_CONFIG_IN_LOG));
    }

    // Populate flags from log file config (CLI flags override log file values)
    const mergedFlags = {
      ...flags,
      'stack-api-key': flags['stack-api-key'] || logFileConfig.apiKey,
      environments: flags.environments?.length > 0 ? flags.environments : logFileConfig.environments,
      locales: flags.locales?.length > 0 ? flags.locales : logFileConfig.locales,
      branch: flags.branch !== 'main' ? flags.branch : logFileConfig.branch || 'main',
      // For revert, always use unpublish; for retry, use original operation
      operation: isRetry ? flags.operation || logFileConfig.operation : 'unpublish',
      // Preserve publish mode from log (single mode operations should retry/revert in single mode)
      // Prioritize log file value over default flag value
      'publish-mode': logFileConfig.publishMode || flags['publish-mode'] || 'bulk',
      revert: flags.revert,
      'retry-failed': flags['retry-failed'],
    };

    this.parsedFlags = mergedFlags;

    // Build config with merged flags (validation is skipped for revert/retry)
    await this.buildConfiguration(mergedFlags);

    // Setup stack using apiKey from log file
    await this.setupStack();
    await this.initializeComponents();

    await this.handleRevertOrRetry(mergedFlags);
    // This early exit bypasses finally(); print the run summary and clear the progress-module
    // flag here so it doesn't leak into the persisted config / later commands.
    this.finalizeProgressSummary();
    process.exit(0);
  }

  protected async setupStack(): Promise<void> {
    const flags = this.parsedFlags || (await this.parse(this.constructor as typeof BaseBulkCommand)).flags;

    let stackConfig;
    try {
      stackConfig = setupStackConfig(flags, this.cmaHost, this.cdaHost);
    } catch (error: any) {
      throw error;
    }

    const clients = await getStacks(stackConfig);
    this.managementStack = clients.managementStack;
    this.deliveryStack = clients.deliveryStack;

    this.logger.debug(
      $t(messages.STACK_SETUP_REQUIRED, { identifier: (stackConfig.apiKey || stackConfig.alias) as string }),
      this.loggerContext
    );

    // Validate branch exists (only if not using retry/revert)
    if (flags.branch && !flags.revert && !flags['retry-failed']) {
      try {
        await validateBranch(this.managementStack, flags.branch, this.logger);
      } catch (error: any) {
        throw error;
      }
    }

    // Validate environments exist and get their UIDs (only if not using retry/revert)
    if (flags.environments && flags.environments.length > 0 && !flags.revert && !flags['retry-failed']) {
      try {
        const environmentUids = await validateEnvironments(this.managementStack, flags.environments, this.logger);
        // Store environment UIDs in config for filtering operations
        this.bulkOperationConfig.environmentUids = environmentUids;
        this.logger.debug(`Stored environment UIDs in config: ${environmentUids.join(', ')}`, this.loggerContext);
      } catch (error: any) {
        throw error;
      }
    }
  }

  /**
   * Resolve flags interactively — subclasses can override to skip prompts for specific modes.
   */
  protected async resolveFlagsInteractively(flags: any): Promise<any> {
    return await fillMissingFlags(flags);
  }

  /**
   * Build operation configuration
   */
  protected async buildConfiguration(flags: any): Promise<void> {
    this.bulkOperationConfig = buildConfig(flags);

    // buildConfig splits comma-separated oclif `multiple` values; mirror onto flags so
    // setupStack, confirmation, and cross-publish use the same lists as the job config.
    flags.locales = this.bulkOperationConfig.locales;
    flags.environments = this.bulkOperationConfig.environments;
    if ('content-types' in flags && flags['content-types'] !== undefined) {
      flags['content-types'] = this.bulkOperationConfig.contentTypes;
    }

    const validation = validateFlags(this.bulkOperationConfig);
    if (!validation.valid) {
      // The progress-module flag was set above; this early exit bypasses finally(), so clear it
      // here to avoid leaking the setting into the persisted config / later commands.
      this.finalizeProgressSummary();
      process.exit(1);
    }

    this.logger.debug($t(messages.CONFIGURATION_BUILT), this.loggerContext);
  }

  /**
   * Initialize core components
   */
  protected async initializeComponents(): Promise<void> {
    const rateLimitConfig: RateLimitConfig = {
      maxRequestsPerSecond:
        this.bulkOperationConfig?.rateLimit?.requestsPerSecond || config.rateLimit.maxRequestsPerSecond,
      maxConcurrent: this.bulkOperationConfig?.rateLimit?.maxConcurrent || config.rateLimit.maxConcurrent,
    };
    this.rateLimiter = new AdaptiveRateLimiter(rateLimitConfig);

    this.retryStrategy = new RetryStrategy(this.bulkOperationConfig?.maxRetries || config.retry.maxRetries);

    this.queueManager = new QueueManager(rateLimitConfig.maxConcurrent);

    this.bulkService = new BulkOperationService(
      this.managementStack,
      this.logger,
      '3.2' // Required API version 3.2 for bulk operations
    );

    const publishMode = this.bulkOperationConfig.publishMode || PublishMode.BULK;

    if (publishMode === PublishMode.SINGLE) {
      // Initialize operation executor for single-mode operations with logging config
      this.operationExecutor = new OperationExecutor(
        this.rateLimiter,
        this.queueManager,
        this.retryStrategy,
        this.logger,
        this.managementStack,
        {
          logFolderPath: this.bulkOperationConfig.bulkOperationFolder,
          apiKey: this.bulkOperationConfig.apiKey || this.bulkOperationConfig.stackApiKey,
          branch: this.bulkOperationConfig.branch,
        }
      );
      this.logger.debug($t(messages.INITIALIZED_OPERATION_EXECUTOR), this.loggerContext);
    } else {
      // Setup queue event listeners for batch processing (BULK mode)
      // Pass retry strategy to enable automatic retry for failed batch submissions
      setupBatchQueueListeners({
        queueManager: this.queueManager,
        bulkService: this.bulkService,
        batchResults: this.batchResults,
        logger: this.logger,
        retryStrategy: this.retryStrategy,
        resourceType: this.resourceType,
        logFolderPath: this.bulkOperationConfig.bulkOperationFolder,
        apiKey: this.bulkOperationConfig.apiKey || this.bulkOperationConfig.stackApiKey,
        branch: this.bulkOperationConfig.branch,
      });
      this.logger.debug($t(messages.SETUP_BATCH_QUEUE_LISTENERS), this.loggerContext);
    }

    this.logger.debug($t(messages.COMPONENTS_INITIALIZED || 'Components initialized successfully'), this.loggerContext);
  }

  /**
   * Show operation summary and get confirmation
   */
  protected async confirmOperation(items?: any[]): Promise<boolean> {
    const flags = this.parsedFlags || (await this.parse(this.constructor as typeof BaseBulkCommand)).flags;
    const itemCount = items?.length || 0;

    return await confirmOperationUtil(this.bulkOperationConfig, itemCount, this.resourceType, flags.yes);
  }

  /**
   * This method handles HIGH-LEVEL orchestration:
   * - BULK mode: Creates batches, enqueues them, waits for BulkOperationService to process
   * - SINGLE mode: Enqueues individual items, waits for OperationExecutor to process
   * @param items - Items to process
   * @returns Aggregated results from all operations
   */
  protected async executeBulkOperation(items: any[]): Promise<BulkOperationResult> {
    this.logger.debug($t(messages.EXECUTING_OPERATION, { count: items.length }), this.loggerContext);
    const startTime = Date.now();

    // Initialize the run-level summary + header once (progress-manager UX, same as import).
    this.beginOperationSummary(items.length);

    let result: BulkOperationResult;
    try {
      logOperationInfo(items, this.logger);

      const publishMode = this.bulkOperationConfig.publishMode || PublishMode.BULK;
      this.logger.debug(`Using ${publishMode.toUpperCase()} mode for operation`, this.loggerContext);

      result =
        publishMode === PublishMode.SINGLE
          ? await this.executeSingleMode(items, startTime)
          : await this.executeBulkMode(items, startTime);
    } catch (error: any) {
      result = handleOperationError(error, items, startTime);
    }

    this.recordModuleSummary(result, items.length);
    return result;
  }

  /**
   * Initialize the run-level summary + header once. The label includes the branch, which
   * defaults to 'main' from the --branch flag, so it normally reads e.g. "BULK PUBLISH-main" —
   * the same "<OP>-<branch>" title shape export/import produce (SummaryManager uses the passed
   * operationName verbatim). The branch is dropped from the label only in the edge case where
   * it is unset. Shared with bulk-taxonomies via inheritance.
   */
  protected beginOperationSummary(itemCount: number): void {
    const operationLabel = (this.bulkOperationConfig?.operation || 'operation').toString().toUpperCase();
    const branchName = this.bulkOperationConfig?.branch || '';
    CLIProgressManager.initializeGlobalSummary(
      branchName ? `BULK ${operationLabel}-${branchName}` : `BULK ${operationLabel}`,
      branchName,
      $t(messages.EXECUTING_OPERATION, { count: itemCount })
    );
  }

  /**
   * Record a per-module row in the summary so the final summary shows Module Details for this
   * command (entry/asset/taxonomy).
   *
   * SINGLE mode processes items individually and returns real success/failed counts, so those
   * are used directly. BULK mode submits async jobs — buildBulkModeResult reports success/failed
   * as 0 because the publish runs server-side — so we count submission-level failures from
   * batchResults (recorded as status:'failed') and treat the remaining submitted items as
   * success. The printed status URL remains the source of truth for the real publish outcome.
   */
  protected recordModuleSummary(result: BulkOperationResult, submittedCount: number): void {
    const publishMode = this.bulkOperationConfig?.publishMode || PublishMode.BULK;
    const total = result?.total || submittedCount || 0;

    let success: number;
    let failed: number;
    if (publishMode === PublishMode.SINGLE) {
      failed = result?.failed || 0;
      success = typeof result?.success === 'number' ? result.success : Math.max(total - failed, 0);
    } else {
      // BULK: derive failures from batch submissions (result.failed is always 0 here).
      failed = aggregateBatchResults(this.batchResults).totalFailed;
      success = Math.max(total - failed, 0);
    }

    // Clamp so counts never over/under-report relative to total.
    failed = Math.min(Math.max(failed, 0), total);
    success = Math.min(Math.max(success, 0), total - failed);

    const progress = CLIProgressManager.createSimple(this.resourceType, total);
    for (let i = 0; i < success; i++) progress.tick(true);
    for (let i = 0; i < failed; i++) progress.tick(false);
    progress.complete(failed === 0);
  }

  /**
   * Print the run-level summary once and clear progress state. Idempotent: subclasses call
   * finally() explicitly AND oclif calls it again, so clearing the summary after printing makes
   * the second invocation a no-op.
   */
  protected finalizeProgressSummary(): void {
    CLIProgressManager.printGlobalSummary();
    CLIProgressManager.clearGlobalSummary();
  }

  /**
   * Execute operation in SINGLE mode - processes items individually
   */
  private async executeSingleMode(items: any[], startTime: number): Promise<BulkOperationResult> {
    this.logger.debug($t(messages.ENQUEUEING_ITEMS_SINGLE_MODE), this.loggerContext);
    this.batchResults.clear();

    enqueueIndividualItems(items, this.queueManager, this.bulkOperationConfig.operation as OperationType);
    this.logger.debug(`Enqueued ${items.length} items for sequential processing...`, this.loggerContext);

    await this.queueManager.waitForCompletion();

    return buildSingleModeResult(items, startTime, this.queueManager, this.logger);
  }

  /**
   * Execute operation in BULK mode - processes items in batches
   */
  private async executeBulkMode(items: any[], startTime: number): Promise<BulkOperationResult> {
    const environments = getUniqueEnvironments(items);
    const locales = getUniqueLocales(items);
    const batches = batchItems(items, environments, locales);

    batches.forEach((batch) => validateBatch(batch));
    this.logger.debug(`Created ${batches.length} batches for processing`, this.loggerContext);

    this.batchResults.clear();
    enqueueBatches(batches, this.queueManager, this.bulkOperationConfig.operation as OperationType);

    this.logger.debug(
      `Enqueued ${batches.length} batches. Starting processing with concurrency ${this.queueManager['concurrency']}...`,
      this.loggerContext
    );

    await this.queueManager.waitForCompletion();

    return buildBulkModeResult(batches, startTime, this.batchResults, this.logger);
  }

  /**
   * Cleanup resources
   */
  protected async cleanup(): Promise<void> {
    if (this.queueManager) {
      this.queueManager.pause();
      this.queueManager.clear();
    }

    if (this.rateLimiter && this.logger) {
      const metrics = this.rateLimiter.getMetrics();
      this.logger.debug($t(messages.RATE_LIMITER_METRICS), { ...metrics, ...this.loggerContext });
    }

    if (this.logger) {
      this.logger.debug($t(messages.CLEANUP_COMPLETED), this.loggerContext);
    }
  }

  /**
   * Print operation summary with bulk operation status URL and log file paths
   * Called at the end of run() method in subclasses
   */
  protected printOperationSummary(result: BulkOperationResult): void {
    const chalk = getChalk();
    const publishMode = this.bulkOperationConfig.publishMode || PublishMode.BULK;

    console.log('');
    console.log(chalk.gray('─'.repeat(60)));

    if (publishMode === PublishMode.BULK) {
      // For BULK mode, print job submission summary and status URL
      const jobCount = result.jobIds?.length || 0;
      console.log(chalk.green.bold(`✓ ${$t(messages.BULK_JOBS_SUBMITTED)}`));
      console.log(chalk.cyan(`  ${$t(messages.JOBS_SUBMITTED_COUNT, { count: jobCount })}`));
      console.log(`  Total items: ${result.total}`);

      // Generate and print status URL in a prominent color
      const statusUrl = generateBulkPublishStatusUrl(
        this.bulkOperationConfig.apiKey || this.bulkOperationConfig.stackApiKey,
        this.bulkOperationConfig.branch
      );
      if (statusUrl) {
        console.log('');
        console.log(chalk.yellow.bold(`  ${$t(messages.CHECK_STATUS_AT)}`));
        console.log(chalk.yellow(`  ${statusUrl}`));
      }
    } else {
      logSummary(result);
    }

    console.log('');
    const cliLogPath = getLogPath();
    console.log(chalk.blue(`  ${$t(messages.LOG_FILE_PATH)} ${cliLogPath}`));

    const bulkOpPaths = getLogPaths(this.bulkOperationConfig.bulkOperationFolder);
    console.log(chalk.magenta(`  ${$t(messages.BULK_OPERATION_FILE_PATH)} ${bulkOpPaths.folder}`));

    console.log(chalk.gray('─'.repeat(60)));
    console.log('');
  }

  /**
   * Handle revert or retry operations
   * Called from init() when --revert or --retry-failed flags are present
   */
  private async handleRevertOrRetry(flags: any): Promise<BulkOperationResult | void> {
    const logPath = flags.revert || flags['retry-failed'];
    const isRetry = !!flags['retry-failed'];

    const result = await handleRevertOrRetry(
      logPath,
      isRetry,
      this.resourceType,
      this.bulkOperationConfig,
      flags.yes,
      this.executeBulkOperation.bind(this),
      this.logger
    );

    if (result) {
      this.printOperationSummary(result);
    }

    return result;
  }

  /**
   * Handle cross-publish operation - can be overridden by child classes
   */
  protected async handleCrossPublish(flags: any): Promise<void> {
    // Fetch published items from source environment using Delivery API
    const itemsToPublish = await handleCrossPublishOperation(
      {
        sourceEnv: flags['source-env'] as string,
        targetEnvs: flags.environments as string[],
        locales: flags.locales as string[],
        contentTypes: flags['content-types'] as string[] | undefined,
        resourceType: this.resourceType,
        deliveryStack: this.deliveryStack!, // Required: initialized via source-alias delivery token
      },
      this.logger
    );

    if (itemsToPublish.length === 0) {
      this.logger.warn($t(messages.NO_ITEMS_FOUND, { resourceType: this.resourceType }), this.loggerContext);
      return;
    }

    const confirmed = await this.confirmOperation(itemsToPublish);
    if (!confirmed) {
      this.logger.warn($t(messages.OPERATION_CANCELLED));
      return;
    }

    const result = await this.executeBulkOperation(itemsToPublish);
    this.printOperationSummary(result);
  }

  /**
   * Handle errors that occur during command execution
   * This includes errors during init, run, and other phases
   */
  async catch(error: Error): Promise<void> {
    // For other errors, use the CLI utilities error handler
    handleAndLogError(error);

    // handleAndLogError only reaches the console when log.showConsoleLogs is enabled
    // (the winston error transport is silenced otherwise), so a failure would leave the
    // terminal completely silent when the user has console logs turned off. Print a
    // user-facing error line here to fill that gap, guarded so we don't double-print when
    // console logs are on and handleAndLogError already emitted the error.
    const showConsoleLogs = Boolean(configHandler.get('log')?.showConsoleLogs);
    if (!showConsoleLogs) {
      const errorMessage = cliErrorHandler.classifyError(error)?.message || error?.message || 'Unknown error';
      cliux.print(`Error: ${errorMessage}`, { color: 'red' });
    }
  }

  abstract run(): Promise<void>;

  protected async finally(_error: Error | undefined): Promise<void> {
    this.finalizeProgressSummary();
    await this.cleanup();
  }
}
