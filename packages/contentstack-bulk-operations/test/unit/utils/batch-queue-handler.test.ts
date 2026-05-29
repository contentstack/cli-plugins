import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { OperationStatus, ResourceType } from '../../../src/interfaces';
import { setupBatchQueueListeners } from '../../../src/utils/batch-queue-handler';
import * as bulkOperationLogHandler from '../../../src/utils/bulk-operation-log-handler';

describe('Batch Queue Handler', () => {
  let queueManager: any;
  let bulkService: any;
  let batchResults: Map<string, any>;
  let logger: any;
  let retryStrategy: any;
  let processingCallback: (item: any, done: (error?: Error) => void) => void;
  let sandbox: sinon.SinonSandbox;
  let writeBulkSuccessLogStub: sinon.SinonStub;
  let writeBulkFailedLogStub: sinon.SinonStub;

  // Helper to create config object
  const createConfig = () => ({
    queueManager,
    bulkService,
    batchResults,
    logger,
    retryStrategy,
    resourceType: ResourceType.ENTRY,
    logFolderPath: './test-logs',
    apiKey: 'test-api-key',
    branch: 'main',
  });

  // Helper to call processing callback with done
  const callProcessing = (item: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      processingCallback(item, (error?: Error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock file system operations to prevent actual file writes
    writeBulkSuccessLogStub = sandbox.stub(bulkOperationLogHandler, 'writeBulkSuccessLog');
    writeBulkFailedLogStub = sandbox.stub(bulkOperationLogHandler, 'writeBulkFailedLog');

    // Create mock instances
    queueManager = {
      on: sandbox.stub().callsFake((event: string, callback: Function) => {
        if (event === 'processing') {
          processingCallback = callback as any;
        }
        // 'completed' event is also registered but not tested directly
      }),
      updateItemStatus: sandbox.stub(),
      requeue: sandbox.stub(),
    };

    bulkService = {
      executeBulkPublish: sandbox.stub(),
    };

    retryStrategy = {
      shouldRetry: sandbox.stub().resolves(false),
      getDelay: sandbox.stub().returns(10), // Short delay for tests
      getRateLimitDelay: sandbox.stub().returns(10),
      maxRetries: 3,
    };

    batchResults = new Map();

    logger = {
      info: sandbox.stub(),
      error: sandbox.stub(),
      warn: sandbox.stub(),
      debug: sandbox.stub(),
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('setupBatchQueueListeners', () => {
    it('should register processing and completed event listeners', () => {
      setupBatchQueueListeners(createConfig());

      expect(queueManager.on.callCount).to.equal(3); // processing, completed, error
      expect(queueManager.on.firstCall.args[0]).to.equal('processing');
      expect(queueManager.on.secondCall.args[0]).to.equal('completed');
      expect(queueManager.on.thirdCall.args[0]).to.equal('error');
    });

    it('should skip processing items without batchNumber (single-mode items)', async () => {
      setupBatchQueueListeners(createConfig());

      const item = {
        id: 'item-1',
        data: {
          // No batchNumber - should be skipped
          items: [{ uid: 'entry1' }],
          locales: ['en-us'],
          environments: ['prod'],
        },
      };

      await callProcessing(item);

      // Should not call bulkService.executeBulkPublish
      expect(bulkService.executeBulkPublish.called).to.be.false;
      expect(logger.info.called).to.be.false;
    });

    it('should process batch items successfully', async () => {
      setupBatchQueueListeners(createConfig());

      const mockResult = {
        jobId: 'job-1',
        status: 'completed',
        success: 5,
        failed: 0,
        items: [],
      };

      bulkService.executeBulkPublish.resolves(mockResult);

      const item = {
        id: 'batch-1',
        data: {
          batchNumber: 1,
          totalBatches: 3,
          items: [{ uid: 'entry1' }, { uid: 'entry2' }, { uid: 'entry3' }, { uid: 'entry4' }, { uid: 'entry5' }],
          locales: ['en-us', 'de-de'],
          environments: ['prod', 'staging'],
          operation: 'publish',
        },
      };

      await callProcessing(item);

      // Verify processing log
      expect(logger.info.calledWith(sinon.match(/Processing batch 1\/3/))).to.be.true;

      // Verify bulk service called
      expect(bulkService.executeBulkPublish.called).to.be.true;

      // Verify result stored
      expect(batchResults.get('batch-1')).to.deep.equal(mockResult);

      // Verify status updated to SUCCESS
      expect(queueManager.updateItemStatus.calledWith('batch-1', OperationStatus.SUCCESS)).to.be.true;

      // Verify log written (mocked, not actual file)
      expect(writeBulkSuccessLogStub.called).to.be.true;
      const logEntry = writeBulkSuccessLogStub.firstCall.args[0];
      expect(logEntry.mode).to.equal('bulk');
      expect(logEntry.jobId).to.equal('job-1');
      expect(logEntry.status).to.equal('success');
    });

    it('should handle batch processing failures with non-retryable error', async () => {
      setupBatchQueueListeners(createConfig());

      const error = new Error('Bulk publish failed');
      bulkService.executeBulkPublish.rejects(error);
      retryStrategy.shouldRetry.resolves(false);

      const item = {
        id: 'batch-2',
        retryCount: 0,
        data: {
          batchNumber: 2,
          totalBatches: 3,
          items: [{ uid: 'entry1' }, { uid: 'entry2' }],
          locales: ['en-us'],
          environments: ['prod'],
          operation: 'publish',
        },
      };

      // Should not throw, but should complete with error handling
      try {
        await callProcessing(item);
      } catch {
        // Expected for non-retryable errors
      }

      // Verify status updated to FAILED
      expect(queueManager.updateItemStatus.calledWith('batch-2', OperationStatus.FAILED, error)).to.be.true;

      // Verify failed log written
      expect(writeBulkFailedLogStub.called).to.be.true;
      const logEntry = writeBulkFailedLogStub.firstCall.args[0];
      expect(logEntry.status).to.equal('failed');
      expect(logEntry.error).to.equal('Bulk publish failed');
    });

    it('should retry batch on retryable error', async () => {
      setupBatchQueueListeners(createConfig());

      const error = new Error('Server error');
      (error as any).errorCode = 500;

      bulkService.executeBulkPublish.rejects(error);
      retryStrategy.shouldRetry.resolves(true);

      const item = {
        id: 'batch-3',
        retryCount: 0,
        data: {
          batchNumber: 3,
          totalBatches: 3,
          items: [{ uid: 'entry1' }],
          locales: ['en-us'],
          environments: ['prod'],
          operation: 'publish',
        },
      };

      await callProcessing(item);

      // Verify requeue called
      expect(queueManager.requeue.calledWith(item, true)).to.be.true;
      expect(logger.warn.called).to.be.true;
    });

    it('should handle empty batch items', async () => {
      setupBatchQueueListeners(createConfig());

      const mockResult = {
        jobId: 'job-empty',
        status: 'completed',
        success: 0,
        failed: 0,
        items: [],
      };

      bulkService.executeBulkPublish.resolves(mockResult);

      const item = {
        id: 'batch-empty',
        data: {
          batchNumber: 1,
          totalBatches: 1,
          items: [],
          locales: ['en-us'],
          environments: ['prod'],
          operation: 'publish',
        },
      };

      await callProcessing(item);

      expect(bulkService.executeBulkPublish.called).to.be.true;
      expect(batchResults.get('batch-empty')).to.deep.equal(mockResult);
    });

    it('should process multiple batches sequentially', async () => {
      setupBatchQueueListeners(createConfig());

      const mockResult1 = { jobId: 'job-1', status: 'completed', success: 2, failed: 0 };
      const mockResult2 = { jobId: 'job-2', status: 'completed', success: 3, failed: 0 };

      bulkService.executeBulkPublish.onFirstCall().resolves(mockResult1).onSecondCall().resolves(mockResult2);

      const batch1 = {
        id: 'batch-1',
        data: {
          batchNumber: 1,
          totalBatches: 2,
          items: [{ uid: 'e1' }, { uid: 'e2' }],
          locales: ['en-us'],
          environments: ['prod'],
          operation: 'publish',
        },
      };

      const batch2 = {
        id: 'batch-2',
        data: {
          batchNumber: 2,
          totalBatches: 2,
          items: [{ uid: 'e3' }, { uid: 'e4' }, { uid: 'e5' }],
          locales: ['en-us'],
          environments: ['prod'],
          operation: 'publish',
        },
      };

      await callProcessing(batch1);
      await callProcessing(batch2);

      expect(batchResults.get('batch-1')).to.deep.equal(mockResult1);
      expect(batchResults.get('batch-2')).to.deep.equal(mockResult2);
    });

    it('should handle unpublish operation', async () => {
      setupBatchQueueListeners(createConfig());

      const mockResult = { jobId: 'job-unpub', status: 'completed', success: 1, failed: 0 };
      bulkService.executeBulkPublish.resolves(mockResult);

      const item = {
        id: 'batch-unpub',
        data: {
          batchNumber: 1,
          totalBatches: 1,
          items: [{ uid: 'entry1' }],
          locales: ['en-us'],
          environments: ['prod'],
          operation: 'unpublish',
        },
      };

      await callProcessing(item);

      expect(bulkService.executeBulkPublish.calledWith(item.data.items, 'unpublish', ResourceType.ENTRY)).to.be.true;
    });

    it('should pass resourceType to bulk service', async () => {
      const assetConfig = { ...createConfig(), resourceType: ResourceType.ASSET };
      setupBatchQueueListeners(assetConfig);

      const mockResult = { jobId: 'job-asset', status: 'completed', success: 1, failed: 0 };
      bulkService.executeBulkPublish.resolves(mockResult);

      const item = {
        id: 'batch-asset',
        data: {
          batchNumber: 1,
          totalBatches: 1,
          items: [{ uid: 'asset1' }],
          locales: ['en-us'],
          environments: ['prod'],
          operation: 'publish',
        },
      };

      await callProcessing(item);

      expect(bulkService.executeBulkPublish.calledWith(item.data.items, 'publish', ResourceType.ASSET)).to.be.true;
    });
  });

  describe('error event handling', () => {
    let errorCallback: (data: { item: any; error: any }) => void;

    beforeEach(() => {
      queueManager.on = sinon.stub().callsFake((event: string, callback: any) => {
        if (event === 'processing') {
          processingCallback = callback;
        } else if (event === 'error') {
          errorCallback = callback;
        }
      });

      batchResults = new Map();
      logger = {
        info: sinon.stub(),
        debug: sinon.stub(),
        warn: sinon.stub(),
        error: sinon.stub(),
      };
      retryStrategy = {
        shouldRetry: sinon.stub().resolves(false),
        maxRetries: 3,
        getDelay: sinon.stub().returns(0),
        getRateLimitDelay: sinon.stub().returns(0),
      };
    });

    it('should register an error event handler', () => {
      setupBatchQueueListeners(createConfig());

      // Verify error handler was registered
      const errorHandlerCall = queueManager.on.getCalls().find((call: any) => call.args[0] === 'error');
      expect(errorHandlerCall).to.exist;
    });

    it('should handle authentication errors (401)', () => {
      setupBatchQueueListeners(createConfig());

      const authError: any = new Error('Session timed out');
      authError.errorCode = '401';
      authError.errorMessage = 'Session timed out, please login to proceed';
      authError.code = 'Unauthorized';

      const item = {
        id: 'batch-401',
        data: {
          batchNumber: 1,
          totalBatches: 2,
          items: [{ uid: 'entry1', locale: 'en-us', content_type: 'blog' }],
          locales: ['en-us'],
          environments: ['prod'],
          operation: 'publish',
        },
      };

      errorCallback({ item, error: authError });

      // Verify failed log was written
      expect(writeBulkFailedLogStub.calledOnce).to.be.true;
      const logEntry = writeBulkFailedLogStub.firstCall.args[0];
      expect(logEntry.status).to.equal('failed');
      expect(logEntry.error).to.equal('Session timed out');

      // Verify batch results
      expect(batchResults.get(item.id)).to.deep.include({
        jobId: item.id,
        status: 'failed',
        success: 0,
        failed: 1,
      });

      // Verify queue status update
      expect(queueManager.updateItemStatus.calledWith(item.id, OperationStatus.FAILED, authError)).to.be.true;
    });

    it('should handle forbidden errors (403)', () => {
      setupBatchQueueListeners(createConfig());

      const forbiddenError: any = new Error('Access denied');
      forbiddenError.errorCode = '403';
      forbiddenError.code = 'Forbidden';

      const item = {
        id: 'batch-403',
        data: {
          batchNumber: 1,
          totalBatches: 1,
          items: [{ uid: 'entry1', locale: 'en-us', content_type: 'blog' }],
          locales: ['en-us'],
          environments: ['prod'],
          operation: 'publish',
        },
      };

      errorCallback({ item, error: forbiddenError });

      // Verify batch results updated
      expect(batchResults.get(item.id)).to.exist;
      expect(batchResults.get(item.id).status).to.equal('failed');
    });

    it('should handle generic errors', () => {
      setupBatchQueueListeners(createConfig());

      const genericError: any = new Error('Network timeout');
      genericError.errorCode = '500';
      genericError.code = 'InternalServerError';

      const item = {
        id: 'batch-500',
        data: {
          batchNumber: 1,
          totalBatches: 1,
          items: [{ uid: 'entry1', locale: 'en-us', content_type: 'blog' }],
          locales: ['en-us'],
          environments: ['prod'],
          operation: 'publish',
        },
      };

      errorCallback({ item, error: genericError });

      // Verify batch results
      expect(batchResults.get(item.id)).to.exist;
      expect(batchResults.get(item.id).status).to.equal('failed');

      // Verify failed log was written
      expect(writeBulkFailedLogStub.calledOnce).to.be.true;
    });

    it('should handle errors with missing error codes', () => {
      setupBatchQueueListeners(createConfig());

      const unknownError: any = new Error('Unknown error');
      // No errorCode or code properties

      const item = {
        id: 'batch-unknown',
        data: {
          batchNumber: 1,
          totalBatches: 1,
          items: [{ uid: 'entry1', locale: 'en-us', content_type: 'blog' }],
          locales: ['en-us'],
          environments: ['prod'],
          operation: 'publish',
        },
      };

      errorCallback({ item, error: unknownError });

      // Should handle gracefully - handleAndLogError will process it
      expect(batchResults.get(item.id)).to.exist;
      expect(writeBulkFailedLogStub.calledOnce).to.be.true;
    });

    it('should write failed log with correct structure', () => {
      setupBatchQueueListeners(createConfig());

      const error: any = new Error('Test error');
      error.errorCode = '500';

      const item = {
        id: 'batch-log',
        data: {
          batchNumber: 2,
          totalBatches: 5,
          items: [
            { uid: 'entry1', locale: 'en-us', content_type: 'blog', version: 1 },
            { uid: 'entry2', locale: 'en-us', content_type: 'page', version: 2 },
          ],
          locales: ['en-us'],
          environments: ['prod', 'staging'],
          operation: 'publish',
        },
      };

      // Call the error callback that was registered
      if (errorCallback) {
        errorCallback({ item, error });
      }

      expect(writeBulkFailedLogStub.calledOnce).to.be.true;

      const logEntry = writeBulkFailedLogStub.firstCall.args[0];
      expect(logEntry).to.deep.include({
        mode: 'bulk',
        jobId: item.id,
        batchNumber: 2,
        operation: 'publish',
        status: 'failed',
        apiKey: 'test-api-key',
        branch: 'main',
      });
      expect(logEntry.items).to.have.lengthOf(2);
      expect(logEntry.environments).to.deep.equal(['prod', 'staging']);
      expect(logEntry.locales).to.deep.equal(['en-us']);
      expect(logEntry.error).to.equal('Test error');
    });

    it('should update queue statistics correctly', () => {
      setupBatchQueueListeners(createConfig());

      const error: any = new Error('Test error');
      const item = {
        id: 'batch-stats',
        data: {
          batchNumber: 1,
          totalBatches: 1,
          items: [{ uid: 'entry1', locale: 'en-us', content_type: 'blog' }],
          locales: ['en-us'],
          environments: ['prod'],
          operation: 'publish',
        },
      };

      errorCallback({ item, error });

      expect(queueManager.updateItemStatus.calledOnce).to.be.true;
      expect(queueManager.updateItemStatus.calledWith(item.id, OperationStatus.FAILED, error)).to.be.true;
    });

    it('should not crash when logging is disabled', () => {
      const configWithoutLogging = {
        ...createConfig(),
        logFolderPath: undefined,
        apiKey: undefined,
      };

      setupBatchQueueListeners(configWithoutLogging);

      const error: any = new Error('Test error');
      const item = {
        id: 'batch-no-log',
        data: {
          batchNumber: 1,
          totalBatches: 1,
          items: [{ uid: 'entry1', locale: 'en-us', content_type: 'blog' }],
          locales: ['en-us'],
          environments: ['prod'],
          operation: 'publish',
        },
      };

      // Should not throw
      expect(() => errorCallback({ item, error })).to.not.throw();

      // Should not write logs
      expect(writeBulkFailedLogStub.called).to.be.false;
    });
  });
});
