import { Context, Modules, Region } from '.';
import DefaultConfig from './default-config';

export default interface ExportConfig extends DefaultConfig {
  access_token?: string;
  apiKey: string;
  auth_token?: string;
  authenticationMethod?: string;
  branchAlias?: string;
  branchDir?: string;
  branchEnabled?: boolean;
  branchName?: string;
  branches?: branch[];
  cliLogsPath: string;
  contentTypes?: string[];
  context: Context;
  data: string;
  exportDir: string;
  forceStopMarketplaceAppsPrompt: boolean;
  headers?: {
    'X-User-Agent': string;
    access_token?: string;
    api_key: string;
    authtoken?: string;
    organization_uid?: string;
  };
  management_token?: string;
  master_locale: masterLocale;
  moduleName?: Modules;
  org_uid?: string;
  query?: any; // Added query field
  region: Region;
  securedAssets?: boolean;
  singleModuleExport?: boolean;
  skipDependencies?: boolean;
  skipStackSettings?: boolean;
  source_stack?: string;
  sourceStackName?: string;
}

type branch = {
  source: string;
  uid: string;
};

type masterLocale = {
  code: string;
};
