import { expect } from 'chai';
import { stub, restore, SinonStub } from 'sinon';
import { cliux } from '@contentstack/cli-utilities';
import { askAPIKey } from '../../src/utils/common-helper';

describe('Common Helper Utilities', () => {
  let cliuxInquireStub: SinonStub;

  beforeEach(() => {
    restore();
  });

  afterEach(() => {
    restore();
  });

  describe('askAPIKey', () => {
    it('should prompt user for API key and return the response', async () => {
      const mockApiKey = 'test-api-key-12345';

      cliuxInquireStub = stub(cliux, 'inquire').resolves(mockApiKey);

      const result = await askAPIKey();

      expect(result).to.equal(mockApiKey);
      expect(cliuxInquireStub.calledOnce).to.be.true;

      const callArgs = cliuxInquireStub.firstCall.args[0];
      expect(callArgs.type).to.equal('input');
      expect(callArgs.message).to.equal('Enter the stack api key');
      expect(callArgs.name).to.equal('apiKey');
    });

    it('should handle empty API key input', async () => {
      const emptyApiKey = '';

      cliuxInquireStub = stub(cliux, 'inquire').resolves(emptyApiKey);

      const result = await askAPIKey();

      expect(result).to.equal(emptyApiKey);
      expect(cliuxInquireStub.calledOnce).to.be.true;
    });

    it('should handle inquire errors', async () => {
      const error = new Error('Inquire failed');

      cliuxInquireStub = stub(cliux, 'inquire').rejects(error);

      try {
        await askAPIKey();
        expect.fail('Expected an error to be thrown');
      } catch (err) {
        expect(err.message).to.equal('Inquire failed');
      }
    });

    it('should validate the inquire call structure', async () => {
      const mockApiKey = 'valid-api-key';

      cliuxInquireStub = stub(cliux, 'inquire').resolves(mockApiKey);

      await askAPIKey();

      expect(cliuxInquireStub.calledOnce).to.be.true;

      const inquireOptions = cliuxInquireStub.firstCall.args[0];
      expect(inquireOptions).to.have.property('type', 'input');
      expect(inquireOptions).to.have.property('message', 'Enter the stack api key');
      expect(inquireOptions).to.have.property('name', 'apiKey');
    });
  });
});
