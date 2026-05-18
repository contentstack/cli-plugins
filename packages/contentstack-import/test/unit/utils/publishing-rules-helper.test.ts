import { expect } from 'chai';
import { parseErrorPayload, isDuplicatePublishingRuleError } from '../../../src/utils/publishing-rules-helper';

describe('publishing-rules-helper', () => {
  describe('parseErrorPayload', () => {
    it('returns the object when error has errors', () => {
      const err = { errors: { name: 'taken' } };
      expect(parseErrorPayload(err)).to.deep.equal({ errors: { name: 'taken' } });
    });

    it('parses JSON from message string', () => {
      const err = { message: JSON.stringify({ error_message: 'already exists' }) };
      expect(parseErrorPayload(err)).to.deep.equal({ error_message: 'already exists' });
    });

    it('returns null for invalid JSON in message', () => {
      expect(parseErrorPayload({ message: 'not-json{' })).to.equal(null);
    });

    it('returns null for non-object', () => {
      expect(parseErrorPayload(null)).to.equal(null);
      expect(parseErrorPayload('x')).to.equal(null);
    });

    it('returns null when object has no errors or parseable message', () => {
      expect(parseErrorPayload({ foo: 1 })).to.equal(null);
    });
  });

  describe('isDuplicatePublishingRuleError', () => {
    it('returns true when errors.name is set', () => {
      expect(isDuplicatePublishingRuleError({ errors: { name: 'x' } }, {})).to.equal(true);
    });

    it('returns true when errors.publishing_rule.name is set', () => {
      expect(isDuplicatePublishingRuleError({ errors: { 'publishing_rule.name': 'x' } }, {})).to.equal(true);
    });

    it('returns true when errors.publish_rule.name is set', () => {
      expect(isDuplicatePublishingRuleError({ errors: { 'publish_rule.name': 'x' } }, {})).to.equal(true);
    });

    it('returns true when error_message matches duplicate wording', () => {
      expect(isDuplicatePublishingRuleError({ error_message: 'Rule already exists' }, {})).to.equal(true);
    });

    it('reads errors from raw when parsed is null', () => {
      const raw = { errors: { name: 'dup' } };
      expect(isDuplicatePublishingRuleError(null, raw)).to.equal(true);
    });

    it('returns false when no duplicate signals', () => {
      expect(isDuplicatePublishingRuleError({ errors: { other: 'x' } }, {})).to.equal(false);
      expect(isDuplicatePublishingRuleError({ error_message: 'timeout' }, {})).to.equal(false);
    });
  });
});
