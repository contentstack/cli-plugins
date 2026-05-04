import { join, resolve } from 'path';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { FsUtility, sanitizePath, cliux, log, configHandler } from '@contentstack/cli-utilities';
import { ContentTypeStruct, CtConstructorParam, ModuleConstructorParam, EntryStruct } from '../types';
import auditConfig from '../config';
import { $t, auditFixMsg, auditMsg, commonMsg } from '../messages';
import values from 'lodash/values';
import { keys } from 'lodash';
import BaseClass from './base-class';

/**
 * Multibar row label for a single space. Bounded to 14 chars after the
 * `Space ` prefix so CLIProgressManager.formatProcessName doesn't truncate the
 * row mid-string. Mirrors the helper in `@contentstack/cli-asset-management`.
 */
const SPACE_PROCESS_NAME_PREFIX = 'Space ';
const SPACE_PROCESS_NAME_MAX_UID_LEN = 14;
function getSpaceProcessName(spaceUid: string): string {
  const safe = spaceUid ?? '';
  const trimmed =
    safe.length > SPACE_PROCESS_NAME_MAX_UID_LEN ? safe.substring(0, SPACE_PROCESS_NAME_MAX_UID_LEN) : safe;
  return `${SPACE_PROCESS_NAME_PREFIX}${trimmed}`;
}

/* The `Assets` class is responsible for scanning assets, looking for missing environment/locale references,
and generating a report in JSON and CSV formats. */
export default class Assets extends BaseClass {
  protected fix: boolean;
  public fileName: string;
  public folderPath: string;
  public currentUid!: string;
  public currentTitle!: string;
  public assets!: Record<string, any>;
  public locales: string[] = [];
  public environments: string[] = [];
  protected schema: ContentTypeStruct[] = [];
  protected missingEnvLocales: Record<string, any> = {};
  public moduleName: keyof typeof auditConfig.moduleConfig;
  private fixOverwriteConfirmed: boolean | null = null;
  private resolvedBasePaths: Array<{ path: string; spaceId: string | null }> = [];
  /** Map space dir name → the per-space multibar row label, or empty when single-space. */
  private spaceProcessNames: Map<string, string> = new Map();

  constructor({ fix, config, moduleName }: ModuleConstructorParam & CtConstructorParam) {
    super({ config });
    this.fix = fix ?? false;
    this.moduleName = this.validateModules(moduleName!, this.config.moduleConfig);
    this.fileName = config.moduleConfig[this.moduleName].fileName;
    this.folderPath = resolve(
      sanitizePath(config.basePath),
      sanitizePath(config.moduleConfig[this.moduleName].dirName),
    );
  }

