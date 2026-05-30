/* eslint-disable @typescript-eslint/no-explicit-any */
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import BulkAmAssets from '../../../src/commands/cm/stacks/bulk-am-assets';

describe('BulkAmAssets command', () => {
  let sandbox: sinon.SinonSandbox;
  let command: BulkAmAssets;

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

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    command = new BulkAmAssets([], {} as any);
    (command as any).parsedFlags = { ...baseDeleteFlags };
    (command as any).loggerContext = { module: 'cm:stacks:bulk-am-assets' };
    setRegion({});
  });

  afterEach(() => {
    sandbox.restore();
    process.exitCode = undefined;
  });

  describe('AM URL validation', () => {
    it('should set exitCode=1 when AM URL is not configured in region', async () => {
      setRegion({});  // no csAssetsUrl

      await command.run();

      expect(process.exitCode).to.equal(1);
    });
  });

  describe('locale not allowed for move', () => {
    it('should set exitCode=1 when --locale is passed with --operation move', async () => {
      (command as any).parsedFlags = { ...baseMoveFlags, locale: 'en-us' };
      setRegion({ csAssetsUrl: 'https://assets.example.com' });

      // Stub the file loader to confirm it is NOT reached
      const assetUidsModule = require('../../../src/utils/asset-uids-from-file');
      const loadStub = sandbox.stub(assetUidsModule, 'loadAssetUidsFromFile');

      await command.run();

      expect(process.exitCode).to.equal(1);
      expect(loadStub.called).to.be.false;  // Should have exited before loading files
    });

    it('should NOT set exitCode when --locale is absent for move and API succeeds', async () => {
      (command as any).parsedFlags = { ...baseMoveFlags };
      setRegion({ csAssetsUrl: 'https://assets.example.com' });

      const assetUidsModule = require('../../../src/utils/asset-uids-from-file');
      sandbox.stub(assetUidsModule, 'loadAssetUidsFromFile').returns(['uid1', 'uid2']);

      const amServiceModule = require('../../../src/services/am-asset-service');
      sandbox.stub(amServiceModule.AmAssetService.prototype, 'bulkMove').resolves({
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
    });

    it('should NOT set exitCode on successful delete', async () => {
      const assetUidsModule = require('../../../src/utils/asset-uids-from-file');
      sandbox.stub(assetUidsModule, 'loadBulkDeleteItemsFromFile').returns([{ uid: 'u1', locale: 'en-us' }]);

      const amServiceModule = require('../../../src/services/am-asset-service');
      sandbox.stub(amServiceModule.AmAssetService.prototype, 'bulkDelete').resolves({
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
      sandbox.stub(amServiceModule.AmAssetService.prototype, 'bulkDelete').resolves({
        success: false,
        error: 'API rate limit exceeded',
      });

      await command.run();

      expect(process.exitCode).to.equal(1);
    });
  });

  describe('BaseAmCommand isolation — no publish/unpublish infrastructure', () => {
    it('should not have bulkOperationConfig, queueManager, or managementStack on the instance', () => {
      // BulkAmAssets extends BaseAmCommand, NOT BaseBulkCommand.
      // None of these publish/unpublish properties should exist.
      expect((command as any).bulkOperationConfig).to.be.undefined;
      expect((command as any).queueManager).to.be.undefined;
      expect((command as any).managementStack).to.be.undefined;
      expect((command as any).rateLimiter).to.be.undefined;
    });
  });
});
