import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { BulkOperationService } from '../../../src/services/bulk-operation-service';
import { EntryPublishData, AssetPublishData, OperationType, ResourceType } from '../../../src/interfaces';
import messages, { $t } from '../../../src/messages';

describe('BulkOperationService', () => {
  let bulkOperationService: BulkOperationService;
  let mockStack: any;
  let mockLogger: any;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockLogger = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
      debug: sandbox.stub(),
    };

    mockStack = {
      bulkOperation: sandbox.stub(),
    };

    bulkOperationService = new BulkOperationService(mockStack, mockLogger);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('executeBulkPublish', () => {
    it('should execute bulk publish operation successfully', async () => {
      const mockItems: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          version: 1,
          publish_details: [{ environment: 'production', locale: 'en-us', version: 1 }],
        },
      ];

      const mockJobId = 'job123';

      sandbox.stub(bulkOperationService as any, 'submitBulkJob').resolves(mockJobId);

      const result = await bulkOperationService.executeBulkPublish(
        mockItems,
        OperationType.PUBLISH,
        ResourceType.ENTRY
      );

      expect(result.jobId).to.equal(mockJobId);
      expect(result.status).to.equal('submitted');
      expect(result.success).to.equal(0);
      expect(result.failed).to.equal(0);
      expect(mockLogger.info.calledWith($t(messages.SUBMITTING_BULK_JOB, { operation: 'publish', count: 1 }))).to.be
        .true;
    });

    it('should return submitted status without polling', async () => {
      const mockItems: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          version: 1,
          publish_details: [],
        },
      ];

      const mockJobId = 'job123';

      sandbox.stub(bulkOperationService as any, 'submitBulkJob').resolves(mockJobId);

      const result = await bulkOperationService.executeBulkPublish(
        mockItems,
        OperationType.PUBLISH,
        ResourceType.ENTRY
      );

      expect(result.status).to.equal('submitted');
      expect(result.jobId).to.equal(mockJobId);
    });

    it('should handle submission error', async () => {
      const mockItems: EntryPublishData[] = [];

      sandbox.stub(bulkOperationService as any, 'submitBulkJob').rejects(new Error('Submission failed'));

      try {
        await bulkOperationService.executeBulkPublish(mockItems, OperationType.PUBLISH, ResourceType.ENTRY);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Submission failed');
      }
    });
  });

  describe('submitBulkJob', () => {
    it('should submit bulk publish job', async () => {
      const mockItems: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          version: 1,
          publish_details: [{ environment: 'production', locale: 'en-us', version: 1 }],
        },
      ];

      const mockResponse = { job_id: 'job123', notice: 'Job created' };
      const mockPublish = sandbox.stub().resolves(mockResponse);

      mockStack.bulkOperation.returns({
        publish: mockPublish,
      });

      const jobId = await (bulkOperationService as any).submitBulkJob(mockItems, OperationType.PUBLISH);

      expect(jobId).to.equal('job123');
      expect(mockPublish.called).to.be.true;
    });

    it('should submit bulk unpublish job', async () => {
      const mockItems: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          version: 1,
          publish_details: [{ environment: 'production', locale: 'en-us', version: 1 }],
        },
      ];

      const mockResponse = { job_id: 'job456', notice: 'Job created' };
      const mockUnpublish = sandbox.stub().resolves(mockResponse);

      mockStack.bulkOperation.returns({
        unpublish: mockUnpublish,
      });

      const jobId = await (bulkOperationService as any).submitBulkJob(mockItems, OperationType.UNPUBLISH);

      expect(jobId).to.equal('job456');
      expect(mockUnpublish.called).to.be.true;
    });

    it('should handle unsupported operation', async () => {
      const mockItems: EntryPublishData[] = [];

      try {
        await (bulkOperationService as any).submitBulkJob(mockItems, 'invalid-operation' as any);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Should throw error for unsupported operation
        expect(error).to.exist;
      }
    });

    it('should handle SDK error', async () => {
      const mockItems: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          version: 1,
          publish_details: [{ environment: 'production', locale: 'en-us', version: 1 }],
        },
      ];

      mockStack.bulkOperation.returns({
        publish: sandbox.stub().rejects(new Error('SDK Error')),
      });

      try {
        await (bulkOperationService as any).submitBulkJob(mockItems, OperationType.PUBLISH);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('SDK Error');
      }
    });
  });

  // pollJobStatus is currently commented out but we test the private method for coverage
  describe('pollJobStatus (private method)', () => {
    it('should poll until job completes', async () => {
      const mockJobId = 'job123';
      const mockResponse = {
        status: 'complete',
        message: 'Success',
        total_count: 10,
        succeeded_count: 10,
        failed_count: 0,
      };

      mockStack.bulkOperation.returns({
        jobStatus: sandbox.stub().resolves(mockResponse),
      });

      const result = await (bulkOperationService as any).pollJobStatus(mockJobId, 10);

      expect(result.status).to.equal('complete');
      expect(result.totalItems).to.equal(10);
      expect(result.succeeded).to.equal(10);
    });

    it('should handle failed job status', async () => {
      const mockJobId = 'job123';
      const mockResponse = {
        status: 'failed',
        message: 'Job failed',
        total_count: 5,
        failed_count: 5,
      };

      mockStack.bulkOperation.returns({
        jobStatus: sandbox.stub().resolves(mockResponse),
      });

      const result = await (bulkOperationService as any).pollJobStatus(mockJobId, 10);

      expect(result.status).to.equal('failed');
      expect(result.failed).to.equal(5);
    });

    it('should continue polling on transient errors', async () => {
      const mockJobId = 'job123';
      const jobStatusStub = sandbox.stub().onFirstCall().rejects(new Error('Network error')).onSecondCall().resolves({
        status: 'complete',
        message: 'Success',
        succeeded_count: 5,
      });

      mockStack.bulkOperation.returns({
        jobStatus: jobStatusStub,
      });

      const result = await (bulkOperationService as any).pollJobStatus(mockJobId, 10);

      expect(result.status).to.equal('complete');
      expect(mockLogger.warn.called).to.be.true;
    });

    it('should timeout after max polls', async () => {
      const mockJobId = 'job123';

      // Mock config to use fewer polls for faster test
      const configModule = require('../../../src/config');
      const originalMaxPolls = configModule.default.maxPolls;
      configModule.default.maxPolls = 3; // Only poll 3 times

      mockStack.bulkOperation.returns({
        jobStatus: sandbox.stub().resolves({ status: 'processing' }),
      });

      try {
        await (bulkOperationService as any).pollJobStatus(mockJobId, 10);
        expect.fail('Should have thrown timeout error');
      } catch (error: any) {
        expect(error.message).to.include('timeout');
      } finally {
        // Restore original config
        configModule.default.maxPolls = originalMaxPolls;
      }
    });
  });

  describe('fetchJobResults (private method)', () => {
    it('should fetch job results', async () => {
      const mockJobId = 'job123';

      const result = await (bulkOperationService as any).fetchJobResults(mockJobId);

      // Currently returns stub response (pending SDK implementation)
      expect(result.jobId).to.equal(mockJobId);
      expect(result.success).to.equal(0);
      expect(result.failed).to.equal(0);
    });
  });

  // Note: fetchJobResults tests removed - pollJobStatus now returns job details directly
  // Note: shouldUseBulkAPI tests removed as this method no longer exists
  // The decision to use bulk API is now made at the command level based on batch size

  describe('prepareBulkPayload', () => {
    it('should prepare entry payload', () => {
      const mockItems: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          version: 1,
          publish_details: [{ environment: 'production', locale: 'en-us', version: 1 }],
        },
      ];

      const payload = (bulkOperationService as any).prepareBulkPayload(
        mockItems,
        OperationType.PUBLISH,
        ResourceType.ENTRY
      );

      expect(payload.entries).to.have.lengthOf(1);
      expect(payload.entries[0].uid).to.equal('entry1');
      expect(payload.entries[0].content_type).to.equal('blog');
    });

    it('should prepare entry payload with variants', () => {
      const mockItems: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          version: 1,
          variants: [{ uid: 'variant-1' }, { uid: 'variant-2' }],
          variant_rules: {
            publish_latest_base: false,
            publish_latest_base_conditionally: true,
          },
          publish_details: [{ environment: 'production', locale: 'en-us', version: 1 }],
        },
      ];

      const payload = (bulkOperationService as any).prepareBulkPayload(
        mockItems,
        OperationType.PUBLISH,
        ResourceType.ENTRY
      );

      expect(payload.entries).to.have.lengthOf(1);
      expect(payload.entries[0].variants).to.have.lengthOf(2);
      expect(payload.entries[0].variant_rules).to.deep.equal({
        publish_latest_base: false,
        publish_latest_base_conditionally: true,
      });
    });

    it('should not include variants when array is empty', () => {
      const mockItems: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          version: 1,
          variants: [],
          publish_details: [{ environment: 'production', locale: 'en-us', version: 1 }],
        },
      ];

      const payload = (bulkOperationService as any).prepareBulkPayload(
        mockItems,
        OperationType.PUBLISH,
        ResourceType.ENTRY
      );

      expect(payload.entries[0].variants).to.be.undefined;
    });

    it('should prepare asset payload', () => {
      const mockItems: AssetPublishData[] = [
        {
          uid: 'asset1',
          version: 1,
          locale: 'en-us',
          publish_details: [{ environment: 'production', locale: 'en-us', version: 1 }],
        },
      ];

      const payload = (bulkOperationService as any).prepareBulkPayload(
        mockItems,
        OperationType.PUBLISH,
        ResourceType.ASSET
      );

      expect(payload.assets).to.have.lengthOf(1);
      expect(payload.assets[0].uid).to.equal('asset1');
    });

    it('should handle items with no publish_details', () => {
      const mockItems: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          version: 1,
        } as EntryPublishData,
      ];

      expect(() =>
        (bulkOperationService as any).prepareBulkPayload(mockItems, OperationType.PUBLISH, ResourceType.ENTRY)
      ).to.throw('No environments for bulk publish');
    });
  });

  describe('formatJobDetails', () => {
    it('should format job response correctly', () => {
      const mockJobId = 'job123';
      const mockResponse = {
        status: 'completed',
        total_count: 100,
        succeeded_count: 95,
        failed_count: 5,
        in_progress_count: 0,
        created_at: '2023-01-01T00:00:00Z',
        completed_at: '2023-01-01T00:05:00Z',
        errors: [
          {
            uid: 'entry1',
            error_message: 'Validation failed',
            error_details: { field: 'title' },
          },
        ],
      };

      const result = (bulkOperationService as any).formatJobDetails(mockJobId, mockResponse);

      expect(result.jobId).to.equal(mockJobId);
      expect(result.status).to.equal('completed');
      expect(result.totalItems).to.equal(100);
      expect(result.succeeded).to.equal(95);
      expect(result.failed).to.equal(5);
      expect(result.errors).to.have.lengthOf(1);
      expect(result.errors[0].uid).to.equal('entry1');
    });

    it('should handle missing error details', () => {
      const mockJobId = 'job123';
      const mockResponse = {
        status: 'completed',
        total_count: 10,
        succeeded_count: 10,
        failed_count: 0,
      };

      const result = (bulkOperationService as any).formatJobDetails(mockJobId, mockResponse);

      expect(result.errors).to.be.an('array').that.is.empty;
    });
  });
});
