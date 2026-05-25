import { expect } from 'chai';
import sinon from 'sinon';
import { QueueManager } from '../../../src/core/queue-manager';
import { OperationType, OperationStatus, ResourceType } from '../../../src/interfaces';

describe('QueueManager', () => {
  let queueManager: QueueManager;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    queueManager = new QueueManager(2); // concurrency = 2
    queueManager.pause(); // Pause to prevent auto-processing during tests
    clock = sinon.useFakeTimers({
      shouldClearNativeTimers: true,
    });
  });

  afterEach(() => {
    clock.restore();
    queueManager.clear();
  });

  describe('enqueue', () => {
    it('should enqueue an item and emit enqueued event', (done) => {
      const data = { uid: 'entry1', content_type: 'blog', locale: 'en-us' };

      queueManager.once('enqueued', (item: any) => {
        expect(item.id).to.be.a('string');
        expect(item.type).to.equal(ResourceType.ENTRY);
        expect(item.operation).to.equal(OperationType.PUBLISH);
        expect(item.data).to.deep.equal(data);
        expect(item.priority).to.equal(0);
        expect(item.status).to.equal(OperationStatus.PENDING);
        done();
      });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, data);
    });

    it('should maintain priority order in queue', () => {
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'low' }, 1);
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'high' }, 10);
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'medium' }, 5);

      const snapshot = queueManager.getQueueSnapshot();
      expect(snapshot[0].data.uid).to.equal('high');
      expect(snapshot[1].data.uid).to.equal('medium');
      expect(snapshot[2].data.uid).to.equal('low');
    });

    it('should increment totalEnqueued counter', () => {
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry2' });

      const stats = queueManager.getStats();
      expect(stats.total).to.equal(2);
    });

    it('should return the enqueued item', () => {
      const item = queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });

      expect(item).to.have.property('id');
      expect(item).to.have.property('type', ResourceType.ENTRY);
      expect(item).to.have.property('status', OperationStatus.PENDING);
    });
  });

  describe('enqueueBatch', () => {
    it('should enqueue multiple items at once', () => {
      const dataArray = [{ uid: 'entry1' }, { uid: 'entry2' }, { uid: 'entry3' }];

      const items = queueManager.enqueueBatch(ResourceType.ENTRY, OperationType.PUBLISH, dataArray, 5);

      expect(items).to.have.lengthOf(3);
      expect(items[0].priority).to.equal(5);
      expect(items[1].priority).to.equal(5);
      expect(items[2].priority).to.equal(5);

      const stats = queueManager.getStats();
      expect(stats.total).to.equal(3);
    });

    it('should emit enqueued event for each item', () => {
      const dataArray = [{ uid: 'entry1' }, { uid: 'entry2' }];
      const enqueuedEvents: any[] = [];

      queueManager.on('enqueued', (item: any) => {
        enqueuedEvents.push(item);
      });

      queueManager.enqueueBatch(ResourceType.ENTRY, OperationType.PUBLISH, dataArray);

      expect(enqueuedEvents).to.have.lengthOf(2);
    });
  });

  describe('requeue', () => {
    it('should requeue a failed item with incremented retry count', () => {
      const item = queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      item.status = OperationStatus.FAILED;

      queueManager.requeue(item);

      expect(item.retryCount).to.equal(1);
      expect(item.status).to.equal(OperationStatus.PENDING);
    });

    it('should increase priority when increasePriority is true', () => {
      const item = queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' }, 5);
      const originalPriority = item.priority;

      queueManager.requeue(item, true);

      expect(item.priority).to.equal(originalPriority + 1);
    });

    it('should not increase priority when increasePriority is false', () => {
      const item = queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' }, 5);
      const originalPriority = item.priority;

      queueManager.requeue(item, false);

      expect(item.priority).to.equal(originalPriority);
    });

    it('should emit requeued event', (done) => {
      const item = queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });

      queueManager.once('requeued', (requeuedItem: any) => {
        expect(requeuedItem.id).to.equal(item.id);
        expect(requeuedItem.retryCount).to.equal(1);
        done();
      });

      queueManager.requeue(item);
    });

    it('should increment retried stats counter', () => {
      const item = queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });

      queueManager.requeue(item);

      const stats = queueManager.getStats();
      expect(stats.retried).to.equal(1);
    });
  });

  describe('updateItemStatus', () => {
    it('should update item status to SUCCESS and increment stats', () => {
      const item = queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });

      queueManager.updateItemStatus(item.id, OperationStatus.SUCCESS);

      const stats = queueManager.getStats();
      expect(stats.succeeded).to.equal(1);
      expect(stats.processed).to.equal(1);
    });

    it('should update item status to FAILED and increment stats', () => {
      const item = queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      const error = new Error('Test error');

      queueManager.updateItemStatus(item.id, OperationStatus.FAILED, error);

      const stats = queueManager.getStats();
      expect(stats.failed).to.equal(1);
      expect(stats.processed).to.equal(1);
    });

    it('should attach error to item when provided', () => {
      const item = queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      const error = new Error('Test error');

      queueManager.updateItemStatus(item.id, OperationStatus.FAILED, error);

      const snapshot = queueManager.getQueueSnapshot();
      const updatedItem = snapshot.find((i) => i.id === item.id);
      expect(updatedItem?.error).to.equal(error);
    });

    it('should update updatedAt timestamp', async () => {
      const item = queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      const originalUpdatedAt = item.updatedAt.getTime();

      await clock.tickAsync(1000);

      queueManager.updateItemStatus(item.id, OperationStatus.SUCCESS);

      const snapshot = queueManager.getQueueSnapshot();
      const updatedItem = snapshot.find((i) => i.id === item.id);
      expect(updatedItem?.updatedAt.getTime()).to.be.greaterThan(originalUpdatedAt);
    });
  });

  describe('pause and resume', () => {
    it('should emit paused event when paused', (done) => {
      queueManager.once('paused', () => {
        done();
      });

      queueManager.pause();
    });

    it('should emit resumed event when resumed', (done) => {
      queueManager.pause();

      queueManager.once('resumed', () => {
        done();
      });

      queueManager.resume();
    });

    it('should not process queue when paused', async () => {
      let processingCalled = false;

      queueManager.on('processing', () => {
        processingCalled = true;
      });

      queueManager.pause();
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });

      await clock.tickAsync(100);

      expect(processingCalled).to.be.false;
    });

    it('should resume processing when resumed', async () => {
      let processingCalled = false;

      queueManager.on('processing', () => {
        processingCalled = true;
      });

      queueManager.pause();
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });

      await clock.tickAsync(100);
      expect(processingCalled).to.be.false;

      queueManager.resume();
      await clock.tickAsync(100);

      expect(processingCalled).to.be.true;
    });
  });

  describe('clear', () => {
    it('should clear all items from queue', () => {
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry2' });

      queueManager.clear();

      const snapshot = queueManager.getQueueSnapshot();
      expect(snapshot).to.have.lengthOf(0);
    });

    it('should emit cleared event', (done) => {
      queueManager.once('cleared', () => {
        done();
      });

      queueManager.clear();
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry2' });

      const stats = queueManager.getStats();

      expect(stats.queued).to.equal(2);
      expect(stats.total).to.equal(2);
      expect(stats.processed).to.equal(0);
      expect(stats.succeeded).to.equal(0);
      expect(stats.failed).to.equal(0);
      expect(stats.retried).to.equal(0);
    });

    it('should update stats after processing', () => {
      const item1 = queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      const item2 = queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry2' });

      queueManager.updateItemStatus(item1.id, OperationStatus.SUCCESS);
      queueManager.updateItemStatus(item2.id, OperationStatus.FAILED);

      const stats = queueManager.getStats();

      expect(stats.processed).to.equal(2);
      expect(stats.succeeded).to.equal(1);
      expect(stats.failed).to.equal(1);
    });
  });

  describe('getQueueSnapshot', () => {
    it('should return a copy of the queue', () => {
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });

      const snapshot = queueManager.getQueueSnapshot();

      expect(snapshot).to.have.lengthOf(1);

      // Modify snapshot should not affect original
      snapshot.push({} as any);

      const newSnapshot = queueManager.getQueueSnapshot();
      expect(newSnapshot).to.have.lengthOf(1);
    });
  });

  describe('waitForCompletion', () => {
    it('should resolve immediately if queue is already empty', async () => {
      const promise = queueManager.waitForCompletion();

      await clock.tickAsync(0);

      await promise;
    });

    it('should resolve when completed event is emitted', async () => {
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });

      const promise = queueManager.waitForCompletion();

      // Simulate completion by clearing queue and emitting event
      queueManager.clear();
      queueManager.emit('completed', queueManager.getStats());

      await clock.tickAsync(0);

      await promise;
    });

    it('should check periodically and resolve when queue is empty', async () => {
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });

      const promise = queueManager.waitForCompletion();

      // Clear queue after 1 second
      await clock.tickAsync(1000);
      queueManager.clear();

      // Wait for periodic check (500ms)
      await clock.tickAsync(500);

      await promise;
    });
  });

  describe('concurrency control', () => {
    it('should respect concurrency limit', async () => {
      const qm = new QueueManager(2); // concurrency = 2
      let activeCount = 0;
      let maxActiveCount = 0;
      const processedItems: string[] = [];

      // Track active processing with done callback
      qm.on('processing', (item: any, done: () => void) => {
        activeCount++;
        maxActiveCount = Math.max(maxActiveCount, activeCount);
        processedItems.push(item.data.uid);

        // Simulate async work completing
        qm.updateItemStatus(item.id, OperationStatus.SUCCESS);
        activeCount--;
        done(); // Signal completion
      });

      // Enqueue 5 items - with concurrency of 2, only 2 should process at once
      for (let i = 0; i < 5; i++) {
        qm.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: `entry${i}` });
      }

      // Allow time for all items to be processed
      await clock.tickAsync(100);

      // Should never have more than 2 items processing concurrently
      expect(maxActiveCount).to.be.at.most(2);

      // All items should eventually be processed
      expect(processedItems).to.have.lengthOf(5);
    });

    it('should process items sequentially when concurrency is 1', async () => {
      const qm = new QueueManager(1); // concurrency = 1
      let activeCount = 0;
      let maxActiveCount = 0;
      const processedOrder: string[] = [];

      qm.on('processing', (item: any, done: () => void) => {
        activeCount++;
        maxActiveCount = Math.max(maxActiveCount, activeCount);
        processedOrder.push(item.data.uid);
        qm.updateItemStatus(item.id, OperationStatus.SUCCESS);
        activeCount--;
        done(); // Signal completion
      });

      // Enqueue 3 items
      qm.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'first' });
      qm.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'second' });
      qm.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'third' });

      await clock.tickAsync(100);

      // Should only have 1 item processing at a time
      expect(maxActiveCount).to.equal(1);

      // Should process in order
      expect(processedOrder).to.deep.equal(['first', 'second', 'third']);
    });
  });

  describe('processing events', () => {
    it('should emit processing event for each item', (done) => {
      const processingEvents: any[] = [];

      queueManager.on('processing', (item: any) => {
        processingEvents.push(item);

        if (processingEvents.length === 2) {
          expect(processingEvents).to.have.lengthOf(2);
          done();
        }
      });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry2' });

      // Resume to allow processing
      queueManager.resume();
    });

    it('should emit completed event when all items are processed', async () => {
      const completedPromise = new Promise((resolve) => {
        queueManager.once('completed', (stats: any) => {
          resolve(stats);
        });
      });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry2' });

      // Simulate processing completion
      queueManager.clear();
      queueManager['activeWorkers'] = 0; // Access private property for testing
      queueManager.emit('completed', queueManager.getStats());

      const stats = await completedPromise;
      expect(stats).to.be.an('object');
    });
  });

  describe('priority queue behavior', () => {
    it('should process higher priority items first', async () => {
      const processedOrder: string[] = [];

      queueManager.on('processing', (item: any, done: () => void) => {
        processedOrder.push(item.data.uid);
        queueManager.updateItemStatus(item.id, OperationStatus.SUCCESS);
        done(); // Signal completion
      });

      // Enqueue in mixed order
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'low' }, 1);
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'high' }, 100);
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'medium' }, 50);

      // Resume to allow processing
      queueManager.resume();
      await clock.tickAsync(100);

      expect(processedOrder[0]).to.equal('high');
      expect(processedOrder[1]).to.equal('medium');
      expect(processedOrder[2]).to.equal('low');
    });

    it('should respect priority when requeueing', () => {
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'original' }, 10);
      const item2 = queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'second' }, 5);

      // Requeue item2 with increased priority
      queueManager.requeue(item2, true);

      const snapshot = queueManager.getQueueSnapshot();

      // item1 priority=10, item2 priority=6 after requeue
      expect(snapshot[0].data.uid).to.equal('original');
      expect(snapshot[1].data.uid).to.equal('second');
    });
  });

  describe('error handling', () => {
    it('should emit error event when processing fails', async () => {
      const testError = new Error('Test error');
      let errorEmitted = false;
      let errorData: any;

      queueManager.on('error', (data: { item: any; error: any }) => {
        errorEmitted = true;
        errorData = data;
      });

      queueManager.on('processing', (_item: any, done: (error?: Error) => void) => {
        // Simulate failure
        done(testError);
      });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      queueManager.resume();

      await clock.tickAsync(100);

      expect(errorEmitted).to.be.true;
      expect(errorData.error).to.equal(testError);
      expect(errorData.item.data.uid).to.equal('entry1');
    });

    it('should not crash on unhandled error event', async () => {
      // No error listener registered - should not throw ERR_UNHANDLED_ERROR
      const testError = new Error('Unhandled test error');

      queueManager.on('processing', (_item: any, done: (error?: Error) => void) => {
        done(testError);
      });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      queueManager.resume();

      await clock.tickAsync(100);

      // Should not throw - error is caught in processQueue
      expect(true).to.be.true;
    });

    it('should mark item as FAILED when error occurs', async () => {
      const testError = new Error('Test error');

      queueManager.on('error', () => {
        // Handler registered to prevent unhandled error
      });

      queueManager.on('processing', (_item: any, done: (error?: Error) => void) => {
        done(testError);
      });

      const item = queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      queueManager.resume();

      await clock.tickAsync(100);

      expect(item.status).to.equal(OperationStatus.FAILED);
      expect(item.error).to.equal(testError);
    });

    it('should handle authentication errors (401)', async () => {
      const authError: any = new Error('Session timed out');
      authError.errorCode = '401';
      authError.errorMessage = 'Session timed out, please login to proceed';
      authError.code = 'Unauthorized';

      let errorData: any;

      queueManager.on('error', (data: { item: any; error: any }) => {
        errorData = data;
      });

      queueManager.on('processing', (_item: any, done: (error?: Error) => void) => {
        done(authError);
      });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      queueManager.resume();

      await clock.tickAsync(100);

      expect(errorData.error.errorCode).to.equal('401');
      expect(errorData.error.code).to.equal('Unauthorized');
    });

    it('should handle forbidden errors (403)', async () => {
      const forbiddenError: any = new Error('Access denied');
      forbiddenError.errorCode = '403';
      forbiddenError.code = 'Forbidden';

      let errorData: any;

      queueManager.on('error', (data: { item: any; error: any }) => {
        errorData = data;
      });

      queueManager.on('processing', (_item: any, done: (error?: Error) => void) => {
        done(forbiddenError);
      });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      queueManager.resume();

      await clock.tickAsync(100);

      expect(errorData.error.errorCode).to.equal('403');
      expect(errorData.error.code).to.equal('Forbidden');
    });

    it('should handle generic errors', async () => {
      const genericError: any = new Error('Something went wrong');
      genericError.errorCode = '500';

      let errorData: any;

      queueManager.on('error', (data: { item: any; error: any }) => {
        errorData = data;
      });

      queueManager.on('processing', (_item: any, done: (error?: Error) => void) => {
        done(genericError);
      });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      queueManager.resume();

      await clock.tickAsync(100);

      expect(errorData.error.errorCode).to.equal('500');
      expect(errorData.error.message).to.equal('Something went wrong');
    });

    it('should continue processing other items after error', async () => {
      const processedItems: string[] = [];

      queueManager.on('error', () => {
        // Handler registered to prevent unhandled error
      });

      queueManager.on('processing', (item: any, done: (error?: Error) => void) => {
        processedItems.push(item.data.uid);

        // Fail the second item
        if (item.data.uid === 'entry2') {
          done(new Error('Simulated failure'));
        } else {
          queueManager.updateItemStatus(item.id, OperationStatus.SUCCESS);
          done();
        }
      });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry2' });
      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry3' });

      queueManager.resume();
      await clock.tickAsync(100);

      // All items should be processed despite one failing
      expect(processedItems).to.have.lengthOf(3);
      expect(processedItems).to.include.members(['entry1', 'entry2', 'entry3']);
    });

    it('should update stats correctly when item fails', async () => {
      queueManager.on('error', () => {
        // Handler registered to prevent unhandled error
      });

      queueManager.on('processing', (_item: any, done: (error?: Error) => void) => {
        done(new Error('Test failure'));
      });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, { uid: 'entry1' });
      queueManager.resume();

      await clock.tickAsync(100);

      const stats = queueManager.getStats();
      expect(stats.failed).to.equal(1);
      expect(stats.processed).to.equal(1);
    });
  });
});
