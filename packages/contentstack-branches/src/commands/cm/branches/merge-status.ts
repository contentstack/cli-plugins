import { Command } from '@contentstack/cli-command';
import { cliux, flags, isAuthenticated, managementSDKClient } from '@contentstack/cli-utilities';
import { displayMergeStatusDetails, handleErrorMsg } from '../../../utils';

/**
 * Command to check the status of a branch merge job.
 * Allows users to check merge progress and status asynchronously.
 */
export default class BranchMergeStatusCommand extends Command {
  static readonly description: string = 'Check the status of a branch merge job';

  static readonly examples: string[] = [
    'csdx cm:branches:merge-status -k bltxxxxxxxx --merge-uid merge_abc123',
    'csdx cm:branches:merge-status --stack-api-key bltxxxxxxxx --merge-uid merge_abc123',
  ];

  static readonly usage: string = 'cm:branches:merge-status -k <value> --merge-uid <value>';

  static readonly flags = {
    'stack-api-key': flags.string({
      char: 'k',
      description: 'Provide your stack API key.',
      required: true,
    }),
    'merge-uid': flags.string({
      description: 'Merge job UID to check status for.',
      required: true,
    }),
  };

  static readonly aliases: string[] = [];

  /**
   * Fetches and displays the current status of a branch merge job.
   * Useful for checking long-running merges asynchronously without blocking.
   */
  async run(): Promise<any> {
    try {
      const { flags: mergeStatusFlags } = await this.parse(BranchMergeStatusCommand);

      if (!isAuthenticated()) {
        const err = { errorMessage: 'You are not logged in. Please login with command $ csdx auth:login' };
        handleErrorMsg(err);
      }

      const { 'stack-api-key': stackAPIKey, 'merge-uid': mergeUID } = mergeStatusFlags;

      const stackAPIClient = await (await managementSDKClient({ host: this.cmaHost })).stack({
        api_key: stackAPIKey,
      });

      const spinner = cliux.loaderV2('Fetching merge status...');
      const mergeStatusResponse = await stackAPIClient
        .branch()
        .mergeQueue(mergeUID)
        .fetch();
      cliux.loaderV2('', spinner);

      if (!mergeStatusResponse?.queue?.length) {
        cliux.error(`No merge job found with UID: ${mergeUID}`);
        process.exit(1);
      }

      const mergeJobStatus = mergeStatusResponse.queue[0];
      displayMergeStatusDetails(mergeJobStatus);
    } catch (error) {
      cliux.error('Failed to fetch merge status', error.message || error);
      process.exit(1);
    }
  }
}
