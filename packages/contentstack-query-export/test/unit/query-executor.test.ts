import { expect } from 'chai';
import * as sinon from 'sinon';
import { QueryExporter } from '../../src/core/query-executor';
import { QueryParser } from '../../src/utils/query-parser';
import { ModuleExporter } from '../../src/core/module-exporter';
import * as logger from '../../src/utils/logger';
import {
  ReferencedContentTypesHandler,
  ContentTypeDependenciesHandler,
  AssetReferenceHandler,
  fsUtil,
} from '../../src/utils';
import * as readCtSchemas from '../../src/utils/read-content-type-schemas';

describe('QueryExporter', () => {
  let sandbox: sinon.SinonSandbox;
  let queryExporter: QueryExporter;
  let mockManagementClient: any;
  let mockConfig: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock management client
    mockManagementClient = {
      stack: sandbox.stub().returns({}),
    };

    // Mock export configuration
    mockConfig = {
      exportDir: './test-export',
      stackApiKey: 'test-stack-api-key',
      managementToken: 'test-management-token',
      query: '{"modules":{"entries":{"content_type_uid":"test_page"}}}',
      modules: {
        general: ['environments', 'locales'],
        queryable: ['entries', 'assets', 'content-types'],
      },
      branchName: 'main',
      securedAssets: false,
      externalConfigPath: './config/export-config.json',
      maxCTReferenceDepth: 20,
    };

    // Stub logger to prevent console output during tests
    sandbox.stub(logger, 'log');

    queryExporter = new QueryExporter(mockManagementClient, mockConfig);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should initialize QueryExporter with correct configuration', () => {
      expect(queryExporter).to.be.an('object');
      expect((queryExporter as any).exportQueryConfig).to.equal(mockConfig);
      expect((queryExporter as any).queryParser).to.be.an.instanceof(QueryParser);
      expect((queryExporter as any).moduleExporter).to.be.an.instanceof(ModuleExporter);
    });

    it('should create QueryParser instance with correct config', () => {
      const queryParser = (queryExporter as any).queryParser;
      expect(queryParser).to.be.an.instanceof(QueryParser);
    });

    it('should create ModuleExporter instance', () => {
      const moduleExporter = (queryExporter as any).moduleExporter;
      expect(moduleExporter).to.be.an.instanceof(ModuleExporter);
    });
  });

  describe('execute', () => {
    let queryParserStub: sinon.SinonStub;
    let exportGeneralModulesStub: sinon.SinonStub;
    let exportQueriedModuleStub: sinon.SinonStub;
    let expandSchemaClosureStub: sinon.SinonStub;
    let exportContentModulesStub: sinon.SinonStub;

    beforeEach(() => {
      queryParserStub = sandbox.stub((queryExporter as any).queryParser, 'parse').resolves({
        modules: { entries: { content_type_uid: 'test_page' } },
      });
      exportGeneralModulesStub = sandbox.stub(queryExporter as any, 'exportGeneralModules').resolves();
      exportQueriedModuleStub = sandbox.stub(queryExporter as any, 'exportQueriedModule').resolves();
      expandSchemaClosureStub = sandbox.stub(queryExporter as any, 'expandSchemaClosure').resolves();
      exportContentModulesStub = sandbox.stub(queryExporter as any, 'exportContentModules').resolves();
    });

    it('should execute the complete export workflow', async () => {
      await queryExporter.execute();

      expect(queryParserStub.calledOnce).to.be.true;
      expect(exportGeneralModulesStub.calledOnce).to.be.true;
      expect(exportQueriedModuleStub.calledOnce).to.be.true;
      expect(expandSchemaClosureStub.calledOnce).to.be.true;
      expect(exportContentModulesStub.calledOnce).to.be.true;
    });

    it('should call methods in correct order', async () => {
      await queryExporter.execute();

      sinon.assert.callOrder(
        queryParserStub,
        exportGeneralModulesStub,
        exportQueriedModuleStub,
        expandSchemaClosureStub,
        exportContentModulesStub,
      );
    });

    it('should pass parsed query to exportQueriedModule', async () => {
      const mockParsedQuery = { modules: { entries: { content_type_uid: 'test_page' } } };
      queryParserStub.resolves(mockParsedQuery);

      await queryExporter.execute();

      expect(exportQueriedModuleStub.calledWith(mockParsedQuery)).to.be.true;
    });

    it('should handle query parsing errors', async () => {
      const queryError = new Error('Invalid query format');
      queryParserStub.rejects(queryError);

      try {
        await queryExporter.execute();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Invalid query format');
      }

      expect(exportGeneralModulesStub.called).to.be.false;
    });

    it('should handle export errors and propagate them', async () => {
      const exportError = new Error('Export failed');
      exportGeneralModulesStub.rejects(exportError);

      try {
        await queryExporter.execute();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Export failed');
      }
    });
  });

  describe('exportGeneralModules', () => {
    let moduleExporterStub: sinon.SinonStub;

    beforeEach(() => {
      moduleExporterStub = sandbox.stub((queryExporter as any).moduleExporter, 'exportModule').resolves();
    });

    it('should export all general modules', async () => {
      await (queryExporter as any).exportGeneralModules();

      expect(moduleExporterStub.callCount).to.equal(2);
      expect(moduleExporterStub.calledWith('environments')).to.be.true;
      expect(moduleExporterStub.calledWith('locales')).to.be.true;
    });

    it('should handle empty general modules array', async () => {
      mockConfig.modules.general = [];
      queryExporter = new QueryExporter(mockManagementClient, mockConfig);
      moduleExporterStub = sandbox.stub((queryExporter as any).moduleExporter, 'exportModule').resolves();

      await (queryExporter as any).exportGeneralModules();

      expect(moduleExporterStub.called).to.be.false;
    });

    it('should handle module export errors', async () => {
      const moduleError = new Error('Module export failed');
      moduleExporterStub.rejects(moduleError);

      try {
        await (queryExporter as any).exportGeneralModules();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Module export failed');
      }
    });
  });

  describe('exportQueriedModule', () => {
    let moduleExporterStub: sinon.SinonStub;

    beforeEach(() => {
      moduleExporterStub = sandbox.stub((queryExporter as any).moduleExporter, 'exportModule').resolves();
    });

    it('should export queryable modules with query', async () => {
      const parsedQuery = {
        modules: {
          entries: { content_type_uid: 'test_page' },
          assets: { tags: 'featured' },
        },
      };

      await (queryExporter as any).exportQueriedModule(parsedQuery);

      expect(moduleExporterStub.callCount).to.equal(2);
      expect(moduleExporterStub.calledWith('entries', { query: parsedQuery })).to.be.true;
      expect(moduleExporterStub.calledWith('assets', { query: parsedQuery })).to.be.true;
    });

    it('should skip non-queryable modules', async () => {
      mockConfig.modules.queryable = ['entries']; // Remove assets from queryable
      queryExporter = new QueryExporter(mockManagementClient, mockConfig);
      moduleExporterStub = sandbox.stub((queryExporter as any).moduleExporter, 'exportModule').resolves();

      const parsedQuery = {
        modules: {
          entries: { content_type_uid: 'test_page' },
          environments: { name: 'production' }, // Not queryable
        },
      };

      await (queryExporter as any).exportQueriedModule(parsedQuery);

      expect(moduleExporterStub.callCount).to.equal(1);
      expect(moduleExporterStub.calledWith('entries', { query: parsedQuery })).to.be.true;
    });

    it('should handle empty modules in query', async () => {
      const parsedQuery = { modules: {} };

      await (queryExporter as any).exportQueriedModule(parsedQuery);

      expect(moduleExporterStub.called).to.be.false;
    });
  });

  describe('expandSchemaClosure', () => {
    let moduleExporterStub: sinon.SinonStub;
    let readContentTypesFromExportDirStub: sinon.SinonStub;
    let readGlobalFieldSchemasFromDirStub: sinon.SinonStub;
    let referencedHandlerStub: any;
    let dependenciesHandlerStub: any;

    const mockCTs = [{ uid: 'page', title: 'Page', schema: [] as any[] }];
    const emptyDeps = {
      globalFields: new Set<string>(),
      extensions: new Set<string>(),
      taxonomies: new Set<string>(),
      marketplaceApps: new Set<string>(),
    };

    beforeEach(() => {
      moduleExporterStub = sandbox.stub((queryExporter as any).moduleExporter, 'exportModule').resolves();

      // Default: CTs from schema.json reader, GFs empty.
      readContentTypesFromExportDirStub = sandbox.stub(readCtSchemas, 'readContentTypesFromExportDir').returns(mockCTs);
      readGlobalFieldSchemasFromDirStub = sandbox.stub(readCtSchemas, 'readGlobalFieldSchemasFromDir').returns([]);

      referencedHandlerStub = { extractReferencedContentTypes: sandbox.stub().resolves([]) };
      sandbox
        .stub(ReferencedContentTypesHandler.prototype, 'extractReferencedContentTypes')
        .callsFake(referencedHandlerStub.extractReferencedContentTypes);

      dependenciesHandlerStub = { extractDependencies: sandbox.stub().resolves(emptyDeps) };
      sandbox
        .stub(ContentTypeDependenciesHandler.prototype, 'extractDependencies')
        .callsFake(dependenciesHandlerStub.extractDependencies);
    });

    it('should export personalize exactly once when no new items are found', async () => {
      await (queryExporter as any).expandSchemaClosure();

      const personalizeCalls = moduleExporterStub.getCalls().filter((c) => c.args[0] === 'personalize');
      expect(personalizeCalls).to.have.lengthOf(1);
      // No CT or GF export should have happened
      expect(moduleExporterStub.getCalls().filter((c) => c.args[0] === 'content-types')).to.have.lengthOf(0);
      expect(moduleExporterStub.getCalls().filter((c) => c.args[0] === 'global-fields')).to.have.lengthOf(0);
    });

    it('should pass combined CT and GF schemas to extractReferencedContentTypes', async () => {
      const mockGFs = [{ uid: 'seo_gf', schema: [] as any[] }];
      readGlobalFieldSchemasFromDirStub.returns(mockGFs);

      await (queryExporter as any).expandSchemaClosure();

      const callArgs = referencedHandlerStub.extractReferencedContentTypes.getCall(0).args[0];
      expect(callArgs).to.deep.include({ uid: 'page', title: 'Page', schema: [] as any[] });
      expect(callArgs).to.deep.include({ uid: 'seo_gf', schema: [] as any[] });
    });

    it('should pass combined CT and GF schemas to extractDependencies', async () => {
      const mockGFs = [{ uid: 'seo_gf', schema: [] as any[] }];
      readGlobalFieldSchemasFromDirStub.returns(mockGFs);

      await (queryExporter as any).expandSchemaClosure();

      const callArgs = dependenciesHandlerStub.extractDependencies.getCall(0).args[0];
      expect(callArgs).to.deep.include({ uid: 'page', title: 'Page', schema: [] as any[] });
      expect(callArgs).to.deep.include({ uid: 'seo_gf', schema: [] as any[] });
    });

    it('should export new referenced content types found in CT schemas', async () => {
      referencedHandlerStub.extractReferencedContentTypes
        .onFirstCall()
        .resolves(['new_ct'])
        .resolves([]);

      await (queryExporter as any).expandSchemaClosure();

      const ctCall = moduleExporterStub.getCalls().find((c) => c.args[0] === 'content-types');
      expect(ctCall).to.exist;
      expect(ctCall!.args[1].query.modules['content-types'].uid.$in).to.deep.equal(['new_ct']);
    });

    it('should export new global fields discovered from CT schemas', async () => {
      dependenciesHandlerStub.extractDependencies
        .onFirstCall()
        .resolves({ globalFields: new Set(['gf_a']), extensions: new Set(), taxonomies: new Set(), marketplaceApps: new Set() })
        .resolves(emptyDeps);

      await (queryExporter as any).expandSchemaClosure();

      const gfCall = moduleExporterStub.getCalls().find((c) => c.args[0] === 'global-fields');
      expect(gfCall).to.exist;
      expect(gfCall!.args[1].query.modules['global-fields'].uid.$in).to.deep.equal(['gf_a']);
    });

    it('should iterate to find CT references inside global field schemas', async () => {
      // Iter 1: GF A is newly discovered from CT deps. GF A is not yet on disk.
      // Iter 2: GF A is now on disk; its schema exposes a reference to CT B.
      const gfADoc = [{ uid: 'gf_a', schema: [] as any[] }];

      readGlobalFieldSchemasFromDirStub.callsFake(() =>
        dependenciesHandlerStub.extractDependencies.callCount > 0 ? gfADoc : [],
      );
      readContentTypesFromExportDirStub.returns(mockCTs);

      dependenciesHandlerStub.extractDependencies
        .onFirstCall()
        .resolves({ globalFields: new Set(['gf_a']), extensions: new Set(), taxonomies: new Set(), marketplaceApps: new Set() })
        .resolves(emptyDeps);

      referencedHandlerStub.extractReferencedContentTypes
        .onFirstCall().resolves([])       // iter 1: only CTs on disk, no CT refs
        .onSecondCall().resolves(['ct_b']) // iter 2: GF A adds a CT ref to ct_b
        .resolves([]);

      await (queryExporter as any).expandSchemaClosure();

      const ctCall = moduleExporterStub.getCalls().find((c) => c.args[0] === 'content-types');
      expect(ctCall).to.exist;
      expect(ctCall!.args[1].query.modules['content-types'].uid.$in).to.include('ct_b');

      const gfCall = moduleExporterStub.getCalls().find((c) => c.args[0] === 'global-fields');
      expect(gfCall).to.exist;
      expect(gfCall!.args[1].query.modules['global-fields'].uid.$in).to.include('gf_a');
    });

    it('should not re-export already exported global fields across iterations', async () => {
      // gf_a is returned by extractDependencies on every call, but should only be exported once.
      dependenciesHandlerStub.extractDependencies.resolves({
        globalFields: new Set(['gf_a']),
        extensions: new Set(),
        taxonomies: new Set(),
        marketplaceApps: new Set(),
      });

      // Trigger a second iteration via a new CT reference so we can verify gf_a is not re-exported.
      referencedHandlerStub.extractReferencedContentTypes
        .onFirstCall().resolves(['new_ct'])
        .resolves([]);

      await (queryExporter as any).expandSchemaClosure();

      const gfCalls = moduleExporterStub.getCalls().filter((c) => c.args[0] === 'global-fields');
      expect(gfCalls).to.have.lengthOf(1);
    });

    it('should not re-export already exported content types across iterations', async () => {
      // new_ct returned on first AND second call — should only be exported once.
      referencedHandlerStub.extractReferencedContentTypes
        .onFirstCall().resolves(['new_ct'])
        .onSecondCall().resolves(['new_ct']) // already exported — should be filtered
        .resolves([]);

      // Trigger a second iteration via a new GF dep.
      dependenciesHandlerStub.extractDependencies
        .onFirstCall().resolves({ globalFields: new Set(['gf_a']), extensions: new Set(), taxonomies: new Set(), marketplaceApps: new Set() })
        .resolves(emptyDeps);

      await (queryExporter as any).expandSchemaClosure();

      const ctCalls = moduleExporterStub.getCalls().filter((c) => c.args[0] === 'content-types');
      expect(ctCalls).to.have.lengthOf(1);
    });

    it('should export extensions, taxonomies, and marketplace apps as leaf deps', async () => {
      dependenciesHandlerStub.extractDependencies.resolves({
        globalFields: new Set(),
        extensions: new Set(['ext_1']),
        taxonomies: new Set(['tax_1']),
        marketplaceApps: new Set(['mp_app_1']),
      });

      await (queryExporter as any).expandSchemaClosure();

      expect(moduleExporterStub.getCalls().some((c) => c.args[0] === 'extensions')).to.be.true;
      expect(moduleExporterStub.getCalls().some((c) => c.args[0] === 'taxonomies')).to.be.true;
      expect(moduleExporterStub.getCalls().some((c) => c.args[0] === 'marketplace-apps')).to.be.true;
    });

    it('should skip CT reference extraction when skipReferences is true', async () => {
      mockConfig.skipReferences = true;
      const localExporter = new QueryExporter(mockManagementClient, mockConfig);
      const localModuleStub = sandbox.stub((localExporter as any).moduleExporter, 'exportModule').resolves();

      await (localExporter as any).expandSchemaClosure();

      expect(referencedHandlerStub.extractReferencedContentTypes.called).to.be.false;
      expect(localModuleStub.getCalls().filter((c) => c.args[0] === 'content-types')).to.have.lengthOf(0);
    });

    it('should skip dependency extraction when skipDependencies is true', async () => {
      mockConfig.skipDependencies = true;
      const localExporter = new QueryExporter(mockManagementClient, mockConfig);
      const localModuleStub = sandbox.stub((localExporter as any).moduleExporter, 'exportModule').resolves();

      await (localExporter as any).expandSchemaClosure();

      expect(dependenciesHandlerStub.extractDependencies.called).to.be.false;
      expect(localModuleStub.getCalls().filter((c) => c.args[0] === 'global-fields')).to.have.lengthOf(0);
    });

    it('should stop after maxCTReferenceDepth iterations', async () => {
      mockConfig.maxCTReferenceDepth = 2;
      const localExporter = new QueryExporter(mockManagementClient, mockConfig);
      sandbox.stub((localExporter as any).moduleExporter, 'exportModule').resolves();

      // Always report new GFs so the loop never naturally terminates.
      let callN = 0;
      dependenciesHandlerStub.extractDependencies.callsFake(() => {
        callN++;
        return Promise.resolve({
          globalFields: new Set([`gf_${callN}`]),
          extensions: new Set(),
          taxonomies: new Set(),
          marketplaceApps: new Set(),
        });
      });

      await (localExporter as any).expandSchemaClosure();

      expect(dependenciesHandlerStub.extractDependencies.callCount).to.be.at.most(2);
    });

    it('should propagate errors from extractReferencedContentTypes', async () => {
      referencedHandlerStub.extractReferencedContentTypes.rejects(new Error('Handler failed'));

      try {
        await (queryExporter as any).expandSchemaClosure();
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).to.equal('Handler failed');
      }
    });

    it('should propagate errors from extractDependencies', async () => {
      dependenciesHandlerStub.extractDependencies.rejects(new Error('Dependencies extraction failed'));

      try {
        await (queryExporter as any).expandSchemaClosure();
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).to.equal('Dependencies extraction failed');
      }
    });
  });

  describe('exportContentModules', () => {
    let exportEntriesStub: sinon.SinonStub;
    let exportReferencedAssetsStub: sinon.SinonStub;
    let setTimeoutStub: sinon.SinonStub;

    beforeEach(() => {
      exportEntriesStub = sandbox.stub(queryExporter as any, 'exportEntries').resolves();
      exportReferencedAssetsStub = sandbox.stub(queryExporter as any, 'exportReferencedAssets').resolves();

      // Mock setTimeout to avoid actual delays in tests
      setTimeoutStub = sandbox.stub(global, 'setTimeout').callsFake((callback) => {
        callback();
        return {} as any;
      });
    });

    it('should export entries and then assets', async () => {
      await (queryExporter as any).exportContentModules();

      expect(exportEntriesStub.calledOnce).to.be.true;
      expect(exportReferencedAssetsStub.calledOnce).to.be.true;
      sinon.assert.callOrder(exportEntriesStub, exportReferencedAssetsStub);
    });

    it('should include delay before asset export', async () => {
      await (queryExporter as any).exportContentModules();

      expect(setTimeoutStub.calledOnce).to.be.true;
      expect(setTimeoutStub.calledWith(sinon.match.func, 5000)).to.be.true;
    });

    it('should handle entries export errors', async () => {
      const entriesError = new Error('Entries export failed');
      exportEntriesStub.rejects(entriesError);

      try {
        await (queryExporter as any).exportContentModules();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Entries export failed');
      }

      expect(exportReferencedAssetsStub.called).to.be.false;
    });

    it('should handle assets export errors', async () => {
      const assetsError = new Error('Assets export failed');
      exportReferencedAssetsStub.rejects(assetsError);

      try {
        await (queryExporter as any).exportContentModules();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Assets export failed');
      }
    });
  });

  describe('exportEntries', () => {
    let moduleExporterStub: sinon.SinonStub;

    beforeEach(() => {
      moduleExporterStub = sandbox.stub((queryExporter as any).moduleExporter, 'exportModule').resolves();
    });

    it('should export entries module', async () => {
      await (queryExporter as any).exportEntries();

      expect(moduleExporterStub.calledOnce).to.be.true;
      expect(moduleExporterStub.calledWith('entries')).to.be.true;
    });

    it('should handle entries export errors', async () => {
      const entriesError = new Error('Entries export failed');
      moduleExporterStub.rejects(entriesError);

      try {
        await (queryExporter as any).exportEntries();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Entries export failed');
      }
    });
  });

  describe('exportReferencedAssets', () => {
    let moduleExporterStub: sinon.SinonStub;
    let assetHandlerStub: any;

    beforeEach(() => {
      moduleExporterStub = sandbox.stub((queryExporter as any).moduleExporter, 'exportModule').resolves();

      // Mock AssetReferenceHandler
      assetHandlerStub = {
        extractReferencedAssets: sandbox.stub().returns(['asset_1', 'asset_2', 'asset_3']),
      };
      sandbox
        .stub(AssetReferenceHandler.prototype, 'extractReferencedAssets')
        .callsFake(assetHandlerStub.extractReferencedAssets);
    });

    it('should export referenced assets when found', async () => {
      await (queryExporter as any).exportReferencedAssets();

      expect(moduleExporterStub.calledOnce).to.be.true;
      const exportCall = moduleExporterStub.getCall(0);
      expect(exportCall.args[0]).to.equal('assets');
      expect(exportCall.args[1].query.modules.assets.uid.$in).to.deep.equal(['asset_1', 'asset_2', 'asset_3']);
    });

    it('should skip export when no assets found', async () => {
      assetHandlerStub.extractReferencedAssets.returns([]);

      await (queryExporter as any).exportReferencedAssets();

      expect(moduleExporterStub.called).to.be.false;
    });

    it('should handle asset extraction errors', async () => {
      const assetError = new Error('Asset extraction failed');
      assetHandlerStub.extractReferencedAssets.throws(assetError);

      try {
        await (queryExporter as any).exportReferencedAssets();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Asset extraction failed');
      }

      expect(moduleExporterStub.called).to.be.false;
    });

    it('should handle asset export errors', async () => {
      const exportError = new Error('Asset export failed');
      moduleExporterStub.rejects(exportError);

      try {
        await (queryExporter as any).exportReferencedAssets();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.equal('Asset export failed');
      }
    });
  });
});
