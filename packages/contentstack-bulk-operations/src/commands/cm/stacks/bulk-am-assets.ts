import chalk from 'chalk';
import { flags, log, createLogContext, cliux, handleAndLogError, FlagInput } from '@contentstack/cli-utilities';

import messages, { $t } from '../../../messages';
import { BaseBulkCommand } from '../../../base-bulk-command';
import { AmAssetService } from '../../../services';
import {
  loadAssetUidsFromFile,
  loadBulkDeleteItemsFromFile,
  LoadAssetUidsError,
} from '../../../utils/asset-uids-from-file';
import { AmBulkDeleteItem, ResourceType } from '../../../interfaces';

const COMMAND_ID = 'cm:stacks:bulk-am-assets';

type RegionWithOptionalAmUrl = { csAssetsUrl?: string };

/**
 * AM bulk delete (job) / bulk move — CS Assets API only; asset UIDs come from a JSON file `{ "uids": [...] }`.
 */
export default class BulkAmAssets extends BaseBulkCommand {
  static description = messages.BULK_AM_ASSETS_DESCRIPTION;

  static examples = [
    '<%= config.bin %> <%= command.id %> --operation delete --space-uid am123 --org-uid bltcOrg --locale en-us --asset-uids-file ./assets.json',
    '<%= config.bin %> <%= command.id %> --operation move --space-uid am123 --org-uid bltcOrg --target-folder-uid amFolder --asset-uids-file ./assets.json',
    '<%= config.bin %> <%= command.id %> --operation delete --space-uid am123 --org-uid bltcOrg --workspace main --locale en-us --asset-uids-file ./uids.json -y',
  ];

  static flags: FlagInput = {
    operation: flags.string({
      description: messages.AM_OPERATION_FLAG,
      options: ['delete', 'move'],
    }),
    'space-uid': flags.string({
      description: messages.AM_SPACE_UID_FLAG,
    }),
    'org-uid': flags.string({
      description: messages.AM_ORG_UID_FLAG,
    }),
    workspace: flags.string({
      default: 'main',
      description: messages.AM_WORKSPACE_FLAG,
    }),
    'asset-uids-file': flags.string({
      description: messages.AM_ASSET_UIDS_FILE_FLAG,
    }),
    locale: flags.string({
      description: messages.AM_LOCALE_FLAG,
    }),
    'target-folder-uid': flags.string({
      description: messages.AM_TARGET_FOLDER_FLAG,
    }),
    yes: flags.boolean({
      char: 'y',
      description: messages.YES,
      default: false,
    }),
  };

  protected resourceType = ResourceType.AM_ASSET;

  private printAmSummary(op: 'delete' | 'move', opts: { jobId?: string; count?: number; folderUid?: string; notice?: string; error?: string }): void {
    if (opts.error) {
      log.error($t(messages.AM_OPERATION_FAILED, { operation: op }), this.loggerContext);
      log.error(opts.error, this.loggerContext);
    } else if (op === 'delete') {
      log.success($t(messages.AM_DELETE_SUCCESS), this.loggerContext);
      if (opts.jobId) log.info($t(messages.AM_DELETE_JOB_ID, { jobId: opts.jobId }), this.loggerContext);
      log.info($t(messages.AM_DELETE_ASYNC_NOTE), this.loggerContext);
    } else {
      log.success($t(messages.AM_MOVE_SUCCESS), this.loggerContext);
      if (opts.count !== undefined && opts.folderUid) {
        log.info($t(messages.AM_MOVE_ASSETS_COUNT, { count: opts.count, folderUid: opts.folderUid }), this.loggerContext);
      }
    }
    if (opts.notice) log.info(opts.notice, this.loggerContext);
  }

  private handleAssetUidsFileError(e: LoadAssetUidsError): void {
    const pathShown = e.filePath;
    if (e.kind === 'READ') {
      log.error(
        $t(messages.AM_ASSET_UIDS_FILE_READ_FAILED, { path: pathShown, detail: e.message }),
        this.loggerContext
      );
    } else {
      log.error($t(messages.AM_ASSET_UIDS_FILE_INVALID, { path: pathShown, detail: e.message }), this.loggerContext);
    }
    process.exitCode = 1;
  }

