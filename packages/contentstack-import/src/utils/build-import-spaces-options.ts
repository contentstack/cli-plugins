import type { ImportSpacesOptions } from '@contentstack/cli-asset-management';
import { log } from '@contentstack/cli-utilities';

import { PATH_CONSTANTS } from '../constants';
import type ImportConfig from '../types/import-config';

/**
 * Maps stack `ImportConfig` and AM base URL into a single `ImportSpacesOptions` for the AM package
 * (variants-style: one flat object; `ImportSpaces` splits API vs context internally).
 *
 * Pass `overrides` to inject default-space mapping data fetched from the target branch before
 * calling this function (see `ImportAssets.start()` for the fetch logic).
 */
export function buildImportSpacesOptions(
  importConfig: ImportConfig,
  csAssetsUrl: string,
  overrides?: Pick<ImportSpacesOptions, 'targetDefaultSpaceUid' | 'targetDefaultWorkspaceUid'>,
): ImportSpacesOptions {
  const legacyModuleConfig = (importConfig.modules as Record<string, any>)['asset-management'];
  const am = importConfig.modules['cs-assets'] || legacyModuleConfig;
  if (!importConfig.modules['cs-assets'] && legacyModuleConfig) {
    log.warn('Config key "modules.asset-management" is deprecated. Please rename it to "modules.cs-assets".');
  }
  const org_uid = importConfig.org_uid ?? '';

  return {
    contentDir: importConfig.contentDir,
    csAssetsUrl,
    org_uid,
    apiKey: importConfig.apiKey,
    host: importConfig.region?.cma ?? importConfig.host ?? '',
    sourceApiKey: importConfig.source_stack,
    context: importConfig.context as unknown as Record<string, unknown>,
    backupDir: importConfig.backupDir,
    apiConcurrency: importConfig.fetchConcurrency,
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
    targetDefaultSpaceUid: overrides?.targetDefaultSpaceUid,
    targetDefaultWorkspaceUid: overrides?.targetDefaultWorkspaceUid,
  };
}
