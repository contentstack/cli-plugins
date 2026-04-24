import { expect } from 'chai';
import sinon from 'sinon';
import { resolve as pResolve } from 'node:path';
import { FsUtility } from '@contentstack/cli-utilities';
import ExportPublishingRules from '../../../../src/export/modules/publishing-rules';
import ExportConfig from '../../../../src/types/export-config';

describe('ExportPublishingRules', () => {
  let exportPublishingRules: ExportPublishingRules;
  let mockStackClient: any;
  let mockExportConfig: ExportConfig;

  beforeEach(() => {
    mockStackClient = {
      workflow: sinon.stub().returns({
        publishRule: sinon.stub().returns({
          fetchAll: sinon.stub().resolves({ items: [], count: 0 }),
        }),
      }),
    };

    mockExportConfig = {
      contentVersion: 1,
      versioning: false,
      host: 'https://api.contentstack.io',
      developerHubUrls: {},
      apiKey: 'test-api-key',
      exportDir: '/test/export',
      data: '/test/data',
      branchName: '',
      context: {
        command: 'cm:stacks:export',
        module: 'publishing-rules',
        userId: 'user-123',
        email: 'test@example.com',
        sessionId: 'session-123',
        apiKey: 'test-api-key',
        orgId: 'org-123',
        authenticationMethod: 'Basic Auth',
      },
      cliLogsPath: '/test/logs',
      forceStopMarketplaceAppsPrompt: false,
      master_locale: { code: 'en-us' },
      region: {
        name: 'us',
        cma: 'https://api.contentstack.io',
        cda: 'https://cdn.contentstack.io',
        uiHost: 'https://app.contentstack.com',
      },
      skipStackSettings: false,
      skipDependencies: false,
      languagesCode: ['en'],
      apis: {},
      preserveStackVersion: false,
      personalizationEnabled: false,
      fetchConcurrency: 5,
      writeConcurrency: 5,
      developerHubBaseUrl: '',
      marketplaceAppEncryptionKey: '',
      onlyTSModules: [],
      modules: {
        types: ['publishing-rules'],
        'publishing-rules': {
          dirName: 'workflows',
          fileName: 'publishing-rules.json',
          invalidKeys: ['stackHeaders', 'created_at'],
        },
      },
    } as any;

    exportPublishingRules = new ExportPublishingRules({
      exportConfig: mockExportConfig,
      stackAPIClient: mockStackClient,
      moduleName: 'publishing-rules',
    });

    sinon.stub(FsUtility.prototype, 'writeFile').resolves();
    sinon.stub(FsUtility.prototype, 'makeDirectory').resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Constructor', () => {
    it('sets context.module to publishing-rules and reads module config', () => {
      expect(exportPublishingRules).to.be.instanceOf(ExportPublishingRules);
      expect(exportPublishingRules.exportConfig.context.module).to.equal('publishing-rules');
      expect((exportPublishingRules as any).publishingRulesConfig.fileName).to.equal('publishing-rules.json');
      expect((exportPublishingRules as any).publishingRulesConfig.dirName).to.equal('workflows');
    });
  });

  describe('start()', () => {
    it('resolves output path from data, branchName, and publishing-rules dirName', async () => {
      const fetchAll = sinon.stub().resolves({ items: [], count: 0 });
      mockStackClient.workflow.returns({
        publishRule: sinon.stub().returns({ fetchAll }),
      });

      await exportPublishingRules.start();

      const expectedFolder = pResolve(mockExportConfig.data, mockExportConfig.branchName || '', 'workflows');
      expect((FsUtility.prototype.makeDirectory as sinon.SinonStub).calledWith(expectedFolder)).to.be.true;
    });

    it('writes publishing-rules.json with rules omitting invalidKeys when API returns items', async () => {
      const writeFileStub = FsUtility.prototype.writeFile as sinon.SinonStub;
      const items = [
        {
          uid: 'pr-1',
          name: 'Rule 1',
          stackHeaders: { h: 1 },
          created_at: '2020-01-01',
        },
      ];
      mockStackClient.workflow.returns({
        publishRule: sinon.stub().returns({
          fetchAll: sinon.stub().resolves({ items, count: 1 }),
        }),
      });

      await exportPublishingRules.start();

      const expectedPath = pResolve(
        mockExportConfig.data,
        mockExportConfig.branchName || '',
        'workflows',
        'publishing-rules.json',
      );
      expect(writeFileStub.calledOnce).to.be.true;
      expect(writeFileStub.firstCall.args[0]).to.equal(expectedPath);
      const written = writeFileStub.firstCall.args[1] as Record<string, Record<string, unknown>>;
      expect(written['pr-1']).to.deep.equal({ uid: 'pr-1', name: 'Rule 1' });
      expect(written['pr-1'].stackHeaders).to.equal(undefined);
      expect(written['pr-1'].created_at).to.equal(undefined);
    });

    it('does not write the rules file when no rules are returned', async () => {
      const writeFileStub = FsUtility.prototype.writeFile as sinon.SinonStub;
      mockStackClient.workflow.returns({
        publishRule: sinon.stub().returns({
          fetchAll: sinon.stub().resolves({ items: [], count: 0 }),
        }),
      });

      await exportPublishingRules.start();

      expect(writeFileStub.called).to.be.false;
    });

    it('requests the next page when count exceeds items length (pagination)', async () => {
      const fetchAll = sinon.stub();
      fetchAll.onFirstCall().resolves({
        items: [
          { uid: 'a', name: 'A' },
          { uid: 'b', name: 'B' },
        ],
        count: 3,
      });
      fetchAll.onSecondCall().resolves({
        items: [{ uid: 'c', name: 'C' }],
        count: 3,
      });

      mockStackClient.workflow.returns({
        publishRule: sinon.stub().returns({ fetchAll }),
      });

      await exportPublishingRules.start();

      expect(fetchAll.callCount).to.equal(2);
      expect(fetchAll.secondCall.args[0]).to.deep.include({ skip: 2, include_count: true });

      const writeFileStub = FsUtility.prototype.writeFile as sinon.SinonStub;
      const written = writeFileStub.firstCall.args[1] as Record<string, Record<string, unknown>>;
      expect(Object.keys(written).sort((x, y) => x.localeCompare(y))).to.deep.equal(['a', 'b', 'c']);
    });
  });
});
