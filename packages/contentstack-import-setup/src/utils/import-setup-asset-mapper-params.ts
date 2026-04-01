import { sanitizePath } from '@contentstack/cli-utilities';
import type { RunAssetMapperImportSetupParams } from '@contentstack/cli-asset-management';

import type ImportConfig from '../types/import-config';

/**
 * Maps import-setup config and resolved AM base URL into params for `ImportSetupAssetMappers`.
 * Mirrors `buildAssetManagementImportOptions` in contentstack-import. Progress: `setParentProgressManager` on the instance.
 */
export function buildImportSetupAssetMapperParams(
  config: ImportConfig,
  assetManagementUrl: string | undefined,
): RunAssetMapperImportSetupParams {
  return {
    contentDir: sanitizePath(config.contentDir),
    mapperBaseDir: sanitizePath(config.backupDir),
    assetManagementUrl: assetManagementUrl ?? config.region?.assetManagementUrl,
    org_uid: config.org_uid,
    source_stack: config.source_stack,
    apiKey: config.apiKey,
    host: config.region?.cma ?? config.host ?? '',
    context: config.context as unknown as Record<string, unknown>,
    fetchConcurrency: config.fetchConcurrency,
  };
}
