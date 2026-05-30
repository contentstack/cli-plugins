import { cliux, configHandler, isAuthenticated } from '@contentstack/cli-utilities';
import { OperationType, FilterType } from '../interfaces';
import { messages } from './index';

async function promptForOperation(): Promise<string> {
  return cliux.inquire<string>({
    type: 'list',
    name: 'operation',
    message: messages.SELECT_OPERATION,
    choices: [
      { name: 'Publish', value: OperationType.PUBLISH },
      { name: 'Unpublish', value: OperationType.UNPUBLISH },
    ],
  });
}

async function promptForEnvironments(): Promise<string[]> {
  const input = await cliux.inquire<string>({
    type: 'input',
    name: 'environments',
    message: messages.ENTER_ENVIRONMENTS,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return messages.ENVIRONMENT_REQUIRED;
      }
      return true;
    },
  });

  return input
    .split(',')
    .map((env) => env.trim())
    .filter((env) => env.length > 0);
}

async function promptForLocales(): Promise<string[]> {
  const input = await cliux.inquire<string>({
    type: 'input',
    name: 'locales',
    message: messages.ENTER_LOCALES,
    default: 'en-us',
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return messages.LOCALE_REQUIRED;
      }
      return true;
    },
  });

  return input
    .split(',')
    .map((locale) => locale.trim())
    .filter((locale) => locale.length > 0);
}

/**
 * Prompt for stack credentials (alias or api key)
 */
async function promptForStackCredentials(): Promise<{ alias?: string; apiKey?: string }> {
  // If user is logged in using auth, prompt for API key only
  if (isAuthenticated()) {
    const apiKey = await cliux.inquire<string>({
      type: 'input',
      name: 'apiKey',
      message: messages.ENTER_API_KEY,
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return messages.API_KEY_REQUIRED;
        }
        if (!value.startsWith('blt')) {
          return messages.API_KEY_INVALID_FORMAT;
        }
        return true;
      },
    });

    return { apiKey };
  }

  // Check if user has saved aliases
  const tokens = configHandler.get('tokens') || {};
  const aliases = Object.keys(tokens);

  // If aliases exist, show them for selection
  if (aliases.length > 0) {
    const selectedAlias = await cliux.inquire<string>({
      type: 'list',
      name: 'alias',
      message: messages.SELECT_ALIAS,
      choices: aliases.map((alias) => ({ name: alias, value: alias })),
    });

    return { alias: selectedAlias };
  }

  // No aliases, prompt for API key
  const apiKey = await cliux.inquire<string>({
    type: 'input',
    name: 'apiKey',
    message: messages.ENTER_API_KEY,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return messages.API_KEY_REQUIRED;
      }
      if (!value.startsWith('blt')) {
        return messages.API_KEY_INVALID_FORMAT;
      }
      return true;
    },
  });

  return { apiKey };
}

/**
 * Prompt for source environment (cross-publish)
 */
async function promptForSourceEnvironment(): Promise<string> {
  return cliux.inquire<string>({
    type: 'input',
    name: 'sourceEnv',
    message: messages.ENTER_SOURCE_ENV,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return messages.SOURCE_ENV_REQUIRED;
      }
      return true;
    },
  });
}

/**
 * Prompt for source alias (cross-publish)
 */
async function promptForSourceAlias(): Promise<string> {
  const tokens = configHandler.get('tokens') || {};
  const deliveryAliases = Object.keys(tokens).filter((alias) => tokens[alias].type === 'delivery');

  if (deliveryAliases.length === 0) {
    throw new Error(messages.NO_DELIVERY_TOKENS_FOUND);
  }

  return cliux.inquire<string>({
    type: 'list',
    name: 'sourceAlias',
    message: messages.SELECT_SOURCE_ALIAS,
    choices: deliveryAliases.map((alias) => ({ name: alias, value: alias })),
  });
}

/**
 * Fills in missing required flags by prompting the user
 */
