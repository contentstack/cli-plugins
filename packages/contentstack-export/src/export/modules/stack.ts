import find from 'lodash/find';
import omit from 'lodash/omit';
import { resolve as pResolve } from 'node:path';
import { handleAndLogError, isAuthenticated, managementSDKClient, log } from '@contentstack/cli-utilities';
import { PATH_CONSTANTS } from '../../constants';

import BaseClass from './base-class';
import {
  fsUtil,
  getExportBasePath,
  PROCESS_NAMES,
  MODULE_CONTEXTS,
  PROCESS_STATUS,
  MODULE_NAMES,
  getLinkedWorkspacesForBranch,
} from '../../utils';
import { StackConfig, ModuleClassParams } from '../../types';

export default class ExportStack extends BaseClass {
  private stackConfig: StackConfig;
  private stackFolderPath: string;
  private qs: {
    include_count: boolean;
    skip?: number;
  };

  constructor({ exportConfig, stackAPIClient }: ModuleClassParams) {
    super({ exportConfig, stackAPIClient });
    this.stackConfig = exportConfig.modules.stack;
    this.qs = { include_count: true };
    this.stackFolderPath = pResolve(
      getExportBasePath(this.exportConfig),
      this.stackConfig.dirName,
    );
    this.exportConfig.context.module = MODULE_CONTEXTS.STACK;
    this.currentModuleName = MODULE_NAMES[MODULE_CONTEXTS.STACK];
  }

  async start(): Promise<void> {
    try {
      log.debug('Starting stack export process...', this.exportConfig.context);

      // Initial analysis with loading spinner (skip getStack when using management token — no SDK snapshot)
      const [stackData] = await this.withLoadingSpinner('STACK: Analyzing stack configuration...', async () => {
        const stackData = this.exportConfig.management_token || !isAuthenticated() ? null : await this.getStack();
        return [stackData];
      });

      // Create nested progress manager
      const progress = this.createNestedProgress(this.currentModuleName);

      const orgUid = stackData?.org_uid ?? stackData?.organization_uid;
      if (orgUid) {
        log.debug(`Found organization UID: '${orgUid}'.`, this.exportConfig.context);
        this.exportConfig.org_uid = orgUid;
        this.exportConfig.sourceStackName = stackData.name;
        log.debug(`Set source stack name: ${stackData.name}`, this.exportConfig.context);
      }

      if (!this.exportConfig.management_token) {
        progress.addProcess(PROCESS_NAMES.STACK_SETTINGS, 1);
      }
      progress.addProcess(PROCESS_NAMES.STACK_DETAILS, 1);

      if (!this.exportConfig.preserveStackVersion && !this.exportConfig.hasOwnProperty('master_locale')) {
        progress.addProcess(PROCESS_NAMES.STACK_LOCALE, 1);
      }

      let stackDetailsExportResult: any;

      // Execute processes
      if (!this.exportConfig.management_token) {
        progress
          .startProcess(PROCESS_NAMES.STACK_SETTINGS)
          .updateStatus(PROCESS_STATUS[PROCESS_NAMES.STACK_SETTINGS].EXPORTING, PROCESS_NAMES.STACK_SETTINGS);
        await this.exportStackSettings();
        progress.completeProcess(PROCESS_NAMES.STACK_SETTINGS, true);

        progress
          .startProcess(PROCESS_NAMES.STACK_DETAILS)
          .updateStatus(PROCESS_STATUS[PROCESS_NAMES.STACK_DETAILS].EXPORTING, PROCESS_NAMES.STACK_DETAILS);
        stackDetailsExportResult = await this.exportStack(stackData);
        progress.completeProcess(PROCESS_NAMES.STACK_DETAILS, true);
      } else {
        log.info(
          'Skipping stack settings export: Operation is not supported when using a management token.',
          this.exportConfig.context,
        );
        progress
          .startProcess(PROCESS_NAMES.STACK_DETAILS)
          .updateStatus(PROCESS_STATUS[PROCESS_NAMES.STACK_DETAILS].EXPORTING, PROCESS_NAMES.STACK_DETAILS);
        stackDetailsExportResult = await this.writeStackJsonFromConfigApiKeyOnly();
        progress.completeProcess(PROCESS_NAMES.STACK_DETAILS, true);
      }

      if (!this.exportConfig.preserveStackVersion && !this.exportConfig.hasOwnProperty('master_locale')) {
        progress
          .startProcess(PROCESS_NAMES.STACK_LOCALE)
          .updateStatus(PROCESS_STATUS[PROCESS_NAMES.STACK_LOCALE].FETCHING, PROCESS_NAMES.STACK_LOCALE);
        const masterLocale = await this.getLocales();
        progress.completeProcess(PROCESS_NAMES.STACK_LOCALE, true);

        if (masterLocale?.code) {
          this.exportConfig.master_locale = { code: masterLocale.code };
          log.debug(`Set master locale: ${masterLocale.code}`, this.exportConfig.context);
        }

        this.completeProgress(true);
        return masterLocale;
      } else if (this.exportConfig.preserveStackVersion) {
        this.completeProgress(true);
        return stackDetailsExportResult;
      } else {
        log.debug('Locale locale already set, skipping locale fetch', this.exportConfig.context);
      }

      this.completeProgressWithMessage();
    } catch (error) {
      log.debug('Error occurred during stack export', this.exportConfig.context);
      handleAndLogError(error, { ...this.exportConfig.context });
      this.completeProgress(false, error?.message || 'Stack export failed');
      throw error;
    }
  }

