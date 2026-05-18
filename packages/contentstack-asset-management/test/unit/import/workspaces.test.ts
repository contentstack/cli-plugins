import { expect } from 'chai';
import sinon from 'sinon';

import ImportWorkspace from '../../../src/import/workspaces';
import ImportAssets from '../../../src/import/assets';
import { CSAssetsImportAdapter } from '../../../src/import/base';

import type { CSAssetsAPIConfig, ImportContext } from '../../../src/types/cs-assets-api';

describe('ImportWorkspace', () => {
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

  const spaceDir = '/tmp/import/spaces/am-space-1';

  const stubMetadata = (metadata: Record<string, unknown>) => {
    const fs = require('node:fs');
    sinon.stub(fs, 'readFileSync').returns(JSON.stringify(metadata));
  };

  beforeEach(() => {
    sinon.stub(CSAssetsImportAdapter.prototype, 'init' as any).resolves();
    sinon.stub(CSAssetsImportAdapter.prototype, 'tick' as any);
    sinon.stub(ImportAssets.prototype, 'setParentProgressManager');
    sinon.stub(ImportAssets.prototype, 'setProcessName' as any);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('default-space mapping path', () => {
    it('should use targetDefaultSpaceUid and skip createSpace when isDefault=true', async () => {
      stubMetadata({ title: 'Source Default Space', is_default: true });
      const createSpaceStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createSpace' as any);
      const assetsStartStub = sinon.stub(ImportAssets.prototype, 'start').resolves({ uidMap: {}, urlMap: {} });

      const importer = new ImportWorkspace(apiConfig, importContext);
      const result = await importer.start(
        'am-space-1',
        spaceDir,
        new Set(),
        undefined,
        'target-default-space-uid',
        'target-ws-uid',
      );

      expect(createSpaceStub.callCount).to.equal(0);
      expect(assetsStartStub.callCount).to.equal(1);
      expect(assetsStartStub.firstCall.args[0]).to.equal('target-default-space-uid');
      expect(result.newSpaceUid).to.equal('target-default-space-uid');
      expect(result.workspaceUid).to.equal('target-ws-uid');
      expect(result.isDefault).to.equal(true);
      expect(result.oldSpaceUid).to.equal('am-space-1');
    });

    it('should upload assets into the existing target default space (not identity-map)', async () => {
      stubMetadata({ title: 'Source Default Space', is_default: true });
      sinon.stub(CSAssetsImportAdapter.prototype, 'createSpace' as any);
      const assetsStartStub = sinon.stub(ImportAssets.prototype, 'start').resolves({
        uidMap: { 'old-asset-1': 'new-asset-1' },
        urlMap: { 'old-url-1': 'new-url-1' },
      });

      const importer = new ImportWorkspace(apiConfig, importContext);
      const result = await importer.start('am-space-1', spaceDir, new Set(), undefined, 'target-space-3');

      expect(assetsStartStub.firstCall.args[0]).to.equal('target-space-3');
      expect(result.uidMap).to.deep.equal({ 'old-asset-1': 'new-asset-1' });
      expect(result.urlMap).to.deep.equal({ 'old-url-1': 'new-url-1' });
    });

    it('should fall back to "main" as workspaceUid when targetDefaultWorkspaceUid is not provided', async () => {
      stubMetadata({ is_default: true });
      sinon.stub(CSAssetsImportAdapter.prototype, 'createSpace' as any);
      sinon.stub(ImportAssets.prototype, 'start').resolves({ uidMap: {}, urlMap: {} });

      const importer = new ImportWorkspace(apiConfig, importContext);
      const result = await importer.start('am-space-1', spaceDir, new Set(), undefined, 'target-space-3');

      expect(result.workspaceUid).to.equal('main');
    });

    it('should NOT use the default-space path when isDefault=false even if targetDefaultSpaceUid is set', async () => {
      stubMetadata({ title: 'Non-default Space', is_default: false });
      const createSpaceStub = sinon
        .stub(CSAssetsImportAdapter.prototype, 'createSpace' as any)
        .resolves({ space: { uid: 'new-space-uid' } });
      sinon.stub(ImportAssets.prototype, 'start').resolves({ uidMap: {}, urlMap: {} });

      const importer = new ImportWorkspace(apiConfig, importContext);
      const result = await importer.start('am-space-2', spaceDir, new Set(), undefined, 'target-space-3');

      expect(createSpaceStub.callCount).to.equal(1);
      expect(result.newSpaceUid).to.equal('new-space-uid');
    });

    it('should NOT use the default-space path when targetDefaultSpaceUid is undefined', async () => {
      stubMetadata({ title: 'Source Default Space', is_default: true });
      const createSpaceStub = sinon
        .stub(CSAssetsImportAdapter.prototype, 'createSpace' as any)
        .resolves({ space: { uid: 'brand-new-uid' } });
      sinon.stub(ImportAssets.prototype, 'start').resolves({ uidMap: {}, urlMap: {} });

      const importer = new ImportWorkspace(apiConfig, importContext);
      const result = await importer.start('am-space-1', spaceDir, new Set());

      expect(createSpaceStub.callCount).to.equal(1);
      expect(result.newSpaceUid).to.equal('brand-new-uid');
    });
  });

  describe('identity-reuse path (existing uid match)', () => {
    it('should reuse existing space uid and call buildIdentityMappersFromExport', async () => {
      stubMetadata({ title: 'Space', is_default: false });
      const identityStub = sinon
        .stub(ImportAssets.prototype, 'buildIdentityMappersFromExport')
        .resolves({ uidMap: { a: 'a' }, urlMap: {} });
      sinon.stub(CSAssetsImportAdapter.prototype, 'createSpace' as any);

      const importer = new ImportWorkspace(apiConfig, importContext);
      const result = await importer.start('am-space-existing', spaceDir, new Set(['am-space-existing']));

      expect(identityStub.callCount).to.equal(1);
      expect(result.newSpaceUid).to.equal('am-space-existing');
    });
  });

  describe('create new space path', () => {
    it('should create a new space and upload assets for non-default non-existing space', async () => {
      stubMetadata({ title: 'Source Space 2', is_default: false });
      const createStub = sinon
        .stub(CSAssetsImportAdapter.prototype, 'createSpace' as any)
        .resolves({ space: { uid: 'new-space-2-uid' } });
      sinon.stub(ImportAssets.prototype, 'start').resolves({ uidMap: {}, urlMap: {} });

      const importer = new ImportWorkspace(apiConfig, importContext);
      const result = await importer.start('am-space-2', spaceDir, new Set());

      expect(createStub.callCount).to.equal(1);
      expect(result.newSpaceUid).to.equal('new-space-2-uid');
      expect(result.isDefault).to.equal(false);
    });
  });
});