  validateModules(
    moduleName: keyof typeof auditConfig.moduleConfig,
    moduleConfig: Record<string, unknown>,
  ): keyof typeof auditConfig.moduleConfig {
    if (Object.keys(moduleConfig).includes(moduleName)) {
      return moduleName;
    }
    return 'assets';
  }
  /**
   * The `run` function checks if a folder path exists, sets the schema based on the module name,
   * iterates over the schema and looks for references, and returns a list of missing references.
   * @param returnFixSchema - If true, returns the fixed schema instead of missing references
   * @param totalCount - Total number of assets to process (for progress tracking)
   * @returns the `missingEnvLocales` object.
   */
  async run(returnFixSchema = false, totalCount?: number) {
    try {
      log.debug(`Starting ${this.moduleName} audit process`, this.config.auditContext);
      log.debug(`Data directory: ${this.folderPath}`, this.config.auditContext);
      log.debug(`Fix mode: ${this.fix}`, this.config.auditContext);

      const spacesDir = join(this.config.basePath, 'spaces');
      if (!existsSync(this.folderPath) && !existsSync(spacesDir)) {
        log.debug(`Skipping ${this.moduleName} audit - path does not exist`, this.config.auditContext);
        log.warn(`Skipping ${this.moduleName} audit`, this.config.auditContext);
        cliux.print($t(auditMsg.NOT_VALID_PATH, { path: this.folderPath }), { color: 'yellow' });
        return returnFixSchema ? [] : {};
      }

      // Load prerequisite data with loading spinner
      await this.withLoadingSpinner('ASSETS: Loading prerequisite data (locales and environments)...', async () => {
        await this.prerequisiteData();
      });

      // Resolve base paths up front so the progress UI can decide between a
      // simple single-bar layout (legacy export) and a per-space multibar.
      this.resolvedBasePaths = this.resolveAssetBasePaths();
      log.debug(`Resolved ${this.resolvedBasePaths.length} asset base path(s)`, this.config.auditContext);

      const isMultiSpace =
        this.resolvedBasePaths.length > 1 ||
        (this.resolvedBasePaths.length === 1 && this.resolvedBasePaths[0].spaceId !== null);

      if (isMultiSpace) {
        const progress = this.createNestedProgress(this.moduleName);
        for (const { path, spaceId } of this.resolvedBasePaths) {
          // Each space row's total = number of assets in that space; pre-counted
          // from the chunked metadata so the bar shows real progress as ticks
          // accumulate inside lookForReference.
          const rowName = getSpaceProcessName(spaceId ?? 'unknown');
          this.spaceProcessNames.set(spaceId ?? path, rowName);
          const spaceTotal = this.countAssetsInChunkedStore(path);
          progress.addProcess(rowName, Math.max(1, spaceTotal));
        }
      } else if (totalCount && totalCount > 0) {
        // Legacy flat layout — single progress bar for the whole asset set.
        const progress = this.createSimpleProgress(this.moduleName, totalCount);
        progress.updateStatus('Validating asset references...');
      }

      log.debug('Starting asset Reference, Environment and Locale validation', this.config.auditContext);
      await this.lookForReference();

      if (returnFixSchema) {
        log.debug(`Returning fixed schema with ${this.schema?.length || 0} items`, this.config.auditContext);
        return this.schema;
      }

      log.debug('Cleaning up empty missing environment/locale references', this.config.auditContext);
      for (let propName in this.missingEnvLocales) {
        if (Array.isArray(this.missingEnvLocales[propName])) {
          if (!this.missingEnvLocales[propName].length) {
            delete this.missingEnvLocales[propName];
          }
        }
      }

      const totalIssues = Object.keys(this.missingEnvLocales).length;
      log.debug(
        `${this.moduleName} audit completed. Found ${totalIssues} assets with missing environment/locale references`,
        this.config.auditContext,
      );

      this.completeProgress(true);
      return this.missingEnvLocales;
    } catch (error: any) {
      this.completeProgress(false, error?.message || 'Assets audit failed');
      throw error;
    }
  }

