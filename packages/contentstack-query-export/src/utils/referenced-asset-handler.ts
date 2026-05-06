import * as path from 'path';
import * as fs from 'fs';
import { QueryExportConfig } from '../types';
import { fsUtil } from './index';
import { sanitizePath, log, formatError, handleAndLogError } from '@contentstack/cli-utilities';

export class AssetReferenceHandler {
  private exportQueryConfig: QueryExportConfig;
  private entriesDir: string;

  constructor(exportQueryConfig: QueryExportConfig) {
    this.exportQueryConfig = exportQueryConfig;
    this.entriesDir = path.join(
      sanitizePath(exportQueryConfig.exportDir),
      sanitizePath(exportQueryConfig.branchName || ''),
      'entries',
    );
  }

  /**
   * Extract all asset UIDs by processing entries file by file (memory efficient)
   */
  extractReferencedAssets(): string[] {
    log.info('Extracting referenced assets from entries...', this.exportQueryConfig.context);

    try {
      if (!fs.existsSync(this.entriesDir)) {
        log.warn('Entries directory does not exist', this.exportQueryConfig.context);
        return [];
      }

      // Global set to maintain unique asset UIDs across all files
      const globalAssetUIDs = new Set<string>();

      // Get all JSON files
      const jsonFiles = this.findAllJsonFiles(this.entriesDir);

      // Process files one by one
      let totalEntriesProcessed = 0;
      for (const jsonFile of jsonFiles) {
        const entriesInFile = this.processSingleFile(jsonFile, globalAssetUIDs);
        totalEntriesProcessed += entriesInFile;
      }

      const result = Array.from(globalAssetUIDs);
      log.info(
        `Found ${result.length} unique asset UIDs from ${totalEntriesProcessed} entries across ${jsonFiles.length} files`,
        this.exportQueryConfig.context,
      );

      return result;
    } catch (error) {
      handleAndLogError(error, this.exportQueryConfig.context, 'Failed to extract assets');
      return [];
    }
  }

  /**
   * Process a single file and extract asset UIDs from all its entries
   */
  private processSingleFile(filePath: string, globalAssetUIDs: Set<string>): number {
    // Skip index.json files
    if (path.basename(filePath) === 'index.json') {
      return 0;
    }

    try {
      const fileContent = fsUtil.readFile(sanitizePath(filePath));

      if (!fileContent || typeof fileContent !== 'object') {
        return 0;
      }

      // Stringify the ENTIRE file content at once
      const fileString = JSON.stringify(fileContent);

      // Extract all asset UIDs from the entire file
      const assetUIDs = this.extractAssetUIDsFromString(fileString);

      // Add to global set
      assetUIDs.forEach((uid) => globalAssetUIDs.add(uid));

      // Count entries for logging
      const entriesCount = Object.keys(fileContent).length;
      log.debug(`Processed ${entriesCount} entries from ${path.basename(filePath)}`, this.exportQueryConfig.context);

      return entriesCount;
    } catch (error) {
      log.warn(`Failed to process file ${filePath}: ${formatError(error)}`, this.exportQueryConfig.context);
      return 0;
    }
  }

  /**
   * Extract asset UIDs from stringified content using multiple patterns
   */
  private extractAssetUIDsFromString(content: string): string[] {
    const assetUIDs = new Set<string>();

    // Pattern 1: HTML img tags with asset_uid
    const htmlAssetRegex = /<img asset_uid=\\"([^"]+)\\"/g;
    let match;
    while ((match = htmlAssetRegex.exec(content)) !== null) {
      if (match[1]) {
        assetUIDs.add(match[1]);
      }
    }

    let assetUrlRegex = '';
    let assetUIDMatchIndex;
    if (process.env.ENVIRONMENT === 'NON_PROD') {
      assetUrlRegex = '(https://.*?/v3/assets/(.*?)/(.*?)/(.*?)/(.*?)(?="))';
      assetUIDMatchIndex = 3;
    } else {
      assetUrlRegex =
        '(https://(assets|(eu-|azure-na-|azure-eu-|gcp-na-|gcp-eu-)?images).contentstack.(io|com)/v3/assets/(.*?)/(.*?)/(.*?)/(.*?)(?="))';
      assetUIDMatchIndex = 6;
    }

    // Pattern 2: Contentstack asset URLs
    const urlRegex = new RegExp(assetUrlRegex, 'g');
    while ((match = urlRegex.exec(content)) !== null) {
      const assetUID = match[assetUIDMatchIndex]; // The asset UID is in the 6th capture group
      if (assetUID) {
        assetUIDs.add(assetUID);
      }
    }

    return Array.from(assetUIDs);
  }

  /**
   * Recursively find all JSON files in the entries directory
   */
  private findAllJsonFiles(dir: string): string[] {
    const jsonFiles: string[] = [];

    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          jsonFiles.push(...this.findAllJsonFiles(fullPath));
        } else if (stat.isFile() && item.endsWith('.json')) {
          jsonFiles.push(fullPath);
        }
      }
    } catch (error) {
      log.warn(`Failed to read directory ${dir}: ${formatError(error)}`, this.exportQueryConfig.context);
    }

    return jsonFiles;
  }
}
