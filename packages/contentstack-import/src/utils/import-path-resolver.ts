import * as path from 'node:path';
import { log } from '@contentstack/cli-utilities';

import defaultConfig from '../config';
import { ImportConfig } from '../types';
import { askBranchSelection } from './interactive';
import { fileExistsSync, readFile } from './file-helper';



/**
 * Resolves the import path based on directory structure and user configuration
 * @param importConfig - The import configuration object
 * @param stackAPIClient - The Contentstack API client
 * @returns Promise<string> - The resolved path
 */
export const resolveImportPath = async (importConfig: ImportConfig, stackAPIClient: any): Promise<string> => {
  log.debug('Resolving import path based on directory structure');

  const contentDir = importConfig.contentDir;
  log.debug(`Content directory: ${contentDir}`);

  if (!fileExistsSync(contentDir)) {
    throw new Error(`Content directory does not exist: ${contentDir}`);
  }

  const moduleTypes = defaultConfig.modules.types;
  const hasModuleFolders = moduleTypes.some((moduleType) => fileExistsSync(path.join(contentDir, moduleType)));

  if (hasModuleFolders) {
    log.debug('Found module folders at export root');
    return contentDir;
  }

  log.debug('No specific structure detected - using contentDir as-is');
  return contentDir;
};

/**
 * Updates the import configuration with the resolved path
 * @param importConfig - The import configuration object
 * @param resolvedPath - The resolved path
 */
export const updateImportConfigWithResolvedPath = async (
  importConfig: ImportConfig,
  resolvedPath: string,
): Promise<void> => {
  log.debug(`Updating import config with resolved path: ${resolvedPath}`);

  if (!fileExistsSync(resolvedPath)) {
    log.warn(`Resolved path does not exist: ${resolvedPath}, skipping config update`);
    return;
  }

  importConfig.contentDir = resolvedPath;

  log.debug(
    `Import config updated - contentDir: ${importConfig.contentDir}`,
  );
};

/**
 * Executes the complete import path resolution logic
 * @param importConfig - The import configuration object
 * @param stackAPIClient - The Contentstack API client
 * @returns Promise<string> - The resolved path
 */
export const executeImportPathLogic = async (importConfig: ImportConfig, stackAPIClient: any): Promise<string> => {
  log.debug('Executing import path resolution logic');

  const resolvedPath = await resolveImportPath(importConfig, stackAPIClient);

  await updateImportConfigWithResolvedPath(importConfig, resolvedPath);

  return resolvedPath;
};
