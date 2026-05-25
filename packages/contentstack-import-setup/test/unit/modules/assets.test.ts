import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { stub, restore, SinonStub } from 'sinon';
import * as amPkg from '@contentstack/cli-asset-management';
import AssetImportSetup from '../../../src/import/modules/assets';
import * as loggerModule from '../../../src/utils/logger';
import * as fsUtilModule from '../../../src/utils/file-helper';
import { ImportConfig } from '../../../src/types';
import { sanitizePath } from '@contentstack/cli-utilities';
import defaultConfig from '../../../src/config';

describe('AssetImportSetup', () => {
  let assetSetup: AssetImportSetup;
  let mockStackAPIClient: any;
  let logStub: SinonStub;
  let makeDirStub: SinonStub;
  let writeFileStub: SinonStub;

  const baseConfig: Partial<ImportConfig> = {
    contentDir: '/path/to/content',
    data: '/path/to/content',
    apiKey: 'test-api-key',
    forceStopMarketplaceAppsPrompt: false,
    master_locale: { code: 'en-us' },
    masterLocale: { code: 'en-us' },
    branchName: '',
    selectedModules: ['assets'],
    backupDir: '/path/to/backup',
    region: 'us',
    fetchConcurrency: 2,
    writeConcurrency: 1,
    modules: {
      ...defaultConfig.modules,
      assets: {
        fetchConcurrency: 2,
        dirName: 'assets',
        fileName: 'assets',
      },
    } as any,
  };

  beforeEach(() => {
    restore();

    mockStackAPIClient = {
      asset: stub().returns({
        query: stub().returnsThis(),
        find: stub().resolves({ items: [] }),
      }),
    };

    logStub = stub(loggerModule, 'log');
    makeDirStub = stub(fsUtilModule, 'makeDirectory');
    writeFileStub = stub(fsUtilModule, 'writeFile');

    assetSetup = new AssetImportSetup({
      config: baseConfig as ImportConfig,
      stackAPIClient: mockStackAPIClient,
      dependencies: {} as any,
    });
  });

  afterEach(() => {
    restore();
  });

  it('should initialize with the correct paths', () => {
    expect((assetSetup as any).assetsFolderPath).to.equal(path.join(sanitizePath('/path/to/content'), 'assets'));
    expect((assetSetup as any).assetsFilePath).to.equal(
      path.join(sanitizePath('/path/to/content'), 'assets', 'assets.json'),
    );
    expect((assetSetup as any).mapperDirPath).to.equal(path.join(sanitizePath('/path/to/backup'), 'mapper', 'assets'));
  });

  //   it('should create mapper directory during start', async () => {
  //     // Stub fetchAndMapAssets to avoid actual implementation
  //     const fetchAndMapStub = stub(assetSetup as any, 'fetchAndMapAssets').resolves();

  //     await assetSetup.start();

  //     expect(makeDirStub.calledOnce).to.be.true;
  //     expect(makeDirStub.firstCall.args[0]).to.equal((assetSetup as any).mapperDirPath);
  //     expect(fetchAndMapStub.calledOnce).to.be.true;
  //   });

  it('should log success message after setup', async () => {
    // Stub withLoadingSpinner to return a non-zero indexerCount to avoid early return
    stub(assetSetup as any, 'withLoadingSpinner').resolves(1);
    // Stub fetchAndMapAssets to avoid actual implementation
    stub(assetSetup as any, 'fetchAndMapAssets').resolves();
    // Stub createNestedProgress and completeProgress to avoid progress manager issues
    stub(assetSetup as any, 'createNestedProgress').returns({
      addProcess: stub().returnsThis(),
      startProcess: stub().returnsThis(),
      updateStatus: stub().returnsThis(),
      completeProcess: stub().returnsThis(),
    });
    stub(assetSetup as any, 'completeProgress');

    await assetSetup.start();

    expect(logStub.called).to.be.true;
    const successCall = logStub.getCalls().find((call) => call.args[1]?.includes('successfully'));
    expect(successCall).to.exist;
    expect(successCall?.args[2]).to.equal('success');
  });

  it('should handle errors during start process', async () => {
    const testError = new Error('Test error');
    stub(assetSetup as any, 'fetchAndMapAssets').rejects(testError);

    await assetSetup.start();

    expect(logStub.calledOnce).to.be.true;
    expect(logStub.firstCall.args[1]).to.include('Error occurred');
    expect(logStub.firstCall.args[2]).to.equal('error');
  });

  //   it('should write mapper files when assets are found', async () => {
  //     // Set up the asset mappers with test data
  //     (assetSetup as any).assetUidMapper = { 'old-uid': 'new-uid' };
  //     (assetSetup as any).assetUrlMapper = { 'old-url': 'new-url' };

  //     // Call the method directly
  //     await (assetSetup as any).fetchAndMapAssets();

  //     // Check that writeFile was called twice (once for each mapper)
  //     expect(writeFileStub.calledTwice).to.be.true;
  //   });

  //   it('should write duplicate assets file when duplicates are found', async () => {
  //     // Set up the duplicate assets with test data
  //     (assetSetup as any).duplicateAssets = { 'asset-uid': [{ uid: 'dup1', title: 'Duplicate 1' }] };

  //     // Call the method directly
  //     await (assetSetup as any).fetchAndMapAssets();

  //     // Check that writeFile was called for duplicate assets
  //     expect(writeFileStub.calledWith((assetSetup as any).duplicateAssetPath)).to.be.true;
  //     // expect(logStub.calledWith(baseConfig, sinon.match.string, 'info')).to.be.true;
  //   });
});

