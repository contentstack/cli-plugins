import { expect } from 'chai';
import sinon from 'sinon';
import { FsUtility } from '@contentstack/cli-utilities';

import ImportAssetTypes from '../../../src/import/asset-types';
import { CSAssetsImportAdapter } from '../../../src/import/base';
import type { CSAssetsAPIConfig, ImportContext } from '../../../src/types/cs-assets-api';

describe('ImportAssetTypes', () => {
  const apiConfig: CSAssetsAPIConfig = {
    baseURL: 'https://am.example.com',
    headers: { organization_uid: 'org-1' },
  };
  const importContext: ImportContext = {
    spacesRootPath: '/tmp/import/spaces',
    apiKey: 'api-key-1',
    host: 'https://api.contentstack.io/v3',
    org_uid: 'org-1',
  };

  let tickStub: sinon.SinonStub;

  beforeEach(() => {
    sinon.stub(CSAssetsImportAdapter.prototype, 'init' as any).resolves();
    tickStub = sinon.stub(CSAssetsImportAdapter.prototype, 'tick' as any);
    sinon.stub(CSAssetsImportAdapter.prototype, 'updateStatus' as any);
    sinon.stub(CSAssetsImportAdapter.prototype, 'getAssetTypesDir' as any).returns('/tmp/import/spaces/asset_types');
  });

  afterEach(() => sinon.restore());

  const stubExistingAssetTypes = (assetTypes: any[]) => {
    sinon.stub(CSAssetsImportAdapter.prototype, 'getWorkspaceAssetTypes' as any)
      .resolves({ asset_types: assetTypes });
  };

  const stubChunks = (records: Record<string, unknown>[]) => {
    const indexer = records.length > 0 ? { '0': true } : {};
    sinon.stub(FsUtility.prototype, 'indexFileContent' as any).get(() => indexer);
    if (records.length > 0) {
      const chunk = Object.fromEntries(records.map((r) => [(r.uid as string), r]));
      sinon.stub(FsUtility.prototype, 'readChunkFiles' as any).get(() => ({
        next: sinon.stub().resolves(chunk),
      }));
    }
  };

  describe('when index file does not exist', () => {
    it('ticks once and returns without calling createAssetType', async () => {
      sinon.stub(require('node:fs'), 'existsSync').returns(false);
      stubExistingAssetTypes([]);
      const createStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createAssetType' as any).resolves();
      const importer = new ImportAssetTypes(apiConfig, importContext);
      await importer.start();

      expect(createStub.callCount).to.equal(0);
      expect(tickStub.callCount).to.equal(1);
      expect(tickStub.firstCall.args[0]).to.equal(true);
    });
  });

  describe('when asset types exist in the export', () => {
    beforeEach(() => {
      sinon.stub(require('node:fs'), 'existsSync').returns(true);
    });

    it('creates a new asset type that does not exist in the target org', async () => {
      const newType = { uid: 'type-new', label: 'New Type' };
      stubExistingAssetTypes([]);
      stubChunks([newType]);
      const createStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createAssetType' as any).resolves();

      const importer = new ImportAssetTypes(apiConfig, importContext);
      await importer.start();

      expect(createStub.callCount).to.equal(1);
      const payload = createStub.firstCall.args[0];
      expect(payload.label).to.equal('New Type');
    });

    it('skips asset types with is_system=true', async () => {
      stubExistingAssetTypes([]);
      stubChunks([{ uid: 'sys-type', is_system: true, label: 'System Type' }]);
      const createStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createAssetType' as any).resolves();

      const importer = new ImportAssetTypes(apiConfig, importContext);
      await importer.start();

      expect(createStub.callCount).to.equal(0);
      const tickArgs = tickStub.lastCall.args[1] as string;
      expect(tickArgs).to.include('skipped');
    });

    it('skips (no create) when uid already exists in target with matching definition', async () => {
      const existing = { uid: 'type-1', label: 'Type One', created_at: '2024-01-01' };
      const exported = { uid: 'type-1', label: 'Type One', created_at: '2024-01-01' };
      stubExistingAssetTypes([existing]);
      stubChunks([exported]);
      const createStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createAssetType' as any).resolves();

      const importer = new ImportAssetTypes(apiConfig, importContext);
      await importer.start();

      expect(createStub.callCount).to.equal(0);
      expect(tickStub.lastCall.args[1]).to.include('skipped');
    });

    it('skips (no create) when uid exists with a different definition in target', async () => {
      const existing = { uid: 'type-1', label: 'Old Label' };
      const exported = { uid: 'type-1', label: 'New Label' };
      stubExistingAssetTypes([existing]);
      stubChunks([exported]);
      const createStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createAssetType' as any).resolves();

      const importer = new ImportAssetTypes(apiConfig, importContext);
      await importer.start();

      expect(createStub.callCount).to.equal(0);
      expect(tickStub.lastCall.args[1]).to.include('skipped');
    });

    it('strips invalid keys (created_at, updated_at, is_system) from the POST payload', async () => {
      const exported = {
        uid: 'type-clean',
        label: 'Clean Type',
        created_at: '2024-01-01',
        updated_at: '2024-06-01',
        is_system: false,
        created_by: 'user-1',
        updated_by: 'user-2',
      };
      stubExistingAssetTypes([]);
      stubChunks([exported]);
      const createStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createAssetType' as any).resolves();

      const importer = new ImportAssetTypes(apiConfig, importContext);
      await importer.start();

      const payload = createStub.firstCall.args[0];
      expect(payload).to.not.have.property('created_at');
      expect(payload).to.not.have.property('updated_at');
      expect(payload).to.not.have.property('is_system');
      expect(payload).to.not.have.property('created_by');
      expect(payload).to.not.have.property('updated_by');
      expect(payload.label).to.equal('Clean Type');
    });

    it('handles createAssetType failure: increments failure count, final tick reflects failure', async () => {
      stubExistingAssetTypes([]);
      stubChunks([{ uid: 'type-bad', label: 'Bad Type' }]);
      sinon.stub(CSAssetsImportAdapter.prototype, 'createAssetType' as any).rejects(new Error('API error'));

      const importer = new ImportAssetTypes(apiConfig, importContext);
      await importer.start();

      const lastTickArgs = tickStub.lastCall.args;
      expect(lastTickArgs[0]).to.equal(false);
      expect(lastTickArgs[1]).to.include('1 failed');
    });

    it('handles getWorkspaceAssetTypes failure: proceeds as if no existing types', async () => {
      sinon.stub(CSAssetsImportAdapter.prototype, 'getWorkspaceAssetTypes' as any)
        .rejects(new Error('API unavailable'));
      stubChunks([{ uid: 'type-new', label: 'New Type' }]);
      const createStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createAssetType' as any).resolves();

      const importer = new ImportAssetTypes(apiConfig, importContext);
      await importer.start();

      expect(createStub.callCount).to.equal(1);
    });

    it('final tick is success=true when all creates succeed', async () => {
      stubExistingAssetTypes([]);
      stubChunks([{ uid: 'type-ok', label: 'OK Type' }]);
      sinon.stub(CSAssetsImportAdapter.prototype, 'createAssetType' as any).resolves();

      const importer = new ImportAssetTypes(apiConfig, importContext);
      await importer.start();

      const lastTickArgs = tickStub.lastCall.args;
      expect(lastTickArgs[0]).to.equal(true);
      expect(lastTickArgs[1]).to.include('1 created');
    });
  });
});
