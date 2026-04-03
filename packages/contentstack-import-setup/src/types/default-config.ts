import { Modules } from '.';

export default interface DefaultConfig {
  host: string;
  developerHubBaseUrl: string;
  modules: {
    'custom-roles': {
      dirName: string;
      fileName: string;
      dependencies: Modules[];
    };
    environments: {
      dirName: string;
      fileName: string;
      dependencies?: Modules[];
    };
    locales: {
      dirName: string;
      fileName: string;
      dependencies?: Modules[];
    };
    extensions: {
      dirName: string;
      fileName: string;
      dependencies?: Modules[];
    };
    assets: {
      dirName: string;
      fileName: string;
      dependencies?: Modules[];
      fetchConcurrency: number;
    };
    'asset-management': {
      dirName: string;
      fieldsDir: string;
      assetTypesDir: string;
      fieldsFileName: string;
      assetTypesFileName: string;
      foldersFileName: string;
      assetsFileName: string;
      fieldsImportInvalidKeys: string[];
      assetTypesImportInvalidKeys: string[];
      mapperRootDir: string;
      mapperAssetsModuleDir: string;
      mapperUidFileName: string;
      mapperUrlFileName: string;
      mapperSpaceUidFileName: string;
      uploadAssetsConcurrency: number;
      importFoldersConcurrency: number;
      dependencies?: Modules[];
    };
    'content-types': {
      dirName: string;
      fileName: string;
      dependencies: Modules[];
    };
    entries: {
      dirName: string;
      fileName: string;
      dependencies: Modules[];
    };
    'global-fields': {
      dirName: string;
      fileName: string;
      dependencies: Modules[];
    };
    'marketplace-apps': {
      dirName: string;
      fileName: string;
      dependencies?: Modules[];
    };
    taxonomies: {
      dirName: string;
      fileName: string;
      dependencies?: Modules[];
      invalidKeys: string[];
    };
  };
  fetchConcurrency: number;
}
