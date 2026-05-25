import chalk from 'chalk';
import { cliux } from '@contentstack/cli-utilities';
import { $t, messages } from './index';
import { BulkOperationConfig, PublishMode } from '../interfaces';

/**
 * Shows operation summary and prompts for confirmation
 * @param config - Bulk operation configuration
 * @param itemCount - Number of items to process
 * @param resourceType - Type of resource (entry or asset)
 * @param skipConfirmation - If true, automatically confirms without prompting
 * @param logger - Logger instance for output
 * @returns Promise<boolean> - true if confirmed, false otherwise
 */
export async function confirmOperation(
  config: BulkOperationConfig,
  itemCount: number,
  resourceType: string,
  skipConfirmation: boolean
): Promise<boolean> {
  if (skipConfirmation) {
    return true;
  }

  const environments = config.environments || [];
  const locales = config.locales || [];
  const publishMode = config.publishMode || PublishMode.BULK;

  console.log(chalk.yellow(`\n${$t(messages.OPERATION_CONFIG_HEADER)}\n`));
  console.log(`   ${$t(messages.OPERATION_LABEL)}: ${config.operation}`);
  console.log(`   ${$t(messages.RESOURCE_TYPE_LABEL)}: ${resourceType}`);
  console.log(`   ${$t(messages.TOTAL_ITEMS_LABEL)}: ${itemCount}`);

  if (locales.length > 0) {
    console.log(`   ${$t(messages.LOCALES_LABEL)}: ${locales.join(', ')} (${locales.length})`);
  }

  console.log(`   ${$t(messages.ENVIRONMENTS_LABEL)}: ${environments.join(', ')} (${environments.length})`);
  console.log(`   ${$t(messages.PROCESSING_MODE_LABEL)}: ${publishMode.toUpperCase()}`);

  console.log('\n');

  const confirmed: boolean = await cliux.inquire({
    type: 'confirm',
    name: 'proceed',
    message: chalk.grey($t(messages.CONTINUE_WITH_CONFIG)),
    default: false,
  });

  return confirmed;
}
