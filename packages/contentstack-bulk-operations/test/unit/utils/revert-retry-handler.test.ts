/**
 * Unit tests for revert-retry-handler
 * Tests utilities for handling revert and retry operations
 */

import { expect } from 'chai';
import sinon from 'sinon';
import {
  loadItemsFromLog,
  handleRevertOrRetry,
  validateRevertOperation,
} from '../../../src/utils/revert-retry-handler';
import { ResourceType } from '../../../src/interfaces';
import * as logHandlerModule from '../../../src/utils/bulk-operation-log-handler';
import * as confirmationModule from '../../../src/utils/operation-confirmation';

describe('Revert Retry Handler', () => {
  let readBulkFailedLogStub: sinon.SinonStub;
  let readBulkSuccessLogStub: sinon.SinonStub;
  let readSingleFailedLogStub: sinon.SinonStub;
  let readSingleSuccessLogStub: sinon.SinonStub;
  let confirmOperationStub: sinon.SinonStub;
  let logger: any;

  beforeEach(() => {
    readBulkFailedLogStub = sinon.stub(logHandlerModule, 'readBulkFailedLog');
    readBulkSuccessLogStub = sinon.stub(logHandlerModule, 'readBulkSuccessLog');
    readSingleFailedLogStub = sinon.stub(logHandlerModule, 'readSingleFailedLog');
    readSingleSuccessLogStub = sinon.stub(logHandlerModule, 'readSingleSuccessLog');
    confirmOperationStub = sinon.stub(confirmationModule, 'confirmOperation');

    // Default empty returns
    readBulkFailedLogStub.returns([]);
    readBulkSuccessLogStub.returns([]);
    readSingleFailedLogStub.returns([]);
    readSingleSuccessLogStub.returns([]);

    logger = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('loadItemsFromLog', () => {
    it('should load and convert entry data for retry operation', () => {
      const mockBulkLogs = [
        {
          mode: 'bulk',
          jobId: 'job-1',
          batchNumber: 1,
          operation: 'publish',
          timestamp: '2024-01-09T10:00:00Z',
          environments: ['prod'],
          locales: ['en-us'],
          items: [{ uid: 'entry1', locale: 'en-us', contentType: 'blog', version: 1, type: 'entry' }],
          status: 'failed',
          error: 'Network timeout',
          apiKey: 'test-key',
          branch: 'main',
        },
      ];

      readBulkFailedLogStub.returns(mockBulkLogs);

      const result = loadItemsFromLog('test-logs', true, ResourceType.ENTRY);

      expect(result).to.have.length(1);
      expect(result[0].uid).to.equal('entry1');
      expect(result[0].type).to.equal('entry');
    });

    it('should load and convert asset data', () => {
      const mockBulkLogs = [
        {
          mode: 'bulk',
          jobId: 'job-1',
          batchNumber: 1,
          operation: 'publish',
          timestamp: '2024-01-09T10:00:00Z',
          environments: ['prod'],
          locales: ['en-us'],
          items: [{ uid: 'asset1', locale: 'en-us', version: 1, type: 'asset' }],
          status: 'failed',
          apiKey: 'test-key',
          branch: 'main',
        },
      ];

      readBulkFailedLogStub.returns(mockBulkLogs);

      const result = loadItemsFromLog('test-logs', true, ResourceType.ASSET);

      expect(result).to.have.length(1);
      expect(result[0].uid).to.equal('asset1');
      expect(result[0].type).to.equal('asset');
    });

    it('should return empty array when no logs found', () => {
      readBulkFailedLogStub.returns([]);
      readSingleFailedLogStub.returns([]);

      const result = loadItemsFromLog('test-logs', true, ResourceType.ENTRY);

      expect(result).to.deep.equal([]);
    });

    it('should load success logs for revert operation', () => {
      const mockBulkLogs = [
        {
          mode: 'bulk',
          jobId: 'job-1',
          batchNumber: 1,
          operation: 'publish',
          timestamp: '2024-01-09T10:00:00Z',
          environments: ['prod'],
          locales: ['en-us'],
          items: [{ uid: 'entry1', locale: 'en-us', contentType: 'blog', version: 1, type: 'entry' }],
          status: 'success',
          apiKey: 'test-key',
          branch: 'main',
        },
      ];

      readBulkSuccessLogStub.returns(mockBulkLogs);

      const result = loadItemsFromLog('test-logs', false, ResourceType.ENTRY);

      expect(result).to.have.length(1);
      expect(result[0].uid).to.equal('entry1');
    });
  });

  describe('handleRevertOrRetry', () => {
    let executeBulkOperationStub: sinon.SinonStub;
    let mockConfig: any;

    beforeEach(() => {
      executeBulkOperationStub = sinon.stub();

      mockConfig = {
        operation: 'publish',
        environments: ['prod'],
        locales: ['en-us'],
      };
    });

    it('should handle retry operation successfully', async () => {
      const mockBulkLogs = [
        {
          mode: 'bulk',
          jobId: 'job-1',
          batchNumber: 1,
          operation: 'publish',
          timestamp: '2024-01-09T10:00:00Z',
          environments: ['prod'],
          locales: ['en-us'],
          items: [{ uid: 'entry1', locale: 'en-us', contentType: 'blog', version: 1, type: 'entry' }],
          status: 'failed',
          apiKey: 'test-key',
          branch: 'main',
        },
      ];

      readBulkFailedLogStub.returns(mockBulkLogs);
      confirmOperationStub.resolves(true);
      executeBulkOperationStub.resolves({
        success: 1,
        failed: 0,
        total: 1,
      });

      const result = await handleRevertOrRetry(
        'test-logs',
        true, // isRetry
        ResourceType.ENTRY,
        mockConfig,
        false,
        executeBulkOperationStub,
        logger
      );

      expect(logger.info.calledWith(sinon.match(/Retrying/))).to.be.true;
      expect(executeBulkOperationStub.calledOnce).to.be.true;
      expect(result).to.have.property('success', 1);
    });

    it('should handle revert operation', async () => {
      const mockBulkLogs = [
        {
          mode: 'bulk',
          jobId: 'job-1',
          batchNumber: 1,
          operation: 'publish',
          timestamp: '2024-01-09T10:00:00Z',
          environments: ['prod'],
          locales: ['en-us'],
          items: [{ uid: 'entry1', locale: 'en-us', contentType: 'blog', version: 1, type: 'entry' }],
          status: 'success',
          apiKey: 'test-key',
          branch: 'main',
        },
      ];

      readBulkSuccessLogStub.returns(mockBulkLogs);
      confirmOperationStub.resolves(true);
      executeBulkOperationStub.resolves({
        success: 1,
        failed: 0,
        total: 1,
      });

      const result = await handleRevertOrRetry(
        'test-logs',
        false, // isRetry (false = revert)
        ResourceType.ENTRY,
        mockConfig,
        false,
        executeBulkOperationStub,
        logger
      );

      expect(logger.info.calledWith(sinon.match(/Reverting/))).to.be.true;
      expect(result).to.have.property('success', 1);
    });

    it('should warn and return undefined if no items found in log', async () => {
      readBulkFailedLogStub.returns([]);
      readSingleFailedLogStub.returns([]);

      const result = await handleRevertOrRetry(
        'test-logs',
        true,
        ResourceType.ENTRY,
        mockConfig,
        false,
        executeBulkOperationStub,
        logger
      );

      expect(logger.warn.calledWith(sinon.match(/No failed/))).to.be.true;
      expect(confirmOperationStub.called).to.be.false;
      expect(executeBulkOperationStub.called).to.be.false;
      expect(result).to.be.undefined;
    });

    it('should return undefined if user does not confirm', async () => {
      const mockBulkLogs = [
        {
          mode: 'bulk',
          jobId: 'job-1',
          batchNumber: 1,
          operation: 'publish',
          timestamp: '2024-01-09T10:00:00Z',
          environments: ['prod'],
          locales: ['en-us'],
          items: [{ uid: 'entry1', locale: 'en-us', contentType: 'blog', version: 1, type: 'entry' }],
          status: 'failed',
          apiKey: 'test-key',
          branch: 'main',
        },
      ];

      readBulkFailedLogStub.returns(mockBulkLogs);
      confirmOperationStub.resolves(false);

      const result = await handleRevertOrRetry(
        'test-logs',
        true,
        ResourceType.ENTRY,
        mockConfig,
        false,
        executeBulkOperationStub,
        logger
      );

      expect(logger.warn.calledWith(sinon.match(/cancelled/))).to.be.true;
      expect(executeBulkOperationStub.called).to.be.false;
      expect(result).to.be.undefined;
    });

    it('should handle assets', async () => {
      const mockBulkLogs = [
        {
          mode: 'bulk',
          jobId: 'job-1',
          batchNumber: 1,
          operation: 'publish',
          timestamp: '2024-01-09T10:00:00Z',
          environments: ['prod'],
          locales: ['en-us'],
          items: [{ uid: 'asset1', locale: 'en-us', version: 1, type: 'asset' }],
          status: 'failed',
          apiKey: 'test-key',
          branch: 'main',
        },
      ];

      readBulkFailedLogStub.returns(mockBulkLogs);
      confirmOperationStub.resolves(true);
      executeBulkOperationStub.resolves({
        success: 1,
        failed: 0,
        total: 1,
      });

      const result = await handleRevertOrRetry(
        'test-logs',
        true,
        ResourceType.ASSET,
        mockConfig,
        false,
        executeBulkOperationStub,
        logger
      );

      const itemsArg = executeBulkOperationStub.getCall(0).args[0];
      expect(itemsArg[0].type).to.equal('asset');
      expect(result).to.have.property('success', 1);
    });
  });

  describe('validateRevertOperation', () => {
    it('should return valid for publish operations in bulk logs', () => {
      const bulkLogs = [
        {
          mode: 'bulk' as const,
          jobId: 'job-1',
          batchNumber: 1,
          operation: 'publish' as const,
          timestamp: '2024-01-09T10:00:00Z',
          environments: ['prod'],
          locales: ['en-us'],
          items: [{ uid: 'entry1', locale: 'en-us', contentType: 'blog', version: 1, type: 'entry' as const }],
          status: 'success' as const,
          apiKey: 'test-key',
          branch: 'main',
        },
      ];

      const result = validateRevertOperation(bulkLogs, []);

      expect(result.valid).to.be.true;
      expect(result.error).to.be.undefined;
    });

    it('should return invalid for unpublish operations in bulk logs', () => {
      const bulkLogs = [
        {
          mode: 'bulk' as const,
          jobId: 'job-1',
          batchNumber: 1,
          operation: 'unpublish' as const,
          timestamp: '2024-01-09T10:00:00Z',
          environments: ['prod'],
          locales: ['en-us'],
          items: [{ uid: 'entry1', locale: 'en-us', contentType: 'blog', version: 1, type: 'entry' as const }],
          status: 'success' as const,
          apiKey: 'test-key',
          branch: 'main',
        },
      ];

      const result = validateRevertOperation(bulkLogs, []);

      expect(result.valid).to.be.false;
      expect(result.error).to.include('unpublish');
    });

    it('should return valid for publish operations in single logs', () => {
      const singleLogs = [
        {
          mode: 'single' as const,
          operation: 'publish' as const,
          timestamp: '2024-01-09T10:00:00Z',
          item: { uid: 'entry1', locale: 'en-us', contentType: 'blog', version: 1, type: 'entry' as const },
          environments: ['prod'],
          status: 'success' as const,
          apiKey: 'test-key',
          branch: 'main',
        },
      ];

      const result = validateRevertOperation([], singleLogs);

      expect(result.valid).to.be.true;
      expect(result.error).to.be.undefined;
    });

    it('should return invalid for unpublish operations in single logs', () => {
      const singleLogs = [
        {
          mode: 'single' as const,
          operation: 'unpublish' as const,
          timestamp: '2024-01-09T10:00:00Z',
          item: { uid: 'entry1', locale: 'en-us', contentType: 'blog', version: 1, type: 'entry' as const },
          environments: ['prod'],
          status: 'success' as const,
          apiKey: 'test-key',
          branch: 'main',
        },
      ];

      const result = validateRevertOperation([], singleLogs);

      expect(result.valid).to.be.false;
      expect(result.error).to.include('unpublish');
    });

    it('should return valid for empty logs', () => {
      const result = validateRevertOperation([], []);

      expect(result.valid).to.be.true;
      expect(result.error).to.be.undefined;
    });
  });
});
