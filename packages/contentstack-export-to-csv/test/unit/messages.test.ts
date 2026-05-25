import { expect } from 'chai';
import { formatMessage, messages } from '../../src/messages';

describe('messages', () => {
  describe('formatMessage', () => {
    it('should replace a single placeholder', () => {
      const result = formatMessage('Hello {name}', { name: 'World' });
      expect(result).to.equal('Hello World');
    });

    it('should replace the same placeholder multiple times', () => {
      const result = formatMessage('{x} and {x}', { x: 'twice' });
      expect(result).to.equal('twice and twice');
    });

    it('should replace multiple distinct placeholders', () => {
      const result = formatMessage('{a}-{b}-{c}', { a: '1', b: '2', c: '3' });
      expect(result).to.equal('1-2-3');
    });

    it('should leave unknown placeholders unchanged', () => {
      const result = formatMessage('keep {missing}', { other: 'x' });
      expect(result).to.equal('keep {missing}');
    });

    it('should handle empty params object', () => {
      const result = formatMessage(messages.INFO_WRITING_FILE, {});
      expect(result).to.equal(messages.INFO_WRITING_FILE);
    });

    it('should work with message template from messages constant', () => {
      const result = formatMessage(messages.INFO_EXPORTING_TEAMS, { orgName: 'Acme' });
      expect(result).to.include('Acme');
    });
  });
});
