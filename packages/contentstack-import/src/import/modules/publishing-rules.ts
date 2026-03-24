import chalk from 'chalk';
import values from 'lodash/values';
import isEmpty from 'lodash/isEmpty';
import { join } from 'node:path';

import BaseClass, { ApiOptions } from './base-class';
import { PUBLISHING_RULES_APPROVERS_SKIP_MSG } from '../../config';
import { fsUtil, fileHelper, parseErrorPayload, isDuplicatePublishingRuleError } from '../../utils';
import { log, handleAndLogError } from '@contentstack/cli-utilities';
import { ModuleClassParams, PublishingRulesConfig } from '../../types';

export default class ImportPublishingRules extends BaseClass {
  private readonly mapperDirPath: string;
  private readonly publishingRulesFolderPath: string;
  private readonly publishingRulesUidMapperPath: string;
  private readonly createdPublishingRulesPath: string;
  private readonly failedPublishingRulesPath: string;
  private readonly publishingRulesConfig: PublishingRulesConfig;
  private publishingRules: Record<string, unknown>;
  private publishingRulesUidMapper: Record<string, unknown>;
  private readonly createdPublishingRules: Record<string, unknown>[];
  private readonly failedPublishingRules: Record<string, unknown>[];
  private envUidMapper: Record<string, unknown>;
  private workflowUidMapper: Record<string, unknown>;
  private readonly stageUidMapper: Record<string, string> = {};

  constructor({ importConfig, stackAPIClient }: ModuleClassParams) {
    super({ importConfig, stackAPIClient });
    this.importConfig.context.module = 'publishing-rules';
    this.publishingRulesConfig = importConfig.modules['publishing-rules'];
    this.mapperDirPath = join(this.importConfig.backupDir, 'mapper', 'publishing-rules');
    this.publishingRulesFolderPath = join(this.importConfig.backupDir, this.publishingRulesConfig.dirName);
    this.publishingRulesUidMapperPath = join(this.mapperDirPath, 'uid-mapping.json');
    this.createdPublishingRulesPath = join(this.mapperDirPath, 'success.json');
    this.failedPublishingRulesPath = join(this.mapperDirPath, 'fails.json');
    this.publishingRules = {};
    this.publishingRulesUidMapper = {};
    this.createdPublishingRules = [];
    this.failedPublishingRules = [];
    this.envUidMapper = {};
    this.workflowUidMapper = {};
  }

  private static collectOldStageUidToName(
    exportedWorkflows: Record<string, { workflow_stages?: { uid?: string; name?: string }[] }>,
  ): Record<string, string> {
    const map: Record<string, string> = {};
    for (const workflow of Object.values(exportedWorkflows)) {
      for (const stage of workflow.workflow_stages ?? []) {
        if (stage.uid && stage.name) {
          map[stage.uid] = stage.name;
        }
      }
    }
    return map;
  }

  /**
   * Returns `{ noSuccessMsg: true }` if any rule failed, so the import command skips the generic stack success line.
   */
  async start(): Promise<{ noSuccessMsg: true } | void> {
    const rulesFilePath = join(this.publishingRulesFolderPath, this.publishingRulesConfig.fileName);

    if (!fileHelper.fileExistsSync(rulesFilePath)) {
      log.info(`No Publishing Rules found - '${rulesFilePath}'`, this.importConfig.context);
      return;
    }

    this.publishingRules = (fsUtil.readFile(rulesFilePath, true) as Record<string, unknown>) ?? {};
    if (isEmpty(this.publishingRules)) {
      log.info('No Publishing Rules found', this.importConfig.context);
      return;
    }

    await fsUtil.makeDirectory(this.mapperDirPath);

    this.publishingRulesUidMapper = this.readUidMappingFile(this.publishingRulesUidMapperPath);
    this.envUidMapper = this.readMapper('environments');
    this.workflowUidMapper = this.readMapper('workflows');

    await this.buildStageUidMapper();
    await this.importPublishingRules();

    if (this.createdPublishingRules?.length) {
      fsUtil.writeFile(this.createdPublishingRulesPath, this.createdPublishingRules);
    }
    if (this.failedPublishingRules?.length) {
      fsUtil.writeFile(this.failedPublishingRulesPath, this.failedPublishingRules);
    }

    const successCount = this.createdPublishingRules.length;
    const failCount = this.failedPublishingRules.length;

    if (failCount > 0 && successCount === 0) {
      log.error(
        `Publishing rules import failed! ${failCount} rule(s) could not be imported. Check '${this.failedPublishingRulesPath}' for details.`,
        this.importConfig.context,
      );
    } else if (failCount > 0) {
      log.warn(
        `Publishing rules import completed with errors. Imported: ${successCount}, Failed: ${failCount}. Check '${this.failedPublishingRulesPath}' for details.`,
        this.importConfig.context,
      );
    } else {
      log.success('Publishing rules have been imported successfully!', this.importConfig.context);
    }

    if (failCount > 0) {
      return { noSuccessMsg: true };
    }
  }

  private readUidMappingFile(path: string): Record<string, unknown> {
    return fileHelper.fileExistsSync(path) ? (fsUtil.readFile(path, true) as Record<string, unknown>) ?? {} : {};
  }

  private readMapper(moduleDir: string): Record<string, unknown> {
    const p = join(this.importConfig.backupDir, 'mapper', moduleDir, 'uid-mapping.json');
    return this.readUidMappingFile(p);
  }