  async run(): Promise<void> {
    try {
      const f = this.parsedFlags;

      const amBaseUrl = (this.region as RegionWithOptionalAmUrl).csAssetsUrl?.trim();
      if (!amBaseUrl) {
        log.error($t(messages.AM_URL_NOT_CONFIGURED), this.loggerContext);
        process.exitCode = 1;
        return;
      }

      const op = f.operation;
      if (op !== 'delete' && op !== 'move') {
        log.error($t(messages.AM_INVALID_OPERATION, { operation: String(op ?? '') }), this.loggerContext);
        process.exitCode = 1;
        return;
      }

      const spaceUid = (f['space-uid'] ?? '').trim();
      if (!spaceUid) {
        log.error($t(messages.SPACE_UID_REQUIRED), this.loggerContext);
        process.exitCode = 1;
        return;
      }

      const orgUid = (f['org-uid'] ?? '').trim();
      if (!orgUid) {
        log.error($t(messages.ORG_UID_REQUIRED), this.loggerContext);
        process.exitCode = 1;
        return;
      }

      const assetUidsPath = (f['asset-uids-file'] ?? '').trim();
      if (!assetUidsPath) {
        log.error($t(messages.AM_ASSET_UIDS_FILE_REQUIRED), this.loggerContext);
        process.exitCode = 1;
        return;
      }

      let deleteRows: AmBulkDeleteItem[];

      if (op === 'delete') {
        const locale = (f.locale ?? '').trim();
        if (!locale) {
          log.error($t(messages.AM_LOCALE_REQUIRED), this.loggerContext);
          process.exitCode = 1;
          return;
        }
        try {
          deleteRows = loadBulkDeleteItemsFromFile(assetUidsPath, locale);
        } catch (e: unknown) {
          if (e instanceof LoadAssetUidsError) {
            this.handleAssetUidsFileError(e);
          } else {
            handleAndLogError(e);
            process.exitCode = 1;
          }
          return;
        }

        createLogContext(this.context?.info?.command || COMMAND_ID, spaceUid, 'OAuth/Token');
        const amService = new AmAssetService(amBaseUrl, spaceUid, orgUid);
        const workspace = f.workspace ?? 'main';

        if (!f.yes) {
          console.log(chalk.yellow(`\n${$t(messages.OPERATION_CONFIG_HEADER)}\n`));
          console.log('   Operation: AM bulk delete');
          console.log(`   Space UID: ${spaceUid}`);
          console.log(`   Organization UID: ${orgUid}`);
          console.log(`   Workspace: ${workspace}`);
          console.log(`   Locale: ${locale}`);
          console.log(`   Asset UIDs file: ${assetUidsPath}`);
          console.log(`   Total AM delete entries: ${deleteRows.length}\n`);

          const confirmed: boolean = await cliux.inquire({
            type: 'confirm',
            name: 'proceed',
            message: chalk.grey($t(messages.CONTINUE_WITH_CONFIG)),
            default: false,
          });
          if (!confirmed) {
            log.warn($t(messages.OPERATION_CANCELLED), this.loggerContext);
            return;
          }
        }

        log.info($t(messages.AM_DELETING_ASSETS, { count: deleteRows.length, spaceUid }), this.loggerContext);
        const result = await amService.bulkDelete(spaceUid, workspace, deleteRows);
        if (!result.success) {
          this.printAmSummary('delete', { error: result.error ?? 'AM bulk delete failed' });
          process.exitCode = 1;
          return;
        }
        this.printAmSummary('delete', { jobId: result.jobId, notice: result.notice });
        return;
      }

      if (f.locale) {
        log.error($t(messages.AM_LOCALE_NOT_ALLOWED_FOR_MOVE), this.loggerContext);
        process.exitCode = 1;
        return;
      }

      const moveFolderUid = (f['target-folder-uid'] ?? '').trim();
      if (!moveFolderUid) {
        log.error($t(messages.TARGET_FOLDER_REQUIRED), this.loggerContext);
        process.exitCode = 1;
        return;
      }

      let uids: string[];
      try {
        uids = loadAssetUidsFromFile(assetUidsPath);
      } catch (e: unknown) {
        if (e instanceof LoadAssetUidsError) {
          this.handleAssetUidsFileError(e);
        } else {
          handleAndLogError(e);
          process.exitCode = 1;
        }
        return;
      }

      createLogContext(this.context?.info?.command || COMMAND_ID, spaceUid, 'OAuth/Token');
      const amService = new AmAssetService(amBaseUrl, spaceUid, orgUid);
      const workspace = f.workspace ?? 'main';

      if (!f.yes) {
        console.log(chalk.yellow(`\n${$t(messages.OPERATION_CONFIG_HEADER)}\n`));
        console.log('   Operation: AM bulk move');
        console.log(`   Space UID: ${spaceUid}`);
        console.log(`   Organization UID: ${orgUid}`);
        console.log(`   Workspace: ${workspace}`);
        console.log(`   Target folder UID: ${moveFolderUid}`);
        console.log(`   Asset UIDs file: ${assetUidsPath}`);
        console.log(`   Assets: ${uids.length}\n`);

        const confirmed: boolean = await cliux.inquire({
          type: 'confirm',
          name: 'proceed',
          message: chalk.grey($t(messages.CONTINUE_WITH_CONFIG)),
          default: false,
        });
        if (!confirmed) {
          log.warn($t(messages.OPERATION_CANCELLED), this.loggerContext);
          return;
        }
      }

      log.info(
        $t(messages.AM_MOVING_ASSETS, { count: uids.length, targetFolderUid: moveFolderUid }),
        this.loggerContext
      );
      const result = await amService.bulkMove(spaceUid, workspace, uids, moveFolderUid);
      if (!result.success) {
        this.printAmSummary('move', { error: result.error ?? 'AM bulk move failed' });
        process.exitCode = 1;
        return;
      }
      this.printAmSummary('move', { count: uids.length, folderUid: moveFolderUid, notice: result.notice });
    } catch (error) {
      handleAndLogError(error);
    }
  }
}
