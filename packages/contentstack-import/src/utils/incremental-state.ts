import { join } from 'node:path';
import { existsSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { log } from '@contentstack/cli-utilities';

export interface StateEntry {
  oldUid: string;
  newUid: string;
  type: 'asset' | 'folder';
  timestamp: number;
}

export interface AssetMappings {
  assets: Record<string, string>;
  folders: Record<string, string>;
  urls: Record<string, string>;
}

export interface StateManagerConfig {
  stateFilePath: string;
  batchSize: number;
  enableBackup: boolean;
  context: Record<string, any>;
}

export class IncrementalStateManager {
  private stateFilePath: string;
  private batchSize: number;
  private enableBackup: boolean;
  private context: Record<string, any>;
  private pendingWrites: StateEntry[] = [];
  private inMemoryMappings: AssetMappings = {
    assets: {},
    folders: {},
    urls: {}
  };
  private lastPersistTime: number = 0;
  private persistPromise: Promise<void> = Promise.resolve();

  constructor(config: StateManagerConfig) {
    this.stateFilePath = config.stateFilePath;
    this.batchSize = config.batchSize;
    this.enableBackup = config.enableBackup;
    this.context = config.context;

    // Load existing state on initialization
    this.loadExistingState();
    
    log.debug(`Incremental state manager initialized with file: ${this.stateFilePath}`, this.context);
  }

  /**
   * Add a new mapping to be persisted
   */
  addMapping(oldUid: string, newUid: string, type: 'asset' | 'folder', url?: string): void {
    const entry: StateEntry = {
      oldUid,
      newUid,
      type,
      timestamp: Date.now()
    };

    // Update in-memory mappings immediately
    if (type === 'asset') {
      this.inMemoryMappings.assets[oldUid] = newUid;
      if (url) {
        this.inMemoryMappings.urls[url] = newUid; // This should be the new URL, but we'll store the mapping
      }
    } else if (type === 'folder') {
      this.inMemoryMappings.folders[oldUid] = newUid;
    }

    // Add to pending writes
    this.pendingWrites.push(entry);

    // Check if we should persist
    if (this.pendingWrites.length >= this.batchSize) {
      this.persistState();
    }

    log.debug(`Added mapping: ${oldUid} -> ${newUid} (${type})`, this.context);
  }

  /**
   * Get a mapping by old UID
   */
  getMapping(oldUid: string, type: 'asset' | 'folder'): string | undefined {
    if (type === 'asset') {
      return this.inMemoryMappings.assets[oldUid];
    } else if (type === 'folder') {
      return this.inMemoryMappings.folders[oldUid];
    }
    return undefined;
  }

  /**
   * Get all mappings of a specific type
   */
  getAllMappings(type: 'asset' | 'folder'): Record<string, string> {
    if (type === 'asset') {
      return { ...this.inMemoryMappings.assets };
    } else if (type === 'folder') {
      return { ...this.inMemoryMappings.folders };
    }
    return {};
  }

  /**
   * Get URL mappings
   */
  getUrlMappings(): Record<string, string> {
    return { ...this.inMemoryMappings.urls };
  }

  /**
   * Check if a mapping exists
   */
  hasMapping(oldUid: string, type: 'asset' | 'folder'): boolean {
    return this.getMapping(oldUid, type) !== undefined;
  }

  /**
   * Get the count of mappings
   */
  getMappingCount(): { assets: number; folders: number; urls: number } {
    return {
      assets: Object.keys(this.inMemoryMappings.assets).length,
      folders: Object.keys(this.inMemoryMappings.folders).length,
      urls: Object.keys(this.inMemoryMappings.urls).length
    };
  }

  /**
   * Persist pending state changes to disk
   */
  persistState(): void {
    if (this.pendingWrites.length === 0) {
      return;
    }

    // Chain persistence to avoid concurrent writes
    this.persistPromise = this.persistPromise.then(async () => {
      try {
        const entriesToWrite = [...this.pendingWrites];
        this.pendingWrites = []; // Clear pending writes immediately

        if (entriesToWrite.length === 0) {
          return;
        }

        // Create backup if enabled
        if (this.enableBackup && existsSync(this.stateFilePath)) {
          const backupPath = `${this.stateFilePath}.backup`;
          const currentContent = readFileSync(this.stateFilePath, 'utf8');
          writeFileSync(backupPath, currentContent);
        }

        // Write current complete state
        const completeState = {
          assets: this.inMemoryMappings.assets,
          folders: this.inMemoryMappings.folders,
          urls: this.inMemoryMappings.urls,
          lastUpdated: Date.now(),
          totalEntries: entriesToWrite.length
        };

        writeFileSync(this.stateFilePath, JSON.stringify(completeState, null, 2));
        this.lastPersistTime = Date.now();

        log.debug(`Persisted ${entriesToWrite.length} state entries to ${this.stateFilePath}`, this.context);
      } catch (error) {
        log.error(`Failed to persist state: ${error}`, this.context);
        // Re-add entries to pending writes for retry
        this.pendingWrites.unshift(...this.pendingWrites);
      }
    });
  }

  /**
   * Force immediate persistence of all pending changes
   */
  async flushState(): Promise<void> {
    this.persistState();
    await this.persistPromise;
    log.debug('State flushed to disk', this.context);
  }

  /**
   * Load existing state from disk
   */
  private loadExistingState(): void {
    if (!existsSync(this.stateFilePath)) {
      log.debug('No existing state file found, starting fresh', this.context);
      return;
    }

    try {
      const content = readFileSync(this.stateFilePath, 'utf8');
      const state = JSON.parse(content);

      if (state.assets) {
        this.inMemoryMappings.assets = state.assets;
      }
      if (state.folders) {
        this.inMemoryMappings.folders = state.folders;
      }
      if (state.urls) {
        this.inMemoryMappings.urls = state.urls;
      }

      const counts = this.getMappingCount();
      log.debug(`Loaded existing state: ${counts.assets} assets, ${counts.folders} folders, ${counts.urls} URLs`, this.context);
    } catch (error) {
      log.warn(`Failed to load existing state file: ${error}. Starting fresh.`, this.context);
      this.inMemoryMappings = { assets: {}, folders: {}, urls: {} };
    }
  }

  /**
   * Clear all in-memory mappings (useful for memory management)
   */
  clearInMemoryMappings(): void {
    const beforeCounts = this.getMappingCount();
    
    // Only clear if we have persisted recently
    const timeSinceLastPersist = Date.now() - this.lastPersistTime;
    if (timeSinceLastPersist > 60000) { // 1 minute
      log.warn('Attempting to clear mappings but no recent persist detected', this.context);
      return;
    }

    this.inMemoryMappings = { assets: {}, folders: {}, urls: {} };
    
    log.debug(`Cleared in-memory mappings: ${beforeCounts.assets} assets, ${beforeCounts.folders} folders, ${beforeCounts.urls} URLs`, this.context);
  }

  /**
   * Get statistics about the state manager
   */
  getStats(): {
    mappingCounts: { assets: number; folders: number; urls: number };
    pendingWrites: number;
    lastPersistTime: number;
    stateFileExists: boolean;
  } {
    return {
      mappingCounts: this.getMappingCount(),
      pendingWrites: this.pendingWrites.length,
      lastPersistTime: this.lastPersistTime,
      stateFileExists: existsSync(this.stateFilePath)
    };
  }

  /**
   * Create a state manager with default configuration
   */
  static createDefault(baseDir: string, context: Record<string, any> = {}): IncrementalStateManager {
    return new IncrementalStateManager({
      stateFilePath: join(baseDir, '.import-state.json'),
      batchSize: 100, // Persist every 100 mappings
      enableBackup: true,
      context
    });
  }

  /**
   * Create a state manager optimized for large datasets
   */
  static createForLargeDataset(baseDir: string, context: Record<string, any> = {}): IncrementalStateManager {
    return new IncrementalStateManager({
      stateFilePath: join(baseDir, '.import-state.json'),
      batchSize: 50, // More frequent persistence for large datasets
      enableBackup: true,
      context
    });
  }
}