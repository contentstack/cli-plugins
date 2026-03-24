import { expect } from 'chai';
import sinon from 'sinon';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { IncrementalStateManager } from '../../../src/utils/incremental-state';

describe('IncrementalStateManager', () => {
  let stateManager: IncrementalStateManager;
  let existsSyncStub: sinon.SinonStub;
  let readFileSyncStub: sinon.SinonStub;
  let writeFileSyncStub: sinon.SinonStub;

  beforeEach(() => {
    existsSyncStub = sinon.stub().returns(false);
    readFileSyncStub = sinon.stub();
    writeFileSyncStub = sinon.stub();

    // Mock fs functions
    sinon.stub(require('node:fs'), 'existsSync').callsFake(existsSyncStub);
    sinon.stub(require('node:fs'), 'readFileSync').callsFake(readFileSyncStub);
    sinon.stub(require('node:fs'), 'writeFileSync').callsFake(writeFileSyncStub);

    stateManager = new IncrementalStateManager({
      stateFilePath: '/test/path/.import-state.json',
      batchSize: 5,
      enableBackup: true,
      context: { test: true }
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('should initialize with empty state when no file exists', () => {
      const counts = stateManager.getMappingCount();
      expect(counts.assets).to.equal(0);
      expect(counts.folders).to.equal(0);
      expect(counts.urls).to.equal(0);
    });

    it('should load existing state when file exists', () => {
      existsSyncStub.returns(true);
      readFileSyncStub.returns(JSON.stringify({
        assets: { 'asset1': 'new-asset1' },
        folders: { 'folder1': 'new-folder1' },
        urls: { 'url1': 'new-url1' }
      }));

      const newStateManager = new IncrementalStateManager({
        stateFilePath: '/test/path/.import-state.json',
        batchSize: 5,
        enableBackup: true,
        context: { test: true }
      });

      const counts = newStateManager.getMappingCount();
      expect(counts.assets).to.equal(1);
      expect(counts.folders).to.equal(1);
      expect(counts.urls).to.equal(1);
    });

    it('should create default state manager', () => {
      const defaultManager = IncrementalStateManager.createDefault('/test/dir');
      expect(defaultManager).to.be.instanceOf(IncrementalStateManager);
    });

    it('should create state manager for large datasets', () => {
      const largeDatasetManager = IncrementalStateManager.createForLargeDataset('/test/dir');
      expect(largeDatasetManager).to.be.instanceOf(IncrementalStateManager);
    });
  });

  describe('addMapping', () => {
    it('should add asset mapping', () => {
      stateManager.addMapping('asset1', 'new-asset1', 'asset');
      
      expect(stateManager.getMapping('asset1', 'asset')).to.equal('new-asset1');
      expect(stateManager.hasMapping('asset1', 'asset')).to.be.true;
    });

    it('should add folder mapping', () => {
      stateManager.addMapping('folder1', 'new-folder1', 'folder');
      
      expect(stateManager.getMapping('folder1', 'folder')).to.equal('new-folder1');
      expect(stateManager.hasMapping('folder1', 'folder')).to.be.true;
    });

    it('should trigger persistence when batch size is reached', () => {
      // Add mappings up to batch size (5)
      for (let i = 1; i <= 5; i++) {
        stateManager.addMapping(`asset${i}`, `new-asset${i}`, 'asset');
      }

      // Should have triggered persistence
      expect(writeFileSyncStub.called).to.be.true;
    });
  });

  describe('getAllMappings', () => {
    beforeEach(() => {
      stateManager.addMapping('asset1', 'new-asset1', 'asset');
      stateManager.addMapping('asset2', 'new-asset2', 'asset');
      stateManager.addMapping('folder1', 'new-folder1', 'folder');
    });

    it('should return all asset mappings', () => {
      const assetMappings = stateManager.getAllMappings('asset');
      expect(assetMappings).to.deep.equal({
        'asset1': 'new-asset1',
        'asset2': 'new-asset2'
      });
    });

    it('should return all folder mappings', () => {
      const folderMappings = stateManager.getAllMappings('folder');
      expect(folderMappings).to.deep.equal({
        'folder1': 'new-folder1'
      });
    });
  });

  describe('persistState', () => {
    it('should write state to file', () => {
      stateManager.addMapping('asset1', 'new-asset1', 'asset');
      stateManager.persistState();

      expect(writeFileSyncStub.called).to.be.true;
      
      const writeCall = writeFileSyncStub.getCall(0);
      expect(writeCall.args[0]).to.equal('/test/path/.import-state.json');
      
      const writtenData = JSON.parse(writeCall.args[1]);
      expect(writtenData.assets).to.deep.equal({ 'asset1': 'new-asset1' });
    });

    it('should create backup when enabled and file exists', () => {
      existsSyncStub.returns(true);
      readFileSyncStub.returns('existing content');
      
      stateManager.addMapping('asset1', 'new-asset1', 'asset');
      stateManager.persistState();

      // Should have written backup file
      expect(writeFileSyncStub.calledTwice).to.be.true;
      const backupCall = writeFileSyncStub.getCall(0);
      expect(backupCall.args[0]).to.equal('/test/path/.import-state.json.backup');
      expect(backupCall.args[1]).to.equal('existing content');
    });
  });

  describe('flushState', () => {
    it('should force immediate persistence', async () => {
      stateManager.addMapping('asset1', 'new-asset1', 'asset');
      
      await stateManager.flushState();
      
      expect(writeFileSyncStub.called).to.be.true;
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      stateManager.addMapping('asset1', 'new-asset1', 'asset');
      stateManager.addMapping('folder1', 'new-folder1', 'folder');
    });

    it('should return correct statistics', () => {
      const stats = stateManager.getStats();
      
      expect(stats.mappingCounts.assets).to.equal(1);
      expect(stats.mappingCounts.folders).to.equal(1);
      expect(stats.pendingWrites).to.equal(2);
      expect(stats.stateFileExists).to.be.false;
    });
  });
});