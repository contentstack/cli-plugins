import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { stub } from 'sinon';
import { cliux } from '@contentstack/cli-utilities';
import { displayMergeStatusDetails, getMergeStatusMessage, getMergeStatusWithContentTypes } from '../../../../../src/utils/merge-status-helper';
import * as utils from '../../../../../src/utils';

describe('Merge Status Helper', () => {
  let printStub;

  beforeEach(() => {
    printStub = stub(cliux, 'print');
  });

  afterEach(() => {
    printStub.restore();
  });

  describe('getMergeStatusMessage', () => {
    it('should return complete status message for complete status', () => {
      const message = getMergeStatusMessage('complete');
      expect(message).to.equal('✅ Merge completed successfully');
    });

    it('should return in_progress status message for in_progress status', () => {
      const message = getMergeStatusMessage('in_progress');
      expect(message).to.equal('⏳ Merge is still processing');
    });

    it('should return in_progress status message for in-progress status', () => {
      const message = getMergeStatusMessage('in-progress');
      expect(message).to.equal('⏳ Merge is still processing');
    });

    it('should return failed status message for failed status', () => {
      const message = getMergeStatusMessage('failed');
      expect(message).to.equal('❌ Merge failed');
    });

    it('should return unknown status message for unknown status', () => {
      const message = getMergeStatusMessage('unknown');
      expect(message).to.equal('⚠️ Unknown status');
    });
  });

  describe('displayMergeStatusDetails', () => {
    it('should display merge status details for completed merge', () => {
      const mergeResponse = {
        uid: 'merge_123',
        merge_details: {
          status: 'complete',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:30:00Z',
          completed_at: '2024-01-01T10:30:00Z',
        },
        merge_summary: {
          content_types: { added: 2, modified: 3, deleted: 1 },
          global_fields: { added: 0, modified: 1, deleted: 0 },
        },
        errors: [],
      };

      displayMergeStatusDetails(mergeResponse);

      expect(printStub.called).to.be.true;
      const calls = printStub.getCalls();
      const printed = calls.map((c) => c.args[0]).join(' ');
      expect(printed).to.include('merge_123');
      expect(printed).to.include('complete');
    });

    it('should display merge status details for in-progress merge', () => {
      const mergeResponse = {
        uid: 'merge_456',
        merge_details: {
          status: 'in_progress',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:15:00Z',
          completion_percentage: 60,
        },
        merge_summary: {
          content_types: { added: 1, modified: 2, deleted: 0 },
          global_fields: { added: 0, modified: 0, deleted: 0 },
        },
        errors: [],
      };

      displayMergeStatusDetails(mergeResponse);

      expect(printStub.called).to.be.true;
      const calls = printStub.getCalls();
      const printed = calls.map((c) => c.args[0]).join(' ');
      expect(printed).to.include('merge_456');
      expect(printed).to.include('in_progress');
      expect(printed).to.include('60');
    });

    it('should display merge status details with errors', () => {
      const mergeResponse = {
        uid: 'merge_789',
        merge_details: {
          status: 'failed',
          created_at: '2024-01-01T10:00:00Z',
          updated_at: '2024-01-01T10:20:00Z',
        },
        merge_summary: {
          content_types: { added: 0, modified: 0, deleted: 0 },
          global_fields: { added: 0, modified: 0, deleted: 0 },
        },
        errors: [{ message: 'Content type conflict' }, { message: 'Field mismatch' }],
      };

      displayMergeStatusDetails(mergeResponse);

      expect(printStub.called).to.be.true;
      const calls = printStub.getCalls();
      const printed = calls.map((c) => c.args[0]).join(' ');
      expect(printed).to.include('merge_789');
      expect(printed).to.include('failed');
      expect(printed).to.include('conflict');
    });

    it('should handle null merge response gracefully', () => {
      displayMergeStatusDetails(null);

      expect(printStub.called).to.be.true;
      const calls = printStub.getCalls();
      expect(calls[0].args[0]).to.equal('No merge information available');
    });

    it('should handle undefined merge response gracefully', () => {
      displayMergeStatusDetails(undefined);

      expect(printStub.called).to.be.true;
      const calls = printStub.getCalls();
      expect(calls[0].args[0]).to.equal('No merge information available');
    });
  });

  describe('getMergeStatusWithContentTypes', () => {
    let getMergeQueueStatusStub;

    beforeEach(() => {
      getMergeQueueStatusStub = stub(utils, 'getMergeQueueStatus');
    });

    afterEach(() => {
      getMergeQueueStatusStub.restore();
    });

    it('should return merge response when merge is complete', async () => {
      const mockMergeResponse = {
        queue: [
          {
            uid: 'merge_complete',
            merge_details: { status: 'complete' },
            content_types: { added: [], modified: [], deleted: [] },
          },
        ],
      };

      getMergeQueueStatusStub.resolves(mockMergeResponse);

      const result = await getMergeStatusWithContentTypes({}, 'merge_complete');

      expect(result.uid).to.equal('merge_complete');
      expect(result.merge_details.status).to.equal('complete');
    });

    it('should return error when merge is in_progress', async () => {
      const mockMergeResponse = {
        queue: [
          {
            uid: 'merge_inprogress',
            merge_details: { status: 'in_progress' },
          },
        ],
      };

      getMergeQueueStatusStub.resolves(mockMergeResponse);

      const result = await getMergeStatusWithContentTypes({}, 'merge_inprogress');

      expect(result.error).to.exist;
      expect(result.error).to.include('not complete');
      expect(result.status).to.equal('in_progress');
    });

    it('should return error when merge is failed', async () => {
      const mockMergeResponse = {
        queue: [
          {
            uid: 'merge_failed',
            merge_details: { status: 'failed' },
          },
        ],
      };

      getMergeQueueStatusStub.resolves(mockMergeResponse);

      const result = await getMergeStatusWithContentTypes({}, 'merge_failed');

      expect(result.error).to.exist;
      expect(result.error).to.include('not complete');
    });

    it('should throw error when no queue found', async () => {
      getMergeQueueStatusStub.resolves({ queue: [] });

      try {
        await getMergeStatusWithContentTypes({}, 'merge_notfound');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('No merge job found');
      }
    });

    it('should throw error when response is invalid', async () => {
      getMergeQueueStatusStub.resolves(null);

      try {
        await getMergeStatusWithContentTypes({}, 'merge_invalid');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('No merge job found');
      }
    });
  });
});
