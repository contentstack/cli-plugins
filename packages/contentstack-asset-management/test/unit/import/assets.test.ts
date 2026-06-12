import { expect } from 'chai';
import sinon from 'sinon';
import * as os from 'os';
import * as path from 'path';
import * as fsReal from 'fs';
import { FsUtility } from '@contentstack/cli-utilities';

import ImportAssets from '../../../src/import/assets';
import { CSAssetsImportAdapter } from '../../../src/import/base';
import type { CSAssetsAPIConfig, ImportContext } from '../../../src/types/cs-assets-api';

describe('ImportAssets', () => {
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
  });

  afterEach(() => sinon.restore());

  const makeSpaceDir = () => {
    const dir = path.join(os.tmpdir(), `am-test-${Date.now()}`);
    fsReal.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    return dir;
  };

  const stubAssetChunks = (assets: Record<string, unknown>[]) => {
    const indexer = assets.length > 0 ? { '0': true } : {};
    sinon.stub(FsUtility.prototype, 'indexFileContent' as any).get(() => indexer);
    if (assets.length > 0) {
      const chunk = Object.fromEntries(assets.map((a) => [(a.uid as string), a]));
      sinon.stub(FsUtility.prototype, 'readChunkFiles' as any).get(() => ({
        next: sinon.stub().resolves(chunk),
      }));
    }
    sinon.stub(FsUtility.prototype, 'getPlainMeta').returns(
      assets.length > 0 ? { 'chunk0': assets.map((a) => a.uid) } : {},
    );
  };

  describe('buildIdentityMappersFromExport', () => {
    it('returns empty maps when no assets.json index exists in spaceDir', async () => {
      const spaceDir = makeSpaceDir();
      const importer = new ImportAssets(apiConfig, importContext);
      const result = await importer.buildIdentityMappersFromExport(spaceDir);

      expect(result.uidMap).to.deep.equal({});
      expect(result.urlMap).to.deep.equal({});
    });

    it('builds identity uid and url maps from chunked assets', async () => {
      const spaceDir = makeSpaceDir();
      fsReal.writeFileSync(path.join(spaceDir, 'assets', 'assets.json'), '{}');
      stubAssetChunks([
        { uid: 'asset-1', url: 'https://cdn.example.com/asset-1.png' },
        { uid: 'asset-2', url: 'https://cdn.example.com/asset-2.png' },
      ]);

      const importer = new ImportAssets(apiConfig, importContext);
      const result = await importer.buildIdentityMappersFromExport(spaceDir);

      expect(result.uidMap).to.deep.equal({ 'asset-1': 'asset-1', 'asset-2': 'asset-2' });
      expect(result.urlMap).to.deep.equal({
        'https://cdn.example.com/asset-1.png': 'https://cdn.example.com/asset-1.png',
        'https://cdn.example.com/asset-2.png': 'https://cdn.example.com/asset-2.png',
      });
    });

    it('handles assets with missing uid gracefully: only url is added to urlMap', async () => {
      const spaceDir = makeSpaceDir();
      fsReal.writeFileSync(path.join(spaceDir, 'assets', 'assets.json'), '{}');
      sinon.stub(FsUtility.prototype, 'indexFileContent' as any).get(() => ({ '0': true }));
      sinon.stub(FsUtility.prototype, 'readChunkFiles' as any).get(() => ({
        next: sinon.stub().resolves({
          'asset-no-url': { uid: 'asset-no-url' },
        }),
      }));
      sinon.stub(FsUtility.prototype, 'getPlainMeta').returns({});

      const importer = new ImportAssets(apiConfig, importContext);
      const result = await importer.buildIdentityMappersFromExport(spaceDir);

      expect(result.uidMap).to.have.key('asset-no-url');
      expect(result.urlMap).to.deep.equal({});
    });
  });

  describe('start', () => {
    it('returns empty maps and ticks once for an empty space (no folders, no assets)', async () => {
      const spaceDir = makeSpaceDir();
      const importer = new ImportAssets(apiConfig, importContext);
      const result = await importer.start('new-space-uid', spaceDir);

      expect(result.uidMap).to.deep.equal({});
      expect(result.urlMap).to.deep.equal({});
      expect(tickStub.callCount).to.equal(1);
      expect(tickStub.firstCall.args[0]).to.equal(true);
    });

    it('creates root-level folders and maps their uids', async () => {
      const spaceDir = makeSpaceDir();
      const folders = [{ uid: 'folder-old', title: 'My Folder' }];
      fsReal.writeFileSync(
        path.join(spaceDir, 'assets', 'folders.json'),
        JSON.stringify({ folders }),
      );
      stubAssetChunks([]);
      sinon.stub(FsUtility.prototype, 'indexFileContent' as any).get(() => ({}));
      const createFolderStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createFolder' as any)
        .resolves({ folder: { uid: 'folder-new' } });

      const importer = new ImportAssets(apiConfig, importContext);
      await importer.start('space-uid', spaceDir);

      expect(createFolderStub.callCount).to.equal(1);
      const createArgs = createFolderStub.firstCall.args;
      expect(createArgs[0]).to.equal('space-uid');
      expect(createArgs[1].title).to.equal('My Folder');
    });

    it('imports nested folders in multi-pass: child waits for parent to be created', async () => {
      const spaceDir = makeSpaceDir();
      const folders = [
        { uid: 'child-folder', title: 'Child', parent_uid: 'parent-folder' },
        { uid: 'parent-folder', title: 'Parent' },
      ];
      fsReal.writeFileSync(
        path.join(spaceDir, 'assets', 'folders.json'),
        JSON.stringify({ folders }),
      );
      sinon.stub(FsUtility.prototype, 'indexFileContent' as any).get(() => ({}));
      let callOrder: string[] = [];
      const createFolderStub = sinon.stub(CSAssetsImportAdapter.prototype, 'createFolder' as any)
        .callsFake(async (_spaceUid: string, payload: any) => {
          callOrder.push(payload.title);
          return { folder: { uid: `new-${payload.title.toLowerCase()}` } };
        });

      const importer = new ImportAssets(apiConfig, importContext);
      await importer.start('space-uid', spaceDir);

      expect(createFolderStub.callCount).to.equal(2);
      expect(callOrder[0]).to.equal('Parent');
      expect(callOrder[1]).to.equal('Child');
    });

    it('uploads assets: calls uploadAsset and builds uidMap and urlMap', async () => {
      const spaceDir = makeSpaceDir();
      const assetUid = 'asset-old-uid';
      const assetFilename = 'photo.png';
      fsReal.mkdirSync(path.join(spaceDir, 'assets', 'files', assetUid), { recursive: true });
      fsReal.writeFileSync(path.join(spaceDir, 'assets', 'files', assetUid, assetFilename), 'fake-content');
      fsReal.writeFileSync(path.join(spaceDir, 'assets', 'assets.json'), '{}');
      stubAssetChunks([{ uid: assetUid, url: 'https://old-cdn.com/photo.png', filename: assetFilename }]);

      const uploadStub = sinon.stub(CSAssetsImportAdapter.prototype, 'uploadAsset' as any)
        .resolves({ asset: { uid: 'asset-new-uid', url: 'https://new-cdn.com/photo.png' } });

      const importer = new ImportAssets(apiConfig, importContext);
      const result = await importer.start('space-uid', spaceDir);

      expect(uploadStub.callCount).to.equal(1);
      expect(result.uidMap[assetUid]).to.equal('asset-new-uid');
      expect(result.urlMap['https://old-cdn.com/photo.png']).to.equal('https://new-cdn.com/photo.png');
    });

    it('skips an asset and ticks false when the file is not found on disk', async () => {
      const spaceDir = makeSpaceDir();
      fsReal.writeFileSync(path.join(spaceDir, 'assets', 'assets.json'), '{}');
      stubAssetChunks([{ uid: 'missing-asset', url: 'https://cdn.com/x.png', filename: 'x.png' }]);
      const uploadStub = sinon.stub(CSAssetsImportAdapter.prototype, 'uploadAsset' as any).resolves();

      const importer = new ImportAssets(apiConfig, importContext);
      const result = await importer.start('space-uid', spaceDir);

      expect(uploadStub.callCount).to.equal(0);
      expect(result.uidMap).to.deep.equal({});
      const failTick = tickStub.getCalls().find((c) => c.args[0] === false && c.args[2]);
      expect(failTick).to.exist;
    });

    it('handles uploadAsset failure gracefully: continues, ticks false, omits from maps', async () => {
      const spaceDir = makeSpaceDir();
      const assetUid = 'asset-fail';
      const filename = 'fail.png';
      fsReal.mkdirSync(path.join(spaceDir, 'assets', 'files', assetUid), { recursive: true });
      fsReal.writeFileSync(path.join(spaceDir, 'assets', 'files', assetUid, filename), 'data');
      fsReal.writeFileSync(path.join(spaceDir, 'assets', 'assets.json'), '{}');
      stubAssetChunks([{ uid: assetUid, url: 'https://cdn.com/fail.png', filename }]);

      sinon.stub(CSAssetsImportAdapter.prototype, 'uploadAsset' as any).rejects(new Error('upload failed'));

      const importer = new ImportAssets(apiConfig, importContext);
      const result = await importer.start('space-uid', spaceDir);

      expect(result.uidMap).to.deep.equal({});
      const failTick = tickStub.getCalls().find((c) => c.args[0] === false);
      expect(failTick).to.exist;
    });

    it('maps asset parent_uid to the new folder uid when parent was imported', async () => {
      const spaceDir = makeSpaceDir();
      fsReal.writeFileSync(
        path.join(spaceDir, 'assets', 'folders.json'),
        JSON.stringify({ folders: [{ uid: 'old-folder', title: 'Folder A' }] }),
      );
      const assetUid = 'asset-in-folder';
      const filename = 'file.png';
      fsReal.mkdirSync(path.join(spaceDir, 'assets', 'files', assetUid), { recursive: true });
      fsReal.writeFileSync(path.join(spaceDir, 'assets', 'files', assetUid, filename), 'data');
      fsReal.writeFileSync(path.join(spaceDir, 'assets', 'assets.json'), '{}');
      stubAssetChunks([{ uid: assetUid, parent_uid: 'old-folder', filename }]);

      sinon.stub(CSAssetsImportAdapter.prototype, 'createFolder' as any)
        .resolves({ folder: { uid: 'new-folder-uid' } });
      const uploadStub = sinon.stub(CSAssetsImportAdapter.prototype, 'uploadAsset' as any)
        .resolves({ asset: { uid: 'new-asset-uid' } });

      const importer = new ImportAssets(apiConfig, importContext);
      await importer.start('space-uid', spaceDir);

      const uploadArgs = uploadStub.firstCall.args;
      expect(uploadArgs[2].parent_uid).to.equal('new-folder-uid');
    });
  });
});