  /**
   * @method prerequisiteData
   * The `prerequisiteData` function reads and parses JSON files to retrieve extension and marketplace
   * app data, and stores them in the `extensions` array.
   */
  async prerequisiteData() {
    log.debug('Loading prerequisite data (locales and environments)', this.config.auditContext);
    log.info(auditMsg.PREPARING_ENTRY_METADATA, this.config.auditContext);

    const localesFolderPath = resolve(this.config.basePath, this.config.moduleConfig.locales.dirName);
    const localesPath = join(localesFolderPath, this.config.moduleConfig.locales.fileName);
    const masterLocalesPath = join(localesFolderPath, 'master-locale.json');

    log.debug(`Loading locales from: ${localesFolderPath}`, this.config.auditContext);
    log.debug(`Master locales path: ${masterLocalesPath}`, this.config.auditContext);
    log.debug(`Locales path: ${localesPath}`, this.config.auditContext);

    this.locales = existsSync(masterLocalesPath) ? values(JSON.parse(readFileSync(masterLocalesPath, 'utf8'))) : [];
    log.debug(`Loaded ${this.locales.length} locales from master-locale.json`, this.config.auditContext);

    if (existsSync(localesPath)) {
      log.debug(`Loading additional locales from: ${localesPath}`, this.config.auditContext);
      const additionalLocales = values(JSON.parse(readFileSync(localesPath, 'utf8')));
      this.locales.push(...additionalLocales);
      log.debug(`Added ${additionalLocales.length} additional locales`, this.config.auditContext);
    } else {
      log.debug('No additional locales file found', this.config.auditContext);
    }
    this.locales = this.locales.map((locale: any) => locale.code);
    log.debug(`Total locales loaded: ${this.locales.length}`, this.config.auditContext);
    log.debug(`Locale codes: ${this.locales.join(', ')}`, this.config.auditContext);

    const environmentPath = resolve(
      this.config.basePath,
      this.config.moduleConfig.environments.dirName,
      this.config.moduleConfig.environments.fileName,
    );
    log.debug(`Loading environments from: ${environmentPath}`, this.config.auditContext);

    this.environments = existsSync(environmentPath) ? keys(JSON.parse(readFileSync(environmentPath, 'utf8'))) : [];
    log.debug(`Total environments loaded: ${this.environments.length}`, this.config.auditContext);
    log.debug(`Environment names: ${this.environments.join(', ')}`, this.config.auditContext);
  }

  /**
   * Detects whether the export uses the old flat structure (<basePath>/assets/) or the new
   * multi-space structure (<basePath>/spaces/<space-id>/assets/) and returns a list of resolved
   * asset base paths paired with their space IDs (null for old structure).
   */
  private resolveAssetBasePaths(): Array<{ path: string; spaceId: string | null }> {
    const spacesDir = join(this.config.basePath, 'spaces');

    if (!existsSync(spacesDir)) {
      log.debug('No spaces/ directory found — using flat asset structure', this.config.auditContext);
      return [{ path: this.folderPath, spaceId: null }];
    }

    log.debug(`Multi-space directory found: ${spacesDir}`, this.config.auditContext);
    const spaceDirs = readdirSync(spacesDir, { withFileTypes: true }).filter(
      (entry) => entry.isDirectory() && existsSync(join(spacesDir, entry.name, 'assets')),
    );

    if (spaceDirs.length === 0) {
      log.debug(
        'spaces/ directory exists but contains no valid space directories with assets/',
        this.config.auditContext,
      );
      return [];
    }

    const paths = spaceDirs.map((entry) => ({
      path: join(spacesDir, entry.name, 'assets'),
      spaceId: entry.name,
    }));
    log.debug(`Resolved ${paths.length} space(s): ${paths.map((p) => p.spaceId).join(', ')}`, this.config.auditContext);
    return paths;
  }

  /**
   * The function checks if it can write the fix content to a file and if so, it writes the content as
   * JSON to the specified file path.
   */
  async writeFixContent(filePath: string, schema: Record<string, EntryStruct>) {
    log.debug(`Starting writeFixContent process for: ${filePath}`, this.config.auditContext);
    let canWrite = true;

    if (this.fix) {
      log.debug('Fix mode enabled, checking write permissions', this.config.auditContext);
      if (this.config.flags['copy-dir'] || this.config.flags['external-config']?.skipConfirm || this.config.flags.yes) {
        this.fixOverwriteConfirmed = true;
        log.debug('Skipping confirmation due to copy-dir, external-config, or yes flags', this.config.auditContext);
      } else if (this.fixOverwriteConfirmed !== null) {
        canWrite = this.fixOverwriteConfirmed;
        log.debug(`Using cached overwrite confirmation: ${canWrite}`, this.config.auditContext);
      } else {
        log.debug(
          `Asking user for confirmation to write fix content (--yes flag: ${this.config.flags.yes})`,
          this.config.auditContext,
        );
        this.completeProgress(true);
        canWrite = await cliux.confirm(commonMsg.FIX_CONFIRMATION);
        this.fixOverwriteConfirmed = canWrite;
      }

      if (canWrite) {
        log.debug(`Writing fixed assets to: ${filePath}`, this.config.auditContext);
        writeFileSync(filePath, JSON.stringify(schema));
        log.debug(`Successfully wrote ${Object.keys(schema).length} assets to file`, this.config.auditContext);
      } else {
        log.debug('User declined to write fix content', this.config.auditContext);
      }
    } else {
      log.debug('Skipping writeFixContent - not in fix mode', this.config.auditContext);
    }
  }

