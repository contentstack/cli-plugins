import { sanitizePath } from '@contentstack/cli-utilities';
import type { RunAssetMapperImportSetupParams } from '@contentstack/cli-asset-management';

import { PATH_CONSTANTS } from '../constants/path-constants';
import type ImportConfig from '../types/import-config';

/**
 * Maps import-setup `ImportConfig` and AM base URL into `RunAssetMapperImportSetupParams`
 * (parallel to contentstack-import `buildImportSpacesOptions` → `ImportSpaces`).
 */
export function buildImportSetupAssetMapperParams(
  config: ImportConfig,
  assetManagementUrl: string,
): RunAssetMapperImportSetupParams {
  const am = config.modules['asset-management'];

  return {
    contentDir: sanitizePath(config.contentDir),
    mapperBaseDir: sanitizePath(config.backupDir),
    assetManagementUrl,
    org_uid: config.org_uid,
    source_stack: config.source_stack,
    apiKey: config.apiKey,
    host: config.region?.cma ?? config.host ?? '',
    context: config.context as unknown as Record<string, unknown>,
    apiConcurrency: config.fetchConcurrency,
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
