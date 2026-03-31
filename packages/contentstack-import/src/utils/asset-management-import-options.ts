import type { AssetManagementImportOptions } from '@contentstack/cli-asset-management';

import { PATH_CONSTANTS } from '../constants';
import type ImportConfig from '../types/import-config';

/**
 * Maps stack import config and resolved AM base URL into options for `ImportSpaces`.
 * Centralizes defaults (`PATH_CONSTANTS`) and field renames so `ImportAssets` stays thin.
 */
export function buildAssetManagementImportOptions(
  importConfig: ImportConfig,
  assetManagementUrl: string,
): AssetManagementImportOptions {
  const am = importConfig.modules['asset-management'];

  return {
    contentDir: importConfig.contentDir,
    assetManagementUrl,
    org_uid: importConfig.org_uid ?? '',
    apiKey: importConfig.apiKey,
    host: importConfig.region?.cma ?? importConfig.host ?? '',
    sourceApiKey: importConfig.source_stack,
    context: importConfig.context as unknown as Record<string, unknown>,
    backupDir: importConfig.backupDir,
    apiConcurrency: importConfig.modules?.apiConcurrency ?? importConfig.fetchConcurrency,
    uploadAssetsConcurrency: am?.uploadAssetsConcurrency,
    importFoldersConcurrency: am?.importFoldersConcurrency,
    spacesDirName: am?.dirName,
    fieldsDir: am?.fieldsDir,
    assetTypesDir: am?.assetTypesDir,
    fieldsFileName: am?.fieldsFileName,
    assetTypesFileName: am?.assetTypesFileName,
    foldersFileName: am?.foldersFileName,
    assetsFileName: am?.assetsFileName,
    fieldsImportInvalidKeys: am?.fieldsImportInvalidKeys,
    assetTypesImportInvalidKeys: am?.assetTypesImportInvalidKeys,
    mapperRootDir: am?.mapperRootDir ?? PATH_CONSTANTS.MAPPER,
    mapperAssetsModuleDir: am?.mapperAssetsModuleDir ?? PATH_CONSTANTS.MAPPER_MODULES.ASSETS,
    mapperUidFileName: am?.mapperUidFileName ?? PATH_CONSTANTS.FILES.UID_MAPPING,
    mapperUrlFileName: am?.mapperUrlFileName ?? PATH_CONSTANTS.FILES.URL_MAPPING,
    mapperSpaceUidFileName: am?.mapperSpaceUidFileName ?? PATH_CONSTANTS.FILES.SPACE_UID_MAPPING,
  };
}
