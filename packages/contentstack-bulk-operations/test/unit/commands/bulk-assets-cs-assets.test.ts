/* eslint-disable @typescript-eslint/no-explicit-any */
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import BulkAssets from '../../../src/commands/cm/stacks/bulk-assets';

/**
 * CS Assets delete/move path of the merged cm:stacks:bulk-assets command
 * (formerly cm:stacks:bulk-am-assets).
 */
describe('BulkAssets command — CS Assets delete/move path', () => {
  let sandbox: sinon.SinonSandbox;
  let command: BulkAssets;
  let authHandler: any;

  const baseDeleteFlags = {
    operation: 'delete',
    'space-uid': 'sp123',
    'org-uid': 'org456',
    'asset-uids-file': './assets.json',
    locale: 'en-us',
    workspace: 'main',
    yes: true,
  };

  const baseMoveFlags = {
    operation: 'move',
    'space-uid': 'sp123',
    'org-uid': 'org456',
    'asset-uids-file': './assets.json',
    'target-folder-uid': 'folderABC',
    workspace: 'main',
    yes: true,
  };

  function setRegion(value: object): void {
    Object.defineProperty(command, 'region', { value, configurable: true, writable: true });
  }

  function setCsAssetsFlags(flags: object): void {
    (command as any).csAssetsMode = true;
    (command as any).csAssetsFlags = { ...flags };
    (command as any).loggerContext = { module: 'cm:stacks:bulk-assets' };
  }

  function stubAuthSuccess(): void {
    sandbox.stub(authHandler, 'getAuthDetails').resolves();
    sandbox.stub(Object.getPrototypeOf(authHandler), 'accessToken').get(() => 'test-token');
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    command = new BulkAssets([], {} as any);
    setCsAssetsFlags(baseDeleteFlags);
    setRegion({});

    authHandler = require('@contentstack/cli-utilities').authenticationHandler;
  });

  afterEach(() => {
    sandbox.restore();
    process.exitCode = undefined;
  });

  describe('AM URL validation', () => {
    it('should set exitCode=1 when AM URL is not configured in region', async () => {
      setRegion({}); // no csAssetsUrl

      await command.run();

      expect(process.exitCode).to.equal(1);
    });
  });

  describe('auth pre-flight', () => {
    it('should set exitCode=1 and skip the API when no auth token is available', async () => {
      setRegion({ csAssetsUrl: 'https://assets.example.com' });
      sandbox.stub(authHandler, 'getAuthDetails').resolves();
      sandbox.stub(Object.getPrototypeOf(authHandler), 'accessToken').get(() => '');

      const assetUidsModule = require('../../../src/utils/asset-uids-from-file');
      const loadStub = sandbox.stub(assetUidsModule, 'loadBulkDeleteItemsFromFile');
      const amServiceModule = require('../../../src/services/am-asset-service');
      const deleteStub = sandbox.stub(amServiceModule.CsAssetsService.prototype, 'bulkDelete');

      await command.run();

      expect(process.exitCode).to.equal(1);
      expect(loadStub.called).to.be.false; // fails before reading any files
      expect(deleteStub.called).to.be.false;
    });

    it('should set exitCode=1 when fetching auth details throws', async () => {
      setRegion({ csAssetsUrl: 'https://assets.example.com' });
      sandbox.stub(authHandler, 'getAuthDetails').rejects(new Error('not logged in'));

      await command.run();

      expect(process.exitCode).to.equal(1);
    });
  });

  describe('locale not allowed for move', () => {
    it('should set exitCode=1 when --locale is passed with --operation move', async () => {
      setCsAssetsFlags({ ...baseMoveFlags, locale: 'en-us' });
      setRegion({ csAssetsUrl: 'https://assets.example.com' });
      stubAuthSuccess();

      // Stub the file loader to confirm it is NOT reached
      const assetUidsModule = require('../../../src/utils/asset-uids-from-file');
      const loadStub = sandbox.stub(assetUidsModule, 'loadAssetUidsFromFile');

      await command.run();

      expect(process.exitCode).to.equal(1);
      expect(loadStub.called).to.be.false; // Should have exited before loading files
    });

    it('should NOT set exitCode when --locale is absent for move and API succeeds', async () => {
      setCsAssetsFlags({ ...baseMoveFlags });
      setRegion({ csAssetsUrl: 'https://assets.example.com' });
      stubAuthSuccess();

      const assetUidsModule = require('../../../src/utils/asset-uids-from-file');
      sandbox.stub(assetUidsModule, 'loadAssetUidsFromFile').returns(['uid1', 'uid2']);

      const amServiceModule = require('../../../src/services/am-asset-service');
      sandbox.stub(amServiceModule.CsAssetsService.prototype, 'bulkMove').resolves({
        success: true,
        notice: undefined,
      });

      await command.run();

      expect(process.exitCode).to.not.equal(1);
    });
  });

  describe('delete operation', () => {
    beforeEach(() => {
      setRegion({ csAssetsUrl: 'https://assets.example.com' });
      stubAuthSuccess();
    });

    it('should NOT set exitCode on successful delete', async () => {
      const assetUidsModule = require('../../../src/utils/asset-uids-from-file');
      sandbox.stub(assetUidsModule, 'loadBulkDeleteItemsFromFile').returns([{ uid: 'u1', locale: 'en-us' }]);

      const amServiceModule = require('../../../src/services/am-asset-service');
      sandbox.stub(amServiceModule.CsAssetsService.prototype, 'bulkDelete').resolves({
        success: true,
        jobId: 'job-abc-123',
      });

      await command.run();

      expect(process.exitCode).to.not.equal(1);
    });

    it('should set exitCode=1 on failed delete', async () => {
      const assetUidsModule = require('../../../src/utils/asset-uids-from-file');
      sandbox.stub(assetUidsModule, 'loadBulkDeleteItemsFromFile').returns([{ uid: 'u1', locale: 'en-us' }]);

      const amServiceModule = require('../../../src/services/am-asset-service');
      sandbox.stub(amServiceModule.CsAssetsService.prototype, 'bulkDelete').resolves({
        success: false,
        error: 'API rate limit exceeded',
      });

      await command.run();

      expect(process.exitCode).to.equal(1);
    });

    it('on partial failure: sets exitCode=1 and writes the failed uids to a {uids:[...]} file', async () => {
      const assetUidsModule = require('../../../src/utils/asset-uids-from-file');
      sandbox.stub(assetUidsModule, 'loadBulkDeleteItemsFromFile').returns([{ uid: 'u1', locale: 'en-us' }]);

      const amServiceModule = require('../../../src/services/am-asset-service');
      // batch 0 committed, batch 1 (uids u2,u3) failed → partial success.
      sandbox.stub(amServiceModule.CsAssetsService.prototype, 'bulkDelete').resolves({
        success: false,
        jobId: 'job-ok-0',
        jobIds: ['job-ok-0'],
        batchesTotal: 2,
        batchesSucceeded: 1,
        batchesFailed: 1,
        failures: [{ batchIndex: 1, count: 2, error: 'status 422 ...', uids: ['u2', 'u3'] }],
      });

      const writeStub = sandbox.stub(require('node:fs'), 'writeFileSync');

      await command.run();

      expect(process.exitCode).to.equal(1);
      expect(writeStub.calledOnce).to.equal(true);
      const [filePath, contents] = writeStub.firstCall.args;
      expect(String(filePath)).to.match(/cs-assets-delete-failed-.*\.json$/);
      expect(JSON.parse(contents as string)).to.deep.equal({ uids: ['u2', 'u3'] });
    });
  });

  describe('CS Assets path isolation — no publish/unpublish infrastructure', () => {
    it('should not touch bulkOperationConfig, queueManager, or managementStack when running delete/move', async () => {
      setRegion({ csAssetsUrl: 'https://assets.example.com' });
      stubAuthSuccess();

      const assetUidsModule = require('../../../src/utils/asset-uids-from-file');
      sandbox.stub(assetUidsModule, 'loadBulkDeleteItemsFromFile').returns([{ uid: 'u1', locale: 'en-us' }]);
      const amServiceModule = require('../../../src/services/am-asset-service');
      sandbox.stub(amServiceModule.CsAssetsService.prototype, 'bulkDelete').resolves({ success: true, jobId: 'j1' });

      await command.run();

      // The CS Assets path must never initialize the bulk-publish pipeline.
      expect((command as any).bulkOperationConfig).to.be.undefined;
      expect((command as any).queueManager).to.be.undefined;
      expect((command as any).managementStack).to.be.undefined;
      expect((command as any).rateLimiter).to.be.undefined;
    });

    it('shouldSkipBulkPipeline() should reflect csAssetsMode', () => {
      (command as any).csAssetsMode = true;
      expect((command as any).shouldSkipBulkPipeline()).to.be.true;
      (command as any).csAssetsMode = false;
      expect((command as any).shouldSkipBulkPipeline()).to.be.false;
    });
  });
});