  async getStack(): Promise<any> {
    log.debug(`Fetching stack data for: '${this.exportConfig.apiKey}'...`, this.exportConfig.context);

    const tempAPIClient = await managementSDKClient({ host: this.exportConfig.host });
    log.debug(`Created Management SDK client with host: '${this.exportConfig.host}'.`, this.exportConfig.context);

    return await tempAPIClient
      .stack({ api_key: this.exportConfig.apiKey })
      .fetch()
      .then((data: any) => {
        log.debug(`Successfully fetched stack data for: '${this.exportConfig.apiKey}'.`, this.exportConfig.context);
        return data;
      })
      .catch((error: any) => {
        log.debug(`Failed to fetch stack data for: '${this.exportConfig.apiKey}'.`, this.exportConfig.context);
        return {};
      });
  }

  async getLocales(skip: number = 0) {
    if (skip) {
      this.qs.skip = skip;
      log.debug(`Fetching locales with skip: ${skip}.`, this.exportConfig.context);
    } else {
      log.debug('Fetching locales with initial query...', this.exportConfig.context);
    }

    log.debug(`Query parameters: ${JSON.stringify(this.qs)}.`, this.exportConfig.context);

    return await this.stack
      .locale()
      .query(this.qs)
      .find()
      .then(async (data: any) => {
        const { items, count } = data;
        log.debug(`Fetched ${items?.length || 0} locales out of ${count}.`, this.exportConfig.context);

        if (items?.length) {
          log.debug(`Processing ${items.length} locales to find master locale`, this.exportConfig.context);

          // Track progress for each locale processed
          this.progressManager?.tick(true, 'Fetch locale', null, PROCESS_NAMES.STACK_LOCALE);
          skip += this.stackConfig.limit || 100;
          const masterLocalObj = find(items, (locale: any) => {
            if (locale.fallback_locale === null) {
              log.debug(`Found master locale: '${locale.name}' (code: ${locale.code}).`, this.exportConfig.context);
              return locale;
            }
          });
          if (masterLocalObj) {
            log.debug(`Returning master locale: '${masterLocalObj.name}'.`, this.exportConfig.context);
            return masterLocalObj;
          } else if (skip >= count) {
            log.error(
              `Locale locale not found in the stack ${this.exportConfig.apiKey}. Please ensure that the stack has a master locale.`,
              this.exportConfig.context,
            );
            log.debug('Completed search. Master locale not found.', this.exportConfig.context);
            return;
          } else {
            log.debug(
              `Locale locale not found in current batch, continuing with skip: ${skip}`,
              this.exportConfig.context,
            );
            return await this.getLocales(skip);
          }
        } else {
          log.debug('No locales found to process.', this.exportConfig.context);
        }
      })
      .catch((error: any) => {
        log.debug(
          `Error occurred while fetching locales for stack: ${this.exportConfig.apiKey}`,
          this.exportConfig.context,
        );
        this.progressManager?.tick(
          false,
          'locale fetch',
          error?.message || PROCESS_STATUS[PROCESS_NAMES.STACK_LOCALE].FAILED,
          PROCESS_NAMES.STACK_LOCALE,
        );
        handleAndLogError(
          error,
          { ...this.exportConfig.context },
          `Failed to fetch locales for stack ${this.exportConfig.apiKey}`,
        );
        throw error;
      });
  }

