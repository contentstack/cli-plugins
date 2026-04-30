import { ContentstackClient, sanitizePath, log, handleAndLogError } from '@contentstack/cli-utilities';
import * as fs from 'fs';
import * as path from 'path';
import { QueryExportConfig, Modules } from '../types';
import { QueryParser } from '../utils/query-parser';
import { ModuleExporter } from './module-exporter';
import { ReferencedContentTypesHandler } from '../utils';
import { fsUtil } from '../utils';
import { ContentTypeDependenciesHandler } from '../utils';
import { AssetReferenceHandler } from '../utils';
import { readContentTypesFromExportDir, readGlobalFieldSchemasFromDir } from '../utils/read-content-type-schemas';

export class QueryExporter {
  private stackAPIClient: ReturnType<ContentstackClient['stack']>;
  private exportQueryConfig: QueryExportConfig;
  private queryParser: QueryParser;
  private moduleExporter: ModuleExporter;

  constructor(managementAPIClient: ContentstackClient, exportQueryConfig: QueryExportConfig) {
    this.exportQueryConfig = exportQueryConfig;

    this.stackAPIClient = managementAPIClient.stack({
      api_key: exportQueryConfig.stackApiKey,
      management_token: exportQueryConfig.managementToken,
    });
    // Initialize components
    this.queryParser = new QueryParser(this.exportQueryConfig);
    this.moduleExporter = new ModuleExporter(exportQueryConfig);
  }

  async execute(): Promise<void> {
    log.info('Starting query-based export...', this.exportQueryConfig.context);

    // Step 1: Parse and validate query
    log.debug('Parsing and validating query', this.exportQueryConfig.context);
    const parsedQuery = await this.queryParser.parse(this.exportQueryConfig.query);
    log.success('Query parsed and validated successfully', this.exportQueryConfig.context);

    // Step 2: Always export general modules
    await this.exportGeneralModules();

    // Step 4: Export queried modules
    await this.exportQueriedModule(parsedQuery);

    // Step 5+6: resolve the full transitive closure of referenced content types,
    // global fields, extensions, taxonomies, and marketplace apps.
    log.debug('Starting schema closure expansion', this.exportQueryConfig.context);
    await this.expandSchemaClosure();
    // Step 7: export content modules entries, assets
    log.debug('Starting content modules export', this.exportQueryConfig.context);
    await this.exportContentModules();
    // Step 9: export all other modules

    log.success('Query-based export completed successfully!', this.exportQueryConfig.context);
  }

  // export general modules
  private async exportGeneralModules(): Promise<void> {
    log.info('Exporting general modules...', this.exportQueryConfig.context);

    for (const module of this.exportQueryConfig.modules.general) {
      await this.moduleExporter.exportModule(module);
    }
  }

  private async exportQueriedModule(parsedQuery: any): Promise<void> {
    log.debug('Starting queried module export', this.exportQueryConfig.context);
    for (const [moduleName] of Object.entries(parsedQuery.modules)) {
      const module = moduleName as Modules;

      if (!this.exportQueryConfig.modules.queryable.includes(module)) {
        log.error(`Module "${module}" is not queryable`, this.exportQueryConfig.context);
        continue;
      }

      log.info(`Exporting ${moduleName} with query...`, this.exportQueryConfig.context);
      // Export the queried module
      await this.moduleExporter.exportModule(module, { query: parsedQuery });
    }
    log.debug('Queried module export completed', this.exportQueryConfig.context);
  }

