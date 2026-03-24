import { expect } from 'chai';
import sinon from 'sinon';
import { MemoryUtils } from '../../src/utils/memory-utils';

describe('Memory Optimization Integration', () => {
  let memoryUtilsSpy: sinon.SinonSpy;
  let processMemoryUsageStub: sinon.SinonStub;

  beforeEach(() => {
    // Mock process.memoryUsage to simulate memory pressure
    processMemoryUsageStub = sinon.stub(process, 'memoryUsage').returns({
      rss: 2000 * 1024 * 1024, // 2GB
      heapTotal: 1500 * 1024 * 1024, // 1.5GB
      heapUsed: 1200 * 1024 * 1024, // 1.2GB (above 1GB threshold)
      external: 100 * 1024 * 1024,
      arrayBuffers: 50 * 1024 * 1024,
    });

    memoryUtilsSpy = sinon.spy(MemoryUtils);
  });

  afterEach(() => {
    processMemoryUsageStub.restore();
    sinon.restore();
  });

  describe('Memory Pressure Detection', () => {
    it('should detect memory pressure with large heap usage', () => {
      const isUnderPressure = MemoryUtils.checkMemoryPressure(1024); // 1GB threshold
      expect(isUnderPressure).to.be.true;
    });

    it('should not detect memory pressure with normal heap usage', () => {
      // Mock lower memory usage
      processMemoryUsageStub.returns({
        rss: 500 * 1024 * 1024,
        heapTotal: 400 * 1024 * 1024,
        heapUsed: 300 * 1024 * 1024, // 300MB < 1GB threshold
        external: 50 * 1024 * 1024,
        arrayBuffers: 25 * 1024 * 1024,
      });

      const isUnderPressure = MemoryUtils.checkMemoryPressure(1024);
      expect(isUnderPressure).to.be.false;
    });
  });

  describe('Periodic Cleanup Logic', () => {
    it('should trigger cleanup at correct intervals', () => {
      // Test cleanup intervals
      expect(MemoryUtils.shouldCleanup(1000, 1000)).to.be.true;
      expect(MemoryUtils.shouldCleanup(2000, 1000)).to.be.true;
      expect(MemoryUtils.shouldCleanup(999, 1000)).to.be.false;
      expect(MemoryUtils.shouldCleanup(1001, 1000)).to.be.false;
    });

    it('should use default interval of 1000', () => {
      expect(MemoryUtils.shouldCleanup(1000)).to.be.true;
      expect(MemoryUtils.shouldCleanup(2000)).to.be.true;
      expect(MemoryUtils.shouldCleanup(3000)).to.be.true;
    });
  });

  describe('Memory Statistics', () => {
    it('should provide accurate memory statistics', () => {
      const stats = MemoryUtils.getMemoryStats();
      
      expect(stats.heapUsedMB).to.equal(1200); // 1.2GB in MB
      expect(stats.heapTotalMB).to.equal(1500); // 1.5GB in MB
      expect(stats.rssMB).to.equal(2000); // 2GB in MB
      
      expect(stats.heapUsed).to.equal(1200 * 1024 * 1024);
      expect(stats.heapTotal).to.equal(1500 * 1024 * 1024);
      expect(stats.rss).to.equal(2000 * 1024 * 1024);
    });
  });

  describe('Garbage Collection', () => {
    it('should handle garbage collection gracefully when not available', async () => {
      // Ensure global.gc is not available
      delete (global as any).gc;
      
      // Should not throw an error
      await MemoryUtils.forceGarbageCollection();
    });

    it('should call garbage collection when available', async () => {
      const mockGc = sinon.stub();
      (global as any).gc = mockGc;
      
      await MemoryUtils.forceGarbageCollection();
      
      expect(mockGc.calledOnce).to.be.true;
      
      delete (global as any).gc;
    });
  });

  describe('Memory Cleanup Simulation', () => {
    it('should simulate asset processing memory cleanup', () => {
      // Simulate processing 5000 assets
      let memoryCleanupCount = 0;
      
      for (let i = 1; i <= 5000; i++) {
        if (MemoryUtils.shouldCleanup(i, 1000)) {
          memoryCleanupCount++;
        }
      }
      
      // Should trigger cleanup 5 times (at 1000, 2000, 3000, 4000, 5000)
      expect(memoryCleanupCount).to.equal(5);
    });

    it('should demonstrate memory pressure detection throughout processing', () => {
      const memoryReadings = [];
      
      // Simulate increasing memory usage
      for (let i = 0; i < 5; i++) {
        const memoryUsageMB = 500 + (i * 200); // 500MB, 700MB, 900MB, 1100MB, 1300MB
        
        processMemoryUsageStub.returns({
          rss: memoryUsageMB * 1024 * 1024,
          heapTotal: (memoryUsageMB - 100) * 1024 * 1024,
          heapUsed: (memoryUsageMB - 200) * 1024 * 1024,
          external: 50 * 1024 * 1024,
          arrayBuffers: 25 * 1024 * 1024,
        });
        
        const isUnderPressure = MemoryUtils.checkMemoryPressure(1024); // 1GB threshold
        memoryReadings.push({ memoryUsageMB: memoryUsageMB - 200, isUnderPressure });
      }
      
      // Should detect pressure when memory exceeds 1GB (1024MB)
      expect(memoryReadings[0].isUnderPressure).to.be.false; // 300MB
      expect(memoryReadings[1].isUnderPressure).to.be.false; // 500MB
      expect(memoryReadings[2].isUnderPressure).to.be.false; // 700MB
      expect(memoryReadings[3].isUnderPressure).to.be.true;  // 900MB (close to threshold)
      expect(memoryReadings[4].isUnderPressure).to.be.true;  // 1100MB (over threshold)
    });
  });
});