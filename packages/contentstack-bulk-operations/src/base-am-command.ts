import { Command } from '@contentstack/cli-command';
import { handleAndLogError } from '@contentstack/cli-utilities';

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
    const { flags } = await this.parse(this.constructor as typeof BaseCsAssetsCommand);
    this.loggerContext = { module: this.id ?? 'cm:stacks:bulk-am-assets' };
    this.parsedFlags = (await fillMissingCsAssetsFlags(flags)) as CsAssetsFlags;
  }

  async catch(error: Error): Promise<void> {
    handleAndLogError(error);
  }

  abstract run(): Promise<void>;
}
