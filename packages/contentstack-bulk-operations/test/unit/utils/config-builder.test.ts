import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { validateFlags, buildConfig, setupStackConfig } from '../../../src/utils/config-builder';
import { OperationType, FilterType, CommandFlags, PublishMode } from '../../../src/interfaces';
import { configHandler } from '@contentstack/cli-utilities';

describe('Config Builder Utilities', () => {
  describe('validateFlags', () => {
    describe('CommandFlags validation', () => {
      it('should pass validation with valid publish flags', () => {
        const flags: CommandFlags = {
          alias: 'test-alias',
          operation: 'publish',
          environments: ['dev', 'staging'],
          locales: ['en-us'],
        };

        const result = validateFlags(flags);

        expect(result.valid).to.be.true;
        expect(result.errors).to.have.lengthOf(0);
      });

      it('should fail validation when operation is missing', () => {
        const config: any = {
          environments: ['dev'],
          locales: ['en-us'],
        };

        const result = validateFlags(config);

        expect(result.valid).to.be.false;
        expect(result.errors).to.include('Operation is required');
      });

      it('should fail validation when environments are missing', () => {
        const config: any = {
          operation: OperationType.PUBLISH,
          environments: [],
          locales: ['en-us'],
        };

        const result = validateFlags(config);

        expect(result.valid).to.be.false;
        expect(result.errors).to.include('Environments are required for publish/unpublish operations');
      });

      it('should fail validation when locales are missing', () => {
        const config: any = {
          operation: OperationType.PUBLISH,
          environments: ['dev'],
          locales: [],
        };

        const result = validateFlags(config);

        expect(result.valid).to.be.false;
        expect(result.errors).to.include('Locales are required');
      });

      it('should pass validation when locales are missing but filter is non-localized', () => {
        const flags: CommandFlags = {
          alias: 'test-alias',
          operation: 'publish',
          environments: ['dev'],
          filter: FilterType.NON_LOCALIZED,
        };

        const result = validateFlags(flags);

        expect(result.valid).to.be.true;
        expect(result.errors).to.have.lengthOf(0);
      });

      // Cross-publish validation test removed - cross-publish is a scenario, not an operation type

      // Note: publish-with-reference flag validation has been removed as this flag is no longer supported

      it('should fail validation when both alias and stack-api-key are missing', () => {
        const flags: CommandFlags = {
          operation: 'publish',
          environments: ['dev'],
          locales: ['en-us'],
          alias: undefined,
          'stack-api-key': undefined,
        };

        const result = validateFlags(flags);

        expect(result.valid).to.be.false;
        expect(result.errors).to.include('Either --alias or --stack-api-key is required');
      });

      it('should pass validation with stack-api-key', () => {
        const flags: CommandFlags = {
          'stack-api-key': 'stack_api_key',
          operation: 'publish',
          environments: ['dev'],
          locales: ['en-us'],
        };

        const result = validateFlags(flags);

        expect(result.valid).to.be.true;
      });

      it('should skip operation/environment/locale validation when retry-failed is set', () => {
        const flags: CommandFlags = {
          alias: 'test-alias',
          'retry-failed': 'path/to/failed.log',
        };

        const result = validateFlags(flags);

        expect(result.valid).to.be.true;
      });

      it('should pass validation with publish operation and source-env (cross-publish scenario)', () => {
        const flags: CommandFlags = {
          alias: 'test-alias',
          operation: OperationType.PUBLISH,
          'source-env': 'production',
          'source-alias': 'prod-delivery',
          environments: ['staging'],
          locales: ['en-us'],
          'content-types': ['content_type_1'],
        };

        const result = validateFlags(flags);

        expect(result.valid).to.be.true;
        expect(result.errors).to.have.lengthOf(0);
      });

      it('should fail validation with invalid operation type', () => {
        const flags: CommandFlags = {
          alias: 'test-alias',
          operation: 'invalid-operation' as any,
          environments: ['staging'],
          locales: ['en-us'],
        };

        const result = validateFlags(flags);

        expect(result.valid).to.be.false;
        expect(result.errors).to.include("Invalid operation type: invalid-operation. Must be 'publish' or 'unpublish'");
      });
    });

    describe('BulkOperationConfig validation', () => {
      it('should pass validation with valid config', () => {
        const config: any = {
          operation: OperationType.PUBLISH,
          environments: ['dev'],
          locales: ['en-us'],
        };

        const result = validateFlags(config);

        expect(result.valid).to.be.true;
        expect(result.errors).to.have.lengthOf(0);
      });

      it('should fail validation when operation is missing in config', () => {
        const config: any = {
          // Mark as config object by having no string operation
          operation: undefined,
          environments: ['dev'],
          locales: ['en-us'],
        };

        const result = validateFlags(config);

        expect(result.valid).to.be.false;
        expect(result.errors).to.include('Operation is required');
      });

      it('should fail validation when environments are missing for publish', () => {
        const config: any = {
          operation: OperationType.PUBLISH,
          environments: [],
          locales: ['en-us'],
        };

        const result = validateFlags(config);

        expect(result.valid).to.be.false;
        expect(result.errors).to.include('Environments are required for publish/unpublish operations');
      });

      it('should fail validation when locales are missing in config', () => {
        const config: any = {
          operation: OperationType.PUBLISH,
          environments: ['dev'],
          locales: [],
        };

        const result = validateFlags(config);

        expect(result.valid).to.be.false;
        expect(result.errors).to.include('Locales are required');
      });

      it('should pass validation when locales are missing in config but filter is non-localized', () => {
        const config: any = {
          operation: OperationType.PUBLISH,
          environments: ['dev'],
          filter: FilterType.NON_LOCALIZED,
        };

        const result = validateFlags(config);

        expect(result.valid).to.be.true;
        expect(result.errors).to.have.lengthOf(0);
      });

      it('should pass validation for unpublish with environments', () => {
        const config: any = {
          operation: OperationType.UNPUBLISH,
          environments: ['dev', 'staging'],
          locales: ['en-us', 'fr-fr'],
        };

        const result = validateFlags(config);

        expect(result.valid).to.be.true;
      });

      it('should fail validation when environments are missing for unpublish', () => {
        const config: any = {
          operation: OperationType.UNPUBLISH,
          environments: [],
          locales: ['en-us'],
        };

        const result = validateFlags(config);

        expect(result.valid).to.be.false;
        expect(result.errors).to.include('Environments are required for publish/unpublish operations');
      });
    });

    describe('validation with multiple errors', () => {
      it('should return all validation errors', () => {
        const config: any = {
          operation: OperationType.PUBLISH,
          environments: [],
          locales: [],
        };

        const result = validateFlags(config);

        expect(result.valid).to.be.false;
        expect(result.errors.length).to.be.greaterThan(1);
        expect(result.errors).to.include('Environments are required for publish/unpublish operations');
        expect(result.errors).to.include('Locales are required');
      });
    });
  });

  describe('buildConfig', () => {
    it('should split comma-separated locales and environments from a single oclif multiple value', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        environments: ['dev, staging'],
        locales: ['en-us, fr-fr'],
      };

      const config = buildConfig(flags);

      expect(config.environments).to.deep.equal(['dev', 'staging']);
      expect(config.locales).to.deep.equal(['en-us', 'fr-fr']);
    });

    it('should split comma-separated content-types in one flag value', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        environments: ['dev'],
        locales: ['en-us'],
        'content-types': ['blog, article'],
      };

      const config = buildConfig(flags);

      expect(config.contentTypes).to.deep.equal(['blog', 'article']);
    });

    it('should build config from flags', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        'stack-api-key': 'stack_api_key',
        'content-types': ['blog', 'article'],
        environments: ['dev', 'staging'],
        locales: ['en-us', 'fr-fr'],
        operation: 'publish',
        'publish-mode': 'bulk',
        'api-version': '3',
        'include-variants': true,
        'source-env': 'production',
        'max-retries': 5,
        'retry-failed': undefined,
        branch: 'develop',
        filter: 'draft',
      };

      const config = buildConfig(flags);

      expect(config.alias).to.equal('test-alias');
      expect(config.stackApiKey).to.equal('stack_api_key');
      expect(config.contentTypes).to.deep.equal(['blog', 'article']);
      expect(config.environments).to.deep.equal(['dev', 'staging']);
      expect(config.locales).to.deep.equal(['en-us', 'fr-fr']);
      expect(config.operation).to.equal('publish');
      expect(config.publishMode).to.equal('bulk');
      expect(config.apiVersion).to.equal('3');
      expect(config.includeVariants).to.be.true;
      expect(config.sourceEnv).to.equal('production');
      expect(config.maxRetries).to.equal(5);
      expect(config.branch).to.equal('develop');
      expect(config.filter).to.equal('draft');
    });

    it('should use default values when flags are not provided', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
      };

      const config = buildConfig(flags);

      expect(config.alias).to.equal('test-alias');
      expect(config.environments).to.deep.equal([]);
      expect(config.locales).to.deep.equal([]);
      expect(config.publishMode).to.equal(PublishMode.BULK);
      expect(config.apiVersion).to.equal('3'); // Default to 3
      expect(config.maxRetries).to.equal(3);
    });

    it('should handle publish-mode as single', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        environments: ['dev'],
        locales: ['en-us'],
        'publish-mode': 'single',
      };

      const config = buildConfig(flags);

      expect(config.publishMode).to.equal('single');
    });

    it('should default publish-mode to bulk', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        environments: ['dev'],
        locales: ['en-us'],
      };

      const config = buildConfig(flags);

      expect(config.publishMode).to.equal(PublishMode.BULK);
    });

    it('should handle undefined optional flags', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'unpublish',
        environments: ['dev'],
        locales: ['en-us'],
      };

      const config = buildConfig(flags);

      expect(config.publishWithReference).to.be.undefined;
      expect(config.includeVariants).to.be.undefined;
      expect(config.sourceEnv).to.be.undefined;
      expect(config.retryFailed).to.be.undefined;
      expect(config.filter).to.be.undefined;
    });

    it('should build config with filter types', () => {
      const filterTypes: FilterType[] = [
        FilterType.DRAFT,
        FilterType.MODIFIED,
        FilterType.NON_LOCALIZED,
        FilterType.UNPUBLISHED,
      ];

      filterTypes.forEach((filterType) => {
        const flags: CommandFlags = {
          alias: 'test-alias',
          operation: 'publish',
          environments: ['dev'],
          locales: ['en-us'],
          filter: filterType,
        };

        const config = buildConfig(flags);

        expect(config.filter).to.equal(filterType);
      });
    });

    it('should build config with operation types', () => {
      const operations: OperationType[] = [OperationType.PUBLISH, OperationType.UNPUBLISH];

      operations.forEach((operation) => {
        const flags: CommandFlags = {
          alias: 'test-alias',
          operation: operation,
          environments: ['dev'],
          locales: ['en-us'],
        };

        const config = buildConfig(flags);

        expect(config.operation).to.equal(operation);
      });
    });

    it('should handle empty arrays', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        'content-types': [],
        environments: [],
        locales: [],
      };

      const config = buildConfig(flags);

      expect(config.contentTypes).to.deep.equal([]);
      expect(config.environments).to.deep.equal([]);
      expect(config.locales).to.deep.equal([]);
    });

    it('should build config with retry-failed flag', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        environments: ['dev'],
        locales: ['en-us'],
        'retry-failed': 'path/to/failed.log',
      };

      const config = buildConfig(flags);

      expect(config.retryFailed).to.equal('path/to/failed.log');
    });

    it('should build config with custom max-retries', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        environments: ['dev'],
        locales: ['en-us'],
        'max-retries': 10,
      };

      const config = buildConfig(flags);

      expect(config.maxRetries).to.equal(10);
    });

    it('should build config with custom branch', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        environments: ['dev'],
        locales: ['en-us'],
        branch: 'feature/new-branch',
      };

      const config = buildConfig(flags);

      expect(config.branch).to.equal('feature/new-branch');
    });

    it('should build config with api-version 3.2', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        environments: ['dev'],
        locales: ['en-us'],
        'api-version': '3.2',
      };

      const config = buildConfig(flags);

      expect(config.apiVersion).to.equal('3.2');
    });
  });

  describe('variant api-version dependency', () => {
    it('should fail validation when include-variants is used without api-version 3.2', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        environments: ['dev'],
        locales: ['en-us'],
        'include-variants': true,
        'api-version': '3',
      };

      const result = validateFlags(flags);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('--include-variants requires --api-version 3.2');
    });

    it('should pass validation with include-variants and api-version 3.2', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        environments: ['dev'],
        locales: ['en-us'],
        'include-variants': true,
        'api-version': '3.2',
      };

      const result = validateFlags(flags);

      expect(result.valid).to.be.true;
    });
  });

  describe('setupStackConfig', () => {
    let sandbox: sinon.SinonSandbox;
    let configHandlerGetStub: sinon.SinonStub;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      configHandlerGetStub = sandbox.stub(configHandler, 'get');
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should setup stack config with explicit stack-api-key', () => {
      const flags: CommandFlags = {
        'stack-api-key': 'stack123456',
        operation: 'publish',
        environments: ['dev'],
        locales: ['en-us'],
      };

      const stackConfig = setupStackConfig(flags);

      expect(stackConfig.apiKey).to.equal('stack123456');
      expect(stackConfig.host).to.equal('api.contentstack.io');
      expect(configHandlerGetStub.called).to.be.false;
    });

    it('should retrieve api key from alias using configHandler', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        environments: ['dev'],
        locales: ['en-us'],
      };

      configHandlerGetStub.withArgs('tokens.test-alias').returns({
        apiKey: 'stack-from-alias',
        token: 'cs-token-123',
      });

      const stackConfig = setupStackConfig(flags);

      expect(stackConfig.alias).to.equal('test-alias');
      expect(stackConfig.apiKey).to.equal('stack-from-alias');
      expect(configHandlerGetStub.calledWith('tokens.test-alias')).to.be.true;
    });

    it('should setup delivery token from source-alias', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        'source-env': 'production',
        'source-alias': 'prod-delivery',
        environments: ['dev'],
        locales: ['en-us'],
      };

      configHandlerGetStub.withArgs('tokens.test-alias').returns({
        apiKey: 'stack-mgmt',
        token: 'cs-mgmt-token',
        type: 'management',
      });

      configHandlerGetStub.withArgs('tokens.prod-delivery').returns({
        type: 'delivery',
        token: 'cs-delivery-token',
        environment: 'production',
        apiKey: 'stack123',
      });

      const stackConfig = setupStackConfig(flags);

      expect(stackConfig.deliveryToken).to.equal('cs-delivery-token');
      expect(stackConfig.environment).to.equal('production');
      expect(configHandlerGetStub.calledWith('tokens.prod-delivery')).to.be.true;
    });

    it('should throw error if source-alias is not found', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        'source-env': 'production',
        'source-alias': 'missing-alias',
        environments: ['dev'],
        locales: ['en-us'],
      };

      configHandlerGetStub.withArgs('tokens.test-alias').returns({
        apiKey: 'stack-mgmt',
        token: 'cs-mgmt-token',
        type: 'management',
      });

      configHandlerGetStub.withArgs('tokens.missing-alias').returns(undefined);

      expect(() => setupStackConfig(flags)).to.throw(/No token found for alias/);
    });

    it('should throw error if source-alias is not a delivery token', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        'source-env': 'production',
        'source-alias': 'mgmt-alias',
        environments: ['dev'],
        locales: ['en-us'],
      };

      configHandlerGetStub.withArgs('tokens.test-alias').returns({
        apiKey: 'stack-mgmt',
        token: 'cs-mgmt-token',
        type: 'management',
      });

      configHandlerGetStub.withArgs('tokens.mgmt-alias').returns({
        type: 'management',
        token: 'cs-mgmt-token',
        apiKey: 'stack123',
      });

      expect(() => setupStackConfig(flags)).to.throw(/is not a delivery token/);
    });

    it('should use source-alias environment when source-env differs', () => {
      const flags: CommandFlags = {
        alias: 'test-alias',
        operation: 'publish',
        'source-env': 'staging',
        'source-alias': 'prod-delivery',
        environments: ['dev'],
        locales: ['en-us'],
      };

      configHandlerGetStub.withArgs('tokens.test-alias').returns({
        apiKey: 'stack-mgmt',
        token: 'cs-mgmt-token',
        type: 'management',
      });

      configHandlerGetStub.withArgs('tokens.prod-delivery').returns({
        type: 'delivery',
        token: 'cs-delivery-token',
        environment: 'production', // Different from source-env
        apiKey: 'stack123',
      });

      const stackConfig = setupStackConfig(flags);

      // Should use environment from alias
      expect(stackConfig.environment).to.equal('production');
    });

    it('should set custom CMA host', () => {
      const flags: CommandFlags = {
        'stack-api-key': 'stack123',
        operation: 'publish',
        environments: ['dev'],
        locales: ['en-us'],
      };

      const stackConfig = setupStackConfig(flags, 'eu-api.contentstack.com');

      expect(stackConfig.host).to.equal('eu-api.contentstack.com');
    });

    it('should set custom CDA host', () => {
      const flags: CommandFlags = {
        'stack-api-key': 'stack123',
        operation: 'publish',
        environments: ['dev'],
        locales: ['en-us'],
      };

      const stackConfig = setupStackConfig(flags, 'eu-api.contentstack.com', 'eu-cdn.contentstack.com');

      expect(stackConfig.host).to.equal('eu-api.contentstack.com');
      expect(stackConfig.cda).to.equal('eu-cdn.contentstack.com');
    });

    it('should use default CDA host if not provided', () => {
      const flags: CommandFlags = {
        'stack-api-key': 'stack123',
        operation: 'publish',
        environments: ['dev'],
        locales: ['en-us'],
      };

      const stackConfig = setupStackConfig(flags);

      expect(stackConfig.cda).to.equal('cdn.contentstack.io');
    });

    it('should pass branch to stack config', () => {
      const flags: CommandFlags = {
        'stack-api-key': 'stack123',
        operation: 'publish',
        environments: ['dev'],
        locales: ['en-us'],
        branch: 'feature/test',
      };

      const stackConfig = setupStackConfig(flags);

      expect(stackConfig.branch).to.equal('feature/test');
    });

    it('should handle source-env without source-alias', () => {
      const flags: CommandFlags = {
        'stack-api-key': 'stack123',
        operation: 'publish',
        'source-env': 'production',
        environments: ['dev'],
        locales: ['en-us'],
      };

      const stackConfig = setupStackConfig(flags);

      expect(stackConfig.environment).to.equal('production');
      expect(stackConfig.deliveryToken).to.be.undefined;
    });
  });
});
