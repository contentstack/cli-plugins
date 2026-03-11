import { fancy } from 'fancy-test';
import { expect } from 'chai';

import { $t, auditMsg, auditFixMsg } from '../../../src/messages';

describe('messages utility', () => {
  describe('$t method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should replace the placeholder in the string with provided value', () => {
        expect($t(auditMsg.AUDIT_START_SPINNER, { module: 'content-types' })).to.include(
          auditMsg.AUDIT_START_SPINNER.replace(new RegExp(`{module}`, 'g'), 'content-types'),
        );
      });
  });

  describe('$t method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should return if the provided string is empty', () => {
        expect($t('', {})).to.be.empty.string;
      });
  });

  describe('typo regression: details not detials', () => {
    it('ASSET_FIX and ENTRY_PUBLISH_DETAILS should contain "details"', () => {
      expect(auditMsg.ENTRY_PUBLISH_DETAILS).to.include('details');
      expect(auditMsg.ENTRY_PUBLISH_DETAILS).to.not.include('detials');
      expect(auditFixMsg.ASSET_FIX).to.include('details');
      expect(auditFixMsg.ASSET_FIX).to.not.include('detials');
    });
  });
});