export async function fillMissingFlags(flags: any): Promise<any> {
  const updatedFlags = { ...flags };

  // Skip interactive mode for retry/revert operations
  if (flags['retry-failed'] || flags.revert) {
    return updatedFlags;
  }

  // Track if we prompted for anything
  let didPrompt = false;

  // Check if any required fields are missing
  const needsCredentials = !updatedFlags.alias && !updatedFlags['stack-api-key'];
  const needsOperation = !updatedFlags.operation;
  const needsEnvironments = !updatedFlags.environments || updatedFlags.environments.length === 0;
  // Check if non-localized filter is used
  const isNonLocalized = updatedFlags.filter === FilterType.NON_LOCALIZED;
  const needsLocales = !isNonLocalized && (!updatedFlags.locales || updatedFlags.locales.length === 0);

  // Only show interactive mode header if we need to prompt
  if (needsCredentials || needsOperation || needsEnvironments || needsLocales) {
    cliux.print(messages.INTERACTIVE_MODE_START, { color: 'cyan' });
    didPrompt = true;
  }

  // 1. Stack credentials (REQUIRED)
  if (needsCredentials) {
    const credentials = await promptForStackCredentials();
    if (credentials.alias) {
      updatedFlags.alias = credentials.alias;
    } else if (credentials.apiKey) {
      updatedFlags['stack-api-key'] = credentials.apiKey;
    }
  }

  // 2. Operation type (REQUIRED)
  if (needsOperation) {
    updatedFlags.operation = await promptForOperation();
  }

  // 3. Check for cross-publish mode
  const isCrossPublish = updatedFlags['source-env'] || updatedFlags['source-alias'];

  if (isCrossPublish) {
    // Cross-publish required prompts
    if (!updatedFlags['source-env']) {
      updatedFlags['source-env'] = await promptForSourceEnvironment();
      didPrompt = true;
    }
    if (!updatedFlags['source-alias']) {
      updatedFlags['source-alias'] = await promptForSourceAlias();
      didPrompt = true;
    }
  }

  // 4. Environments (REQUIRED)
  if (needsEnvironments) {
    updatedFlags.environments = await promptForEnvironments();
  }

  // 5. Locales (REQUIRED)
  if (needsLocales) {
    updatedFlags.locales = await promptForLocales();
  }

  // Only show completion message if we prompted for something
  if (didPrompt) {
    cliux.print(messages.INTERACTIVE_MODE_COMPLETE, { color: 'green' });
  }

  return updatedFlags;
}

/**
 * Fills in missing flags for the bulk-am-assets command by prompting the user.
 * Handles AM-specific required flags including operation-conditional ones
 * (locale for delete, target-folder-uid for move).
 */
export async function fillMissingAmFlags(flags: any): Promise<any> {
  const f = { ...flags };

  const needsLocale = f.operation === 'delete' && !f.locale;
  const needsFolderUid = f.operation === 'move' && !f['target-folder-uid'];
  const needsPrompt =
    !f.operation || !f['space-uid'] || !f['org-uid'] || !f['asset-uids-file'] || needsLocale || needsFolderUid;

  if (!needsPrompt) return f;

  cliux.print(messages.INTERACTIVE_MODE_START, { color: 'cyan' });

  if (!f.operation) {
    f.operation = await cliux.inquire<string>({
      type: 'list',
      name: 'operation',
      message: messages.AM_SELECT_OPERATION,
      choices: [
        { name: 'Delete (AM bulk delete)', value: 'delete' },
        { name: 'Move (AM bulk move)', value: 'move' },
      ],
    });
  }

  if (!f['space-uid']) {
    f['space-uid'] = await cliux.inquire<string>({
      type: 'input',
      name: 'spaceUid',
      message: messages.AM_ENTER_SPACE_UID,
      validate: (v: string) => (!v?.trim() ? messages.SPACE_UID_REQUIRED : true),
    });
  }

  if (!f['org-uid']) {
    f['org-uid'] = await cliux.inquire<string>({
      type: 'input',
      name: 'orgUid',
      message: messages.AM_ENTER_ORG_UID,
      validate: (v: string) => (!v?.trim() ? messages.ORG_UID_REQUIRED : true),
    });
  }

  if (!f['asset-uids-file']) {
    f['asset-uids-file'] = await cliux.inquire<string>({
      type: 'input',
      name: 'assetUidsFile',
      message: messages.AM_ENTER_ASSET_UIDS_FILE,
      validate: (v: string) => (!v?.trim() ? messages.AM_ASSET_UIDS_FILE_REQUIRED : true),
    });
  }

  if (f.operation === 'delete' && !f.locale) {
    f.locale = await cliux.inquire<string>({
      type: 'input',
      name: 'locale',
      message: messages.AM_ENTER_LOCALE,
      validate: (v: string) => (!v?.trim() ? messages.AM_LOCALE_REQUIRED : true),
    });
  }

  if (f.operation === 'move' && !f['target-folder-uid']) {
    f['target-folder-uid'] = await cliux.inquire<string>({
      type: 'input',
      name: 'targetFolderUid',
      message: messages.AM_ENTER_TARGET_FOLDER,
      validate: (v: string) => (!v?.trim() ? messages.TARGET_FOLDER_REQUIRED : true),
    });
  }

  cliux.print(messages.INTERACTIVE_MODE_COMPLETE, { color: 'green' });

  return f;
}
