import { expect } from 'chai';
import sinon from 'sinon';
import { MemoryMonitor } from '../../../src/utils/memory-monitor';

describe('MemoryMonitor', () => {
  let memoryMonitor: MemoryMonitor;
  let processMemoryUsageStub: sinon.SinonStub;
  let globalGcStub: sinon.SinonStub;
  let setTimeoutStub: sinon.SinonStub;

  beforeEach(() => {
    // Mock process.memoryUsage
    processMemoryUsageStub = sinon.stub(process, 'memoryUsage').returns({
      rss: 100 * 1024 * 1024, // 100MB
      heapTotal: 80 * 1024 * 1024, // 80MB
      heapUsed: 60 * 1024 * 1024, // 60MB
      external: 10 * 1024 * 1024, // 10MB
      arrayBuffers: 5 * 1024 * 1024, // 5MB
    });

    // Mock global.gc
    globalGcStub = sinon.stub();
    (global as any).gc = globalGcStub;

    // Mock setTimeout
    setTimeoutStub = sinon.stub(global, 'setTimeout').callsFake((fn: Function) => {
      fn();
      return {} as any;
    });

    memoryMonitor = new MemoryMonitor({
      thresholdMB: 50, // 50MB threshold
      gcCooldownMs: 1000,
      enableLogging: false,
      logInterval: 5000,
    });
  });

  afterEach(() => {
    processMemoryUsageStub.restore();
    setTimeoutStub.restore();
    delete (global as any).gc;
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(memoryMonitor).to.be.instanceOf(MemoryMonitor);
    });

    it('should create default monitor', () => {
      const defaultMonitor = MemoryMonitor.createDefault();
      expect(defaultMonitor).to.be.instanceOf(MemoryMonitor);
    });

    it('should create monitor for large datasets', () => {
      const largeDatasetMonitor = MemoryMonitor.createForLargeDataset();
      expect(largeDatasetMonitor).to.be.instanceOf(MemoryMonitor);
    });
  });

  describe('checkMemoryPressure', () => {
    it('should return true when memory usage exceeds threshold', () => {
      // 60MB used > 50MB threshold
      const result = memoryMonitor.checkMemoryPressure();
      expect(result).to.be.true;
    });

    it('should return false when memory usage is below threshold', () => {
      // Mock lower memory usage
      processMemoryUsageStub.returns({
        rss: 40 * 1024 * 1024,
        heapTotal: 35 * 1024 * 1024,
        heapUsed: 30 * 1024 * 1024, // 30MB < 50MB threshold
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
      });

      const result = memoryMonitor.checkMemoryPressure();
      expect(result).to.be.false;
    });
  });

  describe('getMemoryStats', () => {
    it('should return correct memory statistics', () => {
      const stats = memoryMonitor.getMemoryStats();
      
      expect(stats).to.have.property('heapUsed', 60 * 1024 * 1024);
      expect(stats).to.have.property('heapTotal', 80 * 1024 * 1024);
      expect(stats).to.have.property('rss', 100 * 1024 * 1024);
      expect(stats).to.have.property('heapUsedMB', 60);
      expect(stats).to.have.property('heapTotalMB', 80);
      expect(stats).to.have.property('rssMB', 100);
    });
  });

  describe('forceGarbageCollection', () => {
    it('should call global.gc when available', async () => {
      await memoryMonitor.forceGarbageCollection();
      expect(globalGcStub.calledOnce).to.be.true;
    });

    it('should respect cooldown period', async () => {
      // First call should work
      await memoryMonitor.forceGarbageCollection();
      expect(globalGcStub.calledOnce).to.be.true;

      // Second call immediately should be skipped
      globalGcStub.resetHistory();
      await memoryMonitor.forceGarbageCollection();
      expect(globalGcStub.called).to.be.false;
    });

    it('should handle missing global.gc gracefully', async () => {
      delete (global as any).gc;
      
      // Should not throw
      await memoryMonitor.forceGarbageCollection();
    });
  });

  describe('isCriticalMemoryPressure', () => {
    it('should return true when memory usage exceeds critical threshold', () => {
      // Mock very high memory usage (90MB > 75MB critical threshold)
      processMemoryUsageStub.returns({
        rss: 100 * 1024 * 1024,
        heapTotal: 95 * 1024 * 1024,
        heapUsed: 90 * 1024 * 1024, // 90MB > 75MB (50MB * 1.5)
        external: 5 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024,
      });

      const result = memoryMonitor.isCriticalMemoryPressure();
      expect(result).to.be.true;
    });

    it('should return false when memory usage is below critical threshold', () => {
      const result = memoryMonitor.isCriticalMemoryPressure();
      expect(result).to.be.false; // 60MB < 75MB critical threshold
    });
  });

  describe('getMemoryPressureLevel', () => {
    it('should return correct pressure level percentage', () => {
      const level = memoryMonitor.getMemoryPressureLevel();
      expect(level).to.equal(120); // 60MB / 50MB * 100 = 120%
    });
  });
});