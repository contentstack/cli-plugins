import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import {
  validateOperationFlagMatrix,
  enforceOperationFlagMatrix,
  getOperationFromArgv,
  OperationFlagMatrixError,
  RETRY_REVERT_CONTEXT,
} from '../../../src/utils/operation-flag-matrix';

describe('operation-flag-matrix', () => {
  describe('validateOperationFlagMatrix', () => {
    describe('delete/move reject CMS-only flags', () => {
      it('rejects --environments with delete', () => {
        const violations = validateOperationFlagMatrix('delete', ['--operation', 'delete', '--environments', 'dev']);
        expect(violations).to.have.lengthOf(1);
        expect(violations[0]).to.include('--environments');
        expect(violations[0]).to.include('delete');
      });

      it('rejects explicitly passed defaulted flags (--branch, --publish-mode) with delete', () => {
        const violations = validateOperationFlagMatrix('delete', [
          '--operation',
          'delete',
          '--branch',
          'dev',
          '--publish-mode',
          'bulk',
        ]);
        expect(violations).to.have.lengthOf(2);
        expect(violations.join(' ')).to.include('--branch');
        expect(violations.join(' ')).to.include('--publish-mode');
      });

      it('does NOT trip on flag defaults when they are not in argv', () => {
        // --branch defaults to "main" after parse, but was never passed
        const violations = validateOperationFlagMatrix('delete', [
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
        ]);
        expect(violations).to.be.empty;
      });

      it('rejects short flags -k and -a with move', () => {
        const violations = validateOperationFlagMatrix('move', ['-k', 'blt123', '-a', 'myAlias']);
        expect(violations).to.have.lengthOf(2);
      });

      it('rejects --flag=value form', () => {
        const violations = validateOperationFlagMatrix('delete', ['--environments=dev']);
        expect(violations).to.have.lengthOf(1);
      });

      it('rejects --retry-failed and --revert with delete', () => {
        const violations = validateOperationFlagMatrix('delete', ['--retry-failed', './log', '--revert', './log']);
        expect(violations).to.have.lengthOf(2);
      });

      it('adds a did-you-mean hint for --locales with delete', () => {
        const violations = validateOperationFlagMatrix('delete', ['--locales', 'en-us']);
        expect(violations).to.have.lengthOf(1);
        expect(violations[0]).to.include('--locale?');
      });

      it('rejects --locale with move (delete-only flag within CS Assets pair)', () => {
        const violations = validateOperationFlagMatrix('move', ['--locale', 'en-us']);
        expect(violations).to.have.lengthOf(1);
        expect(violations[0]).to.include('--locale');
      });

      it('rejects --retry-pending with delete and move', () => {
        expect(validateOperationFlagMatrix('delete', ['--retry-pending', './log'])).to.have.lengthOf(1);
        expect(validateOperationFlagMatrix('move', ['--retry-pending', './log'])).to.have.lengthOf(1);
      });
    });

    describe('publish/unpublish reject CS Assets flags', () => {
      it('rejects --space-uid with publish', () => {
        const violations = validateOperationFlagMatrix('publish', ['--space-uid', 'sp1']);
        expect(violations).to.have.lengthOf(1);
        expect(violations[0]).to.include('--space-uid');
      });

      it('adds a did-you-mean hint for --locale with publish', () => {
        const violations = validateOperationFlagMatrix('publish', ['--locale', 'en-us']);
        expect(violations).to.have.lengthOf(1);
        expect(violations[0]).to.include('--locales?');
      });

      it('accepts a normal publish invocation', () => {
        const violations = validateOperationFlagMatrix('publish', [
          '--operation',
          'publish',
          '--environments',
          'dev',
          '--locales',
          'en-us',
          '-k',
          'blt123',
        ]);
        expect(violations).to.be.empty;
      });

      it('rejects --retry-pending with unpublish (scan status only gates publish)', () => {
        const violations = validateOperationFlagMatrix('unpublish', ['--retry-pending', './log']);
        expect(violations).to.have.lengthOf(1);
        expect(violations[0]).to.include('--retry-pending');
      });

      it('accepts --retry-pending with publish', () => {
        const violations = validateOperationFlagMatrix('publish', ['--retry-pending', './log']);
        expect(violations).to.be.empty;
      });

      it('accepts --retry-pending on the retry/revert path (no operation given)', () => {
        const violations = validateOperationFlagMatrix(RETRY_REVERT_CONTEXT, ['--retry-pending', './log']);
        expect(violations).to.be.empty;
      });

      it('rejects CS Assets flags on the retry/revert path (no operation given)', () => {
        const violations = validateOperationFlagMatrix(RETRY_REVERT_CONTEXT, [
          '--retry-failed',
          './log',
          '--space-uid',
          'sp1',
        ]);
        expect(violations).to.have.lengthOf(1);
        expect(violations[0]).to.include('--space-uid');
        // retry/revert is not an operation the user typed — message must not present it as one
        expect(violations[0]).to.include('--retry-failed/--revert');
        expect(violations[0]).to.not.include('operation "retry/revert"');
      });
    });
  });

  describe('enforceOperationFlagMatrix', () => {
    let sandbox: sinon.SinonSandbox;
    let logErrorStub: sinon.SinonStub;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      const cliUtilities = require('@contentstack/cli-utilities');
      logErrorStub = sandbox.stub();
      sandbox.stub(cliUtilities, 'log').value({ error: logErrorStub });
    });

    afterEach(() => {
      sandbox.restore();
      process.exitCode = undefined;
    });

    it('throws OperationFlagMatrixError and sets exitCode=1 on violations (no process.exit)', () => {
      let thrown: unknown;
      try {
        enforceOperationFlagMatrix('delete', ['--environments', 'dev', '--branch', 'main']);
      } catch (e) {
        thrown = e;
      }

      expect(thrown).to.be.instanceOf(OperationFlagMatrixError);
      expect((thrown as OperationFlagMatrixError).violations).to.have.lengthOf(2);
      expect(process.exitCode).to.equal(1);
      expect(logErrorStub.callCount).to.equal(2); // each violation logged individually
    });

    it('does nothing on a valid flag set', () => {
      enforceOperationFlagMatrix('delete', ['--operation', 'delete', '--space-uid', 'sp1']);

      expect(process.exitCode).to.not.equal(1);
      expect(logErrorStub.called).to.be.false;
    });
  });

  describe('getOperationFromArgv', () => {
    it('reads --operation value form', () => {
      expect(getOperationFromArgv(['--operation', 'delete'])).to.equal('delete');
    });

    it('reads --operation=value form', () => {
      expect(getOperationFromArgv(['--operation=move'])).to.equal('move');
    });

    it('returns undefined when absent', () => {
      expect(getOperationFromArgv(['--retry-failed', './log'])).to.be.undefined;
    });
  });
});
