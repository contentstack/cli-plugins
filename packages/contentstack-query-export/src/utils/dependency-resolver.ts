import * as path from 'path';
import { QueryExportConfig } from '../types';
import { fsUtil } from './index';
import {
  ContentstackClient,
  sanitizePath,
  log,
  formatError,
  handleAndLogError,
  readContentTypeSchemas,
} from '@contentstack/cli-utilities';

export class ContentTypeDependenciesHandler {
  private exportQueryConfig: QueryExportConfig;
  private stackAPIClient: ReturnType<ContentstackClient['stack']>;

  constructor(stackAPIClient: any, exportQueryConfig: QueryExportConfig) {
    this.exportQueryConfig = exportQueryConfig;
    this.stackAPIClient = stackAPIClient;
  }

  /**
   * Extract all dependencies (global fields, extensions, taxonomies, marketplace apps) from the
   * provided schema documents.  When `schemas` is omitted the method falls back to reading content
   * type schemas from disk — kept for backward compatibility with callers that do not supply
   * already-loaded documents.
   *
   * Pass the combined set of content-type AND global-field documents so that transitive
   * dependencies inside global fields are discovered in the same pass.
   */
  async extractDependencies(schemas?: any[]): Promise<{
    globalFields: Set<string>;
    extensions: Set<string>;
    taxonomies: Set<string>;
    marketplaceApps: Set<string>;
  }> {
    let allSchemas: any[];

    if (schemas !== undefined) {
      allSchemas = schemas;
    } else {
      const contentTypesFilePath = path.join(
        sanitizePath(this.exportQueryConfig.exportDir),
        sanitizePath(this.exportQueryConfig.branchName || ''),
        'content_types',
      );
      allSchemas = readContentTypeSchemas(contentTypesFilePath);
    }

    if (allSchemas.length === 0) {
      log.info('No schemas found, skipping dependency extraction', this.exportQueryConfig.context);
      return {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
        marketplaceApps: new Set<string>(),
      };
    }

    log.info(`Extracting dependencies from ${allSchemas.length} schema(s)`, this.exportQueryConfig.context);

    const dependencies = {
      globalFields: new Set<string>(),
      extensions: new Set<string>(),
      taxonomies: new Set<string>(),
      marketplaceApps: new Set<string>(),
    };

    for (const doc of allSchemas) {
      if (doc.schema) {
        this.traverseSchemaForDependencies(doc.schema, dependencies);
      }
    }

    // Separate extensions from marketplace apps using the extracted extension UIDs
    if (dependencies.extensions.size > 0) {
      const extensionUIDs = Array.from(dependencies.extensions);
      log.info(
        `Processing ${extensionUIDs.length} extensions to identify marketplace apps...`,
        this.exportQueryConfig.context,
      );

      try {
        const { extensions, marketplaceApps } = await this.fetchExtensionsAndMarketplaceApps(extensionUIDs);
        dependencies.extensions = new Set(extensions);
        dependencies.marketplaceApps = new Set(marketplaceApps);
        log.info(
          `Dependencies separated - Global Fields: ${dependencies.globalFields.size}, Extensions: ${dependencies.extensions.size}, Taxonomies: ${dependencies.taxonomies.size}, Marketplace Apps: ${dependencies.marketplaceApps.size}`,
          this.exportQueryConfig.context,
        );
      } catch (error) {
        handleAndLogError(error, this.exportQueryConfig.context, 'Failed to separate extensions and Marketplace apps');
        // Keep original extensions if separation fails
      }
    } else {
      log.info(
        `Found dependencies - Global Fields: ${dependencies.globalFields.size}, Extensions: ${dependencies.extensions.size}, Taxonomies: ${dependencies.taxonomies.size}, Marketplace Apps: ${dependencies.marketplaceApps.size}`,
        this.exportQueryConfig.context,
      );
    }

    return dependencies;
  }

  // Update the fetchExtensionsAndMarketplaceApps method to only fetch specific extension UIDs
  async fetchExtensionsAndMarketplaceApps(
    extensionUIDs: string[],
  ): Promise<{ extensions: string[]; marketplaceApps: string[] }> {
    log.info(
      `Fetching details for ${extensionUIDs.length} extensions to identify marketplace apps...`,
      this.exportQueryConfig.context,
    );

    try {
      // Query parameters to include marketplace extensions
      const queryParams = {
        include_count: true,
        include_marketplace_extensions: true,
        query: {
          uid: { $in: extensionUIDs },
        },
      };

      // Fetch all extensions including marketplace apps
      const response = await this.stackAPIClient.extension().query(queryParams).find();

      if (!response || !response.items) {
        log.warn(`No extensions found`, this.exportQueryConfig.context);
        return { extensions: extensionUIDs, marketplaceApps: [] };
      }

      const marketplaceApps: string[] = [];
      const regularExtensions: string[] = [];

      response.items.forEach((item: any) => {
        if (item.app_uid && item.app_installation_uid) {
          marketplaceApps.push(item.app_installation_uid);
        } else {
          regularExtensions.push(item.uid);
        }
      });

      log.info(
        `Identified ${marketplaceApps.length} marketplace apps and ${regularExtensions.length} regular extensions from ${extensionUIDs.length} total extensions`,
        this.exportQueryConfig.context,
      );

      return { extensions: regularExtensions, marketplaceApps };
    } catch (error) {
      handleAndLogError(error, this.exportQueryConfig.context, 'Failed to fetch extensions and Marketplace apps');
      return { extensions: extensionUIDs, marketplaceApps: [] };
    }
  }

  private traverseSchemaForDependencies(schema: any[], dependencies: any): void {
    for (const field of schema) {
      // Global fields
      if (field.data_type === 'global_field' && field.reference_to) {
        dependencies.globalFields.add(field.reference_to);
      }

      // Extensions
      if (field.extension_uid) {
        dependencies.extensions.add(field.extension_uid);
      }

      // Taxonomies - UPDATED LOGIC
      if (field.data_type === 'taxonomy' && field.taxonomies && Array.isArray(field.taxonomies)) {
        field.taxonomies.forEach((tax: any) => {
          if (tax.taxonomy_uid) {
            dependencies.taxonomies.add(tax.taxonomy_uid);
          }
        });
      }

      // Recursive traversal for nested structures
      if ((field.data_type === 'group' || field.data_type === 'global_field') && field.schema) {
        this.traverseSchemaForDependencies(field.schema, dependencies);
      }

      if (field.data_type === 'blocks' && field.blocks) {
        for (const blockKey in field.blocks) {
          if (field.blocks[blockKey].schema) {
            this.traverseSchemaForDependencies(field.blocks[blockKey].schema, dependencies);
          }
        }
      }
    }
  }
}
