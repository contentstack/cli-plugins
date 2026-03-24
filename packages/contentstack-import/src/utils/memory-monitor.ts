import { log } from '@contentstack/cli-utilities';

export interface MemoryStats {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  heapUsedMB: number;
  heapTotalMB: number;
  rssMB: number;
}

export interface MemoryMonitorConfig {
  thresholdMB: number;
  gcCooldownMs: number;
  enableLogging: boolean;
  logInterval: number;
}

export class MemoryMonitor {
  private threshold: number;
  private lastGC: number = 0;
  private gcCooldownMs: number;
  private enableLogging: boolean;
  private logInterval: number;
  private lastLogTime: number = 0;
  private context: Record<string, any>;

  constructor(config: MemoryMonitorConfig, context: Record<string, any> = {}) {
    this.threshold = config.thresholdMB * 1024 * 1024; // Convert MB to bytes
    this.gcCooldownMs = config.gcCooldownMs;
    this.enableLogging = config.enableLogging;
    this.logInterval = config.logInterval;
    this.context = context;

    log.debug(`Memory monitor initialized with threshold: ${config.thresholdMB}MB`, this.context);
  }

  /**
   * Check if memory usage exceeds the configured threshold
   */
  checkMemoryPressure(): boolean {
    const stats = this.getMemoryStats();
    const isOverThreshold = stats.heapUsed > this.threshold;

    if (this.enableLogging && this.shouldLog()) {
      log.debug(`Memory check: ${stats.heapUsedMB}MB used, threshold: ${this.threshold / 1024 / 1024}MB, pressure: ${isOverThreshold}`, this.context);
    }

    return isOverThreshold;
  }

  /**
   * Force garbage collection if available and cooldown period has passed
   */
  async forceGarbageCollection(): Promise<void> {
    const now = Date.now();
    
    if (now - this.lastGC < this.gcCooldownMs) {
      log.debug(`GC skipped - cooldown period not elapsed (${now - this.lastGC}ms < ${this.gcCooldownMs}ms)`, this.context);
      return;
    }

    const beforeStats = this.getMemoryStats();
    
    if (global.gc) {
      log.debug(`Forcing garbage collection - heap before: ${beforeStats.heapUsedMB}MB`, this.context);
      global.gc();
      
      // Small delay to allow GC to complete
      await this.sleep(100);
      
      const afterStats = this.getMemoryStats();
      const freedMB = beforeStats.heapUsedMB - afterStats.heapUsedMB;
      
      log.debug(`GC completed - heap after: ${afterStats.heapUsedMB}MB, freed: ${freedMB.toFixed(2)}MB`, this.context);
      
      this.lastGC = now;
    } else {
      log.warn('Garbage collection not available. Run with --expose-gc flag for better memory management.', this.context);
    }
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryStats(): MemoryStats {
    const usage = process.memoryUsage();
    
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
      rssMB: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
    };
  }

  /**
   * Log memory statistics if logging is enabled and interval has passed
   */
  logMemoryStats(label?: string): void {
    if (!this.enableLogging) return;

    const stats = this.getMemoryStats();
    const prefix = label ? `${label} - ` : '';
    
    log.debug(`${prefix}Memory: ${stats.heapUsedMB}MB used / ${stats.heapTotalMB}MB total (RSS: ${stats.rssMB}MB)`, this.context);
  }

  /**
   * Check if memory usage is approaching critical levels
   */
  isCriticalMemoryPressure(): boolean {
    const stats = this.getMemoryStats();
    const criticalThreshold = this.threshold * 1.5; // 50% above normal threshold
    
    return stats.heapUsed > criticalThreshold;
  }

  /**
   * Get memory pressure level as a percentage
   */
  getMemoryPressureLevel(): number {
    const stats = this.getMemoryStats();
    return Math.round((stats.heapUsed / this.threshold) * 100);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if enough time has passed since last log
   */
  private shouldLog(): boolean {
    const now = Date.now();
    if (now - this.lastLogTime > this.logInterval) {
      this.lastLogTime = now;
      return true;
    }
    return false;
  }

  /**
   * Create a memory monitor with default configuration
   */
  static createDefault(context: Record<string, any> = {}): MemoryMonitor {
    return new MemoryMonitor({
      thresholdMB: 1024, // 1GB threshold
      gcCooldownMs: 5000, // 5 second cooldown between GC calls
      enableLogging: true,
      logInterval: 30000, // Log every 30 seconds
    }, context);
  }

  /**
   * Create a memory monitor for large dataset processing
   */
  static createForLargeDataset(context: Record<string, any> = {}): MemoryMonitor {
    return new MemoryMonitor({
      thresholdMB: 768, // Lower threshold for large datasets (768MB)
      gcCooldownMs: 3000, // More frequent GC (3 seconds)
      enableLogging: true,
      logInterval: 15000, // More frequent logging (15 seconds)
    }, context);
  }
}