import chalk from 'chalk';
import { flags, log, createLogContext, cliux, handleAndLogError, FlagInput } from '@contentstack/cli-utilities';

import messages, { $t } from '../../../messages';
import { BaseCsAssetsCommand } from '../../../base-am-command';
import { CsAssetsService } from '../../../services';
import {
  loadAssetUidsFromFile,
  loadBulkDeleteItemsFromFile,
  LoadAssetUidsError,
} from '../../../utils/asset-uids-from-file';
import { generateCsAssetsJobStatusUrl } from '../../../utils/bulk-publish-url-generator';
import { CsAssetsBulkDeleteItem } from '../../../interfaces';

const COMMAND_ID = 'cm:stacks:bulk-am-assets';

type RegionWithOptionalCsAssetsUrl = { csAssetsUrl?: string };

/**
 * CS Assets bulk delete (job) / bulk move; asset UIDs come from a JSON file `{ "uids": [...] }`.
 */
export default class BulkCsAssets extends BaseCsAssetsCommand {
  static description = messages.BULK_CS_ASSETS_DESCRIPTION;

  static examples = [
    '<%= config.bin %> <%= command.id %> --operation delete --space-uid am123 --org-uid bltcOrg --locale en-us --asset-uids-file ./assets.json',
    '<%= config.bin %> <%= command.id %> --operation move --space-uid am123 --org-uid bltcOrg --target-folder-uid amFolder --asset-uids-file ./assets.json',
    '<%= config.bin %> <%= command.id %> --operation delete --space-uid am123 --org-uid bltcOrg --workspace main --locale en-us --asset-uids-file ./uids.json -y',
  ];

  static flags: FlagInput = {
    operation: flags.string({
      description: messages.CS_ASSETS_OPERATION_FLAG,
      options: ['delete', 'move'],
    }),
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
    yes: flags.boolean({
      char: 'y',
      description: messages.YES,
      default: false,
    }),
  };

  private printCsAssetsSummary(
    op: 'delete' | 'move',
    opts: { jobId?: string; count?: number; folderUid?: string; notice?: string; error?: string; spaceUid?: string }
  ): void {
    if (opts.error) {
      log.error($t(messages.CS_ASSETS_OPERATION_FAILED, { operation: op }), this.loggerContext);
      log.error(opts.error, this.loggerContext);
    } else if (op === 'delete') {
      log.success($t(messages.CS_ASSETS_DELETE_SUCCESS), this.loggerContext);
      if (opts.jobId) log.info($t(messages.CS_ASSETS_DELETE_JOB_ID, { jobId: opts.jobId }), this.loggerContext);
      log.info($t(messages.CS_ASSETS_DELETE_ASYNC_NOTE), this.loggerContext);
      const statusUrl = generateCsAssetsJobStatusUrl(opts.spaceUid);
      if (statusUrl) log.info(statusUrl, this.loggerContext);
    } else {
      log.success($t(messages.CS_ASSETS_MOVE_SUCCESS), this.loggerContext);
      if (opts.count !== undefined && opts.folderUid) {
        log.info(
          $t(messages.CS_ASSETS_MOVE_ASSETS_COUNT, { count: opts.count, folderUid: opts.folderUid }),
          this.loggerContext
        );
      }
      const statusUrl = generateCsAssetsJobStatusUrl(opts.spaceUid);
      if (statusUrl) log.info(statusUrl, this.loggerContext);
    }
    if (opts.notice) log.info(opts.notice, this.loggerContext);
  }

  private handleAssetUidsFileError(e: LoadAssetUidsError): void {
    const pathShown = e.filePath;
    if (e.kind === 'READ') {
      log.error(
        $t(messages.CS_ASSETS_ASSET_UIDS_FILE_READ_FAILED, { path: pathShown, detail: e.message }),
        this.loggerContext
      );
    } else {
      log.error($t(messages.CS_ASSETS_ASSET_UIDS_FILE_INVALID, { path: pathShown, detail: e.message }), this.loggerContext);
    }
    process.exitCode = 1;
  }

  async run(): Promise<void> {
    try {
      const f = this.parsedFlags;

      const csAssetsBaseUrl = (this.region as RegionWithOptionalCsAssetsUrl).csAssetsUrl?.trim();
      if (!csAssetsBaseUrl) {
        log.error($t(messages.CS_ASSETS_URL_NOT_CONFIGURED), this.loggerContext);
        process.exitCode = 1;
        return;
      }

      const op = f.operation;
      if (op !== 'delete' && op !== 'move') {
        log.error($t(messages.CS_ASSETS_INVALID_OPERATION, { operation: String(op ?? '') }), this.loggerContext);
        process.exitCode = 1;
        return;
      }

      const spaceUid = f['space-uid'].trim();
      const orgUid = f['org-uid'].trim();
      const assetUidsPath = f['asset-uids-file'].trim();

      let deleteRows: CsAssetsBulkDeleteItem[];

      if (op === 'delete') {
        const locale = (f.locale ?? '').trim();
        if (!locale) {
          log.error($t(messages.CS_ASSETS_LOCALE_REQUIRED), this.loggerContext);
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
        const csAssetsService = new CsAssetsService(csAssetsBaseUrl, spaceUid, orgUid);
        const workspace = f.workspace ?? 'main';

        if (!f.yes) {
          console.log(chalk.yellow(`\n${$t(messages.OPERATION_CONFIG_HEADER)}\n`));
          console.log('   Operation: CS Assets bulk delete');
          console.log(`   Space UID: ${spaceUid}`);
          console.log(`   Organization UID: ${orgUid}`);
          console.log(`   Workspace: ${workspace}`);
          console.log(`   Locale: ${locale}`);
          console.log(`   Asset UIDs file: ${assetUidsPath}`);
          console.log(`   Total CS Assets delete entries: ${deleteRows.length}\n`);

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

        log.info($t(messages.CS_ASSETS_DELETING_ASSETS, { count: deleteRows.length, spaceUid }), this.loggerContext);
        const result = await csAssetsService.bulkDelete(spaceUid, workspace, deleteRows);
        if (!result.success) {
          this.printCsAssetsSummary('delete', { error: result.error ?? 'CS Assets bulk delete failed', spaceUid });
          process.exitCode = 1;
          return;
        }
        this.printCsAssetsSummary('delete', { jobId: result.jobId, notice: result.notice, spaceUid });
        return;
      }

      if (f.locale) {
        log.error($t(messages.CS_ASSETS_LOCALE_NOT_ALLOWED_FOR_MOVE), this.loggerContext);
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
      const csAssetsService = new CsAssetsService(csAssetsBaseUrl, spaceUid, orgUid);
      const workspace = f.workspace ?? 'main';

      if (!f.yes) {
        console.log(chalk.yellow(`\n${$t(messages.OPERATION_CONFIG_HEADER)}\n`));
        console.log('   Operation: CS Assets bulk move');
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
        $t(messages.CS_ASSETS_MOVING_ASSETS, { count: uids.length, targetFolderUid: moveFolderUid }),
        this.loggerContext
      );
      const result = await csAssetsService.bulkMove(spaceUid, workspace, uids, moveFolderUid);
      if (!result.success) {
        this.printCsAssetsSummary('move', { error: result.error ?? 'CS Assets bulk move failed', spaceUid });
        process.exitCode = 1;
        return;
      }
      this.printCsAssetsSummary('move', { count: uids.length, folderUid: moveFolderUid, notice: result.notice, spaceUid });
    } catch (error) {
      handleAndLogError(error);
    }
  }
}
