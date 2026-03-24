import { NodeCrypto, cliux, createDeveloperHubUrl, handleAndLogError, managementSDKClient } from '@contentstack/cli-utilities';

import { ExportConfig } from '../types';

export const getDeveloperHubUrl = async (exportConfig: ExportConfig) => {
  return createDeveloperHubUrl(exportConfig.host);
};

export async function getOrgUid(config: ExportConfig): Promise<string> {
  const tempAPIClient = await managementSDKClient({ host: config.host });
  const tempStackData = await tempAPIClient
    .stack({ api_key: config.source_stack })
    .fetch()
    .catch((error: any) => {
      handleAndLogError(error, {...config.context});
    });

  return tempStackData?.org_uid;
}

export async function createNodeCryptoInstance(config: ExportConfig): Promise<NodeCrypto> {
  const cryptoArgs = { encryptionKey: '' };

  if (config.forceStopMarketplaceAppsPrompt) {
    cryptoArgs['encryptionKey'] = config.marketplaceAppEncryptionKey;
  } else {
    cryptoArgs['encryptionKey'] = await cliux.inquire({
      default: config.marketplaceAppEncryptionKey,
      message: 'Enter Marketplace app configurations encryption key',
      name: 'name',
      type: 'input',
      validate: (url: any) => {
        if (!url) return "Encryption key can't be empty.";

        return true;
      },
    });
  }

  return new NodeCrypto(cryptoArgs);
}
