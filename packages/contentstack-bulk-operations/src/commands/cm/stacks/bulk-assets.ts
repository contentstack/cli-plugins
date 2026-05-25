import { flags, handleAndLogError } from '@contentstack/cli-utilities';

import { ResourceType } from '../../../interfaces';
import { BaseBulkCommand } from '../../../base-bulk-command';
import { $t, messages, fetchAssets } from '../../../utils';

/**
 * Bulk operations command for assets
 * Supports publish, unpublish, and cross publish operations
 */
export default class BulkAssets extends BaseBulkCommand {
  static description = messages.BULK_ASSETS_DESCRIPTION;

  static examples = [
    // Publish assets
    '<%= config.bin %> <%= command.id %> --operation publish --environments dev,staging --locales en-us -k blt123',

    // Unpublish assets
    '<%= config.bin %> <%= command.id %> --operation unpublish --environments prod --locales en-us -a myAlias',

    // Publish assets from specific folder
    '<%= config.bin %> <%= command.id %> --operation publish --folder-uid cs_root --environments prod --locales en-us -k blt123',

    // Publish with bulk API
    '<%= config.bin %> <%= command.id %> --operation publish --environments prod --locales en-us --publish-mode bulk -k blt123',

    // Cross-publish assets (requires delivery token alias)
    '<%= config.bin %> <%= command.id %> --operation publish --source-env production --source-alias prod-delivery --environments staging,dev --locales en-us -a myAlias',

    // Retry failed assets from a log file
    '<%= config.bin %> <%= command.id %> --retry-failed ./bulk-operation -a myAlias',

    // Revert (unpublish) previously published assets using success log
    '<%= config.bin %> <%= command.id %> --revert ./bulk-operation -a myAlias',
  ];

  static flags = {
    ...BaseBulkCommand.baseFlags,
    'folder-uid': flags.string({
      description: messages.FOLDER_UID,
    }),
  };

  protected resourceType: ResourceType = ResourceType.ASSET;

  async run(): Promise<void> {
    try {
      // Handle cross-publish separately if source-env is specified
      if (this.bulkOperationConfig.sourceEnv) {
        await this.handleCrossPublish(this.parsedFlags);
        return;
      }

      const assets = await this.fetchItems();

      if (assets.length === 0) {
        this.logger.warn($t(messages.NO_ITEMS_FOUND, { resourceType: ResourceType.ASSET }));
        return;
      }

      this.logger.info(
        $t(messages.FOUND_ASSETS_TO_OPERATE, { count: assets.length, operation: this.parsedFlags.operation || '' })
      );

      // Confirm operation
      const confirmed = await this.confirmOperation(assets);
      if (!confirmed) {
        this.logger.warn($t(messages.OPERATION_CANCELLED));
        return;
      }

      const result = await this.executeBulkOperation(assets);
      this.printOperationSummary(result);
    } catch (error) {
      handleAndLogError(error);
    } finally {
      await this.finally(undefined);
    }
  }

  protected async fetchItems(): Promise<any[]> {
    return await fetchAssets(this.bulkOperationConfig, this.managementStack, this.deliveryStack, this.logger);
  }
}
