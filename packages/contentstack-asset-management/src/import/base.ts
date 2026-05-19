import { resolve as pResolve } from 'node:path';
import { CLIProgressManager, configHandler } from '@contentstack/cli-utilities';

import type { CSAssetsAPIConfig, ImportContext } from '../types/cs-assets-api';
import { CSAssetsAdapter } from '../utils/cs-assets-api-adapter';
import { CS_ASSETS_MAIN_PROCESS_NAME, FALLBACK_AM_API_CONCURRENCY } from '../constants/index';

export type { ImportContext };

/**
 * Base class for all CS Assets import modules. Mirrors CSAssetsExportAdapter
 * but carries ImportContext (spacesRootPath, apiKey, host, etc.) instead of ExportContext.
 */
export class CSAssetsImportAdapter extends CSAssetsAdapter {
  protected readonly apiConfig: CSAssetsAPIConfig;
  protected readonly importContext: ImportContext;
  protected progressManager: CLIProgressManager | null = null;
  protected parentProgressManager: CLIProgressManager | null = null;
  protected processName: string = CS_ASSETS_MAIN_PROCESS_NAME;

  constructor(apiConfig: CSAssetsAPIConfig, importContext: ImportContext) {
    super(apiConfig);
    this.apiConfig = apiConfig;
    this.importContext = importContext;
  }

  public setParentProgressManager(parent: CLIProgressManager): void {
    this.parentProgressManager = parent;
  }

  /**
   * Override the default progress process name for {@link tick}/{@link updateStatus}
   * calls. Used by the per-space orchestrator so each module's ticks land on the
   * row for the space currently being imported.
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
    return this.importContext.spacesRootPath;
  }

  /** Parallel CS Assets API limit for import batches. */
  protected get apiConcurrency(): number {
    return this.importContext.apiConcurrency ?? FALLBACK_AM_API_CONCURRENCY;
  }

  /** Upload batch size; falls back to {@link apiConcurrency}. */
  protected get uploadAssetsBatchConcurrency(): number {
    return this.importContext.uploadAssetsConcurrency ?? this.apiConcurrency;
  }

  /** Folder creation batch size; falls back to {@link apiConcurrency}. */
  protected get importFoldersBatchConcurrency(): number {
    return this.importContext.importFoldersConcurrency ?? this.apiConcurrency;
  }

  protected getAssetTypesDir(): string {
    return pResolve(this.importContext.spacesRootPath, this.importContext.assetTypesDir ?? 'asset_types');
  }

  protected getFieldsDir(): string {
    return pResolve(this.importContext.spacesRootPath, this.importContext.fieldsDir ?? 'fields');
  }
}
