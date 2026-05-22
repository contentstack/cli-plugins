import type { CLIProgressManager } from '@contentstack/cli-utilities';

import type { AssetMapperImportSetupResult, RunAssetMapperImportSetupParams } from '../types/import-setup-asset-mapper';

/**
 * Base for CLI import-setup flows that prepare AM exports (mappers, metadata) before full import.
 * Mirrors ImportSpaces-style `setParentProgressManager`; callers log via `@contentstack/cli-utilities` `log` + `params.context`.
 */
export abstract class AssetManagementImportSetupAdapter {
  private parentProgressManager: CLIProgressManager | null = null;

  protected constructor(protected readonly params: RunAssetMapperImportSetupParams) {}

  public setParentProgressManager(parent: CLIProgressManager): void {
    this.parentProgressManager = parent;
  }

  protected resolveParentProgress(): CLIProgressManager | null {
    return this.parentProgressManager;
  }

  abstract start(): Promise<AssetMapperImportSetupResult>;
}
