import { resolve as pResolve, join } from 'node:path';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { log, CLIProgressManager, configHandler } from '@contentstack/cli-utilities';

import type {
  AssetManagementAPIConfig,
  AssetManagementImportOptions,
  ImportContext,
  ImportResult,
  SpaceMapping,
} from '../types/asset-management-api';
import { AM_MAIN_PROCESS_NAME } from '../constants/index';
import { AssetManagementAdapter } from '../utils/asset-management-api-adapter';
import ImportAssetTypes from './asset-types';
import ImportFields from './fields';
import ImportWorkspace from './workspaces';

/**
 * Top-level orchestrator for AM 2.0 import.
 * Mirrors ExportSpaces: creates shared fields + asset types, then imports each space.
 * Returns combined uidMap, urlMap, and spaceMappings for the bridge module.
 */
export class ImportSpaces {
  private readonly options: AssetManagementImportOptions;
  private parentProgressManager: CLIProgressManager | null = null;
  private progressManager: CLIProgressManager | null = null;

  constructor(options: AssetManagementImportOptions) {
    this.options = options;
  }

  public setParentProgressManager(parent: CLIProgressManager): void {
    this.parentProgressManager = parent;
  }

  async start(): Promise<ImportResult> {
    const {
      contentDir,
      assetManagementUrl,
      org_uid,
      apiKey,
      host,
      sourceApiKey,
      context,
      apiConcurrency,
      spacesDirName,
      fieldsDir,
      assetTypesDir,
      fieldsFileName,
      assetTypesFileName,
      foldersFileName,
      assetsFileName,
      fieldsImportInvalidKeys,
      assetTypesImportInvalidKeys,
      mapperRootDir,
      mapperAssetsModuleDir,
      mapperUidFileName,
      mapperUrlFileName,
      mapperSpaceUidFileName,
    } = this.options;

    const spacesRootPath = pResolve(contentDir, spacesDirName ?? 'spaces');

    const importContext: ImportContext = {
      spacesRootPath,
      sourceApiKey,
      apiKey,
      host,
      org_uid,
      context,
      apiConcurrency,
      spacesDirName,
      fieldsDir,
      assetTypesDir,
      fieldsFileName,
      assetTypesFileName,
      foldersFileName,
      assetsFileName,
      fieldsImportInvalidKeys,
      assetTypesImportInvalidKeys,
      mapperRootDir,
      mapperAssetsModuleDir,
      mapperUidFileName,
      mapperUrlFileName,
      mapperSpaceUidFileName,
    };

    const apiConfig: AssetManagementAPIConfig = {
      baseURL: assetManagementUrl,
      headers: { organization_uid: org_uid },
      context,
    };

    // Discover space directories
    let spaceDirs: string[] = [];
    try {
      spaceDirs = readdirSync(spacesRootPath).filter((entry) => {
        try {
          return statSync(join(spacesRootPath, entry)).isDirectory() && entry.startsWith('am');
        } catch {
          return false;
        }
      });
    } catch (e) {
      log.debug(`Could not read spaces root path ${spacesRootPath}: ${e}`, context);
    }

    const totalSteps = 2 + spaceDirs.length * 2;
    const progress = this.createProgress();
    progress.addProcess(AM_MAIN_PROCESS_NAME, totalSteps);
    progress.startProcess(AM_MAIN_PROCESS_NAME);

    const allUidMap: Record<string, string> = {};
    const allUrlMap: Record<string, string> = {};
    const allSpaceUidMap: Record<string, string> = {};
    const spaceMappings: SpaceMapping[] = [];
    let hasFailures = false;

    // Space UIDs already present in the target org — reuse when export dir name matches a uid here.
    const existingSpaceUids = new Set<string>();
    try {
      const adapterForList = new AssetManagementAdapter(apiConfig);
      await adapterForList.init();
      const { spaces } = await adapterForList.listSpaces();
      for (const s of spaces) {
        if (s.uid) existingSpaceUids.add(s.uid);
      }
      log.debug(`Found ${existingSpaceUids.size} existing space uid(s) in target org`, context);
    } catch (e) {
      log.debug(`Could not fetch existing spaces — reuse-by-uid disabled: ${e}`, context);
    }

    try {
      // 1. Import shared fields
      progress.updateStatus(`Importing shared fields...`, AM_MAIN_PROCESS_NAME);
      const fieldsImporter = new ImportFields(apiConfig, importContext);
      fieldsImporter.setParentProgressManager(progress);
      await fieldsImporter.start();

      // 2. Import shared asset types
      progress.updateStatus('Importing shared asset types...', AM_MAIN_PROCESS_NAME);
      const assetTypesImporter = new ImportAssetTypes(apiConfig, importContext);
      assetTypesImporter.setParentProgressManager(progress);
      await assetTypesImporter.start();

      // 3. Import each space — continue on failure so partially-imported data is never lost
      for (const spaceUid of spaceDirs) {
        const spaceDir = join(spacesRootPath, spaceUid);
        progress.updateStatus(`Importing space: ${spaceUid}...`, AM_MAIN_PROCESS_NAME);
        log.debug(`Importing space: ${spaceUid}`, context);

        try {
          const workspaceImporter = new ImportWorkspace(apiConfig, importContext);
          workspaceImporter.setParentProgressManager(progress);
          const result = await workspaceImporter.start(spaceUid, spaceDir, existingSpaceUids);

          // Newly created spaces get a new uid — add so later iterations in this run see it.
          existingSpaceUids.add(result.newSpaceUid);

          Object.assign(allUidMap, result.uidMap);
          Object.assign(allUrlMap, result.urlMap);
          allSpaceUidMap[result.oldSpaceUid] = result.newSpaceUid;
          spaceMappings.push({
            oldSpaceUid: result.oldSpaceUid,
            newSpaceUid: result.newSpaceUid,
            workspaceUid: result.workspaceUid,
            isDefault: result.isDefault,
          });

          log.debug(`Imported space ${spaceUid} → ${result.newSpaceUid}`, context);
        } catch (err) {
          hasFailures = true;
          progress.tick(
            false,
            `space: ${spaceUid}`,
            (err as Error)?.message ?? 'Failed to import space',
            AM_MAIN_PROCESS_NAME,
          );
          log.debug(`Failed to import space ${spaceUid}: ${err}`, context);
        }
      }

      if (this.options.backupDir) {
        const mapperRoot = this.options.mapperRootDir ?? 'mapper';
        const mapperAssetsMod = this.options.mapperAssetsModuleDir ?? 'assets';
        const mapperDir = join(this.options.backupDir, mapperRoot, mapperAssetsMod);
        mkdirSync(mapperDir, { recursive: true });
        const uidFile = this.options.mapperUidFileName ?? 'uid-mapping.json';
        const urlFile = this.options.mapperUrlFileName ?? 'url-mapping.json';
        const spaceUidFile = this.options.mapperSpaceUidFileName ?? 'space-uid-mapping.json';
        await writeFile(join(mapperDir, uidFile), JSON.stringify(allUidMap), 'utf8');
        await writeFile(join(mapperDir, urlFile), JSON.stringify(allUrlMap), 'utf8');
        await writeFile(join(mapperDir, spaceUidFile), JSON.stringify(allSpaceUidMap), 'utf8');
        log.debug('Wrote AM 2.0 mapper files (uid, url, space-uid)', context);
      }

      progress.completeProcess(AM_MAIN_PROCESS_NAME, !hasFailures);
      log.debug('Asset Management 2.0 import completed', context);
    } catch (err) {
      progress.completeProcess(AM_MAIN_PROCESS_NAME, false);
      throw err;
    }

    return { uidMap: allUidMap, urlMap: allUrlMap, spaceMappings, spaceUidMap: allSpaceUidMap };
  }

  private createProgress(): CLIProgressManager {
    if (this.parentProgressManager) {
      this.progressManager = this.parentProgressManager;
      return this.parentProgressManager;
    }
    const logConfig = configHandler.get('log') || {};
    const showConsoleLogs = logConfig.showConsoleLogs ?? false;
    this.progressManager = CLIProgressManager.createNested(AM_MAIN_PROCESS_NAME, showConsoleLogs);
    return this.progressManager;
  }
}
