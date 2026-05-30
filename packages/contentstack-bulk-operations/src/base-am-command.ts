import { Command } from '@contentstack/cli-command';
import { handleAndLogError } from '@contentstack/cli-utilities';

import { fillMissingAmFlags } from './utils';
import type { AmAssetFlags } from './interfaces';

/**
 * Thin base command for Asset Management operations.
 * Handles flag prompting in init() and exposes typed parsedFlags / loggerContext.
 * Deliberately does NOT inherit BaseBulkCommand — AM operations use a different API
 * surface with no stack setup, queue managers, or rate limiters.
 */
export abstract class BaseAmCommand extends Command {
  protected parsedFlags!: AmAssetFlags;
  protected loggerContext!: { module: string };

  protected async init(): Promise<void> {
    await super.init();
    const { flags } = await this.parse(this.constructor as typeof BaseAmCommand);
    this.loggerContext = { module: this.id ?? 'cm:stacks:bulk-am-assets' };
    this.parsedFlags = (await fillMissingAmFlags(flags)) as AmAssetFlags;
  }

  async catch(error: Error): Promise<void> {
    handleAndLogError(error);
  }

  abstract run(): Promise<void>;
}
