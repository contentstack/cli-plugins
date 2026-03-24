import omit from 'lodash/omit';
import isEmpty from 'lodash/isEmpty';
import { resolve as pResolve } from 'node:path';
import { handleAndLogError, log } from '@contentstack/cli-utilities';

import BaseClass from './base-class';
import { fsUtil } from '../../utils';
import { PublishingRulesConfig, ModuleClassParams } from '../../types';

export default class ExportPublishingRules extends BaseClass {
  private readonly publishingRules: Record<string, Record<string, unknown>> = {};
  private readonly publishingRulesConfig: PublishingRulesConfig;
  private publishingRulesFolderPath: string;
  private readonly qs: { include_count: boolean; skip?: number };

  constructor({ exportConfig, stackAPIClient }: ModuleClassParams) {
    super({ exportConfig, stackAPIClient });
    this.publishingRulesConfig = exportConfig.modules['publishing-rules'];
    this.qs = { include_count: true };
    this.exportConfig.context.module = 'publishing-rules';
  }

  async start(): Promise<void> {
    this.publishingRulesFolderPath = pResolve(
      this.exportConfig.data,
      this.exportConfig.branchName || '',
      this.publishingRulesConfig.dirName,
    );
    log.debug(`Publishing rules folder path: ${this.publishingRulesFolderPath}`, this.exportConfig.context);

    await fsUtil.makeDirectory(this.publishingRulesFolderPath);
    log.debug('Created publishing rules directory', this.exportConfig.context);

    await this.fetchAllPublishingRules();

    if (isEmpty(this.publishingRules)) {
      log.info('No Publishing Rules found', this.exportConfig.context);
      return;
    }

    const outPath = pResolve(this.publishingRulesFolderPath, this.publishingRulesConfig.fileName);
    fsUtil.writeFile(outPath, this.publishingRules);
    log.success(
      `Publishing rules exported successfully! Total count: ${Object.keys(this.publishingRules).length}`,
      this.exportConfig.context,
    );
  }

  private async fetchAllPublishingRules(skip = 0): Promise<void> {
    try {
      if (skip > 0) {
        this.qs.skip = skip;
      }

      const data: { items?: Record<string, unknown>[]; count?: number } = await this.stack
        .workflow()
        .publishRule()
        .fetchAll(this.qs);

      const items = data.items ?? [];
      const total = data.count ?? items.length;

      if (!items.length) {
        log.debug('No publishing rules returned for this page', this.exportConfig.context);
        return;
      }

      for (const rule of items) {
        const uid = rule.uid as string | undefined;
        if (uid) {
          this.publishingRules[uid] = omit(rule, this.publishingRulesConfig.invalidKeys) as Record<
            string,
            unknown
          >;
        }
      }

      const nextSkip = skip + items.length;
      if (nextSkip < total) {
        await this.fetchAllPublishingRules(nextSkip);
      }
    } catch (error: unknown) {
      handleAndLogError(error as Error, { ...this.exportConfig.context });
    }
  }
}
