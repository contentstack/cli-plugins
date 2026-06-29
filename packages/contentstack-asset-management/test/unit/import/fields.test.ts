import { expect } from 'chai';
import sinon from 'sinon';
import { FsUtility } from '@contentstack/cli-utilities';

import ImportFields from '../../../src/import/fields';
import { CSAssetsImportAdapter } from '../../../src/import/base';
import type { CSAssetsAPIConfig, ImportContext } from '../../../src/types/cs-assets-api';

describe('ImportFields', () => {
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
    sinon.stub(CSAssetsImportAdapter.prototype, 'getFieldsDir' as any).returns('/tmp/import/spaces/fields');
  });

  afterEach(() => sinon.restore());

  const stubExistingFields = (fields: any[]) => {
    sinon.stub(CSAssetsImportAdapter.prototype, 'getWorkspaceFields' as any)
      .resolves({ fields });
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
    it('ticks once and returns without calling createField', async () => {
      sinon.stub(require('node:fs'), 'existsSync').returns(false);
      stubExistingFields([]);
      const createStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createField' as any).resolves();

      const importer = new ImportFields(apiConfig, importContext);
      await importer.start();

      expect(createStub.callCount).to.equal(0);
      expect(tickStub.callCount).to.equal(1);
      expect(tickStub.firstCall.args[0]).to.equal(true);
    });
  });

  describe('when fields exist in the export', () => {
    beforeEach(() => {
      sinon.stub(require('node:fs'), 'existsSync').returns(true);
    });

    it('creates a new field that does not exist in the target org', async () => {
      const newField = { uid: 'field-new', label: 'New Field', type: 'text' };
      stubExistingFields([]);
      stubChunks([newField]);
      const createStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createField' as any).resolves();

      const importer = new ImportFields(apiConfig, importContext);
      await importer.start();

      expect(createStub.callCount).to.equal(1);
      const payload = createStub.firstCall.args[0];
      expect(payload.label).to.equal('New Field');
    });

    it('skips fields with is_system=true', async () => {
      stubExistingFields([]);
      stubChunks([{ uid: 'sys-field', is_system: true, label: 'System Field' }]);
      const createStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createField' as any).resolves();

      const importer = new ImportFields(apiConfig, importContext);
      await importer.start();

      expect(createStub.callCount).to.equal(0);
      expect(tickStub.lastCall.args[1]).to.include('skipped');
    });

    it('silently skips (no create) when uid exists with matching definition after stripping invalid keys', async () => {
      const existing = { uid: 'field-1', label: 'Field One', created_at: '2024-01-01', asset_types_count: 3 };
      const exported = { uid: 'field-1', label: 'Field One', created_at: '2024-01-01', asset_types_count: 5 };
      stubExistingFields([existing]);
      stubChunks([exported]);
      const createStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createField' as any).resolves();

      const importer = new ImportFields(apiConfig, importContext);
      await importer.start();

      expect(createStub.callCount).to.equal(0);
      expect(tickStub.lastCall.args[1]).to.include('skipped');
    });

    it('skips (no create) when uid exists with a different definition', async () => {
      const existing = { uid: 'field-1', label: 'Old Label', type: 'text' };
      const exported = { uid: 'field-1', label: 'New Label', type: 'text' };
      stubExistingFields([existing]);
      stubChunks([exported]);
      const createStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createField' as any).resolves();

      const importer = new ImportFields(apiConfig, importContext);
      await importer.start();

      expect(createStub.callCount).to.equal(0);
      expect(tickStub.lastCall.args[1]).to.include('skipped');
    });

    it('strips invalid keys (created_at, updated_at, is_system, asset_types_count) from POST payload', async () => {
      const exported = {
        uid: 'field-clean',
        label: 'Clean Field',
        created_at: '2024-01-01',
        updated_at: '2024-06-01',
        is_system: false,
        asset_types_count: 10,
        created_by: 'user-1',
        updated_by: 'user-2',
      };
      stubExistingFields([]);
      stubChunks([exported]);
      const createStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createField' as any).resolves();

      const importer = new ImportFields(apiConfig, importContext);
      await importer.start();

      const payload = createStub.firstCall.args[0];
      expect(payload).to.not.have.property('created_at');
      expect(payload).to.not.have.property('updated_at');
      expect(payload).to.not.have.property('is_system');
      expect(payload).to.not.have.property('asset_types_count');
      expect(payload.label).to.equal('Clean Field');
    });

    it('handles createField failure: final tick reflects failure count', async () => {
      stubExistingFields([]);
      stubChunks([{ uid: 'field-bad', label: 'Bad Field' }]);
      sinon.stub(CSAssetsImportAdapter.prototype, 'createField' as any).rejects(new Error('API error'));

      const importer = new ImportFields(apiConfig, importContext);
      await importer.start();

      const lastTickArgs = tickStub.lastCall.args;
      expect(lastTickArgs[0]).to.equal(false);
      expect(lastTickArgs[1]).to.include('1 failed');
    });

    it('handles getWorkspaceFields failure: proceeds as if no existing fields', async () => {
      sinon.stub(CSAssetsImportAdapter.prototype, 'getWorkspaceFields' as any)
        .rejects(new Error('API unavailable'));
      stubChunks([{ uid: 'field-new', label: 'New Field' }]);
      const createStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createField' as any).resolves();

      const importer = new ImportFields(apiConfig, importContext);
      await importer.start();

      expect(createStub.callCount).to.equal(1);
    });

    it('final tick is success=true when all creates succeed and none fail', async () => {
      stubExistingFields([]);
      stubChunks([{ uid: 'field-ok', label: 'OK Field' }]);
      sinon.stub(CSAssetsImportAdapter.prototype, 'createField' as any).resolves();

      const importer = new ImportFields(apiConfig, importContext);
      await importer.start();

      const lastTickArgs = tickStub.lastCall.args;
      expect(lastTickArgs[0]).to.equal(true);
      expect(lastTickArgs[1]).to.include('1 created');
    });
  });
});
