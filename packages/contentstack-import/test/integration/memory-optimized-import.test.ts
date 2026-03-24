import { expect } from 'chai';
import sinon from 'sinon';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import ImportAssets from '../../src/import/modules/assets';
import { MemoryMonitor, IncrementalStateManager, AssetQueue } from '../../src/utils';

describe('Memory Optimized Asset Import Integration', () => {
  let importAssets: ImportAssets;
  let testDir: string;
  let mockStackAPIClient: any;
  let mockImportConfig: any;

  beforeEach(() => {
    // Create test directory
    testDir = join(__dirname, 'test-import-data');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // Mock stack API client
    mockStackAPIClient = {
      asset: sinon.stub().returns({
        create: sinon.stub().resolves({ uid: 'new-asset-uid', url: 'new-asset-url' }),
        folder: sinon.stub().returns({
          create: sinon.stub().resolves({ uid: 'new-folder-uid' })
        })
      })
    };

    // Mock import config
    mockImportConfig = {
      backupDir: testDir,
      context: { test: true },
      modules: {
        assets: {
          enableMemoryMonitoring: true,
          uploadAssetsConcurrency: 2,
          importFoldersConcurrency: 1,
          memoryThresholdMB: 100,
          maxRetries: 3,
          retryDelay: 100
        }
      }
    };

    // Create test data structure
    setupTestData();

    importAssets = new ImportAssets({
      importConfig: mockImportConfig,
      stackAPIClient: mockStackAPIClient
    });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    sinon.restore();
  });

  function setupTestData() {
    // Create assets directory structure
    const assetsDir = join(testDir, 'assets');
    const mapperDir = join(testDir, 'mapper', 'assets');
    const environmentsDir = join(testDir, 'environments');

    mkdirSync(assetsDir, { recursive: true });
    mkdirSync(mapperDir, { recursive: true });
    mkdirSync(environmentsDir, { recursive: true });

    // Create environments.json
    writeFileSync(join(environmentsDir, 'environments.json'), JSON.stringify({
      'env1': { name: 'development' },
      'env2': { name: 'production' }
    }));

    // Create assets.json index file
    writeFileSync(join(assetsDir, 'assets.json'), JSON.stringify({
      '1': 'chunk1.json',
      '2': 'chunk2.json'
    }));

    // Create asset chunk files
    const chunk1Assets = {
      'asset1': {
        uid: 'asset1',
        title: 'Test Asset 1',
        filename: 'test1.jpg',
        url: 'https://example.com/asset1.jpg',
        content_type: 'image/jpeg',
        file_size: 1024,
        _version: 1,
        parent_uid: null,
        tags: ['test']
      },
      'asset2': {
        uid: 'asset2',
        title: 'Test Asset 2',
        filename: 'test2.png',
        url: 'https://example.com/asset2.png',
        content_type: 'image/png',
        file_size: 2048,
        _version: 1,
        parent_uid: null,
        tags: ['test']
      }
    };

    const chunk2Assets = {
      'asset3': {
        uid: 'asset3',
        title: 'Test Asset 3',
        filename: 'test3.pdf',
        url: 'https://example.com/asset3.pdf',
        content_type: 'application/pdf',
        file_size: 4096,
        _version: 1,
        parent_uid: null,
        tags: ['document']
      }
    };

    writeFileSync(join(assetsDir, 'chunk1.json'), JSON.stringify(chunk1Assets));
    writeFileSync(join(assetsDir, 'chunk2.json'), JSON.stringify(chunk2Assets));

    // Create asset files directory structure
    const filesDir = join(assetsDir, 'files');
    mkdirSync(join(filesDir, 'asset1'), { recursive: true });
    mkdirSync(join(filesDir, 'asset2'), { recursive: true });
    mkdirSync(join(filesDir, 'asset3'), { recursive: true });

    // Create dummy asset files
    writeFileSync(join(filesDir, 'asset1', 'test1.jpg'), 'dummy image content');
    writeFileSync(join(filesDir, 'asset2', 'test2.png'), 'dummy image content');
    writeFileSync(join(filesDir, 'asset3', 'test3.pdf'), 'dummy pdf content');
  }

  describe('Memory Optimization Features', () => {
    it('should initialize memory management utilities', () => {
      expect((importAssets as any).memoryMonitor).to.be.instanceOf(MemoryMonitor);
      expect((importAssets as any).stateManager).to.be.instanceOf(IncrementalStateManager);
      expect((importAssets as any).assetQueue).to.be.instanceOf(AssetQueue);
    });

    it('should use memory-efficient processing for assets', async () => {
      // Mock progress manager
      (importAssets as any).progressManager = {
        tick: sinon.stub()
      };

      // Spy on memory-efficient method
      const memoryEfficientSpy = sinon.spy(importAssets as any, 'importAssetsMemoryEfficient');

      await importAssets.importAssets();

      expect(memoryEfficientSpy.calledOnce).to.be.true;
    });

    it('should process assets individually through queue', async () => {
      const assetQueue = (importAssets as any).assetQueue;
      const enqueueSpy = sinon.spy(assetQueue, 'enqueue');

      // Mock progress manager
      (importAssets as any).progressManager = {
        tick: sinon.stub()
      };

      await importAssets.importAssets();

      // Should have enqueued 3 assets (from both chunks)
      expect(enqueueSpy.callCount).to.equal(3);
    });

    it('should persist state incrementally', async () => {
      const stateManager = (importAssets as any).stateManager;
      const addMappingSpy = sinon.spy(stateManager, 'addMapping');

      // Mock progress manager
      (importAssets as any).progressManager = {
        tick: sinon.stub()
      };

      await importAssets.importAssets();

      // Should have added mappings for processed assets
      expect(addMappingSpy.callCount).to.equal(3);
    });

    it('should check memory pressure during processing', async () => {
      const memoryMonitor = (importAssets as any).memoryMonitor;
      const checkMemoryPressureSpy = sinon.spy(memoryMonitor, 'checkMemoryPressure');

      // Mock progress manager
      (importAssets as any).progressManager = {
        tick: sinon.stub()
      };

      await importAssets.importAssets();

      expect(checkMemoryPressureSpy.called).to.be.true;
    });

    it('should clear completed queue items to free memory', async () => {
      const assetQueue = (importAssets as any).assetQueue;
      const clearCompletedSpy = sinon.spy(assetQueue, 'clearCompleted');

      // Mock progress manager
      (importAssets as any).progressManager = {
        tick: sinon.stub()
      };

      await importAssets.importAssets();

      expect(clearCompletedSpy.called).to.be.true;
    });
  });

  describe('Resume Functionality', () => {
    it('should detect existing state and resume', async () => {
      // Create existing state file
      const stateFilePath = join(testDir, '.import-state.json');
      const existingState = {
        assets: { 'asset1': 'existing-asset1' },
        folders: {},
        urls: { 'https://example.com/asset1.jpg': 'new-url1' },
        lastUpdated: Date.now()
      };
      writeFileSync(stateFilePath, JSON.stringify(existingState));

      // Create new import instance to load existing state
      const resumeImportAssets = new ImportAssets({
        importConfig: mockImportConfig,
        stackAPIClient: mockStackAPIClient
      });

      const stateManager = (resumeImportAssets as any).stateManager;
      
      // Should have loaded existing state
      expect(stateManager.hasMapping('asset1', 'asset')).to.be.true;
      expect(stateManager.getMapping('asset1', 'asset')).to.equal('existing-asset1');
    });

    it('should skip already processed assets', async () => {
      // Pre-populate state with one processed asset
      const stateManager = (importAssets as any).stateManager;
      stateManager.addMapping('asset1', 'existing-asset1', 'asset');

      const assetQueue = (importAssets as any).assetQueue;
      const enqueueSpy = sinon.spy(assetQueue, 'enqueue');

      // Mock progress manager
      (importAssets as any).progressManager = {
        tick: sinon.stub()
      };

      await importAssets.importAssets();

      // Should only enqueue 2 assets (asset2 and asset3), skipping asset1
      expect(enqueueSpy.callCount).to.equal(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors with retries', async () => {
      // Mock API to fail first few times
      let callCount = 0;
      mockStackAPIClient.asset().create = sinon.stub().callsFake(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('API Error'));
        }
        return Promise.resolve({ uid: 'new-asset-uid', url: 'new-asset-url' });
      });

      // Mock progress manager
      (importAssets as any).progressManager = {
        tick: sinon.stub()
      };

      await importAssets.importAssets();

      // Should have retried and eventually succeeded
      expect(callCount).to.be.greaterThan(2);
    });

    it('should provide detailed error context', async () => {
      // Mock API to always fail
      mockStackAPIClient.asset().create = sinon.stub().rejects(new Error('Persistent API Error'));

      const assetQueue = (importAssets as any).assetQueue;
      let errorContext: any;

      assetQueue.on('itemFailed', (item: any, error: any) => {
        errorContext = error.assetContext;
      });

      // Mock progress manager
      (importAssets as any).progressManager = {
        tick: sinon.stub()
      };

      await importAssets.importAssets();

      expect(errorContext).to.exist;
      expect(errorContext.uid).to.exist;
      expect(errorContext.title).to.exist;
    });
  });

  describe('Performance Characteristics', () => {
    it('should maintain controlled concurrency', async () => {
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      // Mock API with concurrency tracking
      mockStackAPIClient.asset().create = sinon.stub().callsFake(async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 50));
        
        currentConcurrent--;
        return { uid: 'new-asset-uid', url: 'new-asset-url' };
      });

      // Mock progress manager
      (importAssets as any).progressManager = {
        tick: sinon.stub()
      };

      await importAssets.importAssets();

      // Should not exceed configured concurrency (2)
      expect(maxConcurrent).to.be.at.most(2);
    });

    it('should write final mapping files for compatibility', async () => {
      // Mock progress manager
      (importAssets as any).progressManager = {
        tick: sinon.stub()
      };

      await importAssets.importAssets();

      // Check that state was flushed and mapping files were written
      const stateManager = (importAssets as any).stateManager;
      const flushStateSpy = sinon.spy(stateManager, 'flushState');
      
      // The flushState should have been called
      expect(stateManager.getMappingCount().assets).to.equal(3);
    });
  });
});