  /**
   * This function traverses over the publish details of the assets and removes the publish details where the locale or environment does not exist.
   * Supports both the old flat structure (<basePath>/assets/) and the new multi-space structure
   * (<basePath>/spaces/<space-id>/assets/) via this.resolvedBasePaths.
   */
  async lookForReference(): Promise<void> {
    log.debug('Starting asset reference validation', this.config.auditContext);
    const logConfig = configHandler.get('log') || {};
    const showConsoleLogs = logConfig.showConsoleLogs ?? false;

    if (!this.resolvedBasePaths.length) {
      this.resolvedBasePaths = this.resolveAssetBasePaths();
    }

    for (const { path: spacePath, spaceId } of this.resolvedBasePaths) {
      log.debug(`Processing asset path: ${spacePath} (spaceId=${spaceId ?? 'none'})`, this.config.auditContext);

      // Log UX: print a space header so output is clearly separated per space
      if (showConsoleLogs && spaceId !== null) {
        cliux.print('');
        cliux.print($t(auditMsg.AUDITING_SPACE, { spaceId }), { color: 'cyan' });
      }

      // Multi-space layout: start the per-space row and route ticks below to it.
      // Single-space (legacy) layout falls back to the existing simple progress
      // bar with a status update.
      const spaceProcessName = this.spaceProcessNames.get(spaceId ?? spacePath);
      if (spaceProcessName) {
        this.progressManager?.startProcess?.(spaceProcessName);
        this.progressManager?.updateStatus?.(`Space: ${spaceId ?? 'assets'}`, spaceProcessName);
      } else {
        this.progressManager?.updateStatus?.(spaceId ? `Space: ${spaceId}` : 'Scanning assets...');
      }

      let fsUtility = new FsUtility({ basePath: spacePath, indexFileName: 'assets.json' });
      let indexer = fsUtility.indexFileContent;
      log.debug(`Found ${Object.keys(indexer).length} asset files to process`, this.config.auditContext);

      for (const fileIndex in indexer) {
        log.debug(`Processing asset file: ${indexer[fileIndex]}`, this.config.auditContext);
        const assets = (await fsUtility.readChunkFiles.next()) as Record<string, EntryStruct>;
        this.assets = assets;
        log.debug(`Loaded ${Object.keys(assets).length} assets from file`, this.config.auditContext);

        for (const assetUid in assets) {
          log.debug(`Processing asset: ${assetUid}`, this.config.auditContext);

          if (this.assets[assetUid]?.publish_details && !Array.isArray(this.assets[assetUid].publish_details)) {
            log.debug(`Asset ${assetUid} has invalid publish_details format`, this.config.auditContext);
            cliux.print($t(auditMsg.ASSET_NOT_EXIST, { uid: assetUid }), { color: 'red' });
            this.assets[assetUid].publish_details = [];
          }

          const publishDetails = this.assets[assetUid]?.publish_details;
          log.debug(`Asset ${assetUid} has ${publishDetails?.length || 0} publish details`, this.config.auditContext);

          if (Array.isArray(this.assets[assetUid].publish_details)) {
            this.assets[assetUid].publish_details = this.assets[assetUid].publish_details.filter((pd: any) => {
              log.debug(
                `Checking publish detail: locale=${pd?.locale}, environment=${pd?.environment}`,
                this.config.auditContext,
              );

              if (this.locales?.includes(pd?.locale) && this.environments?.includes(pd?.environment)) {
                log.debug(
                  `Publish detail valid for asset ${assetUid}: locale=${pd.locale}, environment=${pd.environment}`,
                  this.config.auditContext,
                );
                return true;
              } else {
                log.debug(
                  `Publish detail invalid for asset ${assetUid}: locale=${pd.locale}, environment=${pd.environment}`,
                  this.config.auditContext,
                );
                cliux.print(
                  $t(auditMsg.SCAN_ASSET_WARN_MSG, { uid: assetUid, locale: pd.locale, environment: pd.environment }),
                  { color: 'yellow' },
                );
                if (!Object.keys(this.missingEnvLocales).includes(assetUid)) {
                  log.debug(`Creating new missing reference entry for asset ${assetUid}`, this.config.auditContext);
                  this.missingEnvLocales[assetUid] = [
                    {
                      asset_uid: assetUid,
                      publish_locale: pd.locale,
                      publish_environment: pd.environment,
                      space_id: spaceId,
                    },
                  ];
                } else {
                  log.debug(
                    `Adding to existing missing reference entry for asset ${assetUid}`,
                    this.config.auditContext,
                  );
                  this.missingEnvLocales[assetUid].push({
                    asset_uid: assetUid,
                    publish_locale: pd.locale,
                    publish_environment: pd.environment,
                    space_id: spaceId,
                  });
                }
                return false;
              }
            });
          }

          log.info($t(auditMsg.SCAN_ASSET_SUCCESS_MSG, { uid: assetUid }), this.config.auditContext);
          const remainingPublishDetails = this.assets[assetUid].publish_details?.length || 0;
          log.debug(
            `Asset ${assetUid} now has ${remainingPublishDetails} valid publish details`,
            this.config.auditContext,
          );

          if (this.progressManager) {
            // Route the tick to the per-space row when multi-space, otherwise
            // tick the single legacy progress bar (processName arg defaults).
            this.progressManager.tick(true, `asset: ${assetUid}`, null, spaceProcessName);
          }

          if (this.fix) {
            log.debug(`Fixing asset ${assetUid}`, this.config.auditContext);
            log.info($t(auditFixMsg.ASSET_FIX, { uid: assetUid }), this.config.auditContext);
          }
        }

        if (this.fix) {
          await this.writeFixContent(`${spacePath}/${indexer[fileIndex]}`, this.assets);
        }
      }

      // Per-space row finished — close it so the multibar shows ✓ Complete
      // and the next space (if any) starts cleanly.
      if (spaceProcessName) {
        this.progressManager?.completeProcess?.(spaceProcessName, true);
      }
    }

    log.debug(
      `Asset reference validation completed. Processed ${
        Object.keys(this.missingEnvLocales).length
      } assets with issues`,
      this.config.auditContext,
    );
  }

  /**
   * Sum the asset count across all chunk metadata files for a given space's
   * `assets/` directory. Used by `run` to seed each per-space progress row's
   * total before validation begins. Falls back to walking chunk files if the
   * aggregated `metadata.json` is unavailable (older exports).
   */
  private countAssetsInChunkedStore(assetsDir: string): number {
    try {
      const fsUtility = new FsUtility({ basePath: assetsDir, indexFileName: 'assets.json' });
      const meta = fsUtility.getPlainMeta();
      let total = 0;
      for (const value of Object.values(meta)) {
        if (Array.isArray(value)) total += value.length;
      }
      if (total > 0) return total;

      // Fallback: count keys across each chunk file (slow path for legacy
      // exports without metadata.json).
      const indexer = fsUtility.indexFileContent ?? {};
      return Object.keys(indexer).length;
    } catch (e) {
      log.debug(`Could not pre-count assets in ${assetsDir}: ${e}`, this.config.auditContext);
      return 0;
    }
  }
}
