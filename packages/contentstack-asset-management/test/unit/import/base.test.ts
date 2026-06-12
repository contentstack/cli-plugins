import { expect } from 'chai';
import sinon from 'sinon';
import { CLIProgressManager, configHandler } from '@contentstack/cli-utilities';

import { CSAssetsImportAdapter } from '../../../src/import/base';
import type { CSAssetsAPIConfig, ImportContext } from '../../../src/types/cs-assets-api';

class TestImportAdapter extends CSAssetsImportAdapter {
  public callCreateNestedProgress(name: string) { return this.createNestedProgress(name); }
  public callTick(success: boolean, name: string, error: string | null, processName?: string) {
    return this.tick(success, name, error, processName);
  }
  public callUpdateStatus(msg: string, processName?: string) { return this.updateStatus(msg, processName); }
  public callCompleteProcess(name: string, success: boolean) { return this.completeProcess(name, success); }
  public get progressOrParentPublic() { return this.progressOrParent; }
  public get spacesRootPathPublic() { return this.spacesRootPath; }
  public get apiConcurrencyPublic() { return this.apiConcurrency; }
  public get uploadBatchPublic() { return this.uploadAssetsBatchConcurrency; }
  public get foldersBatchPublic() { return this.importFoldersBatchConcurrency; }
  public getAssetTypesDirPublic() { return this.getAssetTypesDir(); }
  public getFieldsDirPublic() { return this.getFieldsDir(); }
}