describe('AssetImportSetup Asset Management export', () => {
  let mockStackAPIClient: any;
  let mapperStartStub: SinonStub;
  let setParentProgressStub: SinonStub;
  let amContentDir: string;
  let backupDir: string;
  let lastMapperParams: Record<string, unknown> | undefined;

  beforeEach(() => {
    restore();

    amContentDir = path.join(os.tmpdir(), `am-import-setup-${Date.now()}`);
    backupDir = path.join(os.tmpdir(), `am-import-setup-backup-${Date.now()}`);
    fs.mkdirSync(amContentDir, { recursive: true });
    fs.mkdirSync(backupDir, { recursive: true });

    mockStackAPIClient = {
      asset: stub().returns({
        query: stub().returnsThis(),
        find: stub().resolves({ items: [] }),
      }),
    };

    stub(loggerModule, 'log');
    lastMapperParams = undefined;
    setParentProgressStub = stub(amPkg.ImportSetupAssetMappers.prototype, 'setParentProgressManager');
    mapperStartStub = stub(amPkg.ImportSetupAssetMappers.prototype, 'start').callsFake(async function (this: {
      params: Record<string, unknown>;
    }) {
      lastMapperParams = this.params;
      return { kind: 'success' as const };
    });
  });

  afterEach(() => {
    restore();
    if (fs.existsSync(amContentDir)) {
      fs.rmSync(amContentDir, { recursive: true, force: true });
    }
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }
  });

  const amBaseConfig = (): ImportConfig =>
    ({
      contentDir: amContentDir,
      data: amContentDir,
      apiKey: 'test-api-key',
      forceStopMarketplaceAppsPrompt: false,
      master_locale: { code: 'en-us' },
      masterLocale: { code: 'en-us' },
      branchName: '',
      selectedModules: ['assets'],
      backupDir,
      region: {
        cma: 'https://api.contentstack.io/v3',
        assetManagementUrl: 'https://am.example.com',
      },
      host: 'https://api.contentstack.io/v3',
      fetchConcurrency: 2,
      writeConcurrency: 1,
      assetManagementEnabled: true,
      org_uid: 'org-uid-test',
      source_stack: 'source-api-key',
      context: {},
      modules: {
        ...defaultConfig.modules,
        assets: {
          fetchConcurrency: 2,
          dirName: 'assets',
          fileName: 'assets',
        },
      },
    } as unknown as ImportConfig);

  it('delegates to ImportSetupAssetMappers and completes progress on success', async () => {
    const cfg = amBaseConfig();
    const assetSetup = new AssetImportSetup({
      config: cfg,
      stackAPIClient: mockStackAPIClient,
      dependencies: {} as any,
    });

    const nested = {
      addProcess: stub().returnsThis(),
      startProcess: stub().returnsThis(),
      updateStatus: stub().returnsThis(),
      completeProcess: stub().returnsThis(),
    };
    stub(assetSetup as any, 'createNestedProgress').returns(nested);
    const completeStub = stub(assetSetup as any, 'completeProgress');

    await assetSetup.start();

    expect(mapperStartStub.calledOnce).to.be.true;
    expect(lastMapperParams).to.exist;
    const params = lastMapperParams!;
    expect(params.contentDir).to.equal(sanitizePath(amContentDir));
    expect(params.mapperBaseDir).to.equal(sanitizePath(backupDir));
    expect(params.assetManagementUrl).to.equal('https://am.example.com');
    expect(params.org_uid).to.equal('org-uid-test');
    expect(params.source_stack).to.equal('source-api-key');
    expect(params.apiKey).to.equal('test-api-key');
    expect(params.host).to.equal('https://api.contentstack.io/v3');
    expect(params.apiConcurrency).to.equal(cfg.fetchConcurrency);
    expect(setParentProgressStub.calledOnce).to.be.true;
    expect(setParentProgressStub.firstCall.args[0]).to.equal(nested);
    expect(completeStub.calledOnceWithExactly(true)).to.be.true;
  });

  it('does not run ImportSetupAssetMappers when assetManagementUrl is missing', async () => {
    const cfg = amBaseConfig();
    (cfg as any).region = { cma: 'https://api.contentstack.io/v3' };

    const assetSetup = new AssetImportSetup({
      config: cfg,
      stackAPIClient: mockStackAPIClient,
      dependencies: {} as any,
    });

    stub(assetSetup as any, 'createNestedProgress').returns({
      addProcess: stub().returnsThis(),
      startProcess: stub().returnsThis(),
      updateStatus: stub().returnsThis(),
      completeProcess: stub().returnsThis(),
    });
    const completeStub = stub(assetSetup as any, 'completeProgress');

    await assetSetup.start();

    expect(mapperStartStub.called).to.be.false;
    expect(setParentProgressStub.called).to.be.false;
    expect(completeStub.called).to.be.false;
  });

  it('calls completeProgress(false) when mapper returns error', async () => {
    mapperStartStub.resolves({ kind: 'error', errorMessage: 'mapper failed' });

    const assetSetup = new AssetImportSetup({
      config: amBaseConfig(),
      stackAPIClient: mockStackAPIClient,
      dependencies: {} as any,
    });

    stub(assetSetup as any, 'createNestedProgress').returns({
      addProcess: stub().returnsThis(),
      startProcess: stub().returnsThis(),
      updateStatus: stub().returnsThis(),
      completeProcess: stub().returnsThis(),
    });
    const completeStub = stub(assetSetup as any, 'completeProgress');

    await assetSetup.start();

    expect(setParentProgressStub.calledOnce).to.be.true;
    expect(completeStub.calledOnceWithExactly(false, 'mapper failed')).to.be.true;
  });

  it('does not run ImportSetupAssetMappers when org_uid is missing', async () => {
    const cfg = amBaseConfig();
    delete (cfg as any).org_uid;

    const assetSetup = new AssetImportSetup({
      config: cfg,
      stackAPIClient: mockStackAPIClient,
      dependencies: {} as any,
    });

    stub(assetSetup as any, 'createNestedProgress').returns({
      addProcess: stub().returnsThis(),
      startProcess: stub().returnsThis(),
      updateStatus: stub().returnsThis(),
      completeProcess: stub().returnsThis(),
    });
    const completeStub = stub(assetSetup as any, 'completeProgress');

    await assetSetup.start();

    expect(mapperStartStub.called).to.be.false;
    expect(setParentProgressStub.called).to.be.false;
    expect(completeStub.called).to.be.false;
  });
});
