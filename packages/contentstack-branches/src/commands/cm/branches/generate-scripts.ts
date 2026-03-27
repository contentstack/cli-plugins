import { Command } from '@contentstack/cli-command';
import { cliux, flags, isAuthenticated, managementSDKClient } from '@contentstack/cli-utilities';
import { getMergeStatusWithContentTypes, handleErrorMsg, selectContentMergePreference, selectContentMergeCustomPreferences, generateMergeScripts } from '../../../utils';
import os from 'os';

/**
 * Command to generate entry migration scripts for a completed merge job.
 * Validates that merge is complete before allowing script generation.
 */
export default class BranchGenerateScriptsCommand extends Command {
  static readonly description: string = 'Generate entry migration scripts for a completed merge job';

  static readonly examples: string[] = [
    'csdx cm:branches:generate-scripts -k bltxxxxxxxx --merge-uid merge_abc123',
    'csdx cm:branches:generate-scripts --stack-api-key bltxxxxxxxx --merge-uid merge_abc123',
  ];

  static readonly usage: string = 'cm:branches:generate-scripts -k <value> --merge-uid <value>';

  static readonly flags = {
    'stack-api-key': flags.string({
      char: 'k',
      description: 'Provide your stack API key.',
      required: true,
    }),
    'merge-uid': flags.string({
      description: 'Merge job UID to generate scripts for.',
      required: true,
    }),
  };

  static readonly aliases: string[] = [];

  /**
   * Generates entry migration scripts for a completed merge job.
   * Validates merge status is 'complete' before proceeding with script generation.
   * Prompts user for merge preference (new entries, existing, or both).
   * Throws error if merge is not complete - user should check status using merge-status command.
   */
  async run(): Promise<any> {
    let spinner;
    try {
      const { flags: generateScriptsFlags } = await this.parse(BranchGenerateScriptsCommand);

      if (!isAuthenticated()) {
        const err = { errorMessage: 'You are not logged in. Please login with command $ csdx auth:login' };
        handleErrorMsg(err);
      }

      const { 'stack-api-key': stackAPIKey, 'merge-uid': mergeUID } = generateScriptsFlags;

      const stackAPIClient = await (await managementSDKClient({ host: this.cmaHost })).stack({
        api_key: stackAPIKey,
      });

      spinner = cliux.loaderV2('Fetching merge status...');
      const mergeStatusResponse = await getMergeStatusWithContentTypes(stackAPIClient, mergeUID);
      cliux.loaderV2('', spinner);

      // Check if merge is complete
      if (mergeStatusResponse.error) {
        cliux.print('⏳ Merge job is still in progress. Please wait for it to complete.', { color: 'yellow' });
        cliux.print('\nCheck status using:', { color: 'grey' });
        cliux.print(`  csdx cm:branches:merge-status -k ${stackAPIKey} --merge-uid ${mergeUID}`, { color: 'cyan' });
        cliux.print('\nTry script generation again once merge completes.', { color: 'grey' });
        process.exit(1);
      }

      // Extract merge details for script generation
      const { uid } = mergeStatusResponse;

      // Ask user for merge preference
      let mergePreference = await selectContentMergePreference();

      // Get content types data
      const contentTypes = mergeStatusResponse.content_types ?? { added: [], modified: [], deleted: [] };

      const updateEntryMergeStrategy = (items, mergeStrategy) => {
        items &&
          items.forEach((item) => {
            item.entry_merge_strategy = mergeStrategy;
          });
      };

      const mergePreferencesMap = {
        existing_new: 'merge_existing_new',
        new: 'merge_new',
        existing: 'merge_existing',
        ask_preference: 'custom',
      };
      const selectedMergePreference = mergePreferencesMap[mergePreference];

      if (selectedMergePreference) {
        if (selectedMergePreference === 'custom') {
          const selectedMergeItems = await selectContentMergeCustomPreferences(contentTypes);
          contentTypes.added = [];
          contentTypes.modified = [];
          contentTypes.deleted = [];

          selectedMergeItems?.forEach((item) => {
            contentTypes[item.status].push(item.value);
          });
        } else {
          updateEntryMergeStrategy(contentTypes.added, selectedMergePreference);
          updateEntryMergeStrategy(contentTypes.modified, selectedMergePreference);
        }
      } else {
        cliux.error(`error: Invalid preference ${mergePreference}`);
        process.exit(1);
      }

      // Generate merge scripts
      let scriptFolderPath = generateMergeScripts(contentTypes, uid);

      if (scriptFolderPath !== undefined) {
        cliux.success(`\nSuccess! Generated entry migration files in folder ${scriptFolderPath}`);
        cliux.print(
          '\nWARNING!!! Migration is not intended to be run more than once. Migrated(entries/assets) will be duplicated if run more than once',
          { color: 'yellow' },
        );

        let migrationCommand: string;
        const compareBase = mergeStatusResponse.compare_branch ?? mergeStatusResponse.base_branch;
        const baseBranch = mergeStatusResponse.base_branch ?? 'main';

        if (os.platform() === 'win32') {
          migrationCommand = `csdx cm:stacks:migration --multiple --file-path ./${scriptFolderPath} --config compare-branch:${compareBase} file-path:./${scriptFolderPath} --branch ${baseBranch} --stack-api-key ${stackAPIKey}`;
        } else {
          migrationCommand = `csdx cm:stacks:migration --multiple --file-path ./${scriptFolderPath} --config {compare-branch:${compareBase},file-path:./${scriptFolderPath}} --branch ${baseBranch} --stack-api-key ${stackAPIKey}`;
        }

        cliux.print(
          `\nKindly follow the steps in the guide "https://www.contentstack.com/docs/developers/cli/entry-migration" to update the migration scripts, and then run the command:\n\n${migrationCommand}`,
          { color: 'blue' },
        );
      }
    } catch (error) {
      if (spinner) cliux.loaderV2('', spinner);
      cliux.error('Failed to generate scripts', error.message || error);
      process.exit(1);
    }
  }
}
