import { Modules } from '.';

interface AnyProperty {
  [propName: string]: any;
}

export default interface DefaultConfig {
  apis: {
    assets: string;
    content_types: string;
    entries: string;
    environments: string;
    extension: string;
    globalfields: string;
    labels: string;
    locales: string;
    stacks: string;
    userSession: string;
    users: string;
    webhooks: string;
  };
  cdn?: string;
  contentVersion: number;
  developerHubBaseUrl: string;
  developerHubUrls: any;
  // use below hosts for eu region
  // host:'https://eu-api.contentstack.com/v3',
  // use below hosts for azure-na region
  // host:'https://azure-na-api.contentstack.com/v3',
  // use below hosts for gcp-na region
  // host: 'https://gcp-na-api.contentstack.com'
  // use below hosts for gcp-eu region
  fetchConcurrency: number;
  host: string;
  languagesCode: string[];
  marketplaceAppEncryptionKey: string;
  // host: 'https://gcp-eu-api.contentstack.com'
  modules: {
    assets: {
      assetsMetaKeys: string[]; // Default keys ['uid', 'url', 'filename']
      // This is the total no. of asset objects fetched in each 'get assets' call
      batchLimit: number;
      // no of asset version files (of a single asset) that'll be downloaded parallel
      chunkFileSize: number; // measured on Megabits (5mb)
      dependencies?: Modules[];
      dirName: string;
      displayExecutionTime: boolean;
      downloadLimit: number;
      enableDownloadStatus: boolean;
      fetchConcurrency: number;
      fileName: string;
      host: string;
      includeVersionedAssets: boolean;
      invalidKeys: string[];
      securedAssets: boolean;
    };
    attributes: {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
      invalidKeys: string[];
    };
    audiences: {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
      invalidKeys: string[];
    };
    'composable-studio': {
      apiBaseUrl: string;
      apiVersion: string;
      dirName: string;
      fileName: string;
    };
    content_types: {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
      // total no of content types fetched in each 'get content types' call
      limit: number;
      validKeys: string[];
    };
    'content-types': {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
      // total no of content types fetched in each 'get content types' call
      limit: number;
      validKeys: string[];
    };
    'custom-roles': {
      customRolesLocalesFileName: string;
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
    };
    customRoles: {
      customRolesLocalesFileName: string;
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
    };
    dependency: {
      entries: string[];
    };
    entries: {
      batchLimit: number;
      dependencies?: Modules[];
      dirName: string;
      downloadLimit: number;
      exportVersions: boolean;
      fileName: string;
      invalidKeys: string[];
      // total no of entries fetched in each content type in a single call
      limit: number;
    };
    environments: {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
    };
    events: {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
      invalidKeys: string[];
    };
    extensions: {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
    };
    'global-fields': {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
      validKeys: string[];
    };
    globalfields: {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
      validKeys: string[];
    };
    labels: {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
      invalidKeys: string[];
    };
    locales: {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
      requiredKeys: string[];
    };
    marketplace_apps: {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
    };
    'marketplace-apps': {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
    };
    masterLocale: {
      dirName: string;
      fileName: string;
      requiredKeys: string[];
    };
    personalize: {
      baseURL: Record<string, string>;
      dirName: string;
    } & AnyProperty;
    'publishing-rules': {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
      invalidKeys: string[];
      limit?: number;
    };
    releases: {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
      invalidKeys: string[];
      releasesList: string;
    };
    stack: {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
    };
    taxonomies: {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
      invalidKeys: string[];
      limit: number;
    };
    types: Modules[];
    variantEntry: {
      chunkFileSize: number;
      dirName: string;
      fileName: string;
      query: {
        include_count: boolean;
        include_publish_details: boolean;
        include_variant: boolean;
        limit: number;
        skip: number;
      } & AnyProperty;
    } & AnyProperty;
    webhooks: {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
    };
    workflows: {
      dependencies?: Modules[];
      dirName: string;
      fileName: string;
      invalidKeys: string[];
    };
  };
  onlyTSModules: string[];
  personalizationEnabled: boolean;
  preserveStackVersion: boolean;
  versioning: boolean;
  writeConcurrency: number;
}
