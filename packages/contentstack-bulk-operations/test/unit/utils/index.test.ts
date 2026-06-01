import chalk from 'chalk';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { logSummary } from '../../../src/utils';
import {
  sleep,
  formatDuration,
  isRateLimitError,
  getErrorCode,
  aggregateBatchResults,
  createOperationResult,
  formatCompletionMessage,
} from '../../../src/utils/helpers';
import messages, { $t } from '../../../src/messages';

describe('Utils', () => {
  let sandbox: sinon.SinonSandbox;
  let consoleLogStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    consoleLogStub = sandbox.stub(console, 'log');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('logSummary', () => {
    it('should log summary with success count', () => {
      const result = {
        success: 10,
        failed: 0,
        total: 10,
      };

      logSummary(result);

      expect(consoleLogStub.calledWith(sinon.match(/Operation Summary/))).to.be.true;
      expect(consoleLogStub.calledWith(chalk.green('  ' + $t(messages.SUCCESSFUL, { count: 10 })))).to.be.true;
    });

    it('should log failed count when present', () => {
      const result = {
        success: 8,
        failed: 2,
        total: 10,
      };

      logSummary(result);

      expect(consoleLogStub.calledWith(chalk.red('  ' + $t(messages.FAILED, { count: 2 })))).to.be.true;
    });

    it('should log skipped count when present', () => {
      const result = {
        success: 8,
        failed: 0,
        skipped: 2,
        total: 10,
      };

      logSummary(result);

      expect(consoleLogStub.calledWith(chalk.yellow('  ' + $t(messages.SKIPPED, { count: 2 })))).to.be.true;
    });

    it('should log file paths when present', () => {
      const result = {
        success: 10,
        failed: 0,
        total: 10,
      };

      logSummary(result);

      // Now logs using getLogPath() rather than individual logFiles
      expect(consoleLogStub.calledWith(sinon.match(/Log files/))).to.be.true;
    });

    it('should handle alternative count property names', () => {
      const result = {
        successCount: 10,
        failureCount: 2,
        total: 12,
      };

      logSummary(result);

      expect(consoleLogStub.calledWith(chalk.green('  ' + $t(messages.SUCCESSFUL, { count: 10 })))).to.be.true;
      expect(consoleLogStub.calledWith(chalk.red('  ' + $t(messages.FAILED, { count: 2 })))).to.be.true;
    });

    it('should handle only success log file', () => {
      const result = {
        success: 15,
        failed: 0,
        total: 15,
      };

      logSummary(result);

      // Should log success count
      expect(consoleLogStub.calledWith(sinon.match(/Successful/))).to.be.true;
    });

    it('should handle zero counts gracefully', () => {
      const result = {
        success: 0,
        failed: 0,
        total: 0,
      };

      logSummary(result);

      expect(consoleLogStub.calledWith(chalk.green('  ' + $t(messages.SUCCESSFUL, { count: 0 })))).to.be.true;
    });

    it('should use console.log for output', () => {
      const result = {
        success: 5,
        failed: 1,
      };

      logSummary(result);

      // Verify that console.log was called
      expect(consoleLogStub.called).to.be.true;
      expect(consoleLogStub.callCount).to.be.greaterThan(0);
    });

    it('should display separators correctly', () => {
      const result = {
        success: 10,
        failed: 0,
      };

      logSummary(result);

      expect(consoleLogStub.calledWith(chalk.gray('─'.repeat(50)))).to.be.true;
    });
  });

  describe('sleep', () => {
    it('should delay execution for specified milliseconds', async () => {
      const startTime = Date.now();
      await sleep(100);
      const endTime = Date.now();

      expect(endTime - startTime).to.be.at.least(95); // Allow small margin
      expect(endTime - startTime).to.be.at.most(150); // Allow reasonable variance
    });

    it('should return a promise', () => {
      const result = sleep(10);
      expect(result).to.be.instanceOf(Promise);
    });

    it('should handle zero delay', async () => {
      const startTime = Date.now();
      await sleep(0);
      const endTime = Date.now();

      expect(endTime - startTime).to.be.at.most(50);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds to seconds with 2 decimals', () => {
      expect(formatDuration(1000)).to.equal('1.00');
      expect(formatDuration(1500)).to.equal('1.50');
      expect(formatDuration(12345)).to.equal('12.35');
    });

    it('should handle zero duration', () => {
      expect(formatDuration(0)).to.equal('0.00');
    });

    it('should handle small durations', () => {
      expect(formatDuration(123)).to.equal('0.12');
      expect(formatDuration(1)).to.equal('0.00');
    });

    it('should handle large durations', () => {
      expect(formatDuration(120000)).to.equal('120.00');
      expect(formatDuration(3661234)).to.equal('3661.23');
    });
  });

  describe('isRateLimitError', () => {
    it('should return true for 429 errorCode', () => {
      expect(isRateLimitError({ errorCode: 429 })).to.be.true;
    });

    it('should return true for 429 status', () => {
      expect(isRateLimitError({ status: 429 })).to.be.true;
    });

    it('should return false for non-429 errors', () => {
      expect(isRateLimitError({ errorCode: 500 })).to.be.false;
      expect(isRateLimitError({ status: 404 })).to.be.false;
    });

    it('should return false for null or undefined', () => {
      expect(isRateLimitError(null)).to.be.false;
      expect(isRateLimitError(undefined)).to.be.false;
    });

    it('should return false for empty object', () => {
      expect(isRateLimitError({})).to.be.false;
    });
  });

  describe('getErrorCode', () => {
    it('should extract errorCode', () => {
      expect(getErrorCode({ errorCode: 500 })).to.equal(500);
    });

    it('should extract status', () => {
      expect(getErrorCode({ status: 404 })).to.equal(404);
    });

    it('should extract code', () => {
      expect(getErrorCode({ code: 'ETIMEDOUT' })).to.equal('ETIMEDOUT');
    });

    it('should return Unknown for empty error', () => {
      expect(getErrorCode({})).to.equal('Unknown');
      expect(getErrorCode(null)).to.equal('Unknown');
    });

    it('should prioritize errorCode over status', () => {
      expect(getErrorCode({ errorCode: 429, status: 500 })).to.equal(429);
    });
  });

  describe('aggregateBatchResults', () => {
    it('should aggregate results from multiple batches', () => {
      const batchResults = new Map();
      batchResults.set('batch1', { success: 10, failed: 2, jobId: 'job1', status: 'completed', items: [] });
      batchResults.set('batch2', { success: 8, failed: 1, jobId: 'job2', status: 'completed', items: [] });
      batchResults.set('batch3', { success: 15, failed: 0, jobId: 'job3', status: 'completed', items: [] });

      const result = aggregateBatchResults(batchResults);

      expect(result.totalSuccess).to.equal(33);
      expect(result.totalFailed).to.equal(3);
      expect(result.total).to.equal(36);
    });

    it('should handle empty batch results', () => {
      const batchResults = new Map();
      const result = aggregateBatchResults(batchResults);

      expect(result.totalSuccess).to.equal(0);
      expect(result.totalFailed).to.equal(0);
      expect(result.total).to.equal(0);
    });

    it('should handle single batch', () => {
      const batchResults = new Map();
      batchResults.set('batch1', { success: 5, failed: 1, jobId: 'job1', status: 'completed', items: [] });

      const result = aggregateBatchResults(batchResults);

      expect(result.totalSuccess).to.equal(5);
      expect(result.totalFailed).to.equal(1);
      expect(result.total).to.equal(6);
    });

    it('should handle all failed batches', () => {
      const batchResults = new Map();
      batchResults.set('batch1', { success: 0, failed: 10, jobId: 'job1', status: 'failed', items: [] });
      batchResults.set('batch2', { success: 0, failed: 5, jobId: 'job2', status: 'failed', items: [] });

      const result = aggregateBatchResults(batchResults);

      expect(result.totalSuccess).to.equal(0);
      expect(result.totalFailed).to.equal(15);
      expect(result.total).to.equal(15);
    });
  });

  describe('createOperationResult', () => {
    it('should create result object with all fields', () => {
      const result = createOperationResult(10, 2, 12, 5000, 1);

      expect(result.success).to.equal(10);
      expect(result.failed).to.equal(2);
      expect(result.total).to.equal(12);
      expect(result.duration).to.equal(5000);
      expect(result.retried).to.equal(1);
    });

    it('should default retried to 0', () => {
      const result = createOperationResult(5, 1, 6, 3000);

      expect(result.retried).to.equal(0);
    });

    it('should handle zero counts', () => {
      const result = createOperationResult(0, 0, 0, 0);

      expect(result.success).to.equal(0);
      expect(result.failed).to.equal(0);
      expect(result.total).to.equal(0);
      expect(result.duration).to.equal(0);
    });
  });

  describe('formatCompletionMessage', () => {
    it('should format basic completion message', () => {
      const message = formatCompletionMessage('BULK', 5000, 10, 2, 12);

      expect(message).to.include('Operation completed in 5.00s');
      expect(message).to.include('Mode: BULK');
      expect(message).to.include('Success: 10 items');
      expect(message).to.include('Failed: 2 items');
      expect(message).to.include('Total: 12 items');
    });

    it('should include additional info when provided', () => {
      const message = formatCompletionMessage('BULK', 3000, 20, 0, 20, 'Processed: 5 batches');

      expect(message).to.include('Processed: 5 batches');
    });

    it('should work without additional info', () => {
      const message = formatCompletionMessage('SINGLE', 2000, 5, 1, 6);

      expect(message).to.include('Mode: SINGLE');
      expect(message).not.to.include('Processed:');
    });

    it('should format duration correctly', () => {
      const message = formatCompletionMessage('BULK', 12345, 10, 0, 10);

      expect(message).to.include('12.35s');
    });

    it('should handle zero items', () => {
      const message = formatCompletionMessage('SINGLE', 100, 0, 0, 0);

      expect(message).to.include('Success: 0 items');
      expect(message).to.include('Failed: 0 items');
      expect(message).to.include('Total: 0 items');
    });
  });
});
