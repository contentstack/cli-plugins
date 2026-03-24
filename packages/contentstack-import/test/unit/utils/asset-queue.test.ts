import { expect } from 'chai';
import sinon from 'sinon';
import { AssetQueue, AssetProcessor } from '../../../src/utils/asset-queue';
import { MemoryMonitor } from '../../../src/utils/memory-monitor';
import { IncrementalStateManager } from '../../../src/utils/incremental-state';

describe('AssetQueue', () => {
  let assetQueue: AssetQueue;
  let mockProcessor: AssetProcessor;
  let memoryMonitor: MemoryMonitor;
  let stateManager: IncrementalStateManager;

  beforeEach(() => {
    // Mock processor
    mockProcessor = {
      processAsset: sinon.stub().resolves({ uid: 'new-uid', url: 'new-url' })
    };

    // Mock memory monitor
    memoryMonitor = {
      checkMemoryPressure: sinon.stub().returns(false),
      forceGarbageCollection: sinon.stub().resolves()
    } as any;

    // Mock state manager
    stateManager = {
      addMapping: sinon.stub()
    } as any;

    assetQueue = new AssetQueue({
      maxConcurrency: 2,
      maxRetries: 3,
      retryDelay: 100,
      enableRateLimiting: false,
      rateLimitDelay: 0,
      memoryMonitor,
      stateManager,
      context: { test: true }
    });

    assetQueue.setProcessor(mockProcessor);
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(assetQueue).to.be.instanceOf(AssetQueue);
    });

    it('should create default queue', () => {
      const defaultQueue = AssetQueue.createDefault();
      expect(defaultQueue).to.be.instanceOf(AssetQueue);
    });

    it('should create queue for large datasets', () => {
      const largeDatasetQueue = AssetQueue.createForLargeDataset(memoryMonitor, stateManager);
      expect(largeDatasetQueue).to.be.instanceOf(AssetQueue);
    });
  });

  describe('enqueue', () => {
    it('should add asset to queue', () => {
      const asset = { uid: 'asset1', title: 'Test Asset' };
      const id = assetQueue.enqueue(asset);
      
      expect(id).to.be.a('string');
      
      const stats = assetQueue.getStats();
      expect(stats.pending).to.equal(1);
      expect(stats.total).to.equal(1);
    });

    it('should start processing automatically', (done) => {
      const asset = { uid: 'asset1', title: 'Test Asset' };
      
      assetQueue.on('itemCompleted', (item, result) => {
        expect(result.uid).to.equal('new-uid');
        done();
      });
      
      assetQueue.enqueue(asset);
    });
  });

  describe('enqueueBatch', () => {
    it('should add multiple assets to queue', () => {
      const assets = [
        { uid: 'asset1', title: 'Asset 1' },
        { uid: 'asset2', title: 'Asset 2' },
        { uid: 'asset3', title: 'Asset 3' }
      ];
      
      const ids = assetQueue.enqueueBatch(assets);
      
      expect(ids).to.have.length(3);
      
      const stats = assetQueue.getStats();
      expect(stats.pending).to.equal(3);
    });
  });

  describe('processing', () => {
    it('should process assets with controlled concurrency', async () => {
      const assets = [
        { uid: 'asset1', title: 'Asset 1' },
        { uid: 'asset2', title: 'Asset 2' },
        { uid: 'asset3', title: 'Asset 3' }
      ];
      
      let processingCount = 0;
      let maxConcurrent = 0;
      
      (mockProcessor.processAsset as sinon.SinonStub).callsFake(async () => {
        processingCount++;
        maxConcurrent = Math.max(maxConcurrent, processingCount);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 50));
        
        processingCount--;
        return { uid: 'new-uid', url: 'new-url' };
      });
      
      assetQueue.enqueueBatch(assets);
      await assetQueue.waitForCompletion();
      
      // Should not exceed max concurrency (2)
      expect(maxConcurrent).to.be.at.most(2);
    });

    it('should handle processing errors with retries', async () => {
      const asset = { uid: 'asset1', title: 'Test Asset' };
      let attemptCount = 0;
      
      (mockProcessor.processAsset as sinon.SinonStub).callsFake(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Processing failed');
        }
        return { uid: 'new-uid', url: 'new-url' };
      });
      
      let completedCalled = false;
      assetQueue.on('itemCompleted', () => {
        completedCalled = true;
      });
      
      assetQueue.enqueue(asset);
      await assetQueue.waitForCompletion();
      
      expect(attemptCount).to.equal(3);
      expect(completedCalled).to.be.true;
    });

    it('should fail after max retries', async () => {
      const asset = { uid: 'asset1', title: 'Test Asset' };
      
      (mockProcessor.processAsset as sinon.SinonStub).rejects(new Error('Always fails'));
      
      let failedCalled = false;
      assetQueue.on('itemFailed', () => {
        failedCalled = true;
      });
      
      assetQueue.enqueue(asset);
      await assetQueue.waitForCompletion();
      
      expect(failedCalled).to.be.true;
    });

    it('should check memory pressure during processing', async () => {
      const assets = [
        { uid: 'asset1', title: 'Asset 1' },
        { uid: 'asset2', title: 'Asset 2' }
      ];
      
      (memoryMonitor.checkMemoryPressure as sinon.SinonStub).returns(true);
      
      assetQueue.enqueueBatch(assets);
      await assetQueue.waitForCompletion();
      
      expect(memoryMonitor.checkMemoryPressure).to.have.been.called;
      expect(memoryMonitor.forceGarbageCollection).to.have.been.called;
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const assets = [
        { uid: 'asset1', title: 'Asset 1' },
        { uid: 'asset2', title: 'Asset 2' }
      ];
      
      assetQueue.enqueueBatch(assets);
      
      const stats = assetQueue.getStats();
      expect(stats.total).to.equal(2);
      expect(stats.pending).to.equal(2);
      expect(stats.processing).to.equal(0);
      expect(stats.completed).to.equal(0);
      expect(stats.failed).to.equal(0);
    });
  });

  describe('clearCompleted', () => {
    it('should clear completed items from queue', async () => {
      const asset = { uid: 'asset1', title: 'Test Asset' };
      
      assetQueue.enqueue(asset);
      await assetQueue.waitForCompletion();
      
      const clearedCount = assetQueue.clearCompleted();
      expect(clearedCount).to.equal(1);
      
      const stats = assetQueue.getStats();
      expect(stats.total).to.equal(0);
    });
  });

  describe('pause and resume', () => {
    it('should pause and resume processing', () => {
      assetQueue.pause();
      
      const asset = { uid: 'asset1', title: 'Test Asset' };
      assetQueue.enqueue(asset);
      
      // Should not process while paused
      const stats = assetQueue.getStats();
      expect(stats.pending).to.equal(1);
      
      assetQueue.resume();
      // Processing should resume
    });
  });

  describe('clear', () => {
    it('should clear entire queue', () => {
      const assets = [
        { uid: 'asset1', title: 'Asset 1' },
        { uid: 'asset2', title: 'Asset 2' }
      ];
      
      assetQueue.enqueueBatch(assets);
      assetQueue.clear();
      
      const stats = assetQueue.getStats();
      expect(stats.total).to.equal(0);
      expect(stats.completed).to.equal(0);
      expect(stats.failed).to.equal(0);
    });
  });
});