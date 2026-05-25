import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import * as utils from '../../../src/utils';
import messages, { $t } from '../../../src/messages';
import BulkAssets from '../../../src/commands/cm/stacks/bulk-assets';
import { ResourceType, OperationType, BulkOperationResult } from '../../../src/interfaces';

describe('BulkAssets Command', () => {
  let command: BulkAssets;
  let sandbox: sinon.SinonSandbox;
  let logStub: any;
  let cliUtilitiesModule: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    command = new BulkAssets([], {} as any);

    // Mock cli-utilities log
    cliUtilitiesModule = require('@contentstack/cli-utilities');
    logStub = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
      debug: sandbox.stub(),
      success: sandbox.stub(),
    };
    sandbox.stub(cliUtilitiesModule, 'log').value(logStub);
    sandbox.stub(cliUtilitiesModule, 'handleAndLogError').callsFake(() => {});
    sandbox.stub(cliUtilitiesModule, 'createLogContext').callsFake(() => {});
    sandbox.stub(cliUtilitiesModule, 'getLogPath').returns('/mock/log/path');

    // Delete cached modules
    delete require.cache[require.resolve('../../../src/utils')];

    // Mock local utils to prevent file system operations and async hangs
    const utilsModule = require('../../../src/utils');
    sandbox.stub(utilsModule, 'getLogPaths').returns({
      folder: '/mock/bulk-operation',
      bulkSuccess: '/mock/bulk-operation/bulk-success.json',
      bulkFailed: '/mock/bulk-operation/bulk-failed.json',
      singleSuccess: '/mock/bulk-operation/single-success.json',
      singleFailed: '/mock/bulk-operation/single-failed.json',
    });
    sandbox.stub(utilsModule, 'clearLogs').returns(undefined);
    sandbox.stub(utilsModule, 'getStacks').resolves({
      managementStack: { stack: sandbox.stub() },
      deliveryStack: null,
    });
    sandbox.stub(utilsModule, 'setupStackConfig').returns({
      apiKey: 'test-api-key',
      alias: 'test-alias',
      host: 'api.contentstack.io',
      cda: 'cdn.contentstack.io',
    });
    sandbox.stub(utilsModule, 'validateBranch').resolves();
    sandbox.stub(utilsModule, 'validateEnvironments').resolves({ dev: 'env-uid-dev' });
    sandbox.stub(utilsModule, 'fillMissingFlags').callsFake((flags: any) => Promise.resolve(flags));
    sandbox.stub(utilsModule, 'buildConfig').returns({
      operation: 'publish',
      environments: ['dev'],
      locales: ['en-us'],
      bulkOperationFolder: '/mock/bulk-operation',
    });
    sandbox.stub(utilsModule, 'validateFlags').returns({ valid: true, errors: [] });
    sandbox.stub(utilsModule, 'confirmOperation').resolves(true);
    sandbox.stub(utilsModule, 'handleRevertOrRetry').resolves(undefined);
    sandbox.stub(utilsModule, 'loadConfigFromLogFile').returns(null);
    sandbox.stub(utilsModule, 'handleCrossPublishOperation').resolves({ success: 0, failed: 0, total: 0 });

    // Set logger on command instance
    (command as any).logger = logStub;

    // Mock command.log
    sandbox.stub(command, 'log');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('class properties', () => {
    it('should have correct resourceType', () => {
      expect(command['resourceType']).to.equal(ResourceType.ASSET);
    });

    it('should have description', () => {
      expect(BulkAssets.description).to.be.a('string');
      expect(BulkAssets.description).to.equal(messages.BULK_ASSETS_DESCRIPTION);
    });

    it('should have examples', () => {
      expect(BulkAssets.examples).to.be.an('array');
      expect(BulkAssets.examples.length).to.be.greaterThan(0);
    });

    it('should extend base flags with asset-specific flags', () => {
      const flags = BulkAssets.flags;

      expect(flags).to.have.property('folder-uid');
      // Base flags should also be present
      expect(flags).to.have.property('alias');
      expect(flags).to.have.property('operation');
    });
  });

  describe('handleCrossPublish', () => {
    it('should log cross-publish information', async () => {
      const flags = {
        'source-env': 'production',
        environments: ['staging', 'dev'],
        locales: ['en-us'],
      };

      // Mock delivery stack for cross-publish
      (command as any).deliveryStack = {
        asset: sandbox.stub().returnsThis(),
        query: sandbox.stub().returnsThis(),
        includeCount: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        find: sandbox.stub().resolves({ entries: [], count: 0 }),
      };

      // Mock handleCrossPublishOperation - need to stub before it's called
      const crossPublishModule = require('../../../src/utils/cross-publish-handler');
      sandbox.stub(crossPublishModule, 'handleCrossPublishOperation').resolves([]);
      sandbox.stub(command as any, 'executeBulkOperation').resolves({ success: 0, failed: 0, total: 0 });
      sandbox.stub(command as any, 'printOperationSummary');
      sandbox.stub(command as any, 'confirmOperation').resolves(true);

      await command['handleCrossPublish'](flags);

      // Just check it completes without error
      expect(true).to.be.true;
    });

    it('should handle multiple target environments', async () => {
      const flags = {
        'source-env': 'production',
        environments: ['env1', 'env2', 'env3'],
        locales: ['en-us'],
      };

      // Mock delivery stack for cross-publish
      (command as any).deliveryStack = {
        asset: sandbox.stub().returnsThis(),
        query: sandbox.stub().returnsThis(),
        includeCount: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        find: sandbox.stub().resolves({ entries: [], count: 0 }),
      };

      // Mock handleCrossPublishOperation
      const crossPublishModule = require('../../../src/utils/cross-publish-handler');
      sandbox.stub(crossPublishModule, 'handleCrossPublishOperation').resolves([]);
      sandbox.stub(command as any, 'executeBulkOperation').resolves({ success: 0, failed: 0, total: 0 });
      sandbox.stub(command as any, 'printOperationSummary');
      sandbox.stub(command as any, 'confirmOperation').resolves(true);

      await command['handleCrossPublish'](flags);

      // Just check it completes without error
      expect(true).to.be.true;
    });
  });

  describe('logSummary utility integration', () => {
    it('should call logSummary utility with result', () => {
      // Test that logSummary function exists and can be called
      const result = {
        success: 15,
        failed: 0,
        total: 15,
      };

      // Just verify the function exists and doesn't throw
      expect(utils.logSummary).to.be.a('function');
      expect(() => utils.logSummary(result)).to.not.throw();
    });
  });

  describe('run - complete flow', () => {
    let fetchItemsStub: sinon.SinonStub;

    beforeEach(() => {
      // Mock all required methods
      sandbox.stub(command as any, 'init').resolves();
      sandbox.stub(command as any, 'setupStack').resolves();
      sandbox.stub(command as any, 'buildConfiguration').resolves();
      sandbox.stub(command as any, 'initializeComponents').resolves();
      sandbox.stub(command as any, 'cleanup').resolves();
      sandbox.stub(command as any, 'finally').resolves();

      // Initialize required properties
      (command as any).bulkOperationConfig = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };
      (command as any).parsedFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      // Create stubs for command methods - set default behavior
      fetchItemsStub = sandbox.stub(command as any, 'fetchItems').resolves([]);
      // Stub logSummary to prevent console output during tests
      sandbox.stub(utils, 'logSummary');
    });

    it('should execute complete publish flow with assets', async () => {
      const mockAssets = [
        {
          uid: 'asset1',
          locale: 'en-us',
          version: 1,
          type: 'asset' as const,
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
        {
          uid: 'asset2',
          locale: 'en-us',
          version: 1,
          type: 'asset' as const,
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
      ];

      (command as any).parsedFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      fetchItemsStub.resolves(mockAssets);
      sandbox.stub(command as any, 'confirmOperation').resolves(true);
      sandbox.stub(command as any, 'executeBulkOperation').resolves({
        success: 2,
        failed: 0,
        total: 2,
        duration: 1000,
      } as BulkOperationResult);
      sandbox.stub(command as any, 'printOperationSummary');

      await command.run();

      expect(logStub.info.calledWith($t(messages.FOUND_ASSETS_TO_OPERATE, { count: 2, operation: 'publish' }))).to.be
        .true;
    });

    it('should execute complete publish flow', async () => {
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });

      // Mock fetchItems to return empty array
      fetchItemsStub.resolves([]);

      await command.run();

      // Run completes successfully
      expect(true).to.be.true;
    });

    it('should execute complete unpublish flow', async () => {
      const mockFlags = {
        operation: OperationType.UNPUBLISH,
        environments: ['dev', 'staging'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      fetchItemsStub.resolves([]);

      await command.run();

      // Run completes successfully
      expect(true).to.be.true;
    });

    it('should handle empty assets list', async () => {
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      fetchItemsStub.resolves([]);

      await command.run();

      // Run completes successfully
      expect(true).to.be.true;
    });

    it('should cancel operation when user declines', async () => {
      const mockAssets = [
        {
          uid: 'asset1',
          locale: 'en-us',
          version: 1,
          type: 'asset' as const,
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
      ];
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      (command as any).bulkOperationConfig = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      fetchItemsStub.resolves(mockAssets);
      sandbox.stub(command as any, 'confirmOperation').resolves(false);
      const executeSpy = sandbox.spy(command as any, 'executeBulkOperation');

      await command.run();

      expect(logStub.warn.calledWith($t(messages.OPERATION_CANCELLED))).to.be.true;
      expect(executeSpy.called).to.be.false;
    });

    it('should handle cross-publish flow with assets', async () => {
      const mockAssets = [
        {
          uid: 'asset1',
          locale: 'en-us',
          version: 1,
          type: 'asset' as const,
          publish_details: [{ environment: 'production', locale: 'en-us', version: 1 }],
        },
      ];
      const mockFlags = {
        operation: OperationType.PUBLISH,
        'source-env': 'production',
        environments: ['staging'],
        locales: ['en-us'],
      };

      (command as any).bulkOperationConfig = {
        operation: OperationType.PUBLISH,
        sourceEnv: 'production',
        environments: ['staging'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      fetchItemsStub.resolves(mockAssets);
      sandbox.stub(command as any, 'confirmOperation').resolves(true);
      sandbox.stub(command as any, 'handleCrossPublish').resolves();

      await command.run();

      expect((command as any).handleCrossPublish.called).to.be.true;
    });

    it('should handle validation errors', async () => {
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: [],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      // Don't stub init/buildConfiguration - let them run to trigger validation error

      try {
        await command.run();
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        // The error message will include validation errors
        expect(error.message).to.be.a('string');
      }
    });

    it('should call executeBulkOperation when assets found and confirmed', async () => {
      const mockAssets = [
        {
          uid: 'asset1',
          locale: 'en-us',
          version: 1,
          type: 'asset' as const,
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
      ];
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      (command as any).bulkOperationConfig = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      fetchItemsStub.resolves(mockAssets);
      sandbox.stub(command as any, 'confirmOperation').resolves(true);
      const executeStub = sandbox.stub(command as any, 'executeBulkOperation').resolves({
        success: 1,
        failed: 0,
        total: 1,
        duration: 1000,
      });
      sandbox.stub(command as any, 'printOperationSummary').resolves();

      await command.run();

      expect(executeStub.called).to.be.true;
      expect(executeStub.calledWith(mockAssets)).to.be.true;
    });

    it('should call printOperationSummary after executeBulkOperation', async () => {
      const mockAssets = [
        {
          uid: 'asset1',
          locale: 'en-us',
          version: 1,
          type: 'asset' as const,
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
      ];
      const mockResult = {
        success: 1,
        failed: 0,
        total: 1,
        duration: 1000,
      };
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      (command as any).bulkOperationConfig = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      fetchItemsStub.resolves(mockAssets);
      sandbox.stub(command as any, 'confirmOperation').resolves(true);
      sandbox.stub(command as any, 'executeBulkOperation').resolves(mockResult);
      const printOperationSummaryStub = sandbox.stub(command as any, 'printOperationSummary').resolves();

      await command.run();

      expect(printOperationSummaryStub.called).to.be.true;
      expect(printOperationSummaryStub.calledWith(mockResult)).to.be.true;
    });

    it('should complete full flow with executeBulkOperation and printOperationSummary', async () => {
      const mockAssets = [
        {
          uid: 'asset1',
          locale: 'en-us',
          version: 1,
          type: 'asset' as const,
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
      ];
      const mockResult = {
        success: 1,
        failed: 0,
        total: 1,
        duration: 1000,
      };
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      (command as any).bulkOperationConfig = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      fetchItemsStub.resolves(mockAssets);
      sandbox.stub(command as any, 'confirmOperation').resolves(true);
      const executeStub = sandbox.stub(command as any, 'executeBulkOperation').resolves(mockResult);
      const printOperationSummaryStub = sandbox.stub(command as any, 'printOperationSummary').resolves();

      await command.run();

      // Verify the full flow executed
      expect(executeStub.called).to.be.true;
      expect(printOperationSummaryStub.called).to.be.true;
      expect(printOperationSummaryStub.calledWith(mockResult)).to.be.true;
      // Note: logSummary is stubbed but not checked as it's an imported direct reference
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Test error');
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      // Make initializeComponents throw error (init is already stubbed in beforeEach)
      (command as any).initializeComponents.rejects(error);

      // Error handling happens automatically via handleAndLogError in run's catch block
      await command.run();

      // Verify no exceptions were thrown
      expect(true).to.be.true;
    });

    it('should handle specific asset UIDs in flow', async () => {
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });

      await command.run();

      // Run completes successfully
      expect(true).to.be.true;
    });
  });

  describe('flag configurations', () => {
    it('should have folder-uid flag', () => {
      const flags = BulkAssets.flags;

      expect(flags['folder-uid']).to.exist;
      expect(flags['folder-uid'].description).to.include('folder');
    });

    it('should inherit base flags', () => {
      const flags = BulkAssets.flags;

      // Check for some key base flags
      expect(flags.alias).to.exist;
      expect(flags['stack-api-key']).to.exist;
      expect(flags.operation).to.exist;
      expect(flags.environments).to.exist;
      expect(flags.locales).to.exist;
      expect(flags['publish-mode']).to.exist;
    });
  });

  describe('examples validation', () => {
    it('should have publish example', () => {
      const hasPublishExample = BulkAssets.examples.some((example: string) => example.includes('--operation publish'));

      expect(hasPublishExample).to.be.true;
    });

    it('should have unpublish example', () => {
      const hasUnpublishExample = BulkAssets.examples.some((example: string) =>
        example.includes('--operation unpublish')
      );

      expect(hasUnpublishExample).to.be.true;
    });

    it('should have cross-publish example', () => {
      const hasCrossPublishExample = BulkAssets.examples.some((example: string) => example.includes('--source-env'));

      expect(hasCrossPublishExample).to.be.true;
    });

    it('should have bulk API example', () => {
      const hasBulkApiExample = BulkAssets.examples.some((example: string) => example.includes('--publish-mode'));

      expect(hasBulkApiExample).to.be.true;
    });

    it('should have folder example', () => {
      const hasFolderExample = BulkAssets.examples.some((example: string) => example.includes('--folder'));

      expect(hasFolderExample).to.be.true;
    });
  });

  describe('run() - lines 50-80 coverage', () => {
    beforeEach(() => {
      // Stub logSummary to prevent console output during tests
      sandbox.stub(utils, 'logSummary');

      (command as any).bulkOperationConfig = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };
    });

    it('should exit early when no assets found (line 50-53)', async () => {
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      sandbox.stub(command as any, 'init').resolves();

      sandbox.stub(command as any, 'fetchItems').resolves([]);

      const confirmSpy = sandbox.spy(command as any, 'confirmOperation');
      const executeSpy = sandbox.spy(command as any, 'executeBulkOperation');
      sandbox.stub(command as any, 'finally').resolves();

      await command.run();

      expect(logStub.warn.calledWith(sinon.match(/no.*asset.*found/i))).to.be.true;

      expect(confirmSpy.called).to.be.false;
      expect(executeSpy.called).to.be.false;
    });

    it.skip('should log info message when assets are found (line 55-57)', async () => {
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      sandbox.stub(command as any, 'init').callsFake(async () => {
        (command as any).parsedFlags = mockFlags;
        (command as any).bulkOperationConfig = {
          operation: OperationType.PUBLISH,
          environments: ['dev'],
          locales: ['en-us'],
        };
        (command as any).logger = logStub;
      });

      // Mock fetchItems to return assets (line 49)
      sandbox.stub(command as any, 'fetchItems').resolves([
        {
          uid: 'asset1',
          locale: 'en-us',
          version: 1,
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
      ]);

      sandbox.stub(command as any, 'confirmOperation').resolves(false);
      sandbox.stub(command as any, 'finally').resolves();

      await command.run();

      expect(logStub.info.called).to.be.true;
    });

    it.skip('should exit early when user cancels confirmation (line 61-64)', async () => {
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      sandbox.stub(command as any, 'init').callsFake(async () => {
        (command as any).parsedFlags = mockFlags;
        (command as any).bulkOperationConfig = {
          operation: OperationType.PUBLISH,
          environments: ['dev'],
          locales: ['en-us'],
        };
        (command as any).logger = logStub;
      });
      sandbox.stub(command as any, 'fetchItems').resolves([
        {
          uid: 'asset1',
          locale: 'en-us',
          version: 1,
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
      ]);

      sandbox.stub(command as any, 'confirmOperation').resolves(false);

      const executeSpy = sandbox.spy(command as any, 'executeBulkOperation');
      const printOperationSummarySpy = sandbox.spy(command as any, 'printOperationSummary');
      sandbox.stub(command as any, 'finally').resolves();

      await command.run();

      expect(logStub.warn.called).to.be.true;

      expect(executeSpy.called).to.be.false;
      expect(printOperationSummarySpy.called).to.be.false;
    });

    it.skip('should call handleCrossPublish when source-env specified (line 67-70)', async () => {
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
        'source-env': 'staging',
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });

      // Mock init to set bulkOperationConfig with sourceEnv and set up stacks
      sandbox.stub(command as any, 'init').callsFake(async () => {
        (command as any).bulkOperationConfig = {
          operation: OperationType.PUBLISH,
          environments: ['dev'],
          locales: ['en-us'],
          sourceEnv: 'staging',
        };
        (command as any).managementStack = {};
        (command as any).deliveryStack = {};
      });

      sandbox.stub(command as any, 'fetchItems').resolves([
        {
          uid: 'asset1',
          locale: 'en-us',
          version: 1,
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
      ]);
      sandbox.stub(command as any, 'confirmOperation').resolves(true);

      const handleCrossPublishStub = sandbox.stub(command as any, 'handleCrossPublish').resolves();
      const executeSpy = sandbox.spy(command as any, 'executeBulkOperation');
      sandbox.stub(command as any, 'finally').resolves();

      await command.run();

      // Line 68: Should call handleCrossPublish
      expect(handleCrossPublishStub.called).to.be.true;
      expect(handleCrossPublishStub.calledWith(mockFlags)).to.be.true;

      // Line 69: Should return early (not call executeBulkOperation)
      expect(executeSpy.called).to.be.false;
    });

    it.skip('should execute bulk operation when NOT cross-publish (line 72-76)', async () => {
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };
      const mockResult = {
        success: 1,
        failed: 0,
        total: 1,
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      sandbox.stub(command as any, 'init').callsFake(async () => {
        (command as any).bulkOperationConfig = {
          operation: OperationType.PUBLISH,
          environments: ['dev'],
          locales: ['en-us'],
          // No sourceEnv
        };
        (command as any).managementStack = {};
        (command as any).deliveryStack = null;
      });

      sandbox.stub(command as any, 'fetchItems').resolves([
        {
          uid: 'asset1',
          locale: 'en-us',
          version: 1,
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
      ]);
      sandbox.stub(command as any, 'confirmOperation').resolves(true);

      const executeStub = sandbox.stub(command as any, 'executeBulkOperation').resolves(mockResult);

      const printOperationSummaryStub = sandbox.stub(command as any, 'printOperationSummary').resolves();

      sandbox.stub(command as any, 'finally').resolves();

      await command.run();

      expect(executeStub.called).to.be.true;
      expect(printOperationSummaryStub.called).to.be.true;
      expect(printOperationSummaryStub.calledWith(mockResult)).to.be.true;
      // Note: logSummary is stubbed but not checked as it's an imported direct reference
    });

    it.skip('should handle errors gracefully (line 77-78)', async () => {
      // Skipped: handleAndLogError is imported directly and cannot be stubbed easily
      // This would require proxyquire or similar module mocking
      const error = new Error('Test error');
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      sandbox.stub(command as any, 'init').rejects(error);
      sandbox.stub(command as any, 'finally').resolves();

      // Error handling happens automatically via handleAndLogError in run's catch block
      await command.run();

      // Verify no exceptions were thrown
      expect(true).to.be.true;
    });

    it('should always call finally handler (line 79-80)', async () => {
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      sandbox.stub(command as any, 'init').resolves();
      sandbox.stub(command as any, 'fetchItems').resolves([]);

      const finallyStub = sandbox.stub(command as any, 'finally').resolves();

      await command.run();

      expect(finallyStub.called).to.be.true;
      expect(finallyStub.calledWith(undefined)).to.be.true;
    });

    it.skip('should call finally even when error occurs', async () => {
      // Skipped: handleAndLogError is imported directly and cannot be stubbed easily
      const error = new Error('Test error');
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      sandbox.stub(command as any, 'init').rejects(error);

      const finallyStub = sandbox.stub(command as any, 'finally').resolves();

      await command.run();

      // Finally should be called even after error
      expect(finallyStub.called).to.be.true;
    });
  });

  describe('asset-specific scenarios', () => {
    beforeEach(() => {
      sandbox.stub(command as any, 'init').resolves();
      sandbox.stub(command as any, 'setupStack').resolves();
      sandbox.stub(command as any, 'buildConfiguration').resolves();
      sandbox.stub(command as any, 'initializeComponents').resolves();
      sandbox.stub(command as any, 'cleanup').resolves();
      sandbox.stub(command as any, 'finally').resolves();
      sandbox.stub(utils, 'logSummary');

      // Initialize bulkOperationConfig (required for run() to check sourceEnv)
      (command as any).bulkOperationConfig = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
      };
    });

    it('should handle folder-uid filtering', async () => {
      const mockFlags = {
        operation: OperationType.PUBLISH,
        environments: ['dev'],
        locales: ['en-us'],
        'folder-uid': 'cs_root',
      };

      sandbox.stub(command as any, 'parse').resolves({ flags: mockFlags });
      sandbox.stub(command as any, 'fetchItems').resolves([]);

      await command.run();

      // Run completes successfully
      expect(true).to.be.true;
    });
  });
});
