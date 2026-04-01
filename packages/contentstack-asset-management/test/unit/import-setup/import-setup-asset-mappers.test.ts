import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { stub, restore } from 'sinon';
import { AssetManagementAdapter } from '../../../src/utils/asset-management-api-adapter';
import ImportAssets from '../../../src/import/assets';
import ImportSetupAssetMappers from '../../../src/import-setup/import-setup-asset-mappers';

describe('ImportSetupAssetMappers', () => {
  const tmpRoot = () =>
    path.join(os.tmpdir(), `am-import-setup-runner-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  afterEach(() => {
    restore();
  });

  it('returns skipped when assetManagementUrl is missing', async () => {
    const contentDir = tmpRoot();
    const backupDir = tmpRoot();
    fs.mkdirSync(contentDir, { recursive: true });

    const result = await new ImportSetupAssetMappers({
      contentDir,
      mapperBaseDir: backupDir,
      org_uid: 'org-1',
      apiKey: 'k',
      host: 'https://api.example/v3',
      context: {},
    }).start();

    expect(result).to.deep.equal({ kind: 'skipped', reason: 'missing_asset_management_url' });
    fs.rmSync(contentDir, { recursive: true, force: true });
  });

  it('returns skipped when org_uid is missing', async () => {
    const contentDir = tmpRoot();
    const backupDir = tmpRoot();
    fs.mkdirSync(contentDir, { recursive: true });

    const result = await new ImportSetupAssetMappers({
      contentDir,
      mapperBaseDir: backupDir,
      assetManagementUrl: 'https://am.example.com',
      apiKey: 'k',
      host: 'https://api.example/v3',
      context: {},
    }).start();

    expect(result).to.deep.equal({ kind: 'skipped', reason: 'missing_organization_uid' });
    fs.rmSync(contentDir, { recursive: true, force: true });
  });

  it('does not require setParentProgressManager when skipped for missing URL', async () => {
    const contentDir = tmpRoot();
    const backupDir = tmpRoot();
    fs.mkdirSync(contentDir, { recursive: true });

    const mappers = new ImportSetupAssetMappers({
      contentDir,
      mapperBaseDir: backupDir,
      org_uid: 'org-1',
      apiKey: 'k',
      host: 'h',
      context: {},
    });

    const result = await mappers.start();

    expect(result.kind).to.equal('skipped');
    fs.rmSync(contentDir, { recursive: true, force: true });
  });

  it('writes mapper files when exported space exists in org', async () => {
    const contentDir = tmpRoot();
    const backupDir = tmpRoot();
    fs.mkdirSync(path.join(contentDir, 'spaces', 'amspace01'), { recursive: true });
    fs.mkdirSync(backupDir, { recursive: true });

    stub(AssetManagementAdapter.prototype, 'init').resolves();
    stub(AssetManagementAdapter.prototype, 'listSpaces').resolves({
      spaces: [{ uid: 'amspace01' }],
    });
    stub(ImportAssets.prototype, 'buildIdentityMappersFromExport').resolves({
      uidMap: { bltAsset: 'bltAsset' },
      urlMap: { 'https://cdn.example/a.png': 'https://cdn.example/a.png' },
    });

    const progress = {
      addProcess: stub().returnsThis(),
      startProcess: stub().returnsThis(),
      updateStatus: stub().returnsThis(),
      completeProcess: stub().returnsThis(),
      tick: stub(),
    };

    const mappers = new ImportSetupAssetMappers({
      contentDir,
      mapperBaseDir: backupDir,
      assetManagementUrl: 'https://am.example.com',
      org_uid: 'org-uid-test',
      source_stack: 'source-api-key',
      apiKey: 'test-api-key',
      host: 'https://api.contentstack.io/v3',
      context: {},
      fetchConcurrency: 2,
    });
    mappers.setParentProgressManager(progress as any);

    const result = await mappers.start();

    expect(result).to.deep.equal({ kind: 'success' });

    const mapperDir = path.join(backupDir, 'mapper', 'assets');
    expect(JSON.parse(fs.readFileSync(path.join(mapperDir, 'uid-mapping.json'), 'utf8'))).to.deep.equal({
      bltAsset: 'bltAsset',
    });
    expect(JSON.parse(fs.readFileSync(path.join(mapperDir, 'url-mapping.json'), 'utf8'))).to.deep.equal({
      'https://cdn.example/a.png': 'https://cdn.example/a.png',
    });
    expect(JSON.parse(fs.readFileSync(path.join(mapperDir, 'space-uid-mapping.json'), 'utf8'))).to.deep.equal({
      amspace01: 'amspace01',
    });
    expect(fs.existsSync(path.join(mapperDir, 'duplicate-assets.json'))).to.be.true;

    fs.rmSync(contentDir, { recursive: true, force: true });
    fs.rmSync(backupDir, { recursive: true, force: true });
  });

  it('skips merge when exported space is not in target org and writes empty uid map', async () => {
    const contentDir = tmpRoot();
    const backupDir = tmpRoot();
    fs.mkdirSync(path.join(contentDir, 'spaces', 'amspace01'), { recursive: true });
    fs.mkdirSync(backupDir, { recursive: true });

    stub(AssetManagementAdapter.prototype, 'init').resolves();
    stub(AssetManagementAdapter.prototype, 'listSpaces').resolves({ spaces: [] });

    const buildStub = stub(ImportAssets.prototype, 'buildIdentityMappersFromExport').resolves({
      uidMap: {},
      urlMap: {},
    });

    const mappers = new ImportSetupAssetMappers({
      contentDir,
      mapperBaseDir: backupDir,
      assetManagementUrl: 'https://am.example.com',
      org_uid: 'org-uid-test',
      apiKey: 'k',
      host: 'https://api.contentstack.io/v3',
      context: {},
    });
    mappers.setParentProgressManager({
      addProcess: stub().returnsThis(),
      startProcess: stub().returnsThis(),
      updateStatus: stub().returnsThis(),
      completeProcess: stub().returnsThis(),
      tick: stub(),
    } as any);

    const result = await mappers.start();

    expect(result.kind).to.equal('success');
    expect(buildStub.called).to.be.false;
    expect(
      JSON.parse(fs.readFileSync(path.join(backupDir, 'mapper', 'assets', 'uid-mapping.json'), 'utf8')),
    ).to.deep.equal({});

    fs.rmSync(contentDir, { recursive: true, force: true });
    fs.rmSync(backupDir, { recursive: true, force: true });
  });
});
