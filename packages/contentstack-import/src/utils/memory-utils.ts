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

/**
 * Simple memory monitoring utilities for asset import
 */
export class MemoryUtils {
  private static lastGC: number = 0;
  private static gcCooldownMs: number = 5000; // 5 second cooldown between GC calls

  /**
   * Get current memory usage statistics
   */
  static getMemoryStats(): MemoryStats {
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
   * Check if memory usage exceeds the given threshold
   * @param thresholdMB Memory threshold in MB
   */
  static checkMemoryPressure(thresholdMB: number = 1024): boolean {
    const stats = this.getMemoryStats();
    return stats.heapUsedMB > thresholdMB;
  }

  /**
   * Force garbage collection if available and cooldown period has passed
   */
  static async forceGarbageCollection(context?: Record<string, any>): Promise<void> {
    const now = Date.now();
    
    if (now - this.lastGC < this.gcCooldownMs) {
      return; // Skip if cooldown period hasn't passed
    }

    const beforeStats = this.getMemoryStats();
    
    if (global.gc) {
      log.debug(`Forcing garbage collection - heap before: ${beforeStats.heapUsedMB}MB`, context);
      global.gc();
      
      // Small delay to allow GC to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const afterStats = this.getMemoryStats();
      const freedMB = beforeStats.heapUsedMB - afterStats.heapUsedMB;
      
      log.debug(`GC completed - heap after: ${afterStats.heapUsedMB}MB, freed: ${freedMB.toFixed(2)}MB`, context);
      
      this.lastGC = now;
    } else {
      log.warn('Garbage collection not available. Run with --expose-gc flag for better memory management.', context);
    }
  }

  /**
   * Log memory statistics with a given label
   */
  static logMemoryStats(label: string, context?: Record<string, any>): void {
    const stats = this.getMemoryStats();
    log.debug(`${label} - Memory: ${stats.heapUsedMB}MB used / ${stats.heapTotalMB}MB total (RSS: ${stats.rssMB}MB)`, context);
  }

  /**
   * Perform memory cleanup operations
   * @param objects Array of objects to null out
   */
  static cleanup(...objects: any[]): void {
    for (let i = 0; i < objects.length; i++) {
      objects[i] = null;
    }
  }

  /**
   * Check if we should trigger memory cleanup based on count
   * @param count Current count
   * @param interval Cleanup interval (default 1000)
   */
  static shouldCleanup(count: number, interval: number = 1000): boolean {
    return count > 0 && count % interval === 0;
  }
}