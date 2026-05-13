import { expect } from 'chai';
import sinon from 'sinon';
import { join } from 'node:path';
import ImportPublishingRules from '../../../../src/import/modules/publishing-rules';
import { ImportConfig } from '../../../../src/types';
describe('ImportPublishingRules', () => {
  const BACKUP = '/test/backup';
  const rulesFile = join(BACKUP, 'workflows', 'publishing-rules.json');
  const workflowsExportFile = join(BACKUP, 'workflows', 'workflows.json');
  const workflowMapperFile = join(BACKUP, 'mapper', 'workflows', 'uid-mapping.json');
  const envMapperFile = join(BACKUP, 'mapper', 'environments', 'uid-mapping.json');
  const publishingMapperFile = join(BACKUP, 'mapper', 'publishing-rules', 'uid-mapping.json');

  let importPublishingRules: ImportPublishingRules;
  let mockStackClient: any;
  let mockImportConfig: ImportConfig;
  let fsUtilStub: any;
  let fileHelperStub: any;
  let makeConcurrentCallStub: sinon.SinonStub;
  let logStub: { info: sinon.SinonStub; debug: sinon.SinonStub; success: sinon.SinonStub; error: sinon.SinonStub; warn: sinon.SinonStub };
  beforeEach(() => {
    fsUtilStub = {
      readFile: sinon.stub(),
      writeFile: sinon.stub(),
      makeDirectory: sinon.stub().resolves(),
    };

    fileHelperStub = {
      fileExistsSync: sinon.stub(),
    };

    sinon.replace(require('../../../../src/utils'), 'fileHelper', fileHelperStub);
    sinon.replaceGetter(require('../../../../src/utils'), 'fsUtil', () => fsUtilStub);

    const fetchWorkflowStub = sinon.stub().resolves({
      workflow_stages: [{ uid: 'stage-new', name: 'Review' }],
    });
    mockStackClient = {
      workflow: sinon.stub().returns({
        fetch: fetchWorkflowStub,
      }),
    };

    mockImportConfig = {
      apiKey: 'test',
      backupDir: BACKUP,
      data: '/test/content',
      contentVersion: 1,
      region: 'us',
      fetchConcurrency: 2,
      context: {
        command: 'cm:stacks:import',
        module: 'publishing-rules',
        userId: 'user-123',
        email: 'test@example.com',
        sessionId: 'session-123',
        apiKey: 'test',
        orgId: 'org-123',
        authenticationMethod: 'Basic Auth',
      },
      modules: {
        workflows: {
          dirName: 'workflows',
          fileName: 'workflows.json',
          invalidKeys: ['uid'],
        },
        'publishing-rules': {
          dirName: 'workflows',
          fileName: 'publishing-rules.json',
          invalidKeys: ['uid'],
        },
      },
    } as any;

    importPublishingRules = new ImportPublishingRules({
      importConfig: mockImportConfig as any,
      stackAPIClient: mockStackClient,
      moduleName: 'publishing-rules',
    });

    makeConcurrentCallStub = sinon.stub(importPublishingRules as any, 'makeConcurrentCall').resolves();

    const cliUtilities = require('@contentstack/cli-utilities');
    logStub = {
      info: sinon.stub(),
      debug: sinon.stub(),
      success: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
    };
    sinon.stub(cliUtilities, 'log').value(logStub);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Constructor', () => {
    it('sets context.module to publishing-rules and derives exact paths from backupDir and config', () => {
      expect(mockImportConfig.context.module).to.equal('publishing-rules');
      expect(importPublishingRules['mapperDirPath']).to.equal(join(BACKUP, 'mapper', 'publishing-rules'));
      expect(importPublishingRules['publishingRulesFolderPath']).to.equal(join(BACKUP, 'workflows'));
      expect(importPublishingRules['publishingRulesUidMapperPath']).to.equal(publishingMapperFile);
      expect(importPublishingRules['createdPublishingRulesPath']).to.equal(
        join(BACKUP, 'mapper', 'publishing-rules', 'success.json'),
      );
      expect(importPublishingRules['failedPublishingRulesPath']).to.equal(
        join(BACKUP, 'mapper', 'publishing-rules', 'fails.json'),
      );
    });

    it('initializes empty rules, mappers, and result arrays', () => {
      expect(importPublishingRules['publishingRules']).to.deep.equal({});
      expect(importPublishingRules['publishingRulesUidMapper']).to.deep.equal({});
      expect(importPublishingRules['createdPublishingRules']).to.deep.equal([]);
      expect(importPublishingRules['failedPublishingRules']).to.deep.equal([]);
      expect(importPublishingRules['envUidMapper']).to.deep.equal({});
      expect(importPublishingRules['workflowUidMapper']).to.deep.equal({});
      expect(importPublishingRules['stageUidMapper']).to.deep.equal({});
    });
  });

  describe('start()', () => {
    it('returns undefined and logs missing file path when rules file does not exist', async () => {
      fileHelperStub.fileExistsSync.withArgs(rulesFile).returns(false);

      const result = await importPublishingRules.start();

      expect(result).to.equal(undefined);
      expect(makeConcurrentCallStub.called).to.be.false;
      expect(logStub.info.firstCall.args[0]).to.include(rulesFile);
    });

    it('returns undefined when rules file exists but payload is empty; arrays stay empty', async () => {
      fileHelperStub.fileExistsSync.withArgs(rulesFile).returns(true);
      fsUtilStub.readFile.withArgs(rulesFile, true).returns({});

      const result = await importPublishingRules.start();

      expect(result).to.equal(undefined);
      expect(makeConcurrentCallStub.called).to.be.false;
      expect(importPublishingRules['createdPublishingRules']).to.deep.equal([]);
      expect(importPublishingRules['failedPublishingRules']).to.deep.equal([]);
    });

    it('passes one apiContent item per rule and binds serializeData to serializePublishingRules', async () => {
      const rules = {
        r1: { uid: 'r1', name: 'Rule 1' },
        r2: { uid: 'r2', name: 'Rule 2' },
      };
      fileHelperStub.fileExistsSync.callsFake((p: string) => {
        if (p === rulesFile) return true;
        if (p === workflowsExportFile || p === workflowMapperFile || p === envMapperFile || p === publishingMapperFile) {
          return false;
        }
        return false;
      });
      fsUtilStub.readFile.callsFake((p: string) => {
        if (p === rulesFile) return rules;
        return {};
      });

      await importPublishingRules.start();

      expect(makeConcurrentCallStub.calledOnce).to.be.true;
      const callArgs = makeConcurrentCallStub.firstCall.args[0];
      expect(callArgs.apiContent).to.have.length(2);
      expect(callArgs.processName).to.equal('import publishing rules');
      expect(callArgs.apiParams.entity).to.equal('create-publishing-rule');
      const serialized = callArgs.apiParams.serializeData({
        apiData: { uid: 'r1', name: 'Rule 1' },
        entity: 'create-publishing-rule',
      });
      expect(serialized.apiData).to.deep.include({ name: 'Rule 1', uid: 'r1' });
      expect(serialized.entity).to.equal('create-publishing-rule');
    });

    it('builds stageUidMapper from exported workflows and fetched target workflow stages by name', async () => {
      fileHelperStub.fileExistsSync.callsFake((p: string) => {
        if (p === rulesFile) return true;
        if (p === workflowsExportFile) return true;
        if (p === workflowMapperFile) return true;
        if (p === envMapperFile || p === publishingMapperFile) return false;
        return false;
      });
      fsUtilStub.readFile.callsFake((p: string) => {
        if (p === rulesFile) return { r1: { uid: 'r1', name: 'R' } };
        if (p === workflowsExportFile) {
          return {
            expWf: { workflow_stages: [{ uid: 'stage-old', name: 'Review' }] },
          };
        }
        if (p === workflowMapperFile) return { oldWf: 'newWf' };
        return {};
      });

      await importPublishingRules.start();

      expect(importPublishingRules['stageUidMapper']).to.deep.equal({ 'stage-old': 'stage-new' });
      expect(mockStackClient.workflow.calledWith('newWf')).to.be.true;
    });

    it('returns { noSuccessMsg: true } when a rule fails to import (non-duplicate error)', async () => {
      fileHelperStub.fileExistsSync.callsFake((p: string) => p === rulesFile);
      fsUtilStub.readFile.callsFake((p: string) => (p === rulesFile ? { r1: { uid: 'r1', name: 'R' } } : {}));

      makeConcurrentCallStub.callsFake(async (env: any) => {
        const { apiParams, apiContent } = env;
        for (const element of apiContent) {
          apiParams.apiData = element;
          let opts = { ...apiParams, apiData: { ...element } };
          opts = apiParams.serializeData(opts);
          if (opts.entity) {
            await apiParams.reject({ error: new Error('network'), apiData: opts.apiData });
          }
        }
      });

      const result = await importPublishingRules.start();

      expect(result).to.deep.equal({ noSuccessMsg: true });
      expect(importPublishingRules['failedPublishingRules']).to.have.length(1);
      expect(importPublishingRules['failedPublishingRules'][0].uid).to.equal('r1');
      expect(String(logStub.error.firstCall?.args[0] ?? '')).to.include('could not be imported');
    });

    it('returns undefined when import succeeds with no failures', async () => {
      fileHelperStub.fileExistsSync.callsFake((p: string) => p === rulesFile);
      fsUtilStub.readFile.callsFake((p: string) => (p === rulesFile ? { r1: { uid: 'r1', name: 'R' } } : {}));

      makeConcurrentCallStub.callsFake(async (env: any) => {
        const { apiParams, apiContent } = env;
        for (const element of apiContent) {
          apiParams.apiData = element;
          let opts = { ...apiParams, apiData: { ...element } };
          opts = apiParams.serializeData(opts);
          if (opts.entity) {
            await apiParams.resolve({ response: { uid: 'new-r1' }, apiData: opts.apiData });
          }
        }
      });

      const result = await importPublishingRules.start();

      expect(result).to.equal(undefined);
      expect(importPublishingRules['failedPublishingRules']).to.deep.equal([]);
      expect(importPublishingRules['publishingRulesUidMapper']).to.deep.equal({ r1: 'new-r1' });
      expect(logStub.success.calledWith('Publishing rules have been imported successfully!', mockImportConfig.context)).to.be
        .true;
    });
  });

  describe('serializePublishingRules', () => {
    it('clears entity when rule uid already in mapper; leaves apiData.uid unchanged', () => {
      importPublishingRules['publishingRulesUidMapper'] = { 'rule-1': 'mapped-1' };

      const apiOptions: any = {
        apiData: { uid: 'rule-1', name: 'N' },
        entity: 'create-publishing-rule',
      };

      const out = importPublishingRules.serializePublishingRules(apiOptions);

      expect(out.entity).to.equal(undefined);
      expect(out.apiData).to.deep.equal({ uid: 'rule-1', name: 'N' });
      expect(String(logStub.info.firstCall?.args[0] ?? '')).to.match(/already exists\. Skipping/);
    });

    it('remaps workflow, environment, workflow_stage and strips approvers; apiData carries uid for completion handler', () => {
      const pr = importPublishingRules as any;
      pr.workflowUidMapper = { wfOld: 'wfNew' };
      pr.envUidMapper = { envOld: 'envNew' };
      Object.keys(pr.stageUidMapper).forEach((k) => delete pr.stageUidMapper[k]);
      pr.stageUidMapper.stOld = 'stNew';

      const apiOptions: any = {
        apiData: {
          uid: 'pr-1',
          name: 'PR',
          workflow: 'wfOld',
          environment: 'envOld',
          workflow_stage: 'stOld',
          approvers: { roles: ['r1'], users: ['u1'] },
        },
        entity: 'create-publishing-rule',
      };

      const out = importPublishingRules.serializePublishingRules(apiOptions);

      expect(out.entity).to.equal('create-publishing-rule');
      expect(out.apiData).to.deep.equal({
        uid: 'pr-1',
        name: 'PR',
        workflow: 'wfNew',
        environment: 'envNew',
        workflow_stage: 'stNew',
        approvers: { roles: [], users: [] },
      });
      const infoArgs = logStub.info.getCalls().map((c) => c.args[0]);
      expect(infoArgs.some((msg) => String(msg).includes('Skipping import of publish rule approver'))).to.be.true;
    });
  });

  describe('importPublishingRules callbacks', () => {
    beforeEach(() => {
      importPublishingRules['publishingRules'] = { r1: { uid: 'r1', name: 'R' } };
    });

    it('onSuccess updates mapper and persists uid-mapping.json with expected payload', async () => {
      await (importPublishingRules as any).importPublishingRules();

      const onSuccess = makeConcurrentCallStub.firstCall.args[0].apiParams.resolve;
      await onSuccess({ response: { uid: 'created-uid', name: 'R' }, apiData: { uid: 'r1', name: 'R' } });

      expect(importPublishingRules['createdPublishingRules']).to.deep.equal([{ uid: 'created-uid', name: 'R' }]);
      expect(importPublishingRules['publishingRulesUidMapper']).to.deep.equal({ r1: 'created-uid' });
      expect(fsUtilStub.writeFile.calledWith(publishingMapperFile, { r1: 'created-uid' })).to.be.true;
    });

    it('onReject for duplicate error does not append to failedPublishingRules', async () => {
      await (importPublishingRules as any).importPublishingRules();

      const onReject = makeConcurrentCallStub.firstCall.args[0].apiParams.reject;
      await onReject({
        error: { errors: { name: 'taken' } },
        apiData: { uid: 'r1', name: 'R' },
      });

      expect(importPublishingRules['failedPublishingRules']).to.deep.equal([]);
      expect(logStub.info.calledWith(`Publishing rule 'r1' already exists`, mockImportConfig.context)).to.be.true;
    });
  });
});
