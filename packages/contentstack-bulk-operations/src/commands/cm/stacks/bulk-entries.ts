import { flags, FlagInput, handleAndLogError } from '@contentstack/cli-utilities';

import { BaseBulkCommand } from '../../../base-bulk-command';
import { ResourceType, FilterType } from '../../../interfaces';
import { $t, messages, fetchEntries } from '../../../utils';

/**
 * Bulk operations command for entries
 * Supports publish, unpublish, and cross publish operations
 */
export default class BulkEntries extends BaseBulkCommand {
  static description = messages.BULK_ENTRIES_DESCRIPTION;

  static examples = [
    // Publish all content types
    '<%= config.bin %> <%= command.id %> --operation publish --environments dev --locales en-us -k blt123',

    // Publish entries
    '<%= config.bin %> <%= command.id %> --operation publish --content-types blog,article --environments dev --locales en-us -k blt123',

    // Unpublish entries
    '<%= config.bin %> <%= command.id %> --operation unpublish --content-types blog --environments prod --locales en-us -a myAlias',

    // Cross-publish entries (requires delivery token alias)
    '<%= config.bin %> <%= command.id %> --operation publish --content-types blog --source-env production --source-alias prod-delivery --environments staging --locales en-us -a myAlias',

    // Publish with bulk API
    '<%= config.bin %> <%= command.id %> --operation publish --content-types blog --environments prod --locales en-us --publish-mode bulk -k blt123',

    // Publish modified entries only
    '<%= config.bin %> <%= command.id %> --operation publish --content-types blog --environments prod --locales en-us --filter modified -k blt123',

    // Publish draft entries only
    '<%= config.bin %> <%= command.id %> --operation publish --content-types blog --environments prod --locales en-us --filter draft -k blt123',

    // Publish unpublished entries only
    '<%= config.bin %> <%= command.id %> --operation publish --content-types blog --environments prod --locales en-us --filter unpublished -k blt123',

    // Publish non-localized entries only
    '<%= config.bin %> <%= command.id %> --operation publish --content-types blog --environments prod --filter non-localized -k blt123',

    // Publish entries with variants
    '<%= config.bin %> <%= command.id %> --operation publish --content-types blog --environments prod --locales en-us --include-variants -k blt123',

    // Retry failed entries from a log file
    '<%= config.bin %> <%= command.id %> --retry-failed ./bulk-operation',

    // Revert (unpublish) previously published entries using success log
    '<%= config.bin %> <%= command.id %> --revert ./bulk-operation',
  ];

  static flags: FlagInput = {
    ...BaseBulkCommand.baseFlags,
    'content-types': flags.string({
      description: messages.CONTENT_TYPES,
      multiple: true,
      required: false,
    }),
    filter: flags.string({
      description: messages.FILTER,
      options: [FilterType.DRAFT, FilterType.MODIFIED, FilterType.NON_LOCALIZED, FilterType.UNPUBLISHED],
    }),

    'include-variants': flags.boolean({
      description: messages.INCLUDE_VARIANTS,
      default: false,
    }),

    'api-version': flags.string({
      description: messages.API_VERSION,
      default: '3.2',
    }),
  };

  protected resourceType: ResourceType = ResourceType.ENTRY;

  async run(): Promise<void> {
    try {
      // Handle cross-publish separately if source-env is specified
      if (this.bulkOperationConfig.sourceEnv) {
        await this.handleCrossPublish(this.parsedFlags);
        return;
      }

      const entries = await this.fetchItems();

      if (entries.length === 0) {
        this.logger.warn($t(messages.NO_ITEMS_FOUND, { resourceType: 'entries' }));
        return;
      }

      this.logger.info(
        $t(messages.FOUND_ENTRIES_TO_OPERATE, { count: entries.length, operation: this.parsedFlags.operation || '' })
      );

      const confirmed = await this.confirmOperation(entries);
      if (!confirmed) {
        this.logger.warn($t(messages.OPERATION_CANCELLED));
        return;
      }

      const result = await this.executeBulkOperation(entries);
      this.printOperationSummary(result);
    } catch (error) {
      handleAndLogError(error);
    } finally {
      await this.finally(undefined);
    }
  }

  /**
   * Fetch entries for regular operations
   */
  protected async fetchItems(): Promise<any[]> {
    if (!this.bulkOperationConfig.contentTypes?.length) {
      this.logger.info($t(messages.NO_CONTENT_TYPES_SPECIFIED));
      const allContentTypes = await this.fetchAllContentTypes();
      this.logger.info(`Found ${allContentTypes.length} content types`);
      this.bulkOperationConfig.contentTypes = allContentTypes;
    }

    return await fetchEntries(this.bulkOperationConfig, this.managementStack, this.deliveryStack, this.logger);
  }

  /**
   * Fetch all content types from the stack
   */
  private async fetchAllContentTypes(): Promise<string[]> {
    try {
      const contentTypes: string[] = [];
      let skip = 0;
      const limit = 100;
      let hasMore = true;
      let totalCount: number | undefined;

      while (hasMore) {
        const response = await this.managementStack.contentType().query({ skip, limit, include_count: true }).find();
        const cts = response.items || [];
        if (totalCount === undefined && response.count !== undefined) {
          totalCount = response.count;
        }

        contentTypes.push(...cts.map((ct: any) => ct.uid));

        if (totalCount !== undefined) {
          hasMore = skip + limit < totalCount;
        } else {
          // Fallback
          hasMore = cts.length === limit;
        }

        skip += limit;
      }

      return contentTypes;
    } catch (error: any) {
      this.logger.error($t(messages.FAILED_TO_FETCH_CONTENT_TYPES), error);
      throw error;
    }
  }

  /**
   * Parse query from flags
   * TODO: Will be used when query flag is enabled
   */
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Method will be used when query flag is implemented

  private _parseQuery(_bulkEntriesFlags: any): Record<string, any> | undefined {
    // TODO: Implement when query flag is enabled
    // const queryString = bulkEntriesFlags.query as string | undefined;
    // if (!queryString) return undefined;
    // try {
    //   return JSON.parse(queryString);
    // } catch (error) {
    //   this.logger.warn("Invalid query JSON, ignoring", { query: queryString });
    //   return undefined;
    // }
    return undefined;
  }
}
