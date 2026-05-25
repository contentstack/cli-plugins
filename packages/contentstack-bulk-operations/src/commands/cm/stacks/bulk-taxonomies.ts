import { Command } from '@contentstack/cli-command';
import { flags, log, createLogContext, handleAndLogError } from '@contentstack/cli-utilities';

import messages, { $t } from '../../../messages';
import { BaseBulkCommand } from '../../../base-bulk-command';
import { TaxonomyService } from '../../../services';
import { fillMissingFlags, clearLogs, fetchTaxonomyList } from '../../../utils';
import { parseTaxonomyPublishItems } from '../../../utils/taxonomy-publish-parse';
import { BulkOperationResult, OperationType, ResourceType, TaxonomyPublishItem } from '../../../interfaces';

const COMMAND_ID = 'cm:stacks:bulk-taxonomies';

/**
 * Publish/unpublish taxonomies via CMA taxonomy job APIs (`stack.taxonomy().publish|unpublish`).
 * Uses the same BaseBulkCommand lifecycle as bulk-entries / bulk-assets.
 */
export default class BulkTaxonomies extends BaseBulkCommand {
  static description = messages.BULK_TAXONOMIES_DESCRIPTION;

  static examples = [
    // Publish specific taxonomies (comma-separated UIDs)
    '<%= config.bin %> <%= command.id %> --operation publish --environments dev,staging --locales en-us --taxonomies products_tax,brands_tax -k blt123',

    // Publish every taxonomy in the stack (omit --taxonomies)
    '<%= config.bin %> <%= command.id %> --operation publish --environments development --locales en-us,hi-in -k blt123',

    // Unpublish specific taxonomies
    '<%= config.bin %> <%= command.id %> --operation unpublish --environments prod --locales en-us --taxonomies my_taxonomy -a myAlias',

    // Multiple locales with a Management token alias
    '<%= config.bin %> <%= command.id %> --operation publish --environments staging --locales en-us,fr-fr --taxonomies taxonomy_a -a myAlias',

    // Explicit CMA version for taxonomy publish (default is 3.2)
    '<%= config.bin %> <%= command.id %> --operation publish --environments development --locales en-us --taxonomies products_tax --api-version 3.2 -k blt123',

    // Publish taxonomies on a non-main branch
    '<%= config.bin %> <%= command.id %> --operation publish --branch feature --environments development --locales en-us --taxonomies brands_tax -k blt123',
  ];

  static flags = {
    ...BaseBulkCommand.baseFlags,
    taxonomies: flags.string({
      description: messages.TAXONOMY_ITEMS,
    }),
    'api-version': flags.string({
      default: '3.2',
      description: messages.TAXONOMY_API_VERSION,
    }),
  } as any;

  protected resourceType: ResourceType = ResourceType.TAXONOMY;

  /**
   * Taxonomies use credential/env/locale prompts without the generic "operation" list;
   * retry/revert and cross-publish are not supported (different APIs / log formats).
   */
  async init(): Promise<void> {
    // Call oclif Command init without running BaseBulkCommand.init (taxonomy uses its own prompts).
    await (Command.prototype as unknown as { init(this: Command): Promise<void> }).init.call(this);

    let { flags: parsed } = await this.parse(BulkTaxonomies);

    if (parsed.revert || parsed['retry-failed']) {
      console.error($t(messages.TAXONOMY_UNSUPPORTED_RETRY));
      process.exit(1);
    }

    if (parsed['source-env'] || parsed['source-alias']) {
      console.error($t(messages.TAXONOMY_UNSUPPORTED_CROSS_PUBLISH));
      process.exit(1);
    }

    parsed = await fillMissingFlags(parsed);
    this.parsedFlags = parsed;

    createLogContext(
      this.context?.info?.command || COMMAND_ID,
      parsed['stack-api-key'] || '',
      parsed.alias ? 'Management Token' : 'Basic Auth'
    );

    this.logger = log;
    this.loggerContext = { module: COMMAND_ID };

    await this.buildConfiguration(parsed);

    clearLogs(this.bulkOperationConfig.bulkOperationFolder);
    this.logger.debug('Cleared previous operation logs', this.loggerContext);

    await this.setupStack();
    await this.initializeComponents();

    this.logger.debug($t(messages.INITIALIZING, { resourceType: this.resourceType }), this.loggerContext);
  }

