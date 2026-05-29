import { expect } from 'chai';
import sinon from 'sinon';
import { QueueManager } from '../../../src/core/queue-manager';
import { OperationType, ResourceType, BulkJobResult } from '../../../src/interfaces';
import {
  logOperationInfo,
  enqueueIndividualItems,
  buildSingleModeResult,
  enqueueBatches,
  buildBulkModeResult,
  handleOperationError,
} from '../../../src/utils/command-helpers';

describe('Command Helpers', () => {
  let sandbox: sinon.SinonSandbox;
  let mockLogger: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockLogger = {
      debug: sandbox.stub(),
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
    };

    // Stub handleAndLogError from cli-utilities
    const cliUtilities = require('@contentstack/cli-utilities');
    sandbox.stub(cliUtilities, 'handleAndLogError').callsFake(() => {});
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('logOperationInfo', () => {
    it('should log operation info with items, environments, and locales', () => {
      const items = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          publish_details: [{ environment: 'dev', locale: 'en-us' }],
        },
        {
          uid: 'entry2',
          content_type: 'article',
          locale: 'de-de',
          publish_details: [{ environment: 'production', locale: 'de-de' }],
        },
      ];

      logOperationInfo(items, mockLogger);

      expect(mockLogger.info.calledOnce).to.be.true;
      expect(mockLogger.info.firstCall.args[0]).to.include('Processing 2 items');
    });

    it('should handle empty items array', () => {
      logOperationInfo([], mockLogger);

      expect(mockLogger.info.calledOnce).to.be.true;
      expect(mockLogger.info.firstCall.args[0]).to.include('Processing 0 items');
    });
  });

  describe('enqueueIndividualItems', () => {
    it('should enqueue entry items with correct type', () => {
      const queueManager = new QueueManager(2);
      const enqueueSpy = sandbox.spy(queueManager, 'enqueue');

      const items = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          publish_details: [{ environment: 'dev', locale: 'en-us' }],
        },
      ];

      enqueueIndividualItems(items, queueManager, OperationType.PUBLISH);

      expect(enqueueSpy.calledOnce).to.be.true;
      expect(enqueueSpy.firstCall.args[0]).to.equal(ResourceType.ENTRY);
      expect(enqueueSpy.firstCall.args[1]).to.equal(OperationType.PUBLISH);
    });

    it('should enqueue asset items with correct type', () => {
      const queueManager = new QueueManager(2);
      const enqueueSpy = sandbox.spy(queueManager, 'enqueue');

      const items = [
        {
          uid: 'asset1',
          locale: 'en-us',
          publish_details: [{ environment: 'dev', locale: 'en-us' }],
        },
      ];

      enqueueIndividualItems(items, queueManager, OperationType.PUBLISH);

      expect(enqueueSpy.calledOnce).to.be.true;
      expect(enqueueSpy.firstCall.args[0]).to.equal(ResourceType.ASSET);
    });

    it('should enqueue multiple items', () => {
      const queueManager = new QueueManager(2);
      const enqueueSpy = sandbox.spy(queueManager, 'enqueue');

      const items = [
        { uid: 'entry1', content_type: 'blog', locale: 'en-us', publish_details: [] },
        { uid: 'asset1', locale: 'en-us', publish_details: [] },
        { uid: 'entry2', content_type: 'article', locale: 'de-de', publish_details: [] },
      ];

      enqueueIndividualItems(items, queueManager, OperationType.UNPUBLISH);

      expect(enqueueSpy.callCount).to.equal(3);
    });
  });

  describe('buildSingleModeResult', () => {
    it('should build result with queue stats', () => {
      const queueManager = new QueueManager(2);
      const items = [{ uid: 'entry1' }, { uid: 'entry2' }];
      const startTime = Date.now() - 1000; // 1 second ago

      // Manually update stats by simulating operations
      sandbox.stub(queueManager, 'getStats').returns({
        total: 2,
        queued: 0,
        active: 0,
        processed: 2,
        succeeded: 1,
        failed: 1,
        retried: 0,
      });

      const result = buildSingleModeResult(items, startTime, queueManager, mockLogger);

      expect(result.success).to.equal(1);
      expect(result.failed).to.equal(1);
      expect(result.total).to.equal(2);
      expect(result.duration).to.be.greaterThan(0);
      expect(mockLogger.info.calledOnce).to.be.true;
    });

    it('should log completion message', () => {
      const queueManager = new QueueManager(2);
      const items = [{ uid: 'entry1' }];
      const startTime = Date.now();

      sandbox.stub(queueManager, 'getStats').returns({
        total: 1,
        queued: 0,
        active: 0,
        processed: 1,
        succeeded: 1,
        failed: 0,
        retried: 0,
      });

      buildSingleModeResult(items, startTime, queueManager, mockLogger);

      expect(mockLogger.info.called).to.be.true;
    });
  });

  describe('enqueueBatches', () => {
    it('should enqueue all batches with correct data', () => {
      const queueManager = new QueueManager(2);
      const enqueueSpy = sandbox.spy(queueManager, 'enqueue');

      const batches = [
        {
          items: [{ uid: 'entry1' }, { uid: 'entry2' }],
          environments: ['dev'],
          locales: ['en-us'],
          batchNumber: 1,
          totalBatches: 2,
        },
        {
          items: [{ uid: 'entry3' }],
          environments: ['dev'],
          locales: ['en-us'],
          batchNumber: 2,
          totalBatches: 2,
        },
      ];

      enqueueBatches(batches, queueManager, OperationType.PUBLISH);

      expect(enqueueSpy.callCount).to.equal(2);
      expect(enqueueSpy.firstCall.args[0]).to.equal(ResourceType.ENTRY);
      expect(enqueueSpy.firstCall.args[1]).to.equal(OperationType.PUBLISH);
      expect(enqueueSpy.firstCall.args[2]).to.have.property('batchNumber', 1);
      expect(enqueueSpy.firstCall.args[2]).to.have.property('totalBatches', 2);
      expect(enqueueSpy.secondCall.args[2]).to.have.property('batchNumber', 2);
    });

    it('should handle empty batches array', () => {
      const queueManager = new QueueManager(2);
      const enqueueSpy = sandbox.spy(queueManager, 'enqueue');

      enqueueBatches([], queueManager, OperationType.PUBLISH);

      expect(enqueueSpy.called).to.be.false;
    });

    it('should include operation in batch data', () => {
      const queueManager = new QueueManager(2);
      const enqueueSpy = sandbox.spy(queueManager, 'enqueue');

      const batches = [
        {
          items: [{ uid: 'entry1' }],
          environments: ['prod'],
          locales: ['en-us', 'de-de'],
          batchNumber: 1,
          totalBatches: 1,
        },
      ];

      enqueueBatches(batches, queueManager, OperationType.UNPUBLISH);

      expect(enqueueSpy.firstCall.args[2]).to.have.property('operation', OperationType.UNPUBLISH);
    });
  });

  describe('buildBulkModeResult', () => {
    it('should build result with job IDs from batch results', () => {
      const batches = [{ items: [{ uid: 'entry1' }, { uid: 'entry2' }] }, { items: [{ uid: 'entry3' }] }];
      const startTime = Date.now() - 500;

      const batchResults = new Map<string, BulkJobResult>();
      batchResults.set('batch1', { jobId: 'job-123', status: 'submitted', success: 0, failed: 0 });
      batchResults.set('batch2', { jobId: 'job-456', status: 'submitted', success: 0, failed: 0 });

      const result = buildBulkModeResult(batches, startTime, batchResults, mockLogger);

      expect(result.success).to.equal(0); // Not known for bulk mode
      expect(result.failed).to.equal(0); // Not known for bulk mode
      expect(result.total).to.equal(3); // Total items across batches
      expect(result.jobIds).to.deep.equal(['job-123', 'job-456']);
      expect(result.duration).to.be.greaterThan(0);
    });

    it('should handle empty batch results', () => {
      const batches = [{ items: [{ uid: 'entry1' }] }];
      const startTime = Date.now();
      const batchResults = new Map<string, BulkJobResult>();

      const result = buildBulkModeResult(batches, startTime, batchResults, mockLogger);

      expect(result.jobIds).to.deep.equal([]);
    });

    it('should skip results without job ID', () => {
      const batches = [{ items: [{ uid: 'entry1' }] }];
      const startTime = Date.now();

      const batchResults = new Map<string, BulkJobResult>();
      batchResults.set('batch1', { jobId: 'job-123', status: 'submitted', success: 0, failed: 0 });
      batchResults.set('batch2', { jobId: '', status: 'failed', success: 0, failed: 0 }); // Empty jobId (falsy)

      const result = buildBulkModeResult(batches, startTime, batchResults, mockLogger);

      // Empty string is falsy, so only 'job-123' should be included
      expect(result.jobIds).to.deep.equal(['job-123']);
    });

    it('should calculate total items from all batches', () => {
      const batches = [
        { items: [{ uid: 'e1' }, { uid: 'e2' }, { uid: 'e3' }] },
        { items: [{ uid: 'e4' }, { uid: 'e5' }] },
        { items: [{ uid: 'e6' }] },
      ];
      const startTime = Date.now();
      const batchResults = new Map<string, BulkJobResult>();

      const result = buildBulkModeResult(batches, startTime, batchResults, mockLogger);

      expect(result.total).to.equal(6);
    });

    it('should log debug message with batch count and duration', () => {
      const batches = [{ items: [{ uid: 'e1' }] }, { items: [{ uid: 'e2' }] }];
      const startTime = Date.now() - 1000;
      const batchResults = new Map<string, BulkJobResult>();

      buildBulkModeResult(batches, startTime, batchResults, mockLogger);

      expect(mockLogger.debug.calledOnce).to.be.true;
      expect(mockLogger.debug.firstCall.args[0]).to.include('Submitted 2 batches');
    });
  });

  describe('handleOperationError', () => {
    it('should log error and return failure result', () => {
      const error = new Error('Test error');
      const items = [{ uid: 'entry1' }, { uid: 'entry2' }];
      const startTime = Date.now() - 100;

      const result = handleOperationError(error, items, startTime);

      // handleAndLogError is called (verified by the error output in console)
      // Just verify the result is correct
      expect(result.success).to.equal(0);
      expect(result.failed).to.equal(2);
      expect(result.total).to.equal(2);
    });

    it('should handle error without message', () => {
      const error = { code: 500 }; // Error object without message
      const items = [{ uid: 'entry1' }];
      const startTime = Date.now();

      const result = handleOperationError(error, items, startTime);

      // handleAndLogError is called, just verify the result
      expect(result.failed).to.equal(1);
    });

    it('should handle string error', () => {
      const error = 'String error';
      const items = [{ uid: 'entry1' }];
      const startTime = Date.now();

      const stringErrorResult = handleOperationError(error, items, startTime);

      // handleAndLogError is called, just verify the result
      expect(stringErrorResult.failed).to.equal(1);
    });

    it('should calculate duration correctly', () => {
      const error = new Error('Test');
      const items = [{ uid: 'entry1' }];
      const startTime = Date.now() - 500; // 500ms ago

      const operationResult = handleOperationError(error, items, startTime);

      expect(operationResult.duration).to.be.at.least(500);
    });
  });
});