  /**
   * Iteratively expand the set of exported content types, global fields, extensions,
   * taxonomies, and marketplace apps until no new items are discovered (fixpoint).
   *
   * Each iteration scans the combined set of CT and GF documents that currently exist on
   * disk.  Any newly discovered referenced content types or global fields are exported and
   * the loop restarts so that their schemas can be scanned in turn.  Leaf dependencies
   * (extensions, taxonomies, marketplace apps) are collected and exported in the same pass
   * without triggering an extra iteration, since they do not themselves produce new schemas.
   *
   * Personalize is exported exactly once, after the closure stabilises.
   */
  private async expandSchemaClosure(): Promise<void> {
    log.info('Starting export of referenced content types and dependent modules...', this.exportQueryConfig.context);

    try {
      const ctPath = path.join(
        sanitizePath(this.exportQueryConfig.exportDir),
        sanitizePath(this.exportQueryConfig.branchName || ''),
        'content_types',
      );
      const gfPath = path.join(
        sanitizePath(this.exportQueryConfig.exportDir),
        sanitizePath(this.exportQueryConfig.branchName || ''),
        'global_fields',
      );

      const referencedHandler = new ReferencedContentTypesHandler(this.exportQueryConfig);
      const dependenciesHandler = new ContentTypeDependenciesHandler(this.stackAPIClient, this.exportQueryConfig);

      const exportedCTUIDs = new Set<string>();
      const exportedGFUIDs = new Set<string>();
      const exportedExtUIDs = new Set<string>();
      const exportedTaxUIDs = new Set<string>();
      const exportedMarketplaceUIDs = new Set<string>();

      let iterationCount = 0;

      while (iterationCount < this.exportQueryConfig.maxCTReferenceDepth) {
        iterationCount++;
        log.debug(`Schema closure iteration ${iterationCount}`, this.exportQueryConfig.context);

        const allCTs = readContentTypesFromExportDir(ctPath);
        const allGFs = readGlobalFieldSchemasFromDir(gfPath);

        // Record everything currently on disk so we never re-export it.
        allCTs.forEach((ct: any) => exportedCTUIDs.add(ct.uid));
        allGFs.forEach((gf: any) => exportedGFUIDs.add(gf.uid));

        const allSchemas = [...allCTs, ...allGFs];

        if (allSchemas.length === 0) {
          log.info('No schemas found on disk, stopping closure', this.exportQueryConfig.context);
          break;
        }

        let foundNewCTs = false;
        let foundNewGFs = false;

        // Step A: find and export referenced content types from the combined schema set.
        if (!this.exportQueryConfig.skipReferences) {
          const referencedUIDs = await referencedHandler.extractReferencedContentTypes(allSchemas);
          const newCTUIDs = referencedUIDs.filter((uid: string) => !exportedCTUIDs.has(uid));

          if (newCTUIDs.length > 0) {
            log.info(
              `Found ${newCTUIDs.length} new referenced content type(s) to fetch`,
              this.exportQueryConfig.context,
            );
            await this.moduleExporter.exportModule('content-types', {
              query: { modules: { 'content-types': { uid: { $in: newCTUIDs } } } },
            });
            // Track immediately so the dedup filter works even if the disk reader
            // hasn't picked up the newly written files yet.
            newCTUIDs.forEach((uid: string) => exportedCTUIDs.add(uid));
            foundNewCTs = true;
          }
        }

        // Step B: find and export dependent modules from the combined schema set.
        if (!this.exportQueryConfig.skipDependencies) {
          const deps = await dependenciesHandler.extractDependencies(allSchemas);

          const newGFUIDs = [...deps.globalFields].filter((uid: string) => !exportedGFUIDs.has(uid));
          if (newGFUIDs.length > 0) {
            log.info(`Found ${newGFUIDs.length} new global field(s)`, this.exportQueryConfig.context);
            await this.moduleExporter.exportModule('global-fields', {
              query: { modules: { 'global-fields': { uid: { $in: newGFUIDs } } } },
            });
            // Track immediately for the same reason as CTs above.
            newGFUIDs.forEach((uid: string) => exportedGFUIDs.add(uid));
            foundNewGFs = true;
          }

          // Extensions, taxonomies, and marketplace apps are leaf nodes: they do not
          // produce new schemas, so exporting them never requires an extra iteration.
          const newExtUIDs = [...deps.extensions].filter((uid: string) => !exportedExtUIDs.has(uid));
          if (newExtUIDs.length > 0) {
            log.info(`Found ${newExtUIDs.length} new extension(s)`, this.exportQueryConfig.context);
            await this.moduleExporter.exportModule('extensions', {
              query: { modules: { extensions: { uid: { $in: newExtUIDs } } } },
            });
            newExtUIDs.forEach((uid: string) => exportedExtUIDs.add(uid));
          }

          const newMarketplaceUIDs = [...deps.marketplaceApps].filter(
            (uid: string) => !exportedMarketplaceUIDs.has(uid),
          );
          if (newMarketplaceUIDs.length > 0) {
            log.info(`Found ${newMarketplaceUIDs.length} new marketplace app(s)`, this.exportQueryConfig.context);
            await this.moduleExporter.exportModule('marketplace-apps', {
              query: { modules: { 'marketplace-apps': { installation_uid: { $in: newMarketplaceUIDs } } } },
            });
            newMarketplaceUIDs.forEach((uid: string) => exportedMarketplaceUIDs.add(uid));
          }

          const newTaxUIDs = [...deps.taxonomies].filter((uid: string) => !exportedTaxUIDs.has(uid));
          if (newTaxUIDs.length > 0) {
            log.info(`Found ${newTaxUIDs.length} new taxonom(ies)`, this.exportQueryConfig.context);
            await this.moduleExporter.exportModule('taxonomies', {
              query: { modules: { taxonomies: { uid: { $in: newTaxUIDs } } } },
            });
            newTaxUIDs.forEach((uid: string) => exportedTaxUIDs.add(uid));
          }
        }

        if (!foundNewCTs && !foundNewGFs) {
          log.info('Schema closure complete, no new content types or global fields found', this.exportQueryConfig.context);
          break;
        }
      }

      // Personalize is a single global module exported once after the closure stabilises.
      await this.moduleExporter.exportModule('personalize');

      log.success('Referenced content types and dependent modules exported successfully', this.exportQueryConfig.context);
    } catch (error) {
      handleAndLogError(error, this.exportQueryConfig.context, 'Error during schema closure expansion');
      throw error;
    }
  }

