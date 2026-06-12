import { expect } from 'chai';
import sinon from 'sinon';
import { CLIProgressManager, configHandler } from '@contentstack/cli-utilities';

import { ImportSpaces } from '../../../src/import/spaces';
import ImportWorkspace from '../../../src/import/workspaces';
import ImportFields from '../../../src/import/fields';
import ImportAssetTypes from '../../../src/import/asset-types';
import { CSAssetsAdapter } from '../../../src/utils/cs-assets-api-adapter';
import { CSAssetsImportAdapter } from '../../../src/import/base';
import { PROCESS_NAMES } from '../../../src/constants/index';

import type { ImportSpacesOptions } from '../../../src/types/cs-assets-api';

describe('ImportSpaces', () => {
  const baseOptions: ImportSpacesOptions = {
    contentDir: '/tmp/import',
    csAssetsUrl: 'https://am.example.com',
    org_uid: 'org-1',
    apiKey: 'api-key-1',
    host: 'https://api.contentstack.io/v3',
  };

  const fakeProgress = {
    addProcess: sinon.stub().returnsThis(),
    startProcess: sinon.stub().returnsThis(),
    updateStatus: sinon.stub().returnsThis(),
    tick: sinon.stub(),
    completeProcess: sinon.stub(),
  };

  beforeEach(() => {
    sinon.stub(configHandler, 'get').callsFake((key: string) => {
      if (key === 'log') return { showConsoleLogs: false };
      return undefined;
    });
    sinon.stub(CLIProgressManager, 'createNested').returns(fakeProgress as any);
    // init and listSpaces live on AssetManagementAdapter (the common base).
    // Stubbing the base once covers both the adapter used for listSpaces and ImportWorkspace.
    sinon.stub(CSAssetsAdapter.prototype, 'init' as any).resolves();
    sinon.stub(CSAssetsAdapter.prototype, 'listSpaces' as any).resolves({ spaces: [] });
    sinon.stub(ImportFields.prototype, 'start').resolves();
    sinon.stub(ImportFields.prototype, 'setParentProgressManager');
    sinon.stub(ImportAssetTypes.prototype, 'start').resolves();
    sinon.stub(ImportAssetTypes.prototype, 'setParentProgressManager');
    sinon.stub(ImportWorkspace.prototype, 'setParentProgressManager');

    fakeProgress.addProcess.resetHistory();
    fakeProgress.addProcess.returnsThis();
    fakeProgress.startProcess.resetHistory();
    fakeProgress.startProcess.returnsThis();
    fakeProgress.completeProcess.reset();
    fakeProgress.tick.reset();
  });

  afterEach(() => {
    sinon.restore();
  });

  const stubSpaceDirs = (dirs: string[]) => {
    const fsMock = require('node:fs');
    sinon.stub(fsMock, 'readdirSync').returns(dirs as any);
    sinon.stub(fsMock, 'statSync').returns({ isDirectory: () => true } as any);
  };

  describe('targetDefaultSpaceUid threading', () => {
    it('should pass targetDefaultSpaceUid and targetDefaultWorkspaceUid to ImportWorkspace.start()', async () => {
      stubSpaceDirs(['am-space-1']);
      const startStub = sinon.stub(ImportWorkspace.prototype, 'start').resolves({
        oldSpaceUid: 'am-space-1',
        newSpaceUid: 'target-space-3',
        workspaceUid: 'ws-3',
        isDefault: true,
        uidMap: {},
        urlMap: {},
      });

      const options: ImportSpacesOptions = {
        ...baseOptions,
        targetDefaultSpaceUid: 'target-space-3',
        targetDefaultWorkspaceUid: 'ws-3',
      };
      const importer = new ImportSpaces(options);
      await importer.start();

      expect(startStub.callCount).to.equal(1);
      const args = startStub.firstCall.args;
      expect(args[4]).to.equal('target-space-3');
      expect(args[5]).to.equal('ws-3');
    });

    it('should pass undefined to ImportWorkspace when targetDefaultSpaceUid is not set', async () => {
      stubSpaceDirs(['am-space-1']);
      const startStub = sinon.stub(ImportWorkspace.prototype, 'start').resolves({
        oldSpaceUid: 'am-space-1',
        newSpaceUid: 'new-space',
        workspaceUid: 'main',
        isDefault: false,
        uidMap: {},
        urlMap: {},
      });

      const importer = new ImportSpaces(baseOptions);
      await importer.start();

      expect(startStub.callCount).to.equal(1);
      expect(startStub.firstCall.args[4]).to.be.undefined;
      expect(startStub.firstCall.args[5]).to.be.undefined;
    });

    it('should record the correct spaceUidMap entry when default space is remapped', async () => {
      stubSpaceDirs(['am-space-1']);
      sinon.stub(ImportWorkspace.prototype, 'start').resolves({
        oldSpaceUid: 'am-space-1',
        newSpaceUid: 'target-space-3',
        workspaceUid: 'ws-3',
        isDefault: true,
        uidMap: {},
        urlMap: {},
      });

      const options: ImportSpacesOptions = {
        ...baseOptions,
        targetDefaultSpaceUid: 'target-space-3',
      };
      const importer = new ImportSpaces(options);
      const result = await importer.start();

      expect(result.spaceUidMap['am-space-1']).to.equal('target-space-3');
      expect(result.spaceMappings[0].newSpaceUid).to.equal('target-space-3');
      expect(result.spaceMappings[0].isDefault).to.equal(true);
    });

    it('should process non-default spaces normally alongside the remapped default space', async () => {
      stubSpaceDirs(['am-space-1', 'am-space-2']);
      const startStub = sinon.stub(ImportWorkspace.prototype, 'start');
      startStub.onFirstCall().resolves({
        oldSpaceUid: 'am-space-1',
        newSpaceUid: 'target-space-3',
        workspaceUid: 'ws-3',
        isDefault: true,
        uidMap: {},
        urlMap: {},
      });
      startStub.onSecondCall().resolves({
        oldSpaceUid: 'am-space-2',
        newSpaceUid: 'brand-new-space',
        workspaceUid: 'main',
        isDefault: false,
        uidMap: {},
        urlMap: {},
      });

      const options: ImportSpacesOptions = {
        ...baseOptions,
        targetDefaultSpaceUid: 'target-space-3',
        targetDefaultWorkspaceUid: 'ws-3',
      };
      const importer = new ImportSpaces(options);
      const result = await importer.start();

      expect(result.spaceMappings).to.have.lengthOf(2);
      expect(result.spaceUidMap['am-space-1']).to.equal('target-space-3');
      expect(result.spaceUidMap['am-space-2']).to.equal('brand-new-space');
    });
  });

  describe('no spaces scenario', () => {
    it('should return empty maps when spaces directory has no am* dirs', async () => {
      stubSpaceDirs([]);

      const importer = new ImportSpaces(baseOptions);
      const result = await importer.start();

      expect(result.spaceMappings).to.deep.equal([]);
      expect(result.spaceUidMap).to.deep.equal({});
    });
  });

  describe('bootstrap failure', () => {
    it('should mark all space rows as failed and re-throw when ImportFields throws', async () => {
      stubSpaceDirs(['am-space-1']);
      sinon.stub(ImportWorkspace.prototype, 'start').resolves({
        oldSpaceUid: 'am-space-1', newSpaceUid: 'new-space', workspaceUid: 'main',
        isDefault: false, uidMap: {}, urlMap: {},
      });
      (ImportFields.prototype.start as sinon.SinonStub).rejects(new Error('fields-bootstrap-error'));

      const importer = new ImportSpaces(baseOptions);
      try {
        await importer.start();
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('fields-bootstrap-error');
      }

      const completeCalls = fakeProgress.completeProcess.getCalls().map((c) => c.args);
      expect(completeCalls).to.deep.include([PROCESS_NAMES.AM_IMPORT_FIELDS, false]);
    });

    it('should mark all space rows as failed and re-throw when ImportAssetTypes throws', async () => {
      stubSpaceDirs(['am-space-1']);
      (ImportAssetTypes.prototype.start as sinon.SinonStub).rejects(new Error('at-bootstrap-error'));

      const importer = new ImportSpaces(baseOptions);
      try {
        await importer.start();
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('at-bootstrap-error');
      }

      const completeCalls = fakeProgress.completeProcess.getCalls().map((c) => c.args);
      expect(completeCalls).to.deep.include([PROCESS_NAMES.AM_IMPORT_ASSET_TYPES, false]);
    });
  });

  describe('per-space failure resilience', () => {
    it('should continue importing remaining spaces when one space fails', async () => {
      stubSpaceDirs(['am-space-1', 'am-space-2']);
      const startStub = sinon.stub(ImportWorkspace.prototype, 'start');
      startStub.onFirstCall().rejects(new Error('space-1-error'));
      startStub.onSecondCall().resolves({
        oldSpaceUid: 'am-space-2', newSpaceUid: 'new-space-2', workspaceUid: 'main',
        isDefault: false, uidMap: {}, urlMap: {},
      });

      const importer = new ImportSpaces(baseOptions);
      const result = await importer.start();

      expect(startStub.callCount).to.equal(2);
      expect(result.spaceMappings).to.have.lengthOf(1);
      expect(result.spaceMappings[0].oldSpaceUid).to.equal('am-space-2');
    });
  });

  describe('backupDir mapper file writing', () => {
    it('should write uid, url, and space-uid mapping files when backupDir is set', async () => {
      const os = require('node:os');
      const path = require('node:path');
      const fsReal = require('node:fs');
      const tmpDir = path.join(os.tmpdir(), `import-spaces-backup-${Date.now()}`);
      fsReal.mkdirSync(tmpDir, { recursive: true });

      stubSpaceDirs(['am-space-1']);
      sinon.stub(ImportWorkspace.prototype, 'start').resolves({
        oldSpaceUid: 'am-space-1', newSpaceUid: 'new-space-1', workspaceUid: 'main',
        isDefault: false,
        uidMap: { 'old-uid': 'new-uid' },
        urlMap: { 'old-url': 'new-url' },
      });

      const options: ImportSpacesOptions = { ...baseOptions, backupDir: tmpDir };
      const importer = new ImportSpaces(options);
      await importer.start();

      const mapperDir = path.join(tmpDir, 'mapper', 'assets');
      expect(fsReal.existsSync(path.join(mapperDir, 'uid-mapping.json'))).to.be.true;
      expect(fsReal.existsSync(path.join(mapperDir, 'url-mapping.json'))).to.be.true;
      expect(fsReal.existsSync(path.join(mapperDir, 'space-uid-mapping.json'))).to.be.true;

      const uidMap = JSON.parse(fsReal.readFileSync(path.join(mapperDir, 'uid-mapping.json'), 'utf8'));
      expect(uidMap).to.deep.equal({ 'old-uid': 'new-uid' });
    });
  });

  describe('listSpaces error handling and uid filtering', () => {
    it('should pass existing org space uids to ImportWorkspace when listSpaces returns spaces', async () => {
      (CSAssetsAdapter.prototype.listSpaces as sinon.SinonStub).resolves({ spaces: [{ uid: 'org-space-uid' }] });
      stubSpaceDirs(['am-space-1']);
      const startStub = sinon.stub(ImportWorkspace.prototype, 'start').resolves({
        oldSpaceUid: 'am-space-1', newSpaceUid: 'new-space', workspaceUid: 'main',
        isDefault: false, uidMap: {}, urlMap: {},
      });

      const importer = new ImportSpaces(baseOptions);
      await importer.start();

      expect(startStub.callCount).to.equal(1);
      const existingSpaceUids: Set<string> = startStub.firstCall.args[2];
      expect(existingSpaceUids.has('org-space-uid')).to.be.true;
    });

    it('should continue (disable reuse-by-uid) when listSpaces throws', async () => {
      (CSAssetsAdapter.prototype.listSpaces as sinon.SinonStub).rejects(new Error('network error'));
      stubSpaceDirs(['am-space-1']);
      sinon.stub(ImportWorkspace.prototype, 'start').resolves({
        oldSpaceUid: 'am-space-1', newSpaceUid: 'new-uid', workspaceUid: 'main',
        isDefault: false, uidMap: {}, urlMap: {},
      });

      const importer = new ImportSpaces(baseOptions);
      const result = await importer.start();

      expect(result.spaceMappings).to.have.lengthOf(1);
    });

    it('should return false for a directory entry when statSync throws', async () => {
      const fsMock = require('node:fs');
      const pResolve = require('node:path').resolve;
      const join = require('node:path').join;
      const spacesRoot = pResolve('/tmp/import', 'spaces');
      const origStatSync = fsMock.statSync.bind(fsMock);
      sinon.stub(fsMock, 'readdirSync').returns(['am-bad-entry'] as any);
      sinon.stub(fsMock, 'statSync').callsFake((p: string) => {
        if (p === join(spacesRoot, 'am-bad-entry')) throw new Error('permission denied');
        return origStatSync(p);
      });

      const importer = new ImportSpaces(baseOptions);
      const result = await importer.start();

      expect(result.spaceMappings).to.deep.equal([]);
    });

    it('should log warning and return empty dirs when readdirSync throws', async () => {
      const fsMock = require('node:fs');
      const pResolve = require('node:path').resolve;
      const spacesRoot = pResolve('/tmp/import', 'spaces');
      const origReaddir = fsMock.readdirSync.bind(fsMock);
      sinon.stub(fsMock, 'readdirSync').callsFake((p: string) => {
        if (p === spacesRoot) throw new Error('ENOENT: no such file or directory');
        return origReaddir(p);
      });
      sinon.stub(fsMock, 'statSync').returns({ isDirectory: () => true } as any);

      const importer = new ImportSpaces(baseOptions);
      const result = await importer.start();

      expect(result.spaceMappings).to.deep.equal([]);
    });
  });

  describe('setParentProgressManager', () => {
    it('should use parent progress manager instead of creating a new CLIProgressManager', async () => {
      const fakeParent = {
        addProcess: sinon.stub().returnsThis(),
        startProcess: sinon.stub().returnsThis(),
        updateStatus: sinon.stub().returnsThis(),
        tick: sinon.stub(),
        completeProcess: sinon.stub(),
      };
      stubSpaceDirs([]);

      const importer = new ImportSpaces(baseOptions);
      importer.setParentProgressManager(fakeParent as any);
      await importer.start();

      expect((CLIProgressManager.createNested as sinon.SinonStub).callCount).to.equal(0);
      expect(fakeParent.addProcess.callCount).to.be.greaterThan(0);
    });
  });
});
