import { expect } from 'chai';
import { performance } from 'perf_hooks';
import { MemoryMonitor, IncrementalStateManager, AssetQueue } from '../../src/utils';

describe('Memory Optimization Performance Benchmarks', () => {
  let memoryMonitor: MemoryMonitor;
  let stateManager: IncrementalStateManager;
  let assetQueue: AssetQueue;

  beforeEach(() => {
    memoryMonitor = MemoryMonitor.createForLargeDataset();
    stateManager = IncrementalStateManager.createForLargeDataset('/tmp/test');
    assetQueue = AssetQueue.createForLargeDataset(memoryMonitor, stateManager);
  });

  describe('Memory Monitor Performance', () => {
    it('should check memory pressure efficiently', () => {
      const iterations = 10000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        memoryMonitor.checkMemoryPressure();
      }

      const end = performance.now();
      const duration = end - start;
      const avgDuration = duration / iterations;

      // Should complete memory checks in reasonable time
      expect(avgDuration).to.be.below(0.1); // Less than 0.1ms per check
      console.log(`Memory pressure check: ${avgDuration.toFixed(4)}ms average over ${iterations} iterations`);
    });

    it('should get memory stats efficiently', () => {
      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        memoryMonitor.getMemoryStats();
      }

      const end = performance.now();
      const duration = end - start;
      const avgDuration = duration / iterations;

      expect(avgDuration).to.be.below(1); // Less than 1ms per stats call
      console.log(`Memory stats retrieval: ${avgDuration.toFixed(4)}ms average over ${iterations} iterations`);
    });
  });

  describe('State Manager Performance', () => {
    it('should handle large numbers of mappings efficiently', () => {
      const mappingCount = 10000;
      const start = performance.now();

      for (let i = 0; i < mappingCount; i++) {
        stateManager.addMapping(`asset${i}`, `new-asset${i}`, 'asset');
      }

      const end = performance.now();
      const duration = end - start;
      const avgDuration = duration / mappingCount;

      expect(avgDuration).to.be.below(0.1); // Less than 0.1ms per mapping
      console.log(`State mapping addition: ${avgDuration.toFixed(4)}ms average over ${mappingCount} mappings`);

      // Verify all mappings were stored
      expect(stateManager.getMappingCount().assets).to.equal(mappingCount);
    });

    it('should lookup mappings efficiently', () => {
      // Pre-populate with mappings
      const mappingCount = 1000;
      for (let i = 0; i < mappingCount; i++) {
        stateManager.addMapping(`asset${i}`, `new-asset${i}`, 'asset');
      }

      const lookupIterations = 10000;
      const start = performance.now();

      for (let i = 0; i < lookupIterations; i++) {
        const assetId = `asset${i % mappingCount}`;
        stateManager.getMapping(assetId, 'asset');
      }

      const end = performance.now();
      const duration = end - start;
      const avgDuration = duration / lookupIterations;

      expect(avgDuration).to.be.below(0.01); // Less than 0.01ms per lookup
      console.log(`State mapping lookup: ${avgDuration.toFixed(4)}ms average over ${lookupIterations} lookups`);
    });
  });

  describe('Asset Queue Performance', () => {
    it('should enqueue assets efficiently', () => {
      const mockProcessor = {
        processAsset: async () => ({ uid: 'new-uid', url: 'new-url' })
      };
      assetQueue.setProcessor(mockProcessor);

      const assetCount = 1000;
      const assets = Array.from({ length: assetCount }, (_, i) => ({
        uid: `asset${i}`,
        title: `Asset ${i}`,
        filename: `file${i}.jpg`
      }));

      const start = performance.now();

      for (const asset of assets) {
        assetQueue.enqueue(asset);
      }

      const end = performance.now();
      const duration = end - start;
      const avgDuration = duration / assetCount;

      expect(avgDuration).to.be.below(0.1); // Less than 0.1ms per enqueue
      console.log(`Asset queue enqueue: ${avgDuration.toFixed(4)}ms average over ${assetCount} assets`);

      const stats = assetQueue.getStats();
      expect(stats.total).to.equal(assetCount);
    });

    it('should handle queue statistics efficiently', () => {
      // Pre-populate queue
      const assetCount = 1000;
      for (let i = 0; i < assetCount; i++) {
        assetQueue.enqueue({ uid: `asset${i}`, title: `Asset ${i}` });
      }

      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        assetQueue.getStats();
      }

      const end = performance.now();
      const duration = end - start;
      const avgDuration = duration / iterations;

      expect(avgDuration).to.be.below(1); // Less than 1ms per stats call
      console.log(`Queue stats retrieval: ${avgDuration.toFixed(4)}ms average over ${iterations} calls`);
    });
  });

  describe('Memory Usage Patterns', () => {
    it('should maintain reasonable memory usage during large operations', () => {
      const initialStats = memoryMonitor.getMemoryStats();
      const initialHeapUsed = initialStats.heapUsed;

      // Simulate processing many assets
      const assetCount = 5000;
      for (let i = 0; i < assetCount; i++) {
        stateManager.addMapping(`asset${i}`, `new-asset${i}`, 'asset');
        
        // Trigger GC periodically
        if (i % 1000 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalStats = memoryMonitor.getMemoryStats();
      const heapGrowth = finalStats.heapUsed - initialHeapUsed;
      const growthPerAsset = heapGrowth / assetCount;

      console.log(`Memory growth: ${(heapGrowth / 1024 / 1024).toFixed(2)}MB for ${assetCount} assets`);
      console.log(`Growth per asset: ${growthPerAsset.toFixed(2)} bytes`);

      // Memory growth should be reasonable (less than 1KB per asset)
      expect(growthPerAsset).to.be.below(1024);
    });

    it('should demonstrate memory efficiency vs legacy approach', () => {
      const assetCount = 1000;
      
      // Simulate legacy approach (accumulating in memory)
      const legacyStart = performance.now();
      const legacyMap: Record<string, string> = {};
      
      for (let i = 0; i < assetCount; i++) {
        legacyMap[`asset${i}`] = `new-asset${i}`;
      }
      
      const legacyEnd = performance.now();
      const legacyDuration = legacyEnd - legacyStart;

      // Simulate optimized approach (incremental persistence)
      const optimizedStart = performance.now();
      
      for (let i = 0; i < assetCount; i++) {
        stateManager.addMapping(`asset${i}`, `new-asset${i}`, 'asset');
      }
      
      const optimizedEnd = performance.now();
      const optimizedDuration = optimizedEnd - optimizedStart;

      console.log(`Legacy approach: ${legacyDuration.toFixed(2)}ms`);
      console.log(`Optimized approach: ${optimizedDuration.toFixed(2)}ms`);

      // Optimized approach might be slightly slower due to persistence,
      // but should still be reasonable
      expect(optimizedDuration).to.be.below(legacyDuration * 10); // Allow 10x overhead for persistence
    });
  });

  describe('Scalability Tests', () => {
    it('should handle increasing dataset sizes efficiently', () => {
      const testSizes = [100, 500, 1000, 5000];
      const results: Array<{ size: number; duration: number; memoryUsed: number }> = [];

      for (const size of testSizes) {
        const startStats = memoryMonitor.getMemoryStats();
        const start = performance.now();

        // Process assets of this size
        for (let i = 0; i < size; i++) {
          stateManager.addMapping(`asset${i}`, `new-asset${i}`, 'asset');
        }

        const end = performance.now();
        const endStats = memoryMonitor.getMemoryStats();
        
        const duration = end - start;
        const memoryUsed = endStats.heapUsed - startStats.heapUsed;

        results.push({ size, duration, memoryUsed });

        console.log(`Size: ${size}, Duration: ${duration.toFixed(2)}ms, Memory: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`);

        // Clear state for next test
        stateManager.clearInMemoryMappings();
        if (global.gc) global.gc();
      }

      // Verify that performance scales reasonably (not exponentially)
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        
        const sizeRatio = curr.size / prev.size;
        const durationRatio = curr.duration / prev.duration;

        // Duration should scale roughly linearly (allow 2x overhead)
        expect(durationRatio).to.be.below(sizeRatio * 2);
      }
    });
  });
});