import { expect } from 'chai';
import { RetryStrategy } from '../../../src/core/retry-strategy';
import { QueueItem, OperationType, OperationStatus, ResourceType } from '../../../src/interfaces';

describe('RetryStrategy', () => {
  let retryStrategy: RetryStrategy;

  beforeEach(() => {
    retryStrategy = new RetryStrategy(5, 1000, 32000, 0.2);
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const strategy = new RetryStrategy();

      expect(strategy.maxRetries).to.equal(5);
    });

    it('should initialize with custom values', () => {
      const strategy = new RetryStrategy(3, 500, 10000, 0.1);

      expect(strategy.maxRetries).to.equal(3);
    });
  });

  describe('shouldRetry', () => {
    let item: QueueItem;

    beforeEach(() => {
      item = {
        id: 'test-id',
        type: ResourceType.ENTRY,
        operation: OperationType.PUBLISH,
        data: { uid: 'entry1' },
        priority: 0,
        retryCount: 0,
        status: OperationStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    it('should return true for retryable error codes', async () => {
      const retryableErrors = [
        { errorCode: 429 },
        { status: 500 },
        { errorCode: 502 },
        { status: 503 },
        { errorCode: 504 },
        { code: 'ETIMEDOUT' },
        { code: 'ECONNRESET' },
        { code: 'ECONNREFUSED' },
      ];

      for (const error of retryableErrors) {
        const shouldRetry = await retryStrategy.shouldRetry(item, error);
        expect(shouldRetry).to.be.true;
      }
    });

    it('should return false for non-retryable error codes', async () => {
      const nonRetryableErrors = [
        { errorCode: 400 }, // Bad request
        { status: 401 }, // Unauthorized
        { errorCode: 403 }, // Forbidden
        { status: 404 }, // Not found
        { errorCode: 422 }, // Unprocessable entity
      ];

      for (const error of nonRetryableErrors) {
        const shouldRetry = await retryStrategy.shouldRetry(item, error);
        expect(shouldRetry).to.be.false;
      }
    });

    it('should return false when max retries is reached', async () => {
      item.retryCount = 5; // At max retries

      const error = { errorCode: 429 };
      const shouldRetry = await retryStrategy.shouldRetry(item, error);

      expect(shouldRetry).to.be.false;
    });

    it('should return true when retry count is below max', async () => {
      item.retryCount = 3;

      const error = { errorCode: 429 };
      const shouldRetry = await retryStrategy.shouldRetry(item, error);

      expect(shouldRetry).to.be.true;
    });

    it('should handle errors with status property', async () => {
      const error = { status: 429 };

      const shouldRetry = await retryStrategy.shouldRetry(item, error);

      expect(shouldRetry).to.be.true;
    });

    it('should handle errors with code property', async () => {
      const error = { code: 'ETIMEDOUT' };

      const shouldRetry = await retryStrategy.shouldRetry(item, error);

      expect(shouldRetry).to.be.true;
    });
  });

  describe('getDelay', () => {
    it('should return exponential backoff delay', () => {
      const delay0 = retryStrategy.getDelay(0);
      const delay1 = retryStrategy.getDelay(1);
      const delay2 = retryStrategy.getDelay(2);

      // Base delay * 2^retryCount
      // With jitter, should be approximately: 1000, 2000, 4000
      expect(delay0).to.be.within(800, 1200); // 1000 ± 20%
      expect(delay1).to.be.within(1600, 2400); // 2000 ± 20%
      expect(delay2).to.be.within(3200, 4800); // 4000 ± 20%
    });

    it('should cap delay at maxDelay', () => {
      const delay = retryStrategy.getDelay(10); // Would be 1024000ms without cap

      // With jitter, max can be maxDelay + (maxDelay * jitterFactor) = 32000 + 6400 = 38400
      expect(delay).to.be.at.most(40000);
    });

    it('should add jitter to prevent thundering herd', () => {
      const delays: number[] = [];

      // Get multiple delays for same retry count
      for (let i = 0; i < 10; i++) {
        delays.push(retryStrategy.getDelay(2));
      }

      // All delays should be different due to jitter
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).to.be.greaterThan(1);
    });

    it('should return positive delay', () => {
      for (let i = 0; i < 10; i++) {
        const delay = retryStrategy.getDelay(i);
        expect(delay).to.be.greaterThan(0);
      }
    });

    it('should increase delay with retry count', () => {
      const delay0 = retryStrategy.getDelay(0);
      const delay1 = retryStrategy.getDelay(1);
      const delay2 = retryStrategy.getDelay(2);

      // Average should increase
      expect(delay1).to.be.greaterThan(delay0 * 0.8); // Account for jitter
      expect(delay2).to.be.greaterThan(delay1 * 0.8);
    });
  });

  describe('getRateLimitDelay', () => {
    it('should return 1.5x the normal delay for rate limit errors', () => {
      const normalDelay = retryStrategy.getDelay(2);
      const rateLimitDelay = retryStrategy.getRateLimitDelay(2);
      expect(rateLimitDelay).to.be.greaterThan(normalDelay * 0.9);
    });

    it('should cap rate limit delay at maxDelay', () => {
      const delay = retryStrategy.getRateLimitDelay(10);
      expect(delay).to.be.at.most(32000);
    });

    it('should be more aggressive than normal delay', () => {
      const normalDelay = retryStrategy.getDelay(1);
      const rateLimitDelay = retryStrategy.getRateLimitDelay(1);

      expect(rateLimitDelay).to.be.greaterThan(normalDelay);
    });

    it('should return positive delay', () => {
      for (let i = 0; i < 5; i++) {
        const delay = retryStrategy.getRateLimitDelay(i);
        expect(delay).to.be.greaterThan(0);
      }
    });
  });

  describe('exponential backoff progression', () => {
    it('should follow exponential pattern', () => {
      const delays: number[] = [];

      for (let i = 0; i < 5; i++) {
        // Get average of multiple samples to reduce jitter effect
        let sum = 0;
        for (let j = 0; j < 10; j++) {
          sum += retryStrategy.getDelay(i);
        }
        delays.push(sum / 10);
      }

      // Each delay should be approximately 2x the previous
      for (let i = 1; i < delays.length; i++) {
        const ratio = delays[i] / delays[i - 1];
        expect(ratio).to.be.within(1.6, 2.4);
      }
    });

    it('should respect baseDelay', () => {
      const strategy = new RetryStrategy(5, 500, 32000, 0.1);

      const delay0 = strategy.getDelay(0);

      // First delay should be close to baseDelay
      expect(delay0).to.be.within(450, 550); // 500 ± 10%
    });

    it('should respect maxDelay', () => {
      const strategy = new RetryStrategy(5, 1000, 5000, 0.2);

      const delay10 = strategy.getDelay(10); // Would be huge without cap

      // With jitter, max can be maxDelay + (maxDelay * jitterFactor) = 5000 + 1000 = 6000
      expect(delay10).to.be.at.most(6000);
    });
  });

  describe('jitter calculation', () => {
    it('should apply jitter within specified factor', () => {
      const strategy = new RetryStrategy(5, 1000, 32000, 0.2); // 20% jitter

      const delays: number[] = [];
      for (let i = 0; i < 100; i++) {
        delays.push(strategy.getDelay(2)); // Base would be 4000ms
      }

      const min = Math.min(...delays);
      const max = Math.max(...delays);

      // Min should be around 3200 (4000 - 20%)
      // Max should be around 4800 (4000 + 20%)
      // expectedBase = 4000
      expect(min).to.be.within(3000, 3400);
      expect(max).to.be.within(4600, 5000);
    });

    it('should create varied delays', () => {
      const delays = new Set<number>();

      for (let i = 0; i < 50; i++) {
        delays.add(retryStrategy.getDelay(3));
      }

      // Should have many unique values due to jitter
      expect(delays.size).to.be.greaterThan(40);
    });
  });

  describe('custom configuration', () => {
    it('should work with different maxRetries', async () => {
      const strategy = new RetryStrategy(3, 1000, 32000, 0.2);

      const item: QueueItem = {
        id: 'test',
        type: ResourceType.ENTRY,
        operation: OperationType.PUBLISH,
        data: {},
        priority: 0,
        retryCount: 2,
        status: OperationStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const shouldRetry = await strategy.shouldRetry(item, { errorCode: 429 });
      expect(shouldRetry).to.be.true;

      item.retryCount = 3;
      const shouldNotRetry = await strategy.shouldRetry(item, { errorCode: 429 });
      expect(shouldNotRetry).to.be.false;
    });

    it('should work with different baseDelay', () => {
      const strategy = new RetryStrategy(5, 2000, 32000, 0.2);

      const delay = strategy.getDelay(0);

      expect(delay).to.be.within(1600, 2400); // 2000 ± 20%
    });

    it('should work with different maxDelay', () => {
      const strategy = new RetryStrategy(5, 1000, 10000, 0.2);

      const delay = strategy.getDelay(10);

      // With jitter, max can be maxDelay + (maxDelay * jitterFactor) = 10000 + 2000 = 12000
      expect(delay).to.be.at.most(12000);
    });

    it('should work with different jitterFactor', () => {
      const strategy = new RetryStrategy(5, 1000, 32000, 0.5); // 50% jitter

      const delays: number[] = [];
      for (let i = 0; i < 100; i++) {
        delays.push(strategy.getDelay(2)); // Base would be 4000ms
      }

      const min = Math.min(...delays);
      const max = Math.max(...delays);

      // With 50% jitter: 4000 ± 2000
      expect(min).to.be.within(1800, 2200);
      expect(max).to.be.within(5800, 6200);
    });
  });

  describe('edge cases', () => {
    it('should handle retry count of 0', () => {
      const delay = retryStrategy.getDelay(0);

      expect(delay).to.be.greaterThan(0);
      expect(delay).to.be.within(800, 1200); // baseDelay ± jitter
    });

    it('should handle very high retry counts', () => {
      const delay = retryStrategy.getDelay(100);

      // With jitter, max delay can be maxDelay + (maxDelay * jitterFactor)
      // 32000 + (32000 * 0.2) = 38400
      expect(delay).to.be.at.most(40000); // Should be capped with jitter
      expect(delay).to.be.greaterThan(0);
    });

    it('should handle error with no error code', async () => {
      const item: QueueItem = {
        id: 'test',
        type: ResourceType.ENTRY,
        operation: OperationType.PUBLISH,
        data: {},
        priority: 0,
        retryCount: 0,
        status: OperationStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const error = { message: 'Unknown error' };
      const shouldRetry = await retryStrategy.shouldRetry(item, error);

      expect(shouldRetry).to.be.false;
    });

    it('should handle null/undefined error', async () => {
      const item: QueueItem = {
        id: 'test',
        type: ResourceType.ENTRY,
        operation: OperationType.PUBLISH,
        data: {},
        priority: 0,
        retryCount: 0,
        status: OperationStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const shouldRetryNull = await retryStrategy.shouldRetry(item, null);
      const shouldRetryUndefined = await retryStrategy.shouldRetry(item, undefined);

      expect(shouldRetryNull).to.be.false;
      expect(shouldRetryUndefined).to.be.false;
    });
  });

  describe('retryable error codes', () => {
    it('should retry 429 (rate limit)', async () => {
      const item: QueueItem = {
        id: 'test',
        type: ResourceType.ENTRY,
        operation: OperationType.PUBLISH,
        data: {},
        priority: 0,
        retryCount: 0,
        status: OperationStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const shouldRetry = await retryStrategy.shouldRetry(item, { errorCode: 429 });
      expect(shouldRetry).to.be.true;
    });

    it('should retry 5xx server errors', async () => {
      const item: QueueItem = {
        id: 'test',
        type: ResourceType.ENTRY,
        operation: OperationType.PUBLISH,
        data: {},
        priority: 0,
        retryCount: 0,
        status: OperationStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const serverErrors = [500, 502, 503, 504];

      for (const errorCode of serverErrors) {
        const shouldRetry = await retryStrategy.shouldRetry(item, { errorCode });
        expect(shouldRetry).to.be.true;
      }
    });

    it('should retry network timeout errors', async () => {
      const item: QueueItem = {
        id: 'test',
        type: ResourceType.ENTRY,
        operation: OperationType.PUBLISH,
        data: {},
        priority: 0,
        retryCount: 0,
        status: OperationStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const networkErrors = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'];

      for (const code of networkErrors) {
        const shouldRetry = await retryStrategy.shouldRetry(item, { code });
        expect(shouldRetry).to.be.true;
      }
    });
  });
});
