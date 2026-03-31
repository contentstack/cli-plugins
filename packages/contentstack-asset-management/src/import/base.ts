import { resolve as pResolve } from 'node:path';
import { CLIProgressManager, configHandler } from '@contentstack/cli-utilities';

import type { AssetManagementAPIConfig, ImportContext } from '../types/asset-management-api';
import { AssetManagementAdapter } from '../utils/asset-management-api-adapter';
import { AM_MAIN_PROCESS_NAME, FALLBACK_AM_API_CONCURRENCY } from '../constants/index';

export type { ImportContext };

/**
 * Base class for all AM 2.0 import modules. Mirrors AssetManagementExportAdapter
 * but carries ImportContext (spacesRootPath, apiKey, host, etc.) instead of ExportContext.
 */
export class AssetManagementImportAdapter extends AssetManagementAdapter {
  protected readonly apiConfig: AssetManagementAPIConfig;
  protected readonly importContext: ImportContext;
  protected progressManager: CLIProgressManager | null = null;
  protected parentProgressManager: CLIProgressManager | null = null;
  protected readonly processName: string = AM_MAIN_PROCESS_NAME;

  constructor(apiConfig: AssetManagementAPIConfig, importContext: ImportContext) {
    super(apiConfig);
    this.apiConfig = apiConfig;
    this.importContext = importContext;
  }

  public setParentProgressManager(parent: CLIProgressManager): void {
    this.parentProgressManager = parent;
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

  /** Parallel AM API limit for import batches. */
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
