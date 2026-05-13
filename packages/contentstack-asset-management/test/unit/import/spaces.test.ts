import { expect } from 'chai';
import sinon from 'sinon';
import { CLIProgressManager, configHandler } from '@contentstack/cli-utilities';

import { ImportSpaces } from '../../../src/import/spaces';
import ImportWorkspace from '../../../src/import/workspaces';
import ImportFields from '../../../src/import/fields';
import ImportAssetTypes from '../../../src/import/asset-types';
import { AssetManagementAdapter } from '../../../src/utils/asset-management-api-adapter';
import { AssetManagementImportAdapter } from '../../../src/import/base';
import { PROCESS_NAMES } from '../../../src/constants/index';

import type { ImportSpacesOptions } from '../../../src/types/asset-management-api';

describe('ImportSpaces', () => {
  const baseOptions: ImportSpacesOptions = {
    contentDir: '/tmp/import',
    assetManagementUrl: 'https://am.example.com',
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
    sinon.stub(configHandler, 'get').returns({ showConsoleLogs: false });
    sinon.stub(CLIProgressManager, 'createNested').returns(fakeProgress as any);
    // init and listSpaces live on AssetManagementAdapter (the common base).
    // Stubbing the base once covers both the adapter used for listSpaces and ImportWorkspace.
    sinon.stub(AssetManagementAdapter.prototype, 'init' as any).resolves();
    sinon.stub(AssetManagementAdapter.prototype, 'listSpaces' as any).resolves({ spaces: [] });
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
      const startStub = sinon
        .stub(ImportWorkspace.prototype, 'start')
        .resolves({ oldSpaceUid: 'am-space-1', newSpaceUid: 'target-space-3', workspaceUid: 'ws-3', isDefault: true, uidMap: {}, urlMap: {} });

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
      const startStub = sinon
        .stub(ImportWorkspace.prototype, 'start')
        .resolves({ oldSpaceUid: 'am-space-1', newSpaceUid: 'new-space', workspaceUid: 'main', isDefault: false, uidMap: {}, urlMap: {} });

      const importer = new ImportSpaces(baseOptions);
      await importer.start();

      expect(startStub.callCount).to.equal(1);
      expect(startStub.firstCall.args[4]).to.be.undefined;
      expect(startStub.firstCall.args[5]).to.be.undefined;
    });

    it('should record the correct spaceUidMap entry when default space is remapped', async () => {
      stubSpaceDirs(['am-space-1']);
      sinon
        .stub(ImportWorkspace.prototype, 'start')
        .resolves({ oldSpaceUid: 'am-space-1', newSpaceUid: 'target-space-3', workspaceUid: 'ws-3', isDefault: true, uidMap: {}, urlMap: {} });

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
        oldSpaceUid: 'am-space-1', newSpaceUid: 'target-space-3', workspaceUid: 'ws-3', isDefault: true, uidMap: {}, urlMap: {},
      });
      startStub.onSecondCall().resolves({
        oldSpaceUid: 'am-space-2', newSpaceUid: 'brand-new-space', workspaceUid: 'main', isDefault: false, uidMap: {}, urlMap: {},
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
});
