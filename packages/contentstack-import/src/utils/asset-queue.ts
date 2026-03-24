import { EventEmitter } from 'events';
import { log } from '@contentstack/cli-utilities';
import { MemoryMonitor } from './memory-monitor';
import { IncrementalStateManager } from './incremental-state';

export interface AssetQueueItem {
  id: string;
  asset: any;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  processedAt?: number;
  error?: Error;
}

export interface AssetQueueConfig {
  maxConcurrency: number;
  maxRetries: number;
  retryDelay: number;
  enableRateLimiting: boolean;
  rateLimitDelay: number;
  memoryMonitor?: MemoryMonitor;
  stateManager?: IncrementalStateManager;
  context: Record<string, any>;
}

export interface AssetProcessor {
  processAsset(asset: any): Promise<{ uid: string; url?: string }>;
}

export class AssetQueue extends EventEmitter {
  private queue: AssetQueueItem[] = [];
  private activeWorkers: number = 0;
  private maxConcurrency: number;
  private maxRetries: number;
  private retryDelay: number;
  private enableRateLimiting: boolean;
  private rateLimitDelay: number;
  private memoryMonitor?: MemoryMonitor;
  private stateManager?: IncrementalStateManager;
  private context: Record<string, any>;
  private processor?: AssetProcessor;
  private isProcessing: boolean = false;
  private completedCount: number = 0;
  private failedCount: number = 0;
  private lastProcessTime: number = 0;

  constructor(config: AssetQueueConfig) {
    super();
    this.maxConcurrency = config.maxConcurrency;
    this.maxRetries = config.maxRetries;
    this.retryDelay = config.retryDelay;
    this.enableRateLimiting = config.enableRateLimiting;
    this.rateLimitDelay = config.rateLimitDelay;
    this.memoryMonitor = config.memoryMonitor;
    this.stateManager = config.stateManager;
    this.context = config.context;

    log.debug(`Asset queue initialized with concurrency: ${this.maxConcurrency}, retries: ${this.maxRetries}`, this.context);
  }

  /**
   * Set the asset processor
   */
  setProcessor(processor: AssetProcessor): void {
    this.processor = processor;
  }

  /**
   * Add an asset to the queue
   */
  enqueue(asset: any): string {
    const id = this.generateId();
    const item: AssetQueueItem = {
      id,
      asset,
      retryCount: 0,
      status: 'pending',
      createdAt: Date.now()
    };

    this.queue.push(item);
    this.emit('enqueued', item);

    log.debug(`Enqueued asset: ${asset.uid || asset.title || id}`, this.context);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }

