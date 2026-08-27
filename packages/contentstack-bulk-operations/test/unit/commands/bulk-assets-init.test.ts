/* eslint-disable @typescript-eslint/no-explicit-any */
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { Command } from '@contentstack/cli-command';
import BulkAssets from '../../../src/commands/cm/stacks/bulk-assets';
import { BaseBulkCommand } from '../../../src/base-bulk-command';
import { OperationFlagMatrixError } from '../../../src/utils/operation-flag-matrix';

/**
 * Integration tests for the merged command's init() dispatch: operation
 * resolution from argv, flag-matrix enforcement, pipeline selection, and the
 * interactive prompt fallback.
 */
describe('BulkAssets command — init() dispatch', () => {
  let sandbox: sinon.SinonSandbox;
  let command: BulkAssets;
  // The utils barrel re-exports via getters, so stubs must target the defining modules
  let interactiveModule: any;
  let logHandlerModule: any;
  let cliUtilitiesModule: any;
  let logStub: any;
  let originalIsTTY: PropertyDescriptor | undefined;

  function setStdinTTY(value: boolean): void {
    Object.defineProperty(process.stdin, 'isTTY', { value, configurable: true });
  }

  const csDeleteArgv = [
    '--operation',
    'delete',
    '--space-uid',
    'sp1',
    '--org-uid',
    'org1',
    '--asset-uids-file',
    './assets.json',
    '--locale',
    'en-us',
    '-y',
  ];

  function makeCommand(argv: string[]): BulkAssets {
    const cmd = new BulkAssets(argv, {} as any);
    (cmd as any).config = {
      runHook: sandbox.stub().resolves(),
      bin: 'test-bin',
      version: '1.0.0',
    };
    return cmd;
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();

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

    interactiveModule = require('../../../src/utils/interactive');
    logHandlerModule = require('../../../src/utils/bulk-operation-log-handler');
    originalIsTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');

    // Stub the framework-level init so no real oclif/CLI setup runs
    sandbox.stub(Command.prototype, 'init' as any).resolves();
  });

  afterEach(() => {
    sandbox.restore();
    process.exitCode = undefined;
    if (originalIsTTY) {
      Object.defineProperty(process.stdin, 'isTTY', originalIsTTY);
    } else {
      delete (process.stdin as any).isTTY;
    }
  });

  describe('delete/move → CS Assets pipeline', () => {
    it('skips the bulk pipeline entirely and fills CS Assets flags', async () => {
      command = makeCommand([...csDeleteArgv]);

      const parsedFlags = {
        operation: 'delete',
        'space-uid': 'sp1',
        'org-uid': 'org1',
        'asset-uids-file': './assets.json',
        locale: 'en-us',
        workspace: 'main',
        yes: true,
      };
      sandbox.stub(command as any, 'parse').resolves({ flags: parsedFlags });
      const fillStub = sandbox.stub(interactiveModule, 'fillMissingCsAssetsFlags').resolvesArg(0);

      const buildConfigSpy = sandbox.spy(command as any, 'buildConfiguration');
      const setupStackSpy = sandbox.spy(command as any, 'setupStack');

      await (command as any).init();

      expect((command as any).csAssetsMode).to.be.true;
      expect((command as any).shouldSkipBulkPipeline()).to.be.true;
      expect(fillStub.calledOnce).to.be.true;
      expect((command as any).csAssetsFlags).to.deep.equal(parsedFlags);
      // Bulk-publish pipeline must never run for CS Assets operations
      expect(buildConfigSpy.called).to.be.false;
      expect(setupStackSpy.called).to.be.false;
      expect((command as any).queueManager).to.be.undefined;
      expect((command as any).rateLimiter).to.be.undefined;
    });
  });

  describe('publish/unpublish → CMS pipeline', () => {
    it('runs the full BaseBulkCommand pipeline', async () => {
      command = makeCommand(['--operation', 'publish', '--environments', 'dev', '--locales', 'en-us', '-k', 'blt1']);

      sandbox.stub(command as any, 'parse').resolves({
        flags: {
          operation: 'publish',
          environments: ['dev'],
          locales: ['en-us'],
          'stack-api-key': 'blt1',
        },
      });
      sandbox.stub(interactiveModule, 'fillMissingFlags').resolvesArg(0);
      sandbox.stub(logHandlerModule, 'clearLogs').returns(undefined);
      const fillCsStub = sandbox.stub(interactiveModule, 'fillMissingCsAssetsFlags');

      const buildConfigStub = sandbox.stub(command as any, 'buildConfiguration').callsFake(() => {
        (command as any).bulkOperationConfig = {
          operation: 'publish',
          environments: ['dev'],
          locales: ['en-us'],
          bulkOperationFolder: '/mock/bulk-operation',
        };
        return Promise.resolve();
      });
      const setupStackStub = sandbox.stub(command as any, 'setupStack').resolves();
      const initComponentsStub = sandbox.stub(command as any, 'initializeComponents').resolves();

      await (command as any).init();

      expect((command as any).csAssetsMode).to.be.false;
      expect((command as any).shouldSkipBulkPipeline()).to.be.false;
      expect(buildConfigStub.calledOnce).to.be.true;
      expect(setupStackStub.calledOnce).to.be.true;
      expect(initComponentsStub.calledOnce).to.be.true;
      expect(fillCsStub.called).to.be.false;
    });
  });

  describe('flag-matrix enforcement', () => {
    it('aborts init with OperationFlagMatrixError when a CMS flag is passed with delete', async () => {
      command = makeCommand(['--operation', 'delete', '--environments', 'dev']);
      const parseSpy = sandbox.spy(command as any, 'parse');

      let thrown: unknown;
      try {
        await (command as any).init();
      } catch (e) {
        thrown = e;
      }

      expect(thrown).to.be.instanceOf(OperationFlagMatrixError);
      expect(process.exitCode).to.equal(1);
      expect(logStub.error.called).to.be.true;
      expect(parseSpy.called).to.be.false; // aborted before any pipeline work
    });

    it('catch() swallows OperationFlagMatrixError without double-logging', async () => {
      command = makeCommand([]);
      const baseCatchStub = sandbox.stub(BaseBulkCommand.prototype, 'catch').resolves();

      await (command as any).catch(new OperationFlagMatrixError(['--environments is not valid']));

      expect(baseCatchStub.called).to.be.false; // violations already logged by enforce
    });

    it('catch() delegates other errors to the base handler', async () => {
      command = makeCommand([]);
      const baseCatchStub = sandbox.stub(BaseBulkCommand.prototype, 'catch').resolves();

      await (command as any).catch(new Error('boom'));

      expect(baseCatchStub.calledOnce).to.be.true;
    });
  });

  describe('operation resolution', () => {
    it('throws in non-TTY environments when --operation is missing', async () => {
      command = makeCommand([]);
      setStdinTTY(false);

      let thrown: unknown;
      try {
        await (command as any).init();
      } catch (e) {
        thrown = e;
      }

      expect(thrown).to.be.instanceOf(Error);
      expect((thrown as Error).message).to.include('--operation');
    });

    it('prompts with all four operations and feeds the answer back into argv', async () => {
      command = makeCommand([]);
      setStdinTTY(true);

      const promptStub = sandbox.stub(interactiveModule, 'promptForOperation').resolves('delete');
      sandbox.stub(command as any, 'parse').resolves({ flags: { operation: 'delete' } });
      sandbox.stub(interactiveModule, 'fillMissingCsAssetsFlags').resolvesArg(0);

      await (command as any).init();

      expect(promptStub.calledOnce).to.be.true;
      const choices = promptStub.firstCall.args[0];
      expect(choices.map((c: any) => c.value)).to.deep.equal(['publish', 'unpublish', 'delete', 'move']);
      expect((command as any).argv).to.include.members(['--operation', 'delete']);
      expect((command as any).csAssetsMode).to.be.true;
    });

    it('does not prompt on the retry/revert path but still rejects CS Assets flags', async () => {
      command = makeCommand(['--retry-failed', './bulk-operation', '--space-uid', 'sp1']);
      const promptStub = sandbox.stub(interactiveModule, 'promptForOperation');

      let thrown: unknown;
      try {
        await (command as any).init();
      } catch (e) {
        thrown = e;
      }

      expect(promptStub.called).to.be.false;
      expect(thrown).to.be.instanceOf(OperationFlagMatrixError);
      expect(logStub.error.firstCall.args[0]).to.include('--retry-failed/--revert');
    });

    it('does not prompt for an operation on the --retry-pending path', async () => {
      command = makeCommand(['--retry-pending', './bulk-operation']);
      const promptStub = sandbox.stub(interactiveModule, 'promptForOperation');
      sandbox.stub(command as any, 'parse').resolves({ flags: { 'retry-pending': './bulk-operation' } });
      // Stop before the flow itself runs — this asserts only that init() skipped the prompt.
      sandbox.stub(command as any, 'initForRetryPendingScan').resolves(undefined);

      await (command as any).init();

      expect(promptStub.called).to.be.false;
    });
  });

  describe('--retry-pending short circuit', () => {
    it('runs the pending-scan flow and skips the normal pipeline and clearLogs', async () => {
      command = makeCommand(['--retry-pending', './bulk-operation']);
      sandbox.stub(command as any, 'parse').resolves({ flags: { 'retry-pending': './bulk-operation' } });

      const clearLogsStub = sandbox.stub(logHandlerModule, 'clearLogs').returns(undefined);
      const retryFlowStub = sandbox.stub(command as any, 'initForRetryPendingScan').resolves(undefined);
      const setupStackStub = sandbox.stub(command as any, 'setupStack').resolves(undefined);

      await (command as any).init();

      expect(retryFlowStub.calledOnce).to.be.true;
      // A retry run must not wipe the sibling logs of the run being retried.
      expect(clearLogsStub.called).to.be.false;
      expect(setupStackStub.called).to.be.false;
    });

    it('leaves the normal pipeline alone when --retry-pending is absent', async () => {
      command = makeCommand(['--operation', 'publish']);
      sandbox.stub(command as any, 'parse').resolves({ flags: { operation: 'publish' } });
      sandbox.stub(logHandlerModule, 'clearLogs').returns(undefined);

      const retryFlowStub = sandbox.stub(command as any, 'initForRetryPendingScan').resolves(undefined);
      sandbox.stub(command as any, 'resolveFlagsInteractively').resolvesArg(0);
      sandbox.stub(command as any, 'buildConfiguration').callsFake(async () => {
        (command as any).bulkOperationConfig = { bulkOperationFolder: './bulk-operation' };
      });
      sandbox.stub(command as any, 'setupStack').resolves(undefined);
      sandbox.stub(command as any, 'initializeComponents').resolves(undefined);

      await (command as any).init();

      expect(retryFlowStub.called).to.be.false;
    });
  });
});
