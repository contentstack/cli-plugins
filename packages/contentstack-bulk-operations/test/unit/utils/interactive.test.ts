/* eslint-disable @typescript-eslint/no-explicit-any */
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { cliux, configHandler } from '@contentstack/cli-utilities';
import { OperationType } from '../../../src/interfaces';
import { fillMissingFlags } from '../../../src/utils/interactive';

describe('Interactive Prompts', () => {
  let sandbox: sinon.SinonSandbox;
  let inquireStub: sinon.SinonStub;
  let configHandlerGetStub: sinon.SinonStub;
  let printStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    inquireStub = sandbox.stub(cliux, 'inquire');
    configHandlerGetStub = sandbox.stub(configHandler, 'get');
    printStub = sandbox.stub(cliux, 'print');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('fillMissingFlags', () => {
    it('should skip interactive mode for retry-failed operation', async () => {
      const flags = {
        'retry-failed': '/path/to/log',
        operation: OperationType.PUBLISH,
      };

      const result = await fillMissingFlags(flags);

      expect(result).to.deep.equal(flags);
      expect(inquireStub.called).to.be.false;
    });

    it('should skip interactive mode for revert operation', async () => {
      const flags = {
        revert: '/path/to/log',
        operation: OperationType.UNPUBLISH,
      };

      const result = await fillMissingFlags(flags);

      expect(result).to.deep.equal(flags);
      expect(inquireStub.called).to.be.false;
    });

    it('should prompt for stack credentials when not provided', async () => {
      const flags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      configHandlerGetStub.returns({});
      inquireStub.onFirstCall().resolves('stack_api_key'); // API key

      const result = await fillMissingFlags(flags);

      expect((result as any)['stack-api-key']).to.equal('stack_api_key');
      expect(inquireStub.calledOnce).to.be.true;
    });

    it('should prompt for alias selection when aliases exist', async () => {
      const flags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      const mockTokens = {
        'my-stack': { token: 'token123', type: 'management' },
        'another-stack': { token: 'token456', type: 'management' },
      };

      configHandlerGetStub.returns(mockTokens);
      inquireStub.resolves('my-stack'); // Selected alias

      const result = await fillMissingFlags(flags);

      expect(result.alias).to.equal('my-stack');
      expect(inquireStub.calledOnce).to.be.true;
    });

    it('should prompt for API key when no aliases exist', async () => {
      const flags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      configHandlerGetStub.returns({}); // No aliases

      inquireStub.resolves('stack_api_key'); // API key

      const result = await fillMissingFlags(flags);

      expect((result as any)['stack-api-key']).to.equal('stack_api_key');
      expect(inquireStub.calledOnce).to.be.true;
    });

    it('should prompt for operation when not provided', async () => {
      const flags = {
        alias: 'my-stack',
        environments: ['dev'],
        locales: ['en-us'],
      };

      configHandlerGetStub.returns({});
      inquireStub.resolves(OperationType.PUBLISH);

      const result = await fillMissingFlags(flags);

      expect(result.operation).to.equal(OperationType.PUBLISH);
      expect(inquireStub.calledOnce).to.be.true;
      expect(inquireStub.firstCall.args[0].choices).to.have.lengthOf(2);
      expect(inquireStub.firstCall.args[0].choices[0].value).to.equal(OperationType.PUBLISH);
      expect(inquireStub.firstCall.args[0].choices[1].value).to.equal(OperationType.UNPUBLISH);
    });

    it('should prompt for environments when not provided', async () => {
      const flags = {
        alias: 'my-stack',
        operation: OperationType.PUBLISH,
        locales: ['en-us'],
      };

      configHandlerGetStub.returns({});
      inquireStub.resolves('dev,staging,prod');

      const result = await fillMissingFlags(flags);

      expect(result.environments).to.deep.equal(['dev', 'staging', 'prod']);
      expect(inquireStub.calledOnce).to.be.true;
    });

    it('should handle environments with extra spaces', async () => {
      const flags = {
        alias: 'my-stack',
        operation: OperationType.PUBLISH,
        locales: ['en-us'],
      };

      configHandlerGetStub.returns({});
      inquireStub.resolves('  dev ,  staging  , prod  ');

      const result = await fillMissingFlags(flags);

      expect(result.environments).to.deep.equal(['dev', 'staging', 'prod']);
    });

    it('should prompt for locales when not provided', async () => {
      const flags = {
        alias: 'my-stack',
        operation: OperationType.PUBLISH,
        environments: ['dev'],
      };

      configHandlerGetStub.returns({});
      inquireStub.resolves('en-us,fr-fr');

      const result = await fillMissingFlags(flags);

      expect(result.locales).to.deep.equal(['en-us', 'fr-fr']);
      expect(inquireStub.calledOnce).to.be.true;
    });

    it('should use default locale en-us in prompt', async () => {
      const flags = {
        alias: 'my-stack',
        operation: OperationType.PUBLISH,
        environments: ['dev'],
      };

      configHandlerGetStub.returns({});
      inquireStub.resolves('en-us');

      await fillMissingFlags(flags);

      const inquireCall = inquireStub.firstCall.args[0];
      expect(inquireCall.default).to.equal('en-us');
    });

    it('should handle locales with extra spaces', async () => {
      const flags = {
        alias: 'my-stack',
        operation: OperationType.PUBLISH,
        environments: ['dev'],
      };

      configHandlerGetStub.returns({});
      inquireStub.resolves('  en-us  ,  fr-fr  ,  de-de  ');

      const result = await fillMissingFlags(flags);

      expect(result.locales).to.deep.equal(['en-us', 'fr-fr', 'de-de']);
    });

    it('should handle cross-publish mode - prompt for source-env', async () => {
      const flags = {
        alias: 'my-stack',
        operation: OperationType.PUBLISH,
        environments: ['staging'],
        locales: ['en-us'],
        'source-alias': 'prod-delivery',
      };

      configHandlerGetStub.returns({});
      inquireStub.resolves('production');

      const result = await fillMissingFlags(flags);

      expect((result as any)['source-env']).to.equal('production');
      expect(inquireStub.calledOnce).to.be.true;
    });

    it('should handle cross-publish mode - prompt for source-alias', async () => {
      const flags = {
        alias: 'my-stack',
        operation: OperationType.PUBLISH,
        environments: ['staging'],
        locales: ['en-us'],
        'source-env': 'production',
      };

      const mockTokens = {
        'prod-delivery': { token: 'dlvtoken123', type: 'delivery', environment: 'production' },
        'dev-delivery': { token: 'dlvtoken456', type: 'delivery', environment: 'dev' },
        'mgmt-token': { token: 'mgttoken789', type: 'management' },
      };

      configHandlerGetStub.returns(mockTokens);
      inquireStub.resolves('prod-delivery');

      const result = await fillMissingFlags(flags);

      expect((result as any)['source-alias']).to.equal('prod-delivery');
      expect(inquireStub.calledOnce).to.be.true;
      // Should only show delivery tokens
      const choices = inquireStub.firstCall.args[0].choices;
      expect(choices).to.have.lengthOf(2);
      expect(choices.map((c: any) => c.value)).to.include('prod-delivery');
      expect(choices.map((c: any) => c.value)).to.include('dev-delivery');
    });

    it('should throw error when no delivery tokens found for cross-publish', async () => {
      const flags = {
        alias: 'my-stack',
        operation: OperationType.PUBLISH,
        environments: ['staging'],
        locales: ['en-us'],
        'source-env': 'production',
      };

      const mockTokens = {
        'mgmt-token': { token: 'mgttoken789', type: 'management' },
      };

      configHandlerGetStub.returns(mockTokens);

      try {
        await fillMissingFlags(flags);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('delivery token');
      }
    });

    it('should fill all missing required flags in one flow', async () => {
      const flags = {}; // Empty flags

      const mockTokens = {};
      configHandlerGetStub.returns(mockTokens);

      // Stack credentials - API key
      inquireStub.onCall(0).resolves('stack_api_key');
      // Operation
      inquireStub.onCall(1).resolves(OperationType.PUBLISH);
      // Environments
      inquireStub.onCall(2).resolves('dev,staging');
      // Locales
      inquireStub.onCall(3).resolves('en-us');

      const result = await fillMissingFlags(flags);

      expect((result as any)['stack-api-key']).to.equal('stack_api_key');
      expect(result.operation).to.equal(OperationType.PUBLISH);
      expect(result.environments).to.deep.equal(['dev', 'staging']);
      expect(result.locales).to.deep.equal(['en-us']);
      expect(inquireStub.callCount).to.equal(4);
    });

    it('should preserve existing flags', async () => {
      const flags = {
        alias: 'existing-alias',
        operation: OperationType.UNPUBLISH,
        environments: ['prod'],
        locales: ['fr-fr'],
        branch: 'develop',
        'bulk-operation-file': 'custom-logs',
      };

      configHandlerGetStub.returns({});

      const result = await fillMissingFlags(flags);

      expect(result.alias).to.equal('existing-alias');
      expect(result.operation).to.equal(OperationType.UNPUBLISH);
      expect(result.environments).to.deep.equal(['prod']);
      expect(result.locales).to.deep.equal(['fr-fr']);
      expect(result.branch).to.equal('develop');
      expect((result as any)['bulk-operation-file']).to.equal('custom-logs');
      expect(inquireStub.called).to.be.false;
    });

    it('should not print interactive mode messages when all flags are provided', async () => {
      const flags = {
        alias: 'my-stack',
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      configHandlerGetStub.returns({});

      await fillMissingFlags(flags);

      // Should not print interactive messages when all required flags are provided
      expect(printStub.called).to.be.false;
      expect(inquireStub.called).to.be.false;
    });

    it('should handle empty environments array', async () => {
      const flags = {
        alias: 'my-stack',
        operation: OperationType.PUBLISH,
        environments: [],
        locales: ['en-us'],
      };

      configHandlerGetStub.returns({});
      inquireStub.resolves('dev,prod');

      const result = await fillMissingFlags(flags);

      expect(result.environments).to.deep.equal(['dev', 'prod']);
      expect(inquireStub.calledOnce).to.be.true;
    });

    it('should handle empty locales array', async () => {
      const flags = {
        alias: 'my-stack',
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: [],
      };

      configHandlerGetStub.returns({});
      inquireStub.resolves('en-us,de-de');

      const result = await fillMissingFlags(flags);

      expect(result.locales).to.deep.equal(['en-us', 'de-de']);
      expect(inquireStub.calledOnce).to.be.true;
    });

    it('should validate API key format in prompt', async () => {
      const flags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      configHandlerGetStub.returns({}); // No aliases - will prompt for API key
      inquireStub.resolves('bltabc123');

      await fillMissingFlags(flags);

      const inquireCall = inquireStub.firstCall.args[0];
      expect(inquireCall.validate).to.be.a('function');

      // Test validation function - invalid key should return error message
      const validation = inquireCall.validate('invalid-key');
      expect(validation).to.be.a('string');
      expect(validation).to.not.equal(true);

      // Valid API key (starts with "blt") should return true
      const validValidation = inquireCall.validate('bltabc123');
      expect(validValidation).to.be.true;
    });

    it('should validate required field is not empty', async () => {
      const flags = {
        alias: 'my-stack',
        operation: OperationType.PUBLISH,
        locales: ['en-us'],
      };

      configHandlerGetStub.returns({});
      inquireStub.resolves('dev');

      await fillMissingFlags(flags);

      const inquireCall = inquireStub.firstCall.args[0];
      expect(inquireCall.validate).to.be.a('function');

      // Test validation function for empty input
      const emptyValidation = inquireCall.validate('');
      expect(emptyValidation).to.be.a('string');
      expect(emptyValidation).to.include('required');

      const validValidation = inquireCall.validate('dev');
      expect(validValidation).to.be.true;
    });
  });
});
