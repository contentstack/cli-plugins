import chalk from 'chalk';
import { ManagementStack } from '../interfaces';

/**
 * Custom error class to indicate the error has already been displayed to the user
 */
class DisplayedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DisplayedError';
  }
}

/**
 * Validate that the specified branch exists in the stack
 * @param managementStack - Management SDK stack instance
 * @param branchName - Branch name to validate
 * @param logger - Logger instance for debug messages
 * @throws Error if branch doesn't exist
 */
export async function validateBranch(
  managementStack: ManagementStack,
  branchName: string,
  logger?: any
): Promise<void> {
  try {
    // Skip validation for 'main' branch as it always exists
    if (branchName === 'main') {
      return;
    }

    // Fetch all branches from the stack
    const response = await managementStack.branch().query().find();
    const branches = response?.items || [];

    const branchExists = branches.some((branch: any) => branch.uid === branchName);

    if (!branchExists) {
      const errorMsg = `Branch '${branchName}' does not exist in the stack`;
      console.error(chalk.red.bold('\n✗ Validation Error:'));
      console.error(chalk.red(`  ${errorMsg}`));
      console.error('');
      throw new DisplayedError(errorMsg);
    }

    if (logger) {
      logger.debug(`Branch '${branchName}' validated successfully`);
    }
  } catch (error: any) {
    // If this is already a validation error (contains "does not exist"), just rethrow it
    if (error.message && error.message.includes('does not exist')) {
      throw error;
    }
    throw error;
  }
}

/**
 * Validate that the specified environments exist in the stack and return their UIDs
 * @param managementStack - Management SDK stack instance
 * @param environments - Array of environment names to validate
 * @param logger - Logger instance for debug messages
 * @returns Array of environment UIDs in the same order as input names
 * @throws Error if any environment doesn't exist
 */
export async function validateEnvironments(
  managementStack: ManagementStack,
  environments: string[],
  logger?: any
): Promise<string[]> {
  try {
    if (!environments || environments.length === 0) {
      return [];
    }

    // Fetch all environments from the stack
    const response = await managementStack.environment().query().find();
    const stackEnvironments = response?.items || [];

    // Create a map of environment name to UID
    const envMap = new Map<string, string>();
    stackEnvironments.forEach((env: any) => {
      envMap.set(env.name, env.uid);
    });

    // Validate and collect UIDs in the same order as input
    const environmentUids: string[] = [];
    for (const envName of environments) {
      const envUid = envMap.get(envName);
      if (!envUid) {
        const errorMsg = `Environment '${envName}' does not exist in the stack`;
        console.error(chalk.red.bold('\n✗ Validation Error:'));
        console.error(chalk.red(`  ${errorMsg}`));
        console.error('');
        throw new DisplayedError(errorMsg);
      }
      environmentUids.push(envUid);
    }

    if (logger) {
      logger.debug(`Environments validated successfully: ${environments.join(', ')}`);
      logger.debug(`Environment UIDs: ${environmentUids.join(', ')}`);
    }

    return environmentUids;
  } catch (error: any) {
    // If this is already a validation error (contains "does not exist"), just rethrow it
    if (error.message && error.message.includes('does not exist')) {
      throw error;
    }
    throw error;
  }
}