  /**
   * Reuse stack snapshot from `getStack()` when present so we do not call `stack.fetch()` twice
   * (same GET /stacks payload as writing stack.json). Falls back to `this.stack.fetch()` otherwise.
   */
  async exportStack(preloadedStack?: Record<string, any> | null): Promise<any> {
    log.debug(`Starting stack export for: '${this.exportConfig.apiKey}'...`, this.exportConfig.context);

    await fsUtil.makeDirectory(this.stackFolderPath);
    log.debug(`Created stack directory at: '${this.stackFolderPath}'`, this.exportConfig.context);

    if (this.isStackFetchPayload(preloadedStack)) {
      log.debug('Reusing stack payload from analysis step (no extra stack.fetch).', this.exportConfig.context);
      try {
        return this.persistStackJsonPayload(preloadedStack);
      } catch (error: any) {
        this.progressManager?.tick(
          false,
          'stack export',
          error?.message || PROCESS_STATUS[PROCESS_NAMES.STACK_DETAILS].FAILED,
          PROCESS_NAMES.STACK_DETAILS,
        );
        handleAndLogError(error, { ...this.exportConfig.context });
        return undefined;
      }
    }

    return this.stack
      .fetch()
      .then((resp: any) => {
        return this.persistStackJsonPayload(resp);
      })
      .catch((error: any) => {
        log.debug(`Error occurred while exporting stack: ${this.exportConfig.apiKey}`, this.exportConfig.context);
        this.progressManager?.tick(
          false,
          'stack export',
          error?.message || PROCESS_STATUS[PROCESS_NAMES.STACK_DETAILS].FAILED,
          PROCESS_NAMES.STACK_DETAILS,
        );
        handleAndLogError(error, { ...this.exportConfig.context });
      });
  }

  private isStackFetchPayload(data: unknown): data is Record<string, any> {
    return typeof data === 'object' && data !== null && !Array.isArray(data) && ('api_key' in data || 'uid' in data);
  }

  /**
   * Management-token exports cannot use Stack CMA endpoints for full metadata; write api_key from config only.
   */
  private async writeStackJsonFromConfigApiKeyOnly(): Promise<{ api_key: string }> {
    if (!this.exportConfig.apiKey || typeof this.exportConfig.apiKey !== 'string') {
      throw new Error('Stack API key is required to write stack.json when using a management token.');
    }

    log.debug('Writing config-based stack.json (api_key only, no stack fetch).', this.exportConfig.context);

    await fsUtil.makeDirectory(this.stackFolderPath);
    const payload = { api_key: this.exportConfig.apiKey };
    const stackFilePath = pResolve(this.stackFolderPath, this.stackConfig.fileName);
    fsUtil.writeFile(stackFilePath, payload);

    this.progressManager?.tick(true, `stack: ${this.exportConfig.apiKey}`, null, PROCESS_NAMES.STACK_DETAILS);

    log.success(
      `Stack identifier written to stack.json from config for stack ${this.exportConfig.apiKey}`,
      this.exportConfig.context,
    );
    return payload;
  }

  private persistStackJsonPayload(resp: Record<string, any>): any {
    const sanitized = omit(resp, this.stackConfig.invalidKeys ?? []);
    const stackFilePath = pResolve(this.stackFolderPath, this.stackConfig.fileName);
    log.debug(`Writing stack data to: '${stackFilePath}'`, this.exportConfig.context);
    fsUtil.writeFile(stackFilePath, sanitized);

    this.progressManager?.tick(true, `stack: ${this.exportConfig.apiKey}`, null, PROCESS_NAMES.STACK_DETAILS);

    log.success(`Stack details exported successfully for stack ${this.exportConfig.apiKey}`, this.exportConfig.context);
    log.debug('Stack export completed successfully.', this.exportConfig.context);
    return sanitized;
  }

  async exportStackSettings(): Promise<any> {
    log.info('Exporting stack settings...', this.exportConfig.context);
    await fsUtil.makeDirectory(this.stackFolderPath);
    return this.stack
      .settings()
      .then(async (resp: any) => {
        const linked = await getLinkedWorkspacesForBranch(
          this.stack,
          this.exportConfig.branchName || 'main',
          this.exportConfig.context as unknown as Record<string, unknown>,
        );
        const settings = {
          ...resp,
          am_v2: { ...(resp.am_v2 ?? {}), linked_workspaces: linked },
        };
        fsUtil.writeFile(pResolve(this.stackFolderPath, PATH_CONSTANTS.FILES.SETTINGS), settings);

        this.exportConfig.linkedWorkspaces = linked;

        // Track progress for stack settings completion
        this.progressManager?.tick(true, 'stack settings', null, PROCESS_NAMES.STACK_SETTINGS);

        log.debug(`Included ${linked.length} linked workspace(s) in settings`, this.exportConfig.context);
        log.success('Exported stack settings successfully!', this.exportConfig.context);
        return settings;
      })
      .catch((error: any) => {
        this.progressManager?.tick(
          false,
          'stack settings',
          error?.message || PROCESS_STATUS[PROCESS_NAMES.STACK_SETTINGS].FAILED,
          PROCESS_NAMES.STACK_SETTINGS,
        );
        handleAndLogError(error, { ...this.exportConfig.context });
      });
  }
}