  private async importPublishingRules(): Promise<void> {
    const apiContent = values(this.publishingRules) as Record<string, unknown>[];
    log.debug(`Importing ${apiContent.length} publishing rule(s)`, this.importConfig.context);

    const onSuccess = ({ response, apiData }: { response: { uid: string }; apiData: { uid: string } }) => {
      const { uid } = apiData;
      this.createdPublishingRules.push(response as unknown as Record<string, unknown>);
      this.publishingRulesUidMapper[uid] = response.uid;
      log.success(`Publishing rule imported successfully (${uid} → ${response.uid})`, this.importConfig.context);
      fsUtil.writeFile(this.publishingRulesUidMapperPath, this.publishingRulesUidMapper);
    };

    const onReject = ({ error, apiData }: { error: unknown; apiData: Record<string, unknown> }) => {
      const uid = apiData.uid as string;
      const parsed = parseErrorPayload(error);

      if (isDuplicatePublishingRuleError(parsed, error)) {
        log.info(`Publishing rule '${uid}' already exists`, this.importConfig.context);
        return;
      }

      this.failedPublishingRules.push(apiData);
      handleAndLogError(
        error as Error,
        { ...this.importConfig.context, publishingRuleUid: uid },
        `Publishing rule '${uid}' failed to import`,
      );
    };

    await this.makeConcurrentCall(
      {
        apiContent,
        processName: 'import publishing rules',
        apiParams: {
          serializeData: this.serializePublishingRules.bind(this),
          reject: onReject,
          resolve: onSuccess,
          entity: 'create-publishing-rule',
          includeParamOnCompletion: true,
        },
        concurrencyLimit: this.importConfig.fetchConcurrency || 1,
      },
      undefined,
      false,
    );
  }

  private mergeFetchedWorkflowStages(
    workflow: { workflow_stages?: { uid?: string; name?: string }[] },
    oldStageUidToName: Record<string, string>,
  ): void {
    for (const newStage of workflow.workflow_stages ?? []) {
      const oldUid = Object.keys(oldStageUidToName).find((u) => oldStageUidToName[u] === newStage.name);
      if (oldUid && newStage.uid) {
        this.stageUidMapper[oldUid] = newStage.uid;
      }
    }
  }

  private async buildStageUidMapper(): Promise<void> {
    const wf = this.importConfig.modules.workflows as { dirName: string; fileName: string };
    const workflowsFilePath = join(this.importConfig.backupDir, wf.dirName, wf.fileName);

    if (!fileHelper.fileExistsSync(workflowsFilePath)) {
      log.debug('No exported workflows file; stage UID mapping skipped', this.importConfig.context);
      return;
    }

    const exportedWorkflows = fsUtil.readFile(workflowsFilePath, true) as Record<
      string,
      { workflow_stages?: { uid?: string; name?: string }[] }
    > | null;
    if (!exportedWorkflows) return;

    const oldStageUidToName = ImportPublishingRules.collectOldStageUidToName(exportedWorkflows);

    for (const newWorkflowUid of Object.values(this.workflowUidMapper)) {
      try {
        const workflow = await this.stack.workflow(newWorkflowUid as string).fetch();
        this.mergeFetchedWorkflowStages(
          workflow as { workflow_stages?: { uid?: string; name?: string }[] },
          oldStageUidToName,
        );
      } catch (error: unknown) {
        log.debug(`Stage mapping: could not fetch workflow '${newWorkflowUid}'`, this.importConfig.context);
        handleAndLogError(error as Error, { ...this.importConfig.context });
      }
    }

    log.debug(`Stage UID mapper: ${Object.keys(this.stageUidMapper).length} entr(y/ies)`, this.importConfig.context);
  }

  private stripApprovers(rule: Record<string, unknown>): void {
    if (rule.approvers == null) return;

    const a = rule.approvers as { roles?: unknown[]; users?: unknown[] };
    const hadContent = (Array.isArray(a.roles) && a.roles.length > 0) || (Array.isArray(a.users) && a.users.length > 0);
    if (hadContent) {
      log.info(chalk.yellow(PUBLISHING_RULES_APPROVERS_SKIP_MSG), this.importConfig.context);
    }
    rule.approvers = { roles: [], users: [] };
  }

  private remapReference(
    rule: Record<string, unknown>,
    field: 'workflow' | 'environment',
    mapper: Record<string, unknown>,
  ): void {
    const current = rule[field] as string | undefined;
    if (!current) return;
    const mapped = mapper[current] as string | undefined;
    if (mapped) {
      rule[field] = mapped;
      log.debug(`${field} UID remapped`, this.importConfig.context);
    } else {
      log.debug(`No ${field} mapping for ${current}; leaving as-is`, this.importConfig.context);
    }
  }

  serializePublishingRules(apiOptions: ApiOptions): ApiOptions {
    const rule = apiOptions.apiData as Record<string, unknown>;
    const ruleUid = rule.uid as string;

    if (ruleUid in this.publishingRulesUidMapper) {
      log.info(
        `Publishing rule '${ruleUid}' already exists. Skipping it to avoid duplicates!`,
        this.importConfig.context,
      );
      apiOptions.entity = undefined;
      return apiOptions;
    }

    const oldUid = ruleUid;
    delete rule.uid;

    this.stripApprovers(rule);
    this.remapReference(rule, 'workflow', this.workflowUidMapper);
    this.remapReference(rule, 'environment', this.envUidMapper);

    if (rule.workflow_stage) {
      const stage = rule.workflow_stage as string;
      const mappedStage = this.stageUidMapper[stage];
      if (mappedStage) {
        rule.workflow_stage = mappedStage;
        log.debug('workflow_stage UID remapped', this.importConfig.context);
      } else {
        log.debug(`No workflow_stage mapping for ${stage}; leaving as-is`, this.importConfig.context);
      }
    }

    apiOptions.apiData = { ...rule, uid: oldUid };
    return apiOptions;
  }
}
