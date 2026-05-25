import { expect } from 'chai';
import sinon from 'sinon';
import * as cliUtilities from '@contentstack/cli-utilities';
import {
  formatError,
  wait,
  handleErrorMsg,
  handleTaxonomyErrorMsg,
  exitProgram,
} from '../../../src/utils/error-handler';

describe('error-handler', () => {
  describe('formatError', () => {
    it('should handle string errors', () => {
      const result = formatError('Simple error message');
      expect(result).to.equal('Simple error message');
    });

    it('should handle JSON string errors', () => {
      const jsonError = JSON.stringify({ errorMessage: 'JSON error' });
      const result = formatError(jsonError);
      expect(result).to.equal('JSON error');
    });

    it('should handle error objects with errorMessage', () => {
      const error = { errorMessage: 'Error message from API' };
      const result = formatError(error);
      expect(result).to.equal('Error message from API');
    });

    it('should handle error objects with error_message', () => {
      const error = { error_message: 'Error message with underscore' };
      const result = formatError(error);
      expect(result).to.equal('Error message with underscore');
    });

    it('should handle error objects with message', () => {
      const error = { message: 'Standard error message' };
      const result = formatError(error);
      expect(result).to.equal('Standard error message');
    });

    it('should handle Error objects with JSON message', () => {
      const error = new Error(JSON.stringify({ errorMessage: 'Nested JSON error' }));
      const result = formatError(error);
      expect(result).to.equal('Nested JSON error');
    });

    it('should handle Error objects with plain message', () => {
      const error = new Error('Plain error message');
      const result = formatError(error);
      expect(result).to.equal('Plain error message');
    });

    it('should append authorization error details', () => {
      const error = {
        errorMessage: 'Unauthorized',
        errors: { authorization: 'is invalid' },
      };
      const result = formatError(error);
      expect(result).to.include('Management Token');
      expect(result).to.include('is invalid');
    });

    it('should append api_key error details', () => {
      const error = {
        errorMessage: 'Invalid request',
        errors: { api_key: 'is required' },
      };
      const result = formatError(error);
      expect(result).to.include('Stack API key');
      expect(result).to.include('is required');
    });

    it('should append uid error details', () => {
      const error = {
        errorMessage: 'Not found',
        errors: { uid: 'does not exist' },
      };
      const result = formatError(error);
      expect(result).to.include('Content Type');
      expect(result).to.include('does not exist');
    });

    it('should append access_token error details', () => {
      const error = {
        errorMessage: 'Unauthorized',
        errors: { access_token: 'is expired' },
      };
      const result = formatError(error);
      expect(result).to.include('Delivery Token');
      expect(result).to.include('is expired');
    });

    it('should handle multiple error fields', () => {
      const error = {
        errorMessage: 'Multiple errors',
        errors: {
          authorization: 'is invalid',
          api_key: 'is missing',
        },
      };
      const result = formatError(error);
      expect(result).to.include('Management Token');
      expect(result).to.include('Stack API key');
    });

    it('should handle unknown error fields', () => {
      const error = {
        errorMessage: 'Unknown error',
        errors: { custom_field: 'has issue' },
      };
      const result = formatError(error);
      expect(result).to.include('custom_field');
      expect(result).to.include('has issue');
    });

    it('should handle null error', () => {
      const result = formatError(null);
      expect(result).to.equal('null');
    });

    it('should handle undefined error', () => {
      const result = formatError(undefined);
      expect(result).to.equal('undefined');
    });

    it('should handle empty object', () => {
      const result = formatError({});
      expect(result).to.be.a('string');
    });
  });

  describe('wait', () => {
    let clock: sinon.SinonFakeTimers;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    });

    it('should resolve after specified time', async () => {
      let resolved = false;
      const waitPromise = wait(1000).then(() => {
        resolved = true;
      });

      expect(resolved).to.be.false;

      clock.tick(999);
      await Promise.resolve(); // Allow microtasks to run
      expect(resolved).to.be.false;

      clock.tick(1);
      await waitPromise;
      expect(resolved).to.be.true;
    });

    it('should resolve immediately for 0ms', async () => {
      let resolved = false;
      const waitPromise = wait(0).then(() => {
        resolved = true;
      });

      clock.tick(0);
      await waitPromise;
      expect(resolved).to.be.true;
    });
  });

  describe('handleErrorMsg', () => {
    let sandbox: sinon.SinonSandbox;
    let printStub: sinon.SinonStub;
    let exitStub: sinon.SinonStub;
    let parseStub: sinon.SinonStub;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      exitStub = sandbox.stub(process, 'exit').callsFake(() => undefined as never);
      printStub = sandbox.stub(cliUtilities.cliux, 'print');
      parseStub = sandbox.stub(cliUtilities.messageHandler, 'parse').returns('fallback-api-failed');
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should print errorMessage and exit with 1', () => {
      handleErrorMsg({ errorMessage: 'Bad request' }, { ctx: 'x' });
      expect(printStub.calledWith('Error: Bad request', { color: 'red' })).to.be.true;
      expect(exitStub.calledWith(1)).to.be.true;
    });

    it('should use message when errorMessage is absent', () => {
      handleErrorMsg(new Error('Plain err'));
      expect(printStub.calledWith('Error: Plain err', { color: 'red' })).to.be.true;
      expect(exitStub.calledWith(1)).to.be.true;
    });

    it('should fall back to messageHandler when no message fields', () => {
      handleErrorMsg({});
      expect(parseStub.calledWith('CLI_EXPORT_CSV_API_FAILED')).to.be.true;
      expect(printStub.calledWith('Error: fallback-api-failed', { color: 'red' })).to.be.true;
      expect(exitStub.calledWith(1)).to.be.true;
    });
  });

  describe('handleTaxonomyErrorMsg', () => {
    let sandbox: sinon.SinonSandbox;
    let printStub: sinon.SinonStub;
    let exitStub: sinon.SinonStub;
    let consoleStub: sinon.SinonStub;
    let parseStub: sinon.SinonStub;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      exitStub = sandbox.stub(process, 'exit').callsFake(() => undefined as never);
      printStub = sandbox.stub(cliUtilities.cliux, 'print');
      parseStub = sandbox.stub(cliUtilities.messageHandler, 'parse').returns('taxonomy-fallback');
      consoleStub = sandbox.stub(console, 'log');
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should prefer errorMessage', () => {
      handleTaxonomyErrorMsg({ errorMessage: 'Tax failed' });
      expect(printStub.calledWith('Error: Tax failed', { color: 'red' })).to.be.true;
      expect(exitStub.calledWith(1)).to.be.true;
    });

    it('should use errors.taxonomy when branch taken via message', () => {
      handleTaxonomyErrorMsg({ message: 'wrapper', errors: { taxonomy: 'bad tax' } });
      expect(printStub.calledWith('Error: bad tax', { color: 'red' })).to.be.true;
    });

    it('should use errors.term when taxonomy absent but branch taken', () => {
      handleTaxonomyErrorMsg({ message: 'wrapper', errors: { term: 'bad term' } });
      expect(printStub.calledWith('Error: bad term', { color: 'red' })).to.be.true;
    });

    it('should use message when present on object', () => {
      handleTaxonomyErrorMsg({ message: 'msg path' });
      expect(printStub.calledWith('Error: msg path', { color: 'red' })).to.be.true;
    });

    it('should use fallback branch when no recognizable fields', () => {
      handleTaxonomyErrorMsg({ foo: 1 });
      expect(consoleStub.called).to.be.true;
      expect(parseStub.calledWith('CLI_EXPORT_CSV_API_FAILED')).to.be.true;
      expect(printStub.calledWith('Error: taxonomy-fallback', { color: 'red' })).to.be.true;
      expect(exitStub.calledWith(1)).to.be.true;
    });
  });

  describe('exitProgram', () => {
    let sandbox: sinon.SinonSandbox;
    let exitStub: sinon.SinonStub;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      exitStub = sandbox.stub(process, 'exit').callsFake(() => undefined as never);
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should exit with 0', () => {
      exitProgram();
      expect(exitStub.calledWith(0)).to.be.true;
    });
  });
});