  private async exportContentModules(): Promise<void> {
    log.info('Starting export of content modules...', this.exportQueryConfig.context);

    try {
      // Step 1: Export entries for all exported content types
      await this.exportEntries();

      // Step 2: Export referenced assets from entries
      // add a delay of 5 seconds
      const delay = (this.exportQueryConfig as any).exportDelayMs || 5000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      await this.exportReferencedAssets();

      log.success('Content modules export completed successfully', this.exportQueryConfig.context);
    } catch (error) {
      handleAndLogError(error, this.exportQueryConfig.context, 'Error exporting content modules');
      throw error;
    }
  }

  private async exportEntries(): Promise<void> {
    log.info('Exporting entries...', this.exportQueryConfig.context);

    try {
      // Export entries - module exporter will automatically read exported content types
      // and export entries for all of them
      await this.moduleExporter.exportModule('entries');

      log.success('Entries export completed successfully', this.exportQueryConfig.context);
    } catch (error) {
      handleAndLogError(error, this.exportQueryConfig.context, 'Error exporting entries');
      throw error;
    }
  }

  private async exportReferencedAssets(): Promise<void> {
    log.info('Starting export of referenced assets...', this.exportQueryConfig.context);

    try {
      const assetsDir = path.join(
        sanitizePath(this.exportQueryConfig.exportDir),
        sanitizePath(this.exportQueryConfig.branchName || ''),
        'assets',
      );

      const metadataFilePath = path.join(assetsDir, 'metadata.json');
      const assetFilePath = path.join(assetsDir, 'assets.json');

      // Define temp file paths
      const tempMetadataFilePath = path.join(assetsDir, 'metadata_temp.json');
      const tempAssetFilePath = path.join(assetsDir, 'assets_temp.json');

      const assetHandler = new AssetReferenceHandler(this.exportQueryConfig);

      // Extract referenced asset UIDs from all entries
      log.debug('Extracting referenced assets from entries', this.exportQueryConfig.context);
      const assetUIDs = assetHandler.extractReferencedAssets();

      if (assetUIDs.length > 0) {
        log.info(`Found ${assetUIDs.length} referenced assets to export`, this.exportQueryConfig.context);

        fs.mkdirSync(assetsDir, { recursive: true });

        // Define batch size - can be configurable through exportQueryConfig
        const batchSize = this.exportQueryConfig.assetBatchSize || 100;

        // if asset size is bigger than batch size, then we need to export in batches
        // Calculate number of batches
        const totalBatches = Math.ceil(assetUIDs.length / batchSize);
        log.info(`Processing assets in ${totalBatches} batches of ${batchSize}`, this.exportQueryConfig.context);

        // Process assets in batches
        for (let i = 0; i < totalBatches; i++) {
          const start = i * batchSize;
          const end = Math.min(start + batchSize, assetUIDs.length);
          const batchAssetUIDs = assetUIDs.slice(start, end);

          log.info(
            `Exporting batch ${i + 1}/${totalBatches} (${batchAssetUIDs.length} assets)...`,
            this.exportQueryConfig.context,
          );

          const query = {
            modules: {
              assets: {
                uid: { $in: batchAssetUIDs },
              },
            },
          };

          await this.moduleExporter.exportModule('assets', { query });

          // Read the current batch's metadata.json and assets.json files
          const currentMetadata: any = fsUtil.readFile(sanitizePath(metadataFilePath));
          const currentAssets: any = fsUtil.readFile(sanitizePath(assetFilePath));

          // Check if this is the first batch
          if (i === 0) {
            // For first batch, initialize temp files with current content
            fsUtil.writeFile(sanitizePath(tempMetadataFilePath), currentMetadata);
            fsUtil.writeFile(sanitizePath(tempAssetFilePath), currentAssets);
            log.info(`Initialized temporary files with first batch data`, this.exportQueryConfig.context);
          } else {
            // For subsequent batches, append to temp files with incremented keys

            // Handle metadata (which contains arrays of asset info)
            const tempMetadata: any = fsUtil.readFile(sanitizePath(tempMetadataFilePath)) || {};

            // Merge metadata by combining arrays
            if (currentMetadata) {
              Object.keys(currentMetadata).forEach((key: string) => {
                if (!tempMetadata[key]) {
                  tempMetadata[key] = currentMetadata[key];
                }
              });
            }

            // Write updated metadata back to temp file
            fsUtil.writeFile(sanitizePath(tempMetadataFilePath), tempMetadata);

            // Handle assets (which is an object with numeric keys)
            const tempAssets: any = fsUtil.readFile(sanitizePath(tempAssetFilePath)) || {};
            let nextIndex = Object.keys(tempAssets).length + 1;

            // Add current assets with incremented keys
            Object.values(currentAssets).forEach((value: any) => {
              tempAssets[nextIndex.toString()] = value;
              nextIndex++;
            });

            fsUtil.writeFile(sanitizePath(tempAssetFilePath), tempAssets);

            log.info(`Updated temporary files with batch ${i + 1} data`, this.exportQueryConfig.context);
          }

          // Optional: Add delay between batches to avoid rate limiting
          if (i < totalBatches - 1 && this.exportQueryConfig.batchDelayMs) {
            await new Promise((resolve) => setTimeout(resolve, this.exportQueryConfig.batchDelayMs));
          }
        }

        // After all batches are processed, copy temp files back to original files
        const finalMetadata = fsUtil.readFile(sanitizePath(tempMetadataFilePath));
        const finalAssets = fsUtil.readFile(sanitizePath(tempAssetFilePath));

        fsUtil.writeFile(sanitizePath(metadataFilePath), finalMetadata);
        fsUtil.writeFile(sanitizePath(assetFilePath), finalAssets);

        log.info(`Final data written back to original files`, this.exportQueryConfig.context);

        // Clean up temp files
        fsUtil.removeFile(sanitizePath(tempMetadataFilePath));
        fsUtil.removeFile(sanitizePath(tempAssetFilePath));

        log.info(`Temporary files cleaned up`, this.exportQueryConfig.context);
        log.success('Referenced assets exported successfully', this.exportQueryConfig.context);
      } else {
        log.info('No referenced assets found in entries', this.exportQueryConfig.context);
      }
    } catch (error) {
      handleAndLogError(error, this.exportQueryConfig.context, 'Error exporting referenced assets');
      throw error;
    }
  }
}
