import { expect } from 'chai';
import sinon from 'sinon';
import { FsUtility } from '@contentstack/cli-utilities';
import ExportGlobalFields from '../../../../src/export/modules/global-fields';
import ExportConfig from '../../../../src/types/export-config';

describe('ExportGlobalFields', () => {
  let exportGlobalFields: any;
  let mockStackClient: any;
  let mockExportConfig: ExportConfig;

  beforeEach(() => {
    mockStackClient = {
      globalField: sinon.stub().returns({
        query: sinon.stub().returns({
          find: sinon.stub().resolves({
            items: [
              { uid: 'gf-1', title: 'Global Field 1', validKey: 'value1' },
              { uid: 'gf-2', title: 'Global Field 2', validKey: 'value2', invalidKey: 'remove' },
            ],
            count: 2,
          }),
        }),
      }),
    };

    mockExportConfig = {
      versioning: false,
      host: 'https://api.contentstack.io',
      developerHubUrls: {},
      apiKey: 'test-api-key',
      exportDir: '/test/export',
      data: '/test/data',
      branchName: '',
      context: {
        command: 'cm:stacks:export',
        module: 'global-fields',
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
      modules: {
        types: ['global-fields'],
        'global-fields': {
          dirName: 'global_fields',
          fileName: 'globalfields.json',
          validKeys: ['uid', 'title', 'validKey'],
          fetchConcurrency: 5,
          writeConcurrency: 5,
          limit: 100,
        },
      },
    } as any;

    exportGlobalFields = new ExportGlobalFields({
      exportConfig: mockExportConfig,
      stackAPIClient: mockStackClient,
      moduleName: 'global-fields',
    });

    // Stub FsUtility methods
    sinon.stub(FsUtility.prototype, 'writeFile').resolves();
    sinon.stub(FsUtility.prototype, 'makeDirectory').resolves();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Constructor', () => {
    it('should initialize with correct parameters', () => {
      expect(exportGlobalFields).to.be.instanceOf(ExportGlobalFields);
    });

    it('should set context module to global-fields', () => {
      expect(exportGlobalFields.exportConfig.context.module).to.equal('global-fields');
    });

    it('should initialize globalFieldsConfig', () => {
      expect(exportGlobalFields.globalFieldsConfig).to.exist;
      expect(exportGlobalFields.globalFieldsConfig.dirName).to.equal('global_fields');
      expect(exportGlobalFields.globalFieldsConfig.fileName).to.equal('globalfields.json');
    });

    it('should initialize query params', () => {
      expect(exportGlobalFields.qs).to.deep.include({
        include_count: true,
        asc: 'updated_at',
        include_global_field_schema: true,
      });
    });

    it('should initialize global fields dir path', () => {
      expect(exportGlobalFields.globalFieldsDirPath).to.be.a('string');
      expect(exportGlobalFields.globalFieldsDirPath).to.include('global_fields');
    });

    it('should set correct directory path', () => {
      expect(exportGlobalFields.globalFieldsDirPath).to.include('global_fields');
    });
  });

  describe('getGlobalFields() method', () => {
    it('should fetch and process global fields correctly', async () => {
      const globalFields = [
        { uid: 'gf-1', title: 'Field 1', validKey: 'value1', invalidKey: 'remove' },
        { uid: 'gf-2', title: 'Field 2', validKey: 'value2', invalidKey: 'remove' },
      ];

      mockStackClient.globalField.returns({
        query: sinon.stub().returns({
          find: sinon.stub().resolves({
            items: globalFields,
            count: 2,
          }),
        }),
      });

      await exportGlobalFields.getGlobalFields();

      // Verify each global field written to its own per-uid file (not globalfields.json)
      const writeFileStub = FsUtility.prototype.writeFile as sinon.SinonStub;
      expect(writeFileStub.callCount).to.equal(2);
      expect(writeFileStub.calledWith(sinon.match(/gf-1\.json/))).to.be.true;
      expect(writeFileStub.calledWith(sinon.match(/gf-2\.json/))).to.be.true;
      expect(writeFileStub.neverCalledWith(sinon.match(/globalfields\.json/))).to.be.true;
    });

    it('should call getGlobalFields recursively when more fields exist', async () => {
      let callCount = 0;
      mockStackClient.globalField.returns({
        query: sinon.stub().returns({
          find: sinon.stub().callsFake(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve({
                items: new Array(100).fill({ uid: 'test', title: 'Test', validKey: 'value' }),
                count: 150,
              });
            } else {
              return Promise.resolve({
                items: new Array(50).fill({ uid: 'test2', title: 'Test2', validKey: 'value' }),
                count: 150,
              });
            }
          }),
        }),
      });

      await exportGlobalFields.getGlobalFields();

      // Verify multiple calls were made and each item written as per-uid file
      expect(callCount).to.be.greaterThan(1);
      const writeFileStub = FsUtility.prototype.writeFile as sinon.SinonStub;
      expect(writeFileStub.callCount).to.equal(150);
    });

    it('should handle API errors gracefully', async () => {
      mockStackClient.globalField.returns({
        query: sinon.stub().returns({
          find: sinon.stub().rejects(new Error('API Error')),
        }),
      });

      try {
        await exportGlobalFields.getGlobalFields();
      } catch (error: any) {
        expect(error).to.exist;
        expect(error.message).to.include('API Error');
      }
    });

    it('should handle no items response', async () => {
      mockStackClient.globalField.returns({
        query: sinon.stub().returns({
          find: sinon.stub().resolves({
            items: [],
            count: 0,
          }),
        }),
      });

      const writeFileStub = FsUtility.prototype.writeFile as sinon.SinonStub;
      await exportGlobalFields.getGlobalFields();

      // No items → writeFile never called
      expect(writeFileStub.called).to.be.false;
    });

    it('should handle empty items array', async () => {
      mockStackClient.globalField.returns({
        query: sinon.stub().returns({
          find: sinon.stub().resolves({
            items: null,
            count: 0,
          }),
        }),
      });

      const writeFileStub = FsUtility.prototype.writeFile as sinon.SinonStub;
      await exportGlobalFields.getGlobalFields();

      // Null items → writeFile never called
      expect(writeFileStub.called).to.be.false;
    });

    it('should update query params with skip value', async () => {
      mockStackClient.globalField.returns({
        query: sinon.stub().returns({
          find: sinon.stub().resolves({
            items: [{ uid: 'gf-1', title: 'Test', validKey: 'value' }],
            count: 1,
          }),
        }),
      });

      await exportGlobalFields.getGlobalFields(50);

      // Verify skip was set in query
      expect(exportGlobalFields.qs.skip).to.equal(50);
    });
  });

  describe('sanitizeAttribs() method', () => {
    it('should sanitize global field attributes and remove invalid keys', () => {
      const globalFields = [
        { uid: 'gf-1', title: 'Field 1', validKey: 'value1', invalidKey: 'remove' },
        { uid: 'gf-2', title: 'Field 2', validKey: 'value2', invalidKey: 'remove' },
      ];

      exportGlobalFields.sanitizeAttribs(globalFields);

      // sanitizeAttribs modifies the array elements in-place
      expect(globalFields[0].invalidKey).to.be.undefined;
      expect(globalFields[0].uid).to.equal('gf-1');
      expect(globalFields[0].title).to.equal('Field 1');
      expect(globalFields[0].validKey).to.equal('value1');
      // Each field written to its own per-uid file (never to globalfields.json)
      const writeFileStub = FsUtility.prototype.writeFile as sinon.SinonStub;
      expect(writeFileStub.calledWith(sinon.match(/gf-1\.json/))).to.be.true;
      expect(writeFileStub.calledWith(sinon.match(/gf-2\.json/))).to.be.true;
      expect(writeFileStub.neverCalledWith(sinon.match(/globalfields\.json/))).to.be.true;
    });

    it('should handle global fields without required keys', () => {
      const globalFields = [{ uid: 'gf-1', invalidKey: 'remove' }];

      exportGlobalFields.sanitizeAttribs(globalFields);

      expect(globalFields[0]).to.exist;
      expect(globalFields[0].invalidKey).to.be.undefined;
    });

    it('should handle empty global fields array', () => {
      const globalFields: any[] = [];

      exportGlobalFields.sanitizeAttribs(globalFields);

      expect(globalFields.length).to.equal(0);
    });

    it('should keep only valid keys from validKeys config', () => {
      const globalFields = [
        {
          uid: 'gf-1',
          title: 'Field 1',
          validKey: 'value1',
          keyToRemove1: 'remove',
          keyToRemove2: 'remove',
          keyToRemove3: 'remove',
        },
      ];

      exportGlobalFields.sanitizeAttribs(globalFields);

      const processedField = globalFields[0];

      // Should only keep uid, title, validKey
      expect(processedField.keyToRemove1).to.be.undefined;
      expect(processedField.keyToRemove2).to.be.undefined;
      expect(processedField.keyToRemove3).to.be.undefined;
      expect(processedField.uid).to.equal('gf-1');
      expect(processedField.title).to.equal('Field 1');
      expect(processedField.validKey).to.equal('value1');
      // Written to per-uid file path
      const writeFileStub = FsUtility.prototype.writeFile as sinon.SinonStub;
      expect(writeFileStub.calledWith(sinon.match(/gf-1\.json/))).to.be.true;
      expect(writeFileStub.neverCalledWith(sinon.match(/globalfields\.json/))).to.be.true;
    });
  });

  describe('start() method', () => {
    it('should complete full export flow and write files', async () => {
      const writeFileStub = FsUtility.prototype.writeFile as sinon.SinonStub;
      const makeDirectoryStub = FsUtility.prototype.makeDirectory as sinon.SinonStub;

      const globalFields = [
        { uid: 'gf-1', title: 'Field 1', validKey: 'value1' },
        { uid: 'gf-2', title: 'Field 2', validKey: 'value2' },
      ];

      mockStackClient.globalField.returns({
        query: sinon.stub().returns({
          find: sinon.stub().resolves({
            items: globalFields,
            count: 2,
          }),
        }),
      });

      await exportGlobalFields.start();

      // Verify each field written to its own per-uid file (not globalfields.json)
      expect(writeFileStub.calledWith(sinon.match(/gf-1\.json/))).to.be.true;
      expect(writeFileStub.calledWith(sinon.match(/gf-2\.json/))).to.be.true;
      expect(writeFileStub.neverCalledWith(sinon.match(/globalfields\.json/))).to.be.true;
      expect(makeDirectoryStub.called).to.be.true;
    });

    it('should return early when no global fields found', async () => {
      const writeFileStub = FsUtility.prototype.writeFile as sinon.SinonStub;

      mockStackClient.globalField.returns({
        query: sinon.stub().returns({
          find: sinon.stub().resolves({
            items: [],
            count: 0,
          }),
        }),
      });

      await exportGlobalFields.start();

      // start() exits early on count=0 — no per-uid files written
      expect(writeFileStub.called).to.be.false;
    });

    it('should handle errors during export without throwing', async () => {
      mockStackClient.globalField.returns({
        query: sinon.stub().returns({
          find: sinon.stub().rejects(new Error('Export failed')),
        }),
      });

      // Should complete without throwing
      await exportGlobalFields.start();
    });

    it('should process multiple batches of global fields', async () => {
      let callCount = 0;
      const globalFieldMock = {
        query: sinon.stub().returns({
          find: sinon.stub().callsFake(() => {
            callCount++;
            // First call is in withLoadingSpinner with limit: 1 to get count
            if (callCount === 1) {
              return Promise.resolve({
                items: [],
                count: 150,
              });
            } else if (callCount === 2) {
              // Second call fetches first batch
              return Promise.resolve({
                items: new Array(100)
                  .fill(null)
                  .map((_, i) => ({ uid: `gf-${i + 1}`, title: 'Test', validKey: 'value' })),
                count: 150,
              });
            } else {
              // Third call fetches remaining batch
              return Promise.resolve({
                items: new Array(50)
                  .fill(null)
                  .map((_, i) => ({ uid: `gf-${i + 101}`, title: 'Test', validKey: 'value' })),
                count: 150,
              });
            }
          }),
        }),
      };
      mockStackClient.globalField.returns(globalFieldMock);

      await exportGlobalFields.start();

      // Verify all fields processed — one writeFile call per item, no globalfields.json
      const writeFileStub = FsUtility.prototype.writeFile as sinon.SinonStub;
      expect(writeFileStub.callCount).to.equal(150);
      expect(callCount).to.be.greaterThan(1);
      expect(writeFileStub.neverCalledWith(sinon.match(/globalfields\.json/))).to.be.true;
    });

    it('should call makeDirectory and writeFile with correct paths', async () => {
      const writeFileStub = FsUtility.prototype.writeFile as sinon.SinonStub;
      const makeDirectoryStub = FsUtility.prototype.makeDirectory as sinon.SinonStub;

      mockStackClient.globalField.returns({
        query: sinon.stub().returns({
          find: sinon.stub().resolves({
            items: [{ uid: 'gf-1', title: 'Test', validKey: 'value' }],
            count: 1,
          }),
        }),
      });

      await exportGlobalFields.start();

      // Verify directory created and per-uid file written (not globalfields.json)
      expect(makeDirectoryStub.called).to.be.true;
      expect(writeFileStub.calledWith(sinon.match(/gf-1\.json/))).to.be.true;
      expect(writeFileStub.neverCalledWith(sinon.match(/globalfields\.json/))).to.be.true;
    });
  });
});
