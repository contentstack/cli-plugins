import { expect } from 'chai';
import sinon from 'sinon';
import { CLIProgressManager, configHandler } from '@contentstack/cli-utilities';

import { ExportSpaces, exportSpaceStructure } from '../../../src/export/spaces';
import ExportAssetTypes from '../../../src/export/asset-types';
import ExportFields from '../../../src/export/fields';
import ExportWorkspace from '../../../src/export/workspaces';
import { AssetManagementExportAdapter } from '../../../src/export/base';
import { PROCESS_NAMES, getSpaceProcessName } from '../../../src/constants/index';

import type { AssetManagementExportOptions, LinkedWorkspace } from '../../../src/types/asset-management-api';

describe('ExportSpaces', () => {
  const baseOptions: AssetManagementExportOptions = {
    linkedWorkspaces: [
      { uid: 'ws-1', space_uid: 'space-1', is_default: true },
      { uid: 'ws-2', space_uid: 'space-2', is_default: false },
    ],
    exportDir: '/tmp/export',
    branchName: 'main',
    assetManagementUrl: 'https://am.example.com',
    org_uid: 'org-1',
  };

  const fakeProgress = {
    addProcess: sinon.stub().returnsThis(),
    startProcess: sinon.stub().returnsThis(),
    updateStatus: sinon.stub().returnsThis(),
    tick: sinon.stub(),
    completeProcess: sinon.stub(),
  };

  beforeEach(() => {
    sinon.stub(AssetManagementExportAdapter.prototype, 'init' as any).resolves();
    sinon.stub(configHandler, 'get').returns({ showConsoleLogs: false });
    sinon.stub(CLIProgressManager, 'createNested').returns(fakeProgress as any);
    sinon.stub(ExportAssetTypes.prototype, 'start').resolves();
    sinon.stub(ExportAssetTypes.prototype, 'setParentProgressManager');
    sinon.stub(ExportFields.prototype, 'start').resolves();
    sinon.stub(ExportFields.prototype, 'setParentProgressManager');
    sinon.stub(ExportWorkspace.prototype, 'start').resolves();
    sinon.stub(ExportWorkspace.prototype, 'setParentProgressManager');

    fakeProgress.addProcess.resetHistory();
    fakeProgress.addProcess.returnsThis();
    fakeProgress.startProcess.resetHistory();
    fakeProgress.startProcess.returnsThis();
    fakeProgress.updateStatus.resetHistory();
    fakeProgress.updateStatus.returnsThis();
    fakeProgress.tick.reset();
    fakeProgress.completeProcess.reset();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('start method', () => {
    it('should return early without starting any export when linkedWorkspaces is empty', async () => {
      const exporter = new ExportSpaces({ ...baseOptions, linkedWorkspaces: [] });
      await exporter.start();

      expect((CLIProgressManager.createNested as sinon.SinonStub).callCount).to.equal(0);
      expect((ExportAssetTypes.prototype.start as sinon.SinonStub).callCount).to.equal(0);
      expect((ExportFields.prototype.start as sinon.SinonStub).callCount).to.equal(0);
      expect((ExportWorkspace.prototype.start as sinon.SinonStub).callCount).to.equal(0);
    });

    it('should export shared asset types and fields from the first workspace space_uid', async () => {
      const exporter = new ExportSpaces(baseOptions);
      await exporter.start();

      const atStub = ExportAssetTypes.prototype.start as sinon.SinonStub;
      expect(atStub.firstCall.args[0]).to.equal('space-1');

      const fieldsStub = ExportFields.prototype.start as sinon.SinonStub;
      expect(fieldsStub.firstCall.args[0]).to.equal('space-1');
    });

    it('should run shared asset types and fields exports in parallel', async () => {
      const atStub = ExportAssetTypes.prototype.start as sinon.SinonStub;
      const fieldsStub = ExportFields.prototype.start as sinon.SinonStub;
      let resolveAssetTypes!: () => void;
      const assetTypesGate = new Promise<void>((resolve) => {
        resolveAssetTypes = resolve;
      });
      atStub.callsFake(async () => assetTypesGate);

      const exporter = new ExportSpaces(baseOptions);
      const startPromise = exporter.start();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(atStub.calledOnce).to.be.true;
      expect(fieldsStub.calledOnce).to.be.true;

      resolveAssetTypes();
      await startPromise;
    });

    it('should iterate over all workspaces in order', async () => {
      const exporter = new ExportSpaces(baseOptions);
      await exporter.start();

      const wsStub = ExportWorkspace.prototype.start as sinon.SinonStub;
      expect(wsStub.callCount).to.equal(2);
      expect(wsStub.firstCall.args[0]).to.deep.include({ uid: 'ws-1', space_uid: 'space-1' });
      expect(wsStub.secondCall.args[0]).to.deep.include({ uid: 'ws-2', space_uid: 'space-2' });
    });

    it('should register one shared row per bootstrap phase plus one row per space, and complete each on success', async () => {
      const exporter = new ExportSpaces(baseOptions);
      await exporter.start();

      const addProcessCalls = fakeProgress.addProcess.getCalls().map((c) => c.args);
      // Shared bootstrap rows + one row per linked workspace.
      expect(addProcessCalls).to.deep.equal([
        [PROCESS_NAMES.AM_FIELDS, 1],
        [PROCESS_NAMES.AM_ASSET_TYPES, 1],
        [getSpaceProcessName('space-1'), 1],
        [getSpaceProcessName('space-2'), 1],
      ]);

      const completeArgs = fakeProgress.completeProcess.getCalls().map((c) => c.args);
      expect(completeArgs).to.deep.include.members([
        [PROCESS_NAMES.AM_FIELDS, true],
        [PROCESS_NAMES.AM_ASSET_TYPES, true],
        [getSpaceProcessName('space-1'), true],
        [getSpaceProcessName('space-2'), true],
      ]);
    });

    it('should mark only the failing space row as failed and continue with remaining spaces', async () => {
      const wsStub = ExportWorkspace.prototype.start as sinon.SinonStub;
      wsStub.onFirstCall().rejects(new Error('workspace-error'));
      wsStub.onSecondCall().resolves();

      const exporter = new ExportSpaces(baseOptions);
      // Per the plan, per-space failures must NOT abort the orchestrator —
      // they're recorded on that space's row and the next space proceeds.
      await exporter.start();

      expect(wsStub.callCount).to.equal(2);

      const completeArgs = fakeProgress.completeProcess.getCalls().map((c) => c.args);
      expect(completeArgs).to.deep.include([getSpaceProcessName('space-1'), false]);
      expect(completeArgs).to.deep.include([getSpaceProcessName('space-2'), true]);
    });

    it('should mark shared rows as failed and re-throw when shared bootstrap export errors', async () => {
      (ExportFields.prototype.start as sinon.SinonStub).rejects(new Error('shared-bootstrap-error'));

      const exporter = new ExportSpaces(baseOptions);
      try {
        await exporter.start();
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('shared-bootstrap-error');
      }

      const completeArgs = fakeProgress.completeProcess.getCalls().map((c) => c.args);
      expect(completeArgs).to.deep.include([PROCESS_NAMES.AM_FIELDS, false]);
      expect(completeArgs).to.deep.include([PROCESS_NAMES.AM_ASSET_TYPES, false]);
    });

    it('should use the provided parentProgressManager instead of creating a new one', async () => {
      const fakeParent = {
        addProcess: sinon.stub().returnsThis(),
        startProcess: sinon.stub().returnsThis(),
        updateStatus: sinon.stub().returnsThis(),
        tick: sinon.stub(),
        completeProcess: sinon.stub(),
      };

      const exporter = new ExportSpaces(baseOptions);
      exporter.setParentProgressManager(fakeParent as any);
      await exporter.start();

      expect((CLIProgressManager.createNested as sinon.SinonStub).callCount).to.equal(0);

      const addProcessCalls = fakeParent.addProcess.getCalls().map((c) => c.args);
      expect(addProcessCalls).to.deep.equal([
        [PROCESS_NAMES.AM_FIELDS, 1],
        [PROCESS_NAMES.AM_ASSET_TYPES, 1],
        [getSpaceProcessName('space-1'), 1],
        [getSpaceProcessName('space-2'), 1],
      ]);
    });
  });

  describe('exportSpaceStructure', () => {
    it('should be a thin wrapper that delegates to ExportSpaces.start', async () => {
      const startSpy = sinon.stub(ExportSpaces.prototype, 'start').resolves();
      const options: AssetManagementExportOptions = { ...baseOptions, linkedWorkspaces: [] as LinkedWorkspace[] };
      await exportSpaceStructure(options);

      expect(startSpy.callCount).to.equal(1);
    });
  });
});
