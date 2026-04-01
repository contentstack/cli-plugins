import { readdirSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { formatError, log } from '@contentstack/cli-utilities';

import {
  IMPORT_ASSETS_MAPPER_DIR_SEGMENTS,
  IMPORT_ASSETS_MAPPER_FILES,
  PROCESS_NAMES,
  PROCESS_STATUS,
} from '../constants/index';
import type { AssetManagementAPIConfig } from '../types/asset-management-api';
import type { AssetMapperImportSetupResult, RunAssetMapperImportSetupParams } from '../types/import-setup-asset-mapper';
import ImportAssets from '../import/assets';
import { AssetManagementAdapter } from '../utils/asset-management-api-adapter';
import { AssetManagementImportSetupAdapter } from './base';

const PROCESS = PROCESS_NAMES.AM_IMPORT_SETUP_ASSET_MAPPERS;

/**
 * Builds identity uid/url and space-uid mapper files from an Asset Management export layout
 * for spaces that already exist in the target org (reuse path).
 */
export default class ImportSetupAssetMappers extends AssetManagementImportSetupAdapter {
  constructor(params: RunAssetMapperImportSetupParams) {
    super(params);
  }

  private async fetchExistingSpaceUidsInOrg(apiConfig: AssetManagementAPIConfig): Promise<Set<string>> {
    const adapter = new AssetManagementAdapter(apiConfig);
    await adapter.init();
    const { spaces } = await adapter.listSpaces();
    const uids = new Set<string>();
    for (const s of spaces) {
      if (s.uid) {
        uids.add(s.uid);
      }
    }
    return uids;
  }

  private listExportedSpaceDirectories(spacesRootPath: string): { spaceDirs: string[]; readFailed: boolean } {
    try {
      const spaceDirs = readdirSync(spacesRootPath).filter((entry) => {
        try {
          return statSync(join(spacesRootPath, entry)).isDirectory() && entry.startsWith('am');
        } catch {
          return false;
        }
      });
      return { spaceDirs, readFailed: false };
    } catch {
      log.info(`Could not read Asset Management spaces directory: ${spacesRootPath}`, this.params.context);
      return { spaceDirs: [], readFailed: true };
    }
  }

  async start(): Promise<AssetMapperImportSetupResult> {
    const {
      contentDir,
      mapperBaseDir,
      assetManagementUrl,
      org_uid,
      source_stack,
      apiKey,
      host,
      context,
      fetchConcurrency,
    } = this.params;

    if (!assetManagementUrl) {
      log.info(
        'Asset Management export detected but region.assetManagementUrl is not configured. Skipping asset mapper setup.',
        context,
      );
      return { kind: 'skipped', reason: 'missing_asset_management_url' };
    }
    if (!org_uid) {
      log.error('Cannot run Asset Management import-setup: organization UID is missing.', context);
      return { kind: 'skipped', reason: 'missing_organization_uid' };
    }

    const parentProgressManager = this.resolveParentProgress();

    const spacesRootPath = resolve(contentDir, 'spaces');
    const mapperDirPath = join(mapperBaseDir, ...IMPORT_ASSETS_MAPPER_DIR_SEGMENTS);
    const duplicateAssetMapperPath = join(mapperDirPath, IMPORT_ASSETS_MAPPER_FILES.DUPLICATE_ASSETS);

    const apiConfig: AssetManagementAPIConfig = {
      baseURL: assetManagementUrl,
      headers: { organization_uid: org_uid },
      context,
    };

    const importContext = {
      spacesRootPath,
      sourceApiKey: source_stack,
      apiKey,
      host,
      org_uid,
      context,
      apiConcurrency: fetchConcurrency,
    };

    try {
      if (parentProgressManager) {
        parentProgressManager.addProcess(PROCESS, 1);
        parentProgressManager
          .startProcess(PROCESS)
          .updateStatus(PROCESS_STATUS[PROCESS].GENERATING, PROCESS);
      }

      const existingSpaceUids = await this.fetchExistingSpaceUidsInOrg(apiConfig);

      const { spaceDirs, readFailed } = this.listExportedSpaceDirectories(spacesRootPath);
      if (spaceDirs.length === 0 && !readFailed) {
        log.info('No Asset Management space directories (am*) found under spaces/.', context);
      }

      const allUidMap: Record<string, string> = {};
      const allUrlMap: Record<string, string> = {};
      const spaceUidMap: Record<string, string> = {};

      const assetsImporter = new ImportAssets(apiConfig, importContext);

      for (const spaceUid of spaceDirs) {
        const spaceDir = join(spacesRootPath, spaceUid);
        if (existingSpaceUids.has(spaceUid)) {
          const { uidMap, urlMap } = await assetsImporter.buildIdentityMappersFromExport(spaceDir);
          Object.assign(allUidMap, uidMap);
          Object.assign(allUrlMap, urlMap);
          spaceUidMap[spaceUid] = spaceUid;
          parentProgressManager?.tick(true, `Asset Management space reused: ${spaceUid}`, null, PROCESS);
          log.info(
            `Asset Management space "${spaceUid}" exists in org; identity asset mappers merged from export.`,
            context,
          );
        } else {
          log.info(
            `Asset Management space "${spaceUid}" is not in the target org yet. Import assets first, then re-run import-setup to refresh mappers after upload.`,
            context,
          );
        }
      }

      await mkdir(mapperDirPath, { recursive: true });

      await writeFile(
        join(mapperDirPath, IMPORT_ASSETS_MAPPER_FILES.UID_MAPPING),
        JSON.stringify(allUidMap),
        'utf8',
      );
      await writeFile(
        join(mapperDirPath, IMPORT_ASSETS_MAPPER_FILES.URL_MAPPING),
        JSON.stringify(allUrlMap),
        'utf8',
      );
      await writeFile(
        join(mapperDirPath, IMPORT_ASSETS_MAPPER_FILES.SPACE_UID_MAPPING),
        JSON.stringify(spaceUidMap),
        'utf8',
      );

      await writeFile(duplicateAssetMapperPath, JSON.stringify({}), 'utf8');

      parentProgressManager?.completeProcess(PROCESS, true);
      log.success(
        'The required Asset Management setup files for assets have been generated successfully.',
        context,
      );

      return { kind: 'success' };
    } catch (error) {
      parentProgressManager?.completeProcess(PROCESS, false);
      log.error(`Error occurred while generating Asset Management asset mappers: ${formatError(error)}.`, context);
      return {
        kind: 'error',
        errorMessage: (error as Error)?.message || 'Asset Management asset mapper generation failed',
      };
    }
  }
}
