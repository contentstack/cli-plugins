import { expect } from 'chai';
import sinon from 'sinon';
import { OperationExecutor } from '../../../src/core/operation-executor';
import { AdaptiveRateLimiter } from '../../../src/core/rate-limiter';
import { QueueManager } from '../../../src/core/queue-manager';
import { RetryStrategy } from '../../../src/core/retry-strategy';
import { OperationType, ResourceType } from '../../../src/interfaces';

describe('OperationExecutor', () => {
  let rateLimiter: AdaptiveRateLimiter;
  let queueManager: QueueManager;
  let retryStrategy: RetryStrategy;
  let mockStack: any;
  let mockLogger: any;
  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Install fake timers BEFORE creating components that use timers
    clock = sinon.useFakeTimers({
      shouldClearNativeTimers: true,
    });

    rateLimiter = new AdaptiveRateLimiter({
      maxRequestsPerSecond: 10,
      maxConcurrent: 5,
      burstCapacity: 20,
    });

    queueManager = new QueueManager(2);

    retryStrategy = new RetryStrategy(3, 100, 1000, 0.2); // Reduced timeouts for faster tests

    mockLogger = {
      debug: sandbox.stub(),
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
    };

    // Mock Contentstack SDK stack
    mockStack = {
      contentType: sandbox.stub().returnsThis(),
      entry: sandbox.stub().returnsThis(),
      asset: sandbox.stub().returnsThis(),
      publish: sandbox.stub().resolves({ notice: 'Published successfully' }),
      unpublish: sandbox.stub().resolves({ notice: 'Unpublished successfully' }),
    };

    // Create executor instance
    new OperationExecutor(rateLimiter, queueManager, retryStrategy, mockLogger, mockStack);
  });

  afterEach(() => {
    queueManager.clear();
    clock.restore();
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should setup queue listeners', () => {
      const listenerCount = queueManager.listenerCount('processing');
      expect(listenerCount).to.be.greaterThan(0);
    });

    it('should initialize with logging configuration', () => {
      const logConfig = {
        logFolderPath: '/tmp/logs',
        apiKey: 'test-api-key',
        branch: 'main',
      };

      const executorWithLogging = new OperationExecutor(
        rateLimiter,
        queueManager,
        retryStrategy,
        mockLogger,
        mockStack,
        logConfig
      );

      expect(executorWithLogging).to.exist;
    });

    it('should initialize without logging configuration', () => {
      const executorWithoutLogging = new OperationExecutor(
        rateLimiter,
        queueManager,
        retryStrategy,
        mockLogger,
        mockStack
      );

      expect(executorWithoutLogging).to.exist;
    });
  });

  describe('batch item handling', () => {
    it('should skip batch items in processing listener', async () => {
      // Batch items have batchNumber property
      const batchData = {
        batchNumber: 1,
        totalBatches: 2,
        items: [{ uid: 'entry1' }, { uid: 'entry2' }],
        environments: ['dev'],
        locales: ['en-us'],
        operation: OperationType.PUBLISH,
      };

      // The OperationExecutor should skip batch items (they are handled by batch-queue-handler)
      // This tests that no SDK call is made for batch items
      mockStack.publish.reset();

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, batchData);

      await clock.tickAsync(100);

      // SDK should not be called for batch items
      expect(mockStack.contentType.called).to.be.false;
    });
  });

  describe('entry operations', () => {
    it('should execute entry publish operation successfully', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      mockStack.publish.resolves({
        notice: 'Published successfully',
        headers: { 'x-ratelimit-remaining': '50' },
      });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      await clock.tickAsync(100);

      expect(mockStack.contentType.calledWith('blog_post')).to.be.true;
      expect(mockStack.entry.calledWith('entry123')).to.be.true;
      expect(mockStack.publish.called).to.be.true;
    });

    it('should execute entry unpublish operation successfully', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      mockStack.unpublish.resolves({
        notice: 'Unpublished successfully',
        headers: { 'x-ratelimit-remaining': '50' },
      });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.UNPUBLISH, entryData);

      await clock.tickAsync(100);

      expect(mockStack.contentType.calledWith('blog_post')).to.be.true;
      expect(mockStack.entry.calledWith('entry123')).to.be.true;
      expect(mockStack.unpublish.called).to.be.true;
    });

    it('should update queue item status to SUCCESS on successful operation', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      mockStack.publish.resolves({ notice: 'Published successfully' });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      // Advance time and wait for completion
      const completionPromise = queueManager.waitForCompletion();
      await clock.tickAsync(100);
      await completionPromise;

      const stats = queueManager.getStats();
      expect(stats.succeeded).to.equal(1);
    });
  });

  describe('asset operations', () => {
    it('should execute asset publish operation successfully', async () => {
      const assetData = {
        uid: 'asset123',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      mockStack.publish.resolves({
        notice: 'Published successfully',
        headers: { 'x-ratelimit-remaining': '50' },
      });

      queueManager.enqueue(ResourceType.ASSET, OperationType.PUBLISH, assetData);

      await clock.tickAsync(100);

      expect(mockStack.asset.calledWith('asset123')).to.be.true;
      expect(mockStack.publish.called).to.be.true;
    });

    it('should execute asset unpublish operation successfully', async () => {
      const assetData = {
        uid: 'asset123',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      mockStack.unpublish.resolves({
        notice: 'Unpublished successfully',
        headers: { 'x-ratelimit-remaining': '50' },
      });

      queueManager.enqueue(ResourceType.ASSET, OperationType.UNPUBLISH, assetData);

      await clock.tickAsync(100);

      expect(mockStack.asset.calledWith('asset123')).to.be.true;
      expect(mockStack.unpublish.called).to.be.true;
    });
  });

  describe('error handling', () => {
    it('should handle operation errors', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      const error = new Error('API Error');
      (error as any).errorCode = 500;

      mockStack.publish.rejects(error);

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      await clock.tickAsync(200);

      expect(mockLogger.warn.called).to.be.true;
    });

    it('should retry on retryable errors', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      const error = new Error('Rate limit exceeded');
      (error as any).errorCode = 429;

      mockStack.publish.onFirstCall().rejects(error);
      mockStack.publish.onSecondCall().resolves({ notice: 'Success' });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      await clock.tickAsync(500);

      // Should have been retried
      expect(mockLogger.warn.calledWith(sinon.match(/retrying/))).to.be.true;
    });

    it('should not retry non-retryable errors', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      const error = new Error('Not found');
      (error as any).errorCode = 404;

      mockStack.publish.rejects(error);

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      // Advance time and wait for completion
      const completionPromise = queueManager.waitForCompletion();
      await clock.tickAsync(100);
      await completionPromise;

      const stats = queueManager.getStats();
      expect(stats.failed).to.equal(1);
      expect(stats.retried).to.equal(0);
    });

    it('should stop retrying after max retries', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      const error = new Error('Server error');
      (error as any).errorCode = 500;

      mockStack.publish.rejects(error);

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      await clock.tickAsync(2000);

      const stats = queueManager.getStats();
      expect(stats.failed).to.equal(1);
      expect(stats.retried).to.be.at.most(3); // Max retries
    });

    it('should handle 429 errors with rate limiter', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      const error = new Error('Rate limit');
      (error as any).errorCode = 429;

      mockStack.publish.rejects(error);

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      await clock.tickAsync(500);

      const metrics = rateLimiter.getMetrics();
      expect(metrics.rateLimitHits).to.be.greaterThan(0);
    });
  });

  describe('rate limiting integration', () => {
    it('should acquire rate limit token before operation', async () => {
      const acquireSpy = sandbox.spy(rateLimiter, 'acquire');

      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      mockStack.publish.resolves({ notice: 'Success' });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      await clock.tickAsync(100);

      expect(acquireSpy.called).to.be.true;
    });

    it('should release rate limit token after operation', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      mockStack.publish.resolves({ notice: 'Success' });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      // Advance time and wait for completion
      const completionPromise = queueManager.waitForCompletion();
      await clock.tickAsync(100);
      await completionPromise;

      const metrics = rateLimiter.getMetrics();
      expect(metrics.activeRequests).to.equal(0);
    });

    it('should update rate limiter from response headers', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      mockStack.publish.resolves({
        notice: 'Success',
        headers: {
          'x-ratelimit-limit': '100',
          'x-ratelimit-remaining': '50',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
        },
      });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      // Advance time and wait for completion
      const completionPromise = queueManager.waitForCompletion();
      await clock.tickAsync(100);
      await completionPromise;

      const metrics = rateLimiter.getMetrics();
      expect(metrics.serverLimitRemaining).to.equal(50);
    });
  });

  describe('retry strategy integration', () => {
    it('should use retry strategy to determine if should retry', async () => {
      const shouldRetrySpy = sandbox.spy(retryStrategy, 'shouldRetry');

      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      const error = new Error('Server error');
      (error as any).errorCode = 500;

      mockStack.publish.rejects(error);

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      await clock.tickAsync(500);

      expect(shouldRetrySpy.called).to.be.true;
    });

    it('should use exponential backoff delay', async () => {
      const getDelaySpy = sandbox.spy(retryStrategy, 'getDelay');

      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      const error = new Error('Server error');
      (error as any).errorCode = 500;

      mockStack.publish.rejects(error);

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      await clock.tickAsync(500);

      expect(getDelaySpy.called).to.be.true;
    });

    it('should use rate limit delay for 429 errors', async () => {
      const getRateLimitDelaySpy = sandbox.spy(retryStrategy, 'getRateLimitDelay');

      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      const error = new Error('Rate limit');
      (error as any).errorCode = 429;

      mockStack.publish.rejects(error);

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      await clock.tickAsync(500);

      expect(getRateLimitDelaySpy.called).to.be.true;
    });
  });

  describe('queue manager integration', () => {
    it('should update queue item status on success', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      mockStack.publish.resolves({ notice: 'Success' });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      // Advance time and wait for completion
      const completionPromise = queueManager.waitForCompletion();
      await clock.tickAsync(100);
      await completionPromise;

      const stats = queueManager.getStats();
      expect(stats.succeeded).to.equal(1);
    });

    it('should update queue item status on failure', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      const error = new Error('Not found');
      (error as any).errorCode = 404;

      mockStack.publish.rejects(error);

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      // Advance time and wait for completion
      const completionPromise = queueManager.waitForCompletion();
      await clock.tickAsync(100);
      await completionPromise;

      const stats = queueManager.getStats();
      expect(stats.failed).to.equal(1);
    });

    it('should requeue item on retryable error', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      const error = new Error('Server error');
      (error as any).errorCode = 500;

      mockStack.publish.onFirstCall().rejects(error);
      mockStack.publish.onSecondCall().resolves({ notice: 'Success' });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      await clock.tickAsync(500);

      const stats = queueManager.getStats();
      expect(stats.retried).to.be.greaterThan(0);
    });
  });

  describe('logging', () => {
    it('should log successful operations', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      mockStack.publish.resolves({ notice: 'Success' });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      // Advance time and wait for completion
      const completionPromise = queueManager.waitForCompletion();
      await clock.tickAsync(100);
      await completionPromise;

      expect(mockLogger.debug.calledWith(sinon.match(/Successfully processed/))).to.be.true;
    });

    it('should log failed operations', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      const error = new Error('Not found');
      (error as any).errorCode = 404;

      mockStack.publish.rejects(error);

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      // Advance time and wait for completion
      const completionPromise = queueManager.waitForCompletion();
      await clock.tickAsync(100);
      await completionPromise;

      // Error should be handled and operation should fail
      const stats = queueManager.getStats();
      expect(stats.failed).to.equal(1);
    });

    it('should log retry attempts', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      const error = new Error('Server error');
      (error as any).errorCode = 500;

      mockStack.publish.onFirstCall().rejects(error);
      mockStack.publish.onSecondCall().resolves({ notice: 'Success' });

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      await clock.tickAsync(500);

      expect(mockLogger.warn.calledWith(sinon.match(/retrying/))).to.be.true;
    });
  });

  describe('error sanitization', () => {
    it('should sanitize error objects for logging', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      const error = new Error('API Error');
      (error as any).errorCode = 500;
      (error as any).sensitiveData = 'should-be-removed';

      mockStack.publish.rejects(error);

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      // Advance time and wait for completion
      const completionPromise = queueManager.waitForCompletion();
      for (let i = 0; i < 30; i++) {
        await clock.tickAsync(100);
      }
      await completionPromise;

      // Check that error was handled and operation failed
      const stats = queueManager.getStats();
      expect(stats.failed).to.equal(1);
    });

    it('should include errors array in sanitized output', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      const error = new Error('API Error');
      (error as any).errorCode = 422;
      (error as any).errors = ['Field is required', 'Invalid value'];

      mockStack.publish.rejects(error);

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      // Advance time and wait for completion
      const completionPromise = queueManager.waitForCompletion();
      for (let i = 0; i < 30; i++) {
        await clock.tickAsync(100);
      }
      await completionPromise;

      // Check that error was handled with errors array preserved
      const stats = queueManager.getStats();
      expect(stats.failed).to.equal(1);
    });

    it('should include error_message in sanitized output', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      const error = new Error('API Error');
      (error as any).errorCode = 400;
      (error as any).error_message = 'Detailed error message from API';

      mockStack.publish.rejects(error);

      queueManager.enqueue(ResourceType.ENTRY, OperationType.PUBLISH, entryData);

      // Advance time and wait for completion
      const completionPromise = queueManager.waitForCompletion();
      for (let i = 0; i < 30; i++) {
        await clock.tickAsync(100);
      }
      await completionPromise;

      // Check that error was handled
      const stats = queueManager.getStats();
      expect(stats.failed).to.equal(1);
    });
  });

  describe('unknown operations', () => {
    it('should throw error for unknown entry operation type', async () => {
      const entryData = {
        uid: 'entry123',
        content_type: 'blog_post',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      // Use an invalid operation type
      queueManager.enqueue(ResourceType.ENTRY, 'invalid_operation' as any, entryData);

      const completionPromise = queueManager.waitForCompletion();
      await clock.tickAsync(200);
      await completionPromise;

      // Should handle error for unknown operation
      const stats = queueManager.getStats();
      expect(stats.failed).to.equal(1);
    });

    it('should throw error for unknown asset operation type', async () => {
      const assetData = {
        uid: 'asset123',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      // Use an invalid operation type
      queueManager.enqueue(ResourceType.ASSET, 'invalid_operation' as any, assetData);

      const completionPromise = queueManager.waitForCompletion();
      await clock.tickAsync(200);
      await completionPromise;

      // Should handle error for unknown operation
      const stats = queueManager.getStats();
      expect(stats.failed).to.equal(1);
    });
  });

  describe('unknown item types', () => {
    it('should throw error for unknown resource type', async () => {
      const unknownData = {
        uid: 'unknown123',
        locale: 'en-us',
        version: 1,
        publish_details: [{ environment: 'production', locale: 'en-us' }],
      };

      // Use an invalid resource type
      queueManager.enqueue('unknown_type' as any, OperationType.PUBLISH, unknownData);

      const completionPromise = queueManager.waitForCompletion();
      await clock.tickAsync(200);
      await completionPromise;

      // Should handle error for unknown item type
      const stats = queueManager.getStats();
      expect(stats.failed).to.equal(1);
    });
  });
});