describe('CSAssetsImportAdapter (base)', () => {
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

  beforeEach(() => {
    sinon.stub(CSAssetsImportAdapter.prototype, 'init' as any).resolves();
  });
  afterEach(() => sinon.restore());

  describe('setParentProgressManager / progressOrParent', () => {
    it('returns null when no progress manager is set', () => {
      const adapter = new TestImportAdapter(apiConfig, importContext);
      expect(adapter.progressOrParentPublic).to.be.null;
    });

    it('returns the parent manager after setParentProgressManager', () => {
      const fakeParent = { tick: sinon.stub() } as any;
      const adapter = new TestImportAdapter(apiConfig, importContext);
      adapter.setParentProgressManager(fakeParent);
      expect(adapter.progressOrParentPublic).to.equal(fakeParent);
    });

    it('returns progressManager when parentProgressManager is not set', () => {
      sinon.stub(configHandler, 'get').returns({});
      const fakeProgress = { tick: sinon.stub() } as any;
      sinon.stub(CLIProgressManager, 'createNested').returns(fakeProgress);
      const adapter = new TestImportAdapter(apiConfig, importContext);
      adapter.callCreateNestedProgress('test-module');
      expect(adapter.progressOrParentPublic).to.equal(fakeProgress);
    });
  });

  describe('setProcessName', () => {
    it('overrides the processName used in tick calls', () => {
      const fakeParent = { tick: sinon.stub(), updateStatus: sinon.stub() } as any;
      const adapter = new TestImportAdapter(apiConfig, importContext);
      adapter.setParentProgressManager(fakeParent);
      adapter.setProcessName('custom-process');
      adapter.callTick(true, 'item', null);
      expect(fakeParent.tick.firstCall.args[3]).to.equal('custom-process');
    });
  });

  describe('createNestedProgress', () => {
    it('creates a CLIProgressManager when no parent is set', () => {
      sinon.stub(configHandler, 'get').returns({ showConsoleLogs: true });
      const fakeProgress = { tick: sinon.stub() } as any;
      const createNestedStub = sinon.stub(CLIProgressManager, 'createNested').returns(fakeProgress);
      const adapter = new TestImportAdapter(apiConfig, importContext);
      const result = adapter.callCreateNestedProgress('my-module');
      expect(createNestedStub.firstCall.args[0]).to.equal('my-module');
      expect(result).to.equal(fakeProgress);
    });

    it('returns parent directly when parentProgressManager is set', () => {
      const fakeParent = { tick: sinon.stub() } as any;
      const adapter = new TestImportAdapter(apiConfig, importContext);
      adapter.setParentProgressManager(fakeParent);
      const result = adapter.callCreateNestedProgress('ignored');
      expect(result).to.equal(fakeParent);
    });

    it('defaults showConsoleLogs to false when log config is missing', () => {
      sinon.stub(configHandler, 'get').returns(null);
      const fakeProgress = { tick: sinon.stub() } as any;
      const createNestedStub = sinon.stub(CLIProgressManager, 'createNested').returns(fakeProgress);
      const adapter = new TestImportAdapter(apiConfig, importContext);
      adapter.callCreateNestedProgress('test');
      expect(createNestedStub.firstCall.args[1]).to.be.false;
    });
  });

  describe('tick', () => {
    it('forwards success, itemName, error to progress manager tick', () => {
      const fakeParent = { tick: sinon.stub(), updateStatus: sinon.stub() } as any;
      const adapter = new TestImportAdapter(apiConfig, importContext);
      adapter.setParentProgressManager(fakeParent);
      adapter.callTick(true, 'my-item', 'some-error');
      expect(fakeParent.tick.firstCall.args[0]).to.equal(true);
      expect(fakeParent.tick.firstCall.args[1]).to.equal('my-item');
      expect(fakeParent.tick.firstCall.args[2]).to.equal('some-error');
    });

    it('uses explicit processName override when provided', () => {
      const fakeParent = { tick: sinon.stub(), updateStatus: sinon.stub() } as any;
      const adapter = new TestImportAdapter(apiConfig, importContext);
      adapter.setParentProgressManager(fakeParent);
      adapter.callTick(false, 'item', null, 'override-process');
      expect(fakeParent.tick.firstCall.args[3]).to.equal('override-process');
    });

    it('does not throw when progressOrParent is null', () => {
      const adapter = new TestImportAdapter(apiConfig, importContext);
      expect(() => adapter.callTick(true, 'item', null)).to.not.throw();
    });
  });

  describe('updateStatus', () => {
    it('forwards status message to progress manager', () => {
      const fakeParent = { tick: sinon.stub(), updateStatus: sinon.stub() } as any;
      const adapter = new TestImportAdapter(apiConfig, importContext);
      adapter.setParentProgressManager(fakeParent);
      adapter.callUpdateStatus('Importing...');
      expect(fakeParent.updateStatus.firstCall.args[0]).to.equal('Importing...');
    });

    it('does not throw when progressOrParent is null', () => {
      const adapter = new TestImportAdapter(apiConfig, importContext);
      expect(() => adapter.callUpdateStatus('msg')).to.not.throw();
    });
  });

  describe('completeProcess', () => {
    it('calls completeProcess on progressManager when no parent is set', () => {
      sinon.stub(configHandler, 'get').returns({});
      const fakeProgress = { tick: sinon.stub(), completeProcess: sinon.stub() } as any;
      sinon.stub(CLIProgressManager, 'createNested').returns(fakeProgress);
      const adapter = new TestImportAdapter(apiConfig, importContext);
      adapter.callCreateNestedProgress('test');
      adapter.callCompleteProcess('test-process', true);
      expect(fakeProgress.completeProcess.firstCall.args).to.deep.equal(['test-process', true]);
    });

    it('does NOT call completeProcess when parentProgressManager is set', () => {
      const fakeParent = { tick: sinon.stub(), completeProcess: sinon.stub() } as any;
      const adapter = new TestImportAdapter(apiConfig, importContext);
      adapter.setParentProgressManager(fakeParent);
      adapter.callCompleteProcess('test-process', true);
      expect(fakeParent.completeProcess.callCount).to.equal(0);
    });
  });

  describe('path and concurrency getters', () => {
    it('spacesRootPath returns the value from importContext', () => {
      const adapter = new TestImportAdapter(apiConfig, importContext);
      expect(adapter.spacesRootPathPublic).to.equal('/tmp/import/spaces');
    });

    it('apiConcurrency defaults to FALLBACK_AM_API_CONCURRENCY (5) when not set', () => {
      const adapter = new TestImportAdapter(apiConfig, importContext);
      expect(adapter.apiConcurrencyPublic).to.equal(5);
    });

    it('apiConcurrency uses importContext.apiConcurrency when set', () => {
      const adapter = new TestImportAdapter(apiConfig, { ...importContext, apiConcurrency: 10 });
      expect(adapter.apiConcurrencyPublic).to.equal(10);
    });

    it('uploadAssetsBatchConcurrency falls back to apiConcurrency when uploadAssetsConcurrency not set', () => {
      const adapter = new TestImportAdapter(apiConfig, { ...importContext, apiConcurrency: 8 });
      expect(adapter.uploadBatchPublic).to.equal(8);
    });

    it('uploadAssetsBatchConcurrency uses uploadAssetsConcurrency when set', () => {
      const adapter = new TestImportAdapter(apiConfig, { ...importContext, uploadAssetsConcurrency: 3 });
      expect(adapter.uploadBatchPublic).to.equal(3);
    });

    it('importFoldersBatchConcurrency falls back to apiConcurrency when not set', () => {
      const adapter = new TestImportAdapter(apiConfig, { ...importContext, apiConcurrency: 6 });
      expect(adapter.foldersBatchPublic).to.equal(6);
    });

    it('importFoldersBatchConcurrency uses importFoldersConcurrency when set', () => {
      const adapter = new TestImportAdapter(apiConfig, { ...importContext, importFoldersConcurrency: 2 });
      expect(adapter.foldersBatchPublic).to.equal(2);
    });

    it('getAssetTypesDir defaults to spacesRootPath/asset_types', () => {
      const adapter = new TestImportAdapter(apiConfig, importContext);
      const expected = require('node:path').join('/tmp/import/spaces', 'asset_types');
      expect(adapter.getAssetTypesDirPublic()).to.equal(expected);
    });

    it('getAssetTypesDir uses custom assetTypesDir when set in importContext', () => {
      const adapter = new TestImportAdapter(apiConfig, { ...importContext, assetTypesDir: 'custom_at' });
      const expected = require('node:path').join('/tmp/import/spaces', 'custom_at');
      expect(adapter.getAssetTypesDirPublic()).to.equal(expected);
    });

    it('getFieldsDir defaults to spacesRootPath/fields', () => {
      const adapter = new TestImportAdapter(apiConfig, importContext);
      const expected = require('node:path').join('/tmp/import/spaces', 'fields');
      expect(adapter.getFieldsDirPublic()).to.equal(expected);
    });

    it('getFieldsDir uses custom fieldsDir when set in importContext', () => {
      const adapter = new TestImportAdapter(apiConfig, { ...importContext, fieldsDir: 'custom_fields' });
      const expected = require('node:path').join('/tmp/import/spaces', 'custom_fields');
      expect(adapter.getFieldsDirPublic()).to.equal(expected);
    });
  });
});