  async run(): Promise<void> {
    try {
      const publishTaxonomies = await this.fetchTaxonomies();

      if (publishTaxonomies.length === 0) {
        this.logger.warn($t(messages.NO_ITEMS_FOUND, { resourceType: 'taxonomies' }), this.loggerContext);
        return;
      }

      this.logger.info(
        $t(messages.FOUND_TAXONOMIES_TO_OPERATE, {
          count: publishTaxonomies.length,
          operation: this.parsedFlags.operation || this.bulkOperationConfig.operation || OperationType.PUBLISH,
        })
      );

      const confirmed = await this.confirmOperation(publishTaxonomies);
      if (!confirmed) {
        this.logger.warn($t(messages.OPERATION_CANCELLED), this.loggerContext);
        return;
      }

      const result = await this.executeBulkOperation(publishTaxonomies);
      this.printOperationSummary(result);
    } catch (error) {
      handleAndLogError(error);
    } finally {
      await this.finally(undefined);
    }
  }

  protected async fetchTaxonomies(): Promise<TaxonomyPublishItem[]> {
    const parsed = this.parsedFlags;
    const itemsStr = String(parsed.taxonomies || '').trim();

    if (itemsStr) {
      try {
        const parsedItems = parseTaxonomyPublishItems(itemsStr);
        if (parsedItems.length === 0) {
          this.logger.error($t(messages.TAXONOMY_ITEMS_REQUIRED), this.loggerContext);
          return [];
        }
        return parsedItems;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(msg, this.loggerContext);
        throw e;
      }
    }

    this.logger.info($t(messages.FETCHING_TAXONOMIES_LIST), this.loggerContext);
    const taxonomyList = await fetchTaxonomyList(this.managementStack, parsed.branch);
    if (taxonomyList.length === 0) {
      this.logger.warn($t(messages.NO_TAXONOMIES_IN_STACK), this.loggerContext);
      return [];
    }

    this.logger.info($t(messages.TAXONOMY_ALL_FROM_STACK, { count: taxonomyList.length }), this.loggerContext);
    return taxonomyList.map((t) => ({ uid: t.uid }));
  }

  /**
   * Submit one CMA taxonomy job (publish or unpublish), then reuse shared summary handling.
   */
  protected async executeBulkOperation(items: TaxonomyPublishItem[]): Promise<BulkOperationResult> {
    this.logger.debug($t(messages.EXECUTING_OPERATION, { count: items.length }), this.loggerContext);
    const startTime = Date.now();

    const operation = this.bulkOperationConfig.operation;
    if (operation !== OperationType.PUBLISH && operation !== OperationType.UNPUBLISH) {
      throw new Error($t(messages.UNSUPPORTED_OPERATION, { operation: operation ?? 'unknown' }));
    }

    const apiVersion = this.parsedFlags['api-version'] || '3.2';
    const locales = this.bulkOperationConfig.locales || [];
    const environments = this.bulkOperationConfig.environments || [];

    const taxonomyService = new TaxonomyService(this.managementStack);
    const payload = {
      locales,
      environments,
      items: items.map((i) => ({ uid: i.uid })),
    };
    const response =
      operation === OperationType.UNPUBLISH
        ? await taxonomyService.unpublish(payload, apiVersion, this.bulkOperationConfig.branch)
        : await taxonomyService.publish(payload, apiVersion, this.bulkOperationConfig.branch);

    const duration = Date.now() - startTime;
    const rawJobId = response.job_id;
    const jobId =
      rawJobId !== undefined && rawJobId !== null && String(rawJobId).length > 0 ? String(rawJobId) : undefined;

    if (response.notice) {
      this.logger.info(String(response.notice));
    }

    return {
      success: 0,
      failed: 0,
      total: items.length,
      duration,
      jobIds: jobId ? [jobId] : [],
    };
  }
}
