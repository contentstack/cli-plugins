import { flags, handleAndLogError, FlagInput } from '@contentstack/cli-utilities';

import { ResourceType, OperationType, CsAssetsFlags } from '../../../interfaces';
import { BaseBulkCommand } from '../../../base-bulk-command';
import {
  $t,
  messages,
  fetchAssets,
  fillMissingCsAssetsFlags,
  promptForOperation,
  runCsAssetsOperation,
  enforceOperationFlagMatrix,
  getOperationFromArgv,
  OperationFlagMatrixError,
  RETRY_REVERT_CONTEXT,
} from '../../../utils';

type RegionWithOptionalCsAssetsUrl = { csAssetsUrl?: string };

const ALL_OPERATION_CHOICES = [
  { name: 'Publish', value: OperationType.PUBLISH },
  { name: 'Unpublish', value: OperationType.UNPUBLISH },
  { name: 'Delete (CS Assets bulk delete)', value: OperationType.DELETE },
  { name: 'Move (CS Assets bulk move)', value: OperationType.MOVE },
];

/**
 * Bulk operations command for assets
 * Supports publish, unpublish, and cross publish operations (CMS), plus
 * delete and move operations (CS Assets).
 *
 * The two families use fully separate execution paths:
 * - publish/unpublish run through the BaseBulkCommand pipeline (stack setup,
 *   queue, rate limiter, retry) authenticated via stack API key or alias.
 * - delete/move run through the CS Assets runner (OAuth/Token against the
 *   region's csAssetsUrl) with no bulk-publish infrastructure at all.
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

    // CS Assets bulk delete (asset UIDs from a JSON file `{ "uids": [...] }`)
    '<%= config.bin %> <%= command.id %> --operation delete --space-uid am123 --org-uid bltOrg --locale en-us --asset-uids-file ./assets.json',

    // CS Assets bulk move to a target folder
    '<%= config.bin %> <%= command.id %> --operation move --space-uid am123 --org-uid bltOrg --target-folder-uid amFolder --asset-uids-file ./assets.json',
  ];

  static flags: FlagInput = {
    ...BaseBulkCommand.baseFlags,
    operation: flags.string({
      description: messages.BULK_ASSETS_OPERATION,
      options: [OperationType.PUBLISH, OperationType.UNPUBLISH, OperationType.DELETE, OperationType.MOVE],
      required: false, // Not required if retry-failed or revert is used
    }),
    'folder-uid': flags.string({
      description: messages.FOLDER_UID,
    }),

    // CS Assets delete/move flags
    'space-uid': flags.string({
      description: messages.CS_ASSETS_SPACE_UID_FLAG,
    }),
    'org-uid': flags.string({
      description: messages.CS_ASSETS_ORG_UID_FLAG,
    }),
    workspace: flags.string({
      default: 'main',
      description: messages.CS_ASSETS_WORKSPACE_FLAG,
    }),
    'asset-uids-file': flags.string({
      description: messages.CS_ASSETS_ASSET_UIDS_FILE_FLAG,
    }),
    locale: flags.string({
      description: messages.CS_ASSETS_LOCALE_FLAG,
    }),
    'target-folder-uid': flags.string({
      description: messages.CS_ASSETS_TARGET_FOLDER_FLAG,
    }),
  };

  protected resourceType: ResourceType = ResourceType.ASSET;

  /** True when the resolved operation is a CS Assets one (delete/move). */
  private csAssetsMode = false;
  private csAssetsFlags!: CsAssetsFlags;

  protected shouldSkipBulkPipeline(): boolean {
    return this.csAssetsMode;
  }

  protected async init(): Promise<void> {
    // Resolve the operation from raw argv BEFORE any pipeline work: the two
    // operation families use disjoint flags and auth, so the pipeline choice
    // (and flag validation) depends on it. Raw argv is also what lets us reject
    // explicitly-passed CMS flags that carry defaults (--branch, --publish-mode).
    let operation = getOperationFromArgv(this.argv);
    const isRevertOrRetry = this.argv.some(
      (token) =>
        token === '--retry-failed' ||
        token.startsWith('--retry-failed=') ||
        token === '--revert' ||
        token.startsWith('--revert=')
    );

    if (!operation && !isRevertOrRetry) {
      if (!process.stdin.isTTY) {
        throw new Error(
          'Missing required flag: --operation. Provide it when running in a non-interactive environment.'
        );
      }
      operation = await promptForOperation(ALL_OPERATION_CHOICES);
      // Feed the answer back into argv so both pipelines parse it like any other flag
      this.argv.push('--operation', operation);
    }

    enforceOperationFlagMatrix(operation ?? RETRY_REVERT_CONTEXT, this.argv, { module: this.id });

    this.csAssetsMode = operation === OperationType.DELETE || operation === OperationType.MOVE;

    // For delete/move, shouldSkipBulkPipeline() makes super.init() stop right after
    // the framework-level Command init — no stack setup, queue, or rate limiter.
    await super.init();

    if (this.csAssetsMode) {
      const { flags: parsed } = await this.parse(this.constructor as typeof BulkAssets);
      this.loggerContext = { module: this.id ?? 'cm:stacks:bulk-assets' };
      this.csAssetsFlags = (await fillMissingCsAssetsFlags(parsed)) as CsAssetsFlags;
      this.parsedFlags = this.csAssetsFlags;
    }
  }

  async catch(error: Error): Promise<void> {
    // Matrix violations are already logged (with exitCode set) by
    // enforceOperationFlagMatrix — the throw only aborts init().
    if (error instanceof OperationFlagMatrixError) {
      return;
    }
    return super.catch(error);
  }

  async run(): Promise<void> {
    if (this.csAssetsMode) {
      await runCsAssetsOperation({
        flags: this.csAssetsFlags,
        csAssetsBaseUrl: (this.region as RegionWithOptionalCsAssetsUrl).csAssetsUrl,
        commandId: this.context?.info?.command || this.id || 'cm:stacks:bulk-assets',
        loggerContext: this.loggerContext,
      });
      return;
    }

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