    return id;
  }

  /**
   * Add multiple assets to the queue
   */
  enqueueBatch(assets: any[]): string[] {
    const ids: string[] = [];
    
    for (const asset of assets) {
      ids.push(this.enqueue(asset));
    }

    log.debug(`Enqueued batch of ${assets.length} assets`, this.context);
    return ids;
  }

  /**
   * Start processing the queue
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    if (!this.processor) {
      throw new Error('Asset processor not set. Call setProcessor() first.');
    }

    this.isProcessing = true;
    this.emit('processingStarted');

    log.debug('Started asset queue processing', this.context);

    while (this.queue.length > 0 || this.activeWorkers > 0) {
      // Check memory pressure before starting new workers
      if (this.memoryMonitor?.checkMemoryPressure()) {
        log.debug('Memory pressure detected, pausing new workers', this.context);
        await this.memoryMonitor.forceGarbageCollection();
        await this.sleep(1000); // Brief pause after GC
      }

      // Start new workers if we have capacity and pending items
      while (this.activeWorkers < this.maxConcurrency && this.queue.length > 0) {
        const item = this.getNextPendingItem();
        if (item) {
          this.processItem(item);
        } else {
          break; // No pending items available
        }
      }

      // Wait a bit before checking again
      await this.sleep(100);
    }

    this.isProcessing = false;
    this.emit('processingCompleted', {
      completed: this.completedCount,
      failed: this.failedCount,
      total: this.completedCount + this.failedCount
    });

    log.debug(`Asset queue processing completed. Completed: ${this.completedCount}, Failed: ${this.failedCount}`, this.context);
  }

  /**
   * Process a single queue item
   */
  private async processItem(item: AssetQueueItem): Promise<void> {
    this.activeWorkers++;
    item.status = 'processing';
    item.processedAt = Date.now();

    this.emit('itemStarted', item);

    try {
      // Rate limiting
      if (this.enableRateLimiting) {
        const timeSinceLastProcess = Date.now() - this.lastProcessTime;
        if (timeSinceLastProcess < this.rateLimitDelay) {
          await this.sleep(this.rateLimitDelay - timeSinceLastProcess);
        }
      }

      // Process the asset
      const result = await this.processor!.processAsset(item.asset);
      
      // Update state manager if available
      if (this.stateManager) {
        this.stateManager.addMapping(
          item.asset.uid,
          result.uid,
          'asset',
          result.url
        );
      }

      item.status = 'completed';
      this.completedCount++;
      this.lastProcessTime = Date.now();

      this.emit('itemCompleted', item, result);
      log.debug(`Completed asset: ${item.asset.uid || item.asset.title} -> ${result.uid}`, this.context);

    } catch (error) {
      item.error = error as Error;
      
      if (item.retryCount < this.maxRetries) {
        // Retry the item
        item.retryCount++;
        item.status = 'pending';
        
        log.debug(`Retrying asset ${item.asset.uid || item.asset.title} (attempt ${item.retryCount}/${this.maxRetries})`, this.context);
        
        // Add delay before retry
        setTimeout(() => {
          // Item will be picked up in the next processing cycle
        }, this.retryDelay * item.retryCount);

        this.emit('itemRetry', item, error);
      } else {
        // Max retries reached
        item.status = 'failed';
        this.failedCount++;
        
        this.emit('itemFailed', item, error);
        log.error(`Failed to process asset ${item.asset.uid || item.asset.title} after ${this.maxRetries} retries: ${error}`, this.context);
      }
    } finally {
      this.activeWorkers--;
    }
  }

  /**
   * Get the next pending item from the queue
   */
  private getNextPendingItem(): AssetQueueItem | null {
    const index = this.queue.findIndex(item => item.status === 'pending');
    if (index === -1) {
      return null;
    }
    
    return this.queue[index];
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    activeWorkers: number;
  } {
    const stats = {
      total: this.queue.length,
      pending: 0,
      processing: 0,
      completed: this.completedCount,
      failed: this.failedCount,
      activeWorkers: this.activeWorkers
    };

    for (const item of this.queue) {
      if (item.status === 'pending') stats.pending++;
      else if (item.status === 'processing') stats.processing++;
    }

    return stats;
  }

  /**
   * Clear completed items from the queue to free memory
   */
  clearCompleted(): number {
    const beforeLength = this.queue.length;
    this.queue = this.queue.filter(item => 
      item.status !== 'completed' && item.status !== 'failed'
    );
    const cleared = beforeLength - this.queue.length;
    
    if (cleared > 0) {
      log.debug(`Cleared ${cleared} completed/failed items from queue`, this.context);
    }
    
    return cleared;
  }

  /**
   * Wait for all items in the queue to complete
   */
  async waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isProcessing && this.queue.length === 0) {
        resolve();
        return;
      }

      this.once('processingCompleted', () => {
        resolve();
      });
    });
  }

  /**
   * Pause processing
   */
  pause(): void {
    this.isProcessing = false;
    this.emit('paused');
    log.debug('Asset queue processing paused', this.context);
  }

  /**
   * Resume processing
   */
  resume(): void {
    if (!this.isProcessing && this.queue.length > 0) {
      this.startProcessing();
    }
  }

  /**
   * Clear the entire queue
   */
  clear(): void {
    const cleared = this.queue.length;
    this.queue = [];
    this.completedCount = 0;
    this.failedCount = 0;
    
    log.debug(`Cleared entire queue (${cleared} items)`, this.context);
    this.emit('cleared');
  }

  /**
   * Generate a unique ID for queue items
   */
  private generateId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create an asset queue with default configuration
   */
  static createDefault(context: Record<string, any> = {}): AssetQueue {
    return new AssetQueue({
      maxConcurrency: 10,
      maxRetries: 3,
      retryDelay: 1000,
      enableRateLimiting: true,
      rateLimitDelay: 100,
      context
    });
  }

  /**
   * Create an asset queue optimized for large datasets
   */
  static createForLargeDataset(
    memoryMonitor: MemoryMonitor,
    stateManager: IncrementalStateManager,
    context: Record<string, any> = {}
  ): AssetQueue {
    return new AssetQueue({
      maxConcurrency: 8, // Slightly lower concurrency for memory management
      maxRetries: 5, // More retries for reliability
      retryDelay: 2000, // Longer retry delay
      enableRateLimiting: true,
      rateLimitDelay: 200, // Slightly longer rate limit delay
      memoryMonitor,
      stateManager,
      context
    });
  }
}