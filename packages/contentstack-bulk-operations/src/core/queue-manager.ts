import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { QueueItem, OperationType, OperationStatus, ResourceType } from '../interfaces';

export class QueueManager extends EventEmitter {
  private queue: QueueItem[] = [];
  private processing: boolean = false;
  private paused: boolean = false;
  private concurrency: number;
  private activeWorkers: number = 0;
  private totalEnqueued: number = 0;

  private stats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
  };

  constructor(concurrency: number = 1) {
    super();
    this.concurrency = concurrency;
  }

  enqueue<T>(type: ResourceType, operation: OperationType, data: T, priority: number = 0): QueueItem<T> {
    const item: QueueItem<T> = {
      id: uuidv4(),
      type,
      operation,
      data,
      priority,
      retryCount: 0,
      status: OperationStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert based on priority (higher priority first)
    const insertIndex = this.queue.findIndex((q) => q.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }

    this.totalEnqueued++;
    this.emit('enqueued', item);
    this.processQueue();

    return item;
  }

  enqueueBatch<T>(type: ResourceType, operation: OperationType, dataArray: T[], priority: number = 0): QueueItem<T>[] {
    return dataArray.map((data) => this.enqueue(type, operation, data, priority));
  }

  requeue(item: QueueItem, increasePriority: boolean = true): void {
    // Update item metadata
    item.retryCount++;
    item.status = OperationStatus.PENDING;
    item.updatedAt = new Date();

    if (increasePriority) {
      item.priority += 1; // Increase priority for retried items
    }

    // Insert back into queue at correct position based on priority
    const insertIndex = this.queue.findIndex((q) => q.priority < item.priority);
    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }

    this.stats.retried++;
    this.emit('requeued', item);

    // Resume processing if queue was idle
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.paused) return;

    this.processing = true;

    while (this.queue.length > 0 && this.activeWorkers < this.concurrency && !this.paused) {
      const item = this.queue.shift();
      if (!item) break;

      this.activeWorkers++;
      item.status = OperationStatus.IN_PROGRESS;
      item.updatedAt = new Date();

      // Process item asynchronously
      this.processItem(item)
        .catch(() => {})
        .finally(() => {
          this.activeWorkers--;
          this.processQueue(); // Continue processing
        });
    }

    this.processing = false;

    // Emit completion if queue is empty
    if (this.queue.length === 0 && this.activeWorkers === 0) {
      this.emit('completed', this.stats);
    }
  }

  private async processItem(item: QueueItem): Promise<void> {
    return new Promise((resolve, reject) => {
      // Emit 'processing' event with a done callback
      // The handler MUST call done() when processing is complete
      const done = (error?: Error) => {
        if (error) {
          item.error = error;
          item.status = OperationStatus.FAILED;
          this.stats.failed++;
          this.stats.processed++;
          this.emit('error', { item, error });
          reject(error);
        } else {
          resolve();
        }
      };

      // Set timeout to auto-resolve if handler doesn't call done within 5 minutes
      const timeout = setTimeout(
        () => {
          done();
        },
        5 * 60 * 1000
      );

      // Emit with item and done callback
      this.emit('processing', item, (error?: Error) => {
        clearTimeout(timeout);
        done(error);
      });
    });
  }

  updateItemStatus(itemId: string, status: OperationStatus, error?: Error): void {
    const item = this.queue.find((i) => i.id === itemId);
    if (item) {
      item.status = status;
      item.updatedAt = new Date();
      if (error) item.error = error;
    }

    if (status === OperationStatus.SUCCESS) {
      this.stats.succeeded++;
      this.stats.processed++;
    } else if (status === OperationStatus.FAILED) {
      this.stats.failed++;
      this.stats.processed++;
    }
  }

  pause(): void {
    this.paused = true;
    this.emit('paused');
  }

  resume(): void {
    this.paused = false;
    this.emit('resumed');
    this.processQueue();
  }

  clear(): void {
    this.queue = [];
    this.emit('cleared');
  }

  getStats() {
    return {
      ...this.stats,
      queued: this.queue.length,
      active: this.activeWorkers,
      total: this.totalEnqueued,
    };
  }

  getQueueSnapshot(): QueueItem[] {
    return [...this.queue];
  }

  /**
   * Wait for queue to complete all processing
   */
  waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      // If already complete, resolve immediately
      if (this.queue.length === 0 && this.activeWorkers === 0) {
        resolve();
        return;
      }

      // Listen for completion event
      this.once('completed', () => {
        resolve();
      });

      // Also check periodically in case event was missed
      const interval = setInterval(() => {
        if (this.queue.length === 0 && this.activeWorkers === 0) {
          clearInterval(interval);
          resolve();
        }
      }, 500);
    });
  }
}
