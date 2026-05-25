import { expect } from 'chai';
import messages, { $t } from '../../../src/messages';

describe('Messages', () => {
  describe('$t function - message interpolation', () => {
    it('should return message with placeholders replaced', () => {
      const result = $t(messages.FETCHING_ENTRIES, { contentType: 'blog' });
      expect(result).to.equal('Fetching entries for content type: blog');
    });

    it('should handle multiple placeholders', () => {
      const result = $t(messages.FOUND_ENTRIES, { count: 10, contentType: 'article', locale: 'en-us' });
      expect(result).to.equal('Found 10 entries for article (en-us)');
    });

    it('should handle numeric values', () => {
      const result = $t(messages.JOBS_SUBMITTED_COUNT, { count: 5 });
      expect(result).to.equal('5 bulk job(s) submitted');
    });

    it('should return empty string for null/undefined message', () => {
      const result = $t('', {});
      expect(result).to.equal('');
    });

    it('should return empty string for null message', () => {
      const result = $t(null as any, {});
      expect(result).to.equal('');
    });

    it('should return empty string for undefined message', () => {
      const result = $t(undefined as any, {});
      expect(result).to.equal('');
    });

    it('should handle empty args object', () => {
      const result = $t(messages.OPERATION_CANCELLED, {});
      expect(result).to.equal('Operation cancelled by user');
    });

    it('should handle missing args object', () => {
      const result = $t(messages.OPERATION_CANCELLED);
      expect(result).to.equal('Operation cancelled by user');
    });

    it('should leave unmatched placeholders unchanged', () => {
      const result = $t('{unmatched} placeholder', {});
      expect(result).to.equal('{unmatched} placeholder');
    });

    it('should handle simple alphanumeric keys', () => {
      const msg = 'Value: {myKey}';
      const result = $t(msg, { myKey: 'test' });
      expect(result).to.equal('Value: test');
    });

    it('should handle multiple occurrences of the same placeholder', () => {
      const msg = '{name} loves {name}';
      const result = $t(msg, { name: 'John' });
      expect(result).to.equal('John loves John');
    });

    it('should convert numbers to strings', () => {
      const result = $t('{count} items', { count: 42 });
      expect(result).to.equal('42 items');
    });

    it('should handle zero value', () => {
      const result = $t('{count} items', { count: 0 });
      expect(result).to.equal('0 items');
    });
  });

  describe('messages object', () => {
    it('should export errors messages', () => {
      expect(messages.STACK_SETUP_REQUIRED).to.be.a('string');
      expect(messages.INVALID_CONFIGURATION).to.be.a('string');
      expect(messages.FETCH_ENTRIES_FAILED).to.be.a('string');
    });

    it('should export common messages', () => {
      expect(messages.INITIALIZING).to.be.a('string');
      expect(messages.OPERATION_COMPLETED).to.be.a('string');
      expect(messages.CONFIGURATION_BUILT).to.be.a('string');
    });

    it('should export entry service messages', () => {
      expect(messages.FETCHING_ENTRIES).to.be.a('string');
      expect(messages.FETCHED_TOTAL_ENTRIES).to.be.a('string');
      expect(messages.FILTERED_DRAFT).to.be.a('string');
    });

    it('should export asset service messages', () => {
      expect(messages.FETCHING_ASSETS).to.be.a('string');
      expect(messages.FETCHED_TOTAL_ASSETS).to.be.a('string');
      expect(messages.ASSET_NOT_FOUND).to.be.a('string');
    });

    it('should export bulk operation service messages', () => {
      expect(messages.SUBMITTING_BULK_JOB).to.be.a('string');
      expect(messages.BULK_JOB_CREATED).to.be.a('string');
      expect(messages.POLLING_JOB_STATUS).to.be.a('string');
    });

    it('should export interactive messages', () => {
      expect(messages.INTERACTIVE_MODE_START).to.be.a('string');
      expect(messages.SELECT_OPERATION).to.be.a('string');
      expect(messages.ENTER_ENVIRONMENTS).to.be.a('string');
    });

    it('should export flag descriptions', () => {
      expect(messages.ALIAS).to.be.a('string');
      expect(messages.STACK_API_KEY).to.be.a('string');
      expect(messages.OPERATION).to.be.a('string');
    });

    it('should export command info', () => {
      expect(messages.BULK_ENTRIES_DESCRIPTION).to.be.a('string');
      expect(messages.BULK_ASSETS_DESCRIPTION).to.be.a('string');
    });

    it('should export rate limiter messages', () => {
      expect(messages.RATE_LIMIT_SERVER_WAIT).to.be.a('string');
      expect(messages.RATE_LIMIT_LOW_REMAINING).to.be.a('string');
      expect(messages.RATE_LIMIT_THROTTLED).to.be.a('string');
      expect(messages.RATE_LIMIT_CIRCUIT_BREAKER).to.be.a('string');
    });

    it('should export summary messages', () => {
      expect(messages.OPERATION_SUMMARY).to.be.a('string');
      expect(messages.SUCCESSFUL).to.be.a('string');
      expect(messages.FAILED).to.be.a('string');
    });

    it('should have all required error messages', () => {
      // Validate critical error messages exist
      const criticalErrors = [
        'STACK_SETUP_REQUIRED',
        'INVALID_CONFIGURATION',
        'OPERATION_CANCELLED',
        'NO_ITEMS_FOUND',
        'CONTENT_TYPE_REQUIRED',
        'ENVIRONMENTS_REQUIRED',
      ];

      criticalErrors.forEach((key) => {
        expect(messages).to.have.property(key);
        expect((messages as any)[key]).to.be.a('string');
      });
    });
  });

  describe('message interpolation with various message types', () => {
    it('should interpolate error messages correctly', () => {
      const result = $t(messages.STACK_SETUP_REQUIRED, { identifier: 'test-stack' });
      expect(result).to.include('test-stack');
    });

    it('should interpolate service messages correctly', () => {
      const result = $t(messages.FETCHED_TOTAL_ENTRIES, { total: 100, contentType: 'blog' });
      expect(result).to.include('100');
      expect(result).to.include('blog');
    });

    it('should interpolate rate limiter messages correctly', () => {
      const result = $t(messages.RATE_LIMIT_SERVER_WAIT, { seconds: 5 });
      expect(result).to.include('5');
    });

    it('should interpolate bulk operation messages correctly', () => {
      const result = $t(messages.BULK_JOB_CREATED, { jobId: 'job-12345' });
      expect(result).to.include('job-12345');
    });

    it('should interpolate summary messages correctly', () => {
      const result = $t(messages.SUCCESSFUL, { count: 50 });
      expect(result).to.include('50');
    });
  });

  describe('edge cases', () => {
    it('should handle message with curly braces in value', () => {
      const msg = 'Value: {value}';
      const result = $t(msg, { value: '{nested}' });
      expect(result).to.equal('Value: {nested}');
    });

    it('should handle empty string value', () => {
      const msg = 'Empty: {value}';
      const result = $t(msg, { value: '' });
      expect(result).to.equal('Empty: ');
    });

    it('should handle very long values', () => {
      const longValue = 'a'.repeat(1000);
      const result = $t('{value}', { value: longValue });
      expect(result).to.equal(longValue);
    });

    it('should handle unicode characters', () => {
      const result = $t('Hello {name}!', { name: '世界' });
      expect(result).to.equal('Hello 世界!');
    });

    it('should handle keys with underscores', () => {
      const msg = 'Array: {arr_item}';
      const result = $t(msg, { arr_item: 'first' });
      expect(result).to.equal('Array: first');
    });

    it('should handle keys with numbers', () => {
      const msg = 'Special: {key123}';
      const result = $t(msg, { key123: 'test' });
      expect(result).to.equal('Special: test');
    });
  });
});
