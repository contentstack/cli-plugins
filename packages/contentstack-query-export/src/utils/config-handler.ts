import * as path from 'path';
import { QueryExportConfig } from '../types';
import { sanitizePath, pathValidator, configHandler, isAuthenticated } from '@contentstack/cli-utilities';
import config from '../config';
import { askAPIKey } from './common-helper';

export async function setupQueryExportConfig(flags: any): Promise<QueryExportConfig> {
  const exportDir = sanitizePath(flags['data-dir'] || pathValidator('export'));

  const exportQueryConfig: QueryExportConfig = {
    ...config,
    exportDir,
    stackApiKey: flags['stack-api-key'] || '',
    managementToken: flags.alias ? configHandler.get(`tokens.${flags.alias}`)?.token : undefined,
    query: flags.query,
    skipReferences: flags['skip-references'] || false,
    skipDependencies: flags['skip-dependencies'] || false,
    branchName: flags.branch,
    securedAssets: flags['secured-assets'] || false,
    isQueryBasedExport: true,
    logsPath: exportDir,
    dataPath: exportDir,
    // Todo: accept the path of the config file from the user
    externalConfigPath: path.join(__dirname, '../config/export-config.json'),
  };

  if (flags['branch-alias']) {
    exportQueryConfig.branchAlias = flags['branch-alias'];
  }
  // override the external config path if the user provides a config file
  if (flags.config) {
    exportQueryConfig.externalConfigPath = sanitizePath(flags['config']);
  }

  // Handle authentication
  if (flags.alias) {
    const { token, apiKey } = configHandler.get(`tokens.${flags.alias}`) || {};
    exportQueryConfig.managementToken = token;
    exportQueryConfig.stackApiKey = apiKey;
    if (!exportQueryConfig.managementToken) {
      throw new Error(`No management token found for alias ${flags.alias}.`);
    }
  }

  if (!exportQueryConfig.managementToken) {
    if (!isAuthenticated()) {
      throw new Error('Log in or provide an alias for the management token.');
    } else {
      exportQueryConfig.stackApiKey = flags['stack-api-key'] || (await askAPIKey());
      if (typeof exportQueryConfig.stackApiKey !== 'string') {
        throw new Error('The API key is invalid.');
      }
    }
  }
  return exportQueryConfig;
}
