import { ContentstackClient } from '@contentstack/cli-utilities';

import ExportConfig from './export-config';

// eslint-disable-next-line @typescript-eslint/no-redeclare
export interface AuthOptions {
  contentstackClient: any;
}

export interface ContentStackManagementClient {
  contentstackClient: object;
}

export interface PrintOptions {
  color?: string;
}

export interface InquirePayload {
  choices?: Array<any>;
  message: string;
  name: string;
  transformer?: (value: string, answers: Record<string, unknown>) => boolean | string;
  type: string;
}

export interface User {
  authtoken: string;
  email: string;
}

export interface Region {
  cda: string;
  cma: string;
  name: string;
  uiHost: string;
}

export type Modules =
  | 'assets'
  | 'composable-studio'
  | 'content-types'
  | 'custom-roles'
  | 'entries'
  | 'environments'
  | 'extensions'
  | 'global-fields'
  | 'labels'
  | 'locales'
  | 'marketplace-apps'
  | 'personalize'
  | 'publishing-rules'
  | 'stack'
  | 'taxonomies'
  | 'webhooks'
  | 'workflows';

export type ModuleClassParams = {
  exportConfig: ExportConfig;
  moduleName: Modules;
  stackAPIClient: ReturnType<ContentstackClient['stack']>;
};

export interface ExternalConfig extends ExportConfig {
  branchName: string;
  data: string;
  email?: string;
  fetchConcurrency: number;
  master_locale: {
    code: string;
    name: string;
  };
  moduleName: Modules;
  password?: string;
  securedAssets: boolean;
  source_stack?: string;
  writeConcurrency: number;
}

export interface ExtensionsConfig {
  dependencies?: Modules[];
  dirName: string;
  fileName: string;
  limit?: number;
}

export interface MarketplaceAppsConfig {
  dependencies?: Modules[];
  dirName: string;
  fileName: string;
}

export interface EnvironmentConfig {
  dependencies?: Modules[];
  dirName: string;
  fileName: string;
  limit?: number;
}

export interface LabelConfig {
  dependencies?: Modules[];
  dirName: string;
  fileName: string;
  invalidKeys: string[];
  limit?: number;
}

export interface WebhookConfig {
  dependencies?: Modules[];
  dirName: string;
  fileName: string;
  limit?: number;
}

export interface WorkflowConfig {
  dependencies?: Modules[];
  dirName: string;
  fileName: string;
  invalidKeys: string[];
  limit?: number;
}

export interface PublishingRulesConfig {
  dependencies?: Modules[];
  dirName: string;
  fileName: string;
  invalidKeys: string[];
  limit?: number;
}

export interface CustomRoleConfig {
  customRolesLocalesFileName: string;
  dependencies?: Modules[];
  dirName: string;
  fileName: string;
}

export interface StackConfig {
  dependencies?: Modules[];
  dirName: string;
  fileName: string;
  limit?: number;
}

export interface ComposableStudioConfig {
  apiBaseUrl: string;
  apiVersion: string;
  dirName: string;
  fileName: string;
}

export interface ComposableStudioProject {
  canvasUrl: string;
  connectedStackApiKey: string;
  contentTypeUid: string;
  createdAt: string;
  createdBy: string;
  deletedAt: boolean;
  description: string;
  name: string;
  organizationUid: string;
  settings: {
    configuration: {
      environment: string;
      locale: string;
    };
  };
  uid: string;
  updatedAt: string;
  updatedBy: string;
}
export interface Context {
  module: string;
}

export { default as DefaultConfig } from './default-config';
export { default as ExportConfig } from './export-config';
export * from './marketplace-app';
