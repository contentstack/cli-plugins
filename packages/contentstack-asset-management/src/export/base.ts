import { resolve as pResolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { FsUtility, log, CLIProgressManager, configHandler } from '@contentstack/cli-utilities';

import type { AssetManagementAPIConfig } from '../types/asset-management-api';
import type { ExportContext } from '../types/export-types';
import { AssetManagementAdapter } from '../utils/asset-management-api-adapter';
import { AM_MAIN_PROCESS_NAME, FALLBACK_AM_API_CONCURRENCY, FALLBACK_AM_CHUNK_FILE_SIZE_MB } from '../constants/index';

export type { ExportContext };

/**
 * Base class for export modules. Extends the API adapter and adds export context,
 * internal progress management, and shared write helpers.
 */
export class AssetManagementExportAdapter extends AssetManagementAdapter {
  protected readonly apiConfig: AssetManagementAPIConfig;
  protected readonly exportContext: ExportContext;
  protected progressManager: CLIProgressManager | null = null;
  protected parentProgressManager: CLIProgressManager | null = null;
  protected processName: string = AM_MAIN_PROCESS_NAME;

  constructor(apiConfig: AssetManagementAPIConfig, exportContext: ExportContext) {
    super(apiConfig);
    this.apiConfig = apiConfig;
    this.exportContext = exportContext;
  }

  public setParentProgressManager(parent: CLIProgressManager): void {
    this.parentProgressManager = parent;
  }

  /**
   * Override the default progress process name for {@link tick}/{@link updateStatus}
   * calls. Used by the per-space orchestrator so each module's ticks land on the
   * row for the space currently being exported.
   */
  public setProcessName(name: string): void {
    this.processName = name;
  }

  protected get progressOrParent(): CLIProgressManager | null {
    return this.parentProgressManager ?? this.progressManager;
  }

  protected createNestedProgress(moduleName: string): CLIProgressManager {
    if (this.parentProgressManager) {
      this.progressManager = this.parentProgressManager;
      return this.parentProgressManager;
    }
    const logConfig = configHandler.get('log') || {};
    const showConsoleLogs = logConfig.showConsoleLogs ?? false;
    this.progressManager = CLIProgressManager.createNested(moduleName, showConsoleLogs);
    return this.progressManager;
  }

  protected tick(success: boolean, itemName: string, error: string | null, processName?: string): void {
    this.progressOrParent?.tick?.(success, itemName, error, processName ?? this.processName);
  }

  protected updateStatus(message: string, processName?: string): void {
    this.progressOrParent?.updateStatus?.(message, processName ?? this.processName);
  }

  protected completeProcess(processName: string, success: boolean): void {
    if (!this.parentProgressManager) {
      this.progressManager?.completeProcess?.(processName, success);
    }
  }

  protected get spacesRootPath(): string {
    return this.exportContext.spacesRootPath;
  }

  /** Parallel AM export limit for bootstrap and default batch operations. */
  protected get apiConcurrency(): number {
    return this.exportContext.apiConcurrency ?? FALLBACK_AM_API_CONCURRENCY;
  }

  /** Asset download batch size; falls back to {@link apiConcurrency}. */
  protected get downloadAssetsBatchConcurrency(): number {
    return this.exportContext.downloadAssetsConcurrency ?? this.apiConcurrency;
  }

  protected getAssetTypesDir(): string {
    return pResolve(this.exportContext.spacesRootPath, 'asset_types');
  }

  protected getFieldsDir(): string {
    return pResolve(this.exportContext.spacesRootPath, 'fields');
  }

  protected async writeItemsToChunkedJson(
    dir: string,
    indexFileName: string,
    moduleName: string,
    metaPickKeys: string[],
    items: unknown[],
  ): Promise<void> {
    if (items.length === 0) {
      await writeFile(pResolve(dir, indexFileName), '{}');
      return;
    }
    const chunkMb = this.exportContext.chunkFileSizeMb ?? FALLBACK_AM_CHUNK_FILE_SIZE_MB;
    const fs = new FsUtility({
      basePath: dir,
      indexFileName,
      chunkFileSize: chunkMb,
      moduleName,
      fileExt: 'json',
      metaPickKeys,
      keepMetadata: true,
    });
    fs.writeIntoFile(items as Record<string, string>[], { mapKeyVal: true });
    fs.completeFile(true);
  }
}
