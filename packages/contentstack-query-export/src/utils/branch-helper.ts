
import { getBranchFromAlias, log, handleAndLogError } from '@contentstack/cli-utilities';
import { QueryExportConfig } from '../types';

/**
 * Validates and sets up branch configuration for the stack
 *
 * @param config The export configuration
 * @param stackAPIClient The stack API client
 * @returns Promise that resolves when branch setup is complete
 */
export const setupBranches = async (config: QueryExportConfig, stackAPIClient: any): Promise<void> => {
  if (typeof config !== 'object') {
    throw new Error('The branch configuration is invalid.');
  }

  const context = config.context;

  try {
    if (config.branchAlias) {
      config.branchName = await getBranchFromAlias(stackAPIClient, config.branchAlias);
      return;
    }
    if (config.branchName) {
      // Check if the specified branch exists
      log.info(`Validating branch: ${config.branchName}`, context);

      const result = await stackAPIClient
        .branch(config.branchName)
        .fetch()
        .catch((err: unknown): any => {
          handleAndLogError(err, context, 'Error fetching branch');
          return null;
        });

      if (result && typeof result === 'object') {
        log.success(`Branch '${config.branchName}' found`, context);
      } else {
        throw new Error(`No branch found named ${config.branchName}.`);
      }
    } else {
      // If no branch name provided, check if the stack has branches
      log.info('No branch specified, checking if stack has branches', context);

      const result = await stackAPIClient
        .branch()
        .query()
        .find()
        .catch((): any => {
          log.info('Stack does not have branches', context);
          return null;
        });

      if (result && result.items && Array.isArray(result.items) && result.items.length > 0) {
        // Set default branch to 'main' if it exists
        config.branchName = 'main';
      } else {
        // Stack doesn't have branches
        log.info('Stack does not have branches', context);
        return;
      }
    }
    config.branchEnabled = true;
  } catch (error) {
    handleAndLogError(error, context, 'Error setting up branches');
    throw error;
  }
};

export default setupBranches;
