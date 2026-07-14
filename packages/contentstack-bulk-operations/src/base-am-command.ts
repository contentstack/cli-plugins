import { Command } from '@contentstack/cli-command';
import {
  handleAndLogError,
  configHandler,
  loadChalk,
  CLIProgressManager,
  clearProgressModuleSetting,
} from '@contentstack/cli-utilities';

import { fillMissingCsAssetsFlags } from './utils';
import type { CsAssetsFlags } from './interfaces';

/**
 * Thin base command for CS Assets operations.
 * Handles flag prompting in init() and exposes typed parsedFlags / loggerContext.
 * Deliberately does NOT inherit BaseBulkCommand — CS Assets operations use a different API
 * surface with no stack setup, queue managers, or rate limiters.
 */
export abstract class BaseCsAssetsCommand extends Command {
  protected parsedFlags!: CsAssetsFlags;
  protected loggerContext!: { module: string };

  protected async init(): Promise<void> {
    await super.init();

    // Suppress timestamped console logs + load chalk (same UX as the other bulk commands).
    // Must run before the first log call. CS Assets keeps its own printCsAssetsSummary output.
    configHandler.set('log.progressSupportedModule', 'bulk-operations');
    await loadChalk();

    const { flags } = await this.parse(this.constructor as typeof BaseCsAssetsCommand);
    this.loggerContext = { module: this.id ?? 'cm:stacks:bulk-am-assets' };
    this.parsedFlags = (await fillMissingCsAssetsFlags(flags)) as CsAssetsFlags;
  }

  async catch(error: Error): Promise<void> {
    handleAndLogError(error);
  }

  protected async finally(_error?: Error): Promise<void> {
    // Clear progress state so the module flag never leaks into a later command in the process.
    // (CS Assets doesn't initialize a global summary, so printGlobalSummary is a no-op here.)
    CLIProgressManager.printGlobalSummary();
    CLIProgressManager.clearGlobalSummary();
    clearProgressModuleSetting();
  }

  abstract run(): Promise<void>;
}
