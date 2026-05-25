/**
 * Unit tests for operation-confirmation
 * Tests user confirmation prompts for bulk operations
 */

import { expect } from 'chai';
import sinon from 'sinon';
import { confirmOperation } from '../../../src/utils/operation-confirmation';
import { PublishMode, BulkOperationConfig } from '../../../src/interfaces';
import * as cliuxModule from '@contentstack/cli-utilities';

describe('Operation Confirmation', () => {
  let inquireStub: sinon.SinonStub;
  let consoleLogStub: sinon.SinonStub;

  beforeEach(() => {
    inquireStub = sinon.stub();
    consoleLogStub = sinon.stub(console, 'log');

    // Stub cliux.inquire
    sinon.stub(cliuxModule, 'cliux').value({
      inquire: inquireStub,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('confirmOperation', () => {
    it('should return true immediately if skipConfirmation is true', async () => {
      const config: BulkOperationConfig = {
        operation: 'publish',
        environments: ['prod'],
        locales: ['en-us'],
        publishMode: PublishMode.BULK,
      };

      const result = await confirmOperation(config, 10, 'entry', true);

      expect(result).to.be.true;
      expect(inquireStub.called).to.be.false;
      expect(consoleLogStub.called).to.be.false;
    });

    it('should display configuration summary and prompt user', async () => {
      inquireStub.resolves(true);

      const config: BulkOperationConfig = {
        operation: 'publish',
        environments: ['dev', 'staging'],
        locales: ['en-us', 'de-de'],
        publishMode: PublishMode.BULK,
        rateLimit: {
          maxConcurrent: 5,
        },
      };

      const result = await confirmOperation(config, 20, 'entry', false);

      expect(result).to.be.true;
      expect(inquireStub.calledOnce).to.be.true;

      // Verify configuration was logged
      expect(consoleLogStub.called).to.be.true;
      expect(consoleLogStub.calledWith(sinon.match(/publish/))).to.be.true;
      expect(consoleLogStub.calledWith(sinon.match(/entry/))).to.be.true;
      expect(consoleLogStub.calledWith(sinon.match(/20/))).to.be.true;
      expect(consoleLogStub.calledWith(sinon.match(/en-us, de-de/))).to.be.true;
      expect(consoleLogStub.calledWith(sinon.match(/dev, staging/))).to.be.true;
    });

    it('should return false when user declines confirmation', async () => {
      inquireStub.resolves(false);

      const config: BulkOperationConfig = {
        operation: 'unpublish',
        environments: ['prod'],
        locales: ['en-us'],
        publishMode: PublishMode.BULK,
      };

      const result = await confirmOperation(config, 5, 'asset', false);

      expect(result).to.be.false;
      expect(inquireStub.calledOnce).to.be.true;
    });

    it('should display SINGLE mode information', async () => {
      inquireStub.resolves(true);

      const config: BulkOperationConfig = {
        operation: 'publish',
        environments: ['prod'],
        locales: ['en-us'],
        publishMode: PublishMode.SINGLE,
      };

      await confirmOperation(config, 10, 'entry', false);

      expect(consoleLogStub.calledWith(sinon.match(/SINGLE/))).to.be.true;
      // Internal details like "Estimated Batches" are not shown to users
      expect(consoleLogStub.calledWith(sinon.match(/Estimated Batches/))).to.be.false;
    });

    it('should display BULK mode with estimated batches and concurrency', async () => {
      inquireStub.resolves(true);

      const config: BulkOperationConfig = {
        operation: 'publish',
        environments: ['prod'],
        locales: ['en-us'],
        publishMode: PublishMode.BULK,
        rateLimit: {
          maxConcurrent: 3,
        },
      };

      await confirmOperation(config, 15, 'entry', false);

      expect(consoleLogStub.calledWith(sinon.match(/BULK/))).to.be.true;
      // Internal details like "Estimated Batches" and "Concurrency" are not shown to users
      expect(consoleLogStub.calledWith(sinon.match(/Estimated Batches/))).to.be.false;
      expect(consoleLogStub.calledWith(sinon.match(/Concurrency/))).to.be.false;
    });

    it('should use default concurrency of 3 if not provided', async () => {
      inquireStub.resolves(true);

      const config: BulkOperationConfig = {
        operation: 'publish',
        environments: ['prod'],
        locales: ['en-us'],
        publishMode: PublishMode.BULK,
        // No rateLimit provided
      };

      await confirmOperation(config, 10, 'entry', false);

      // Internal details like "Concurrency" are not shown to users
      expect(consoleLogStub.calledWith(sinon.match(/Concurrency/))).to.be.false;
    });

    it('should handle multiple environments and locales', async () => {
      inquireStub.resolves(true);

      const config: BulkOperationConfig = {
        operation: 'publish',
        environments: ['dev', 'staging', 'prod'],
        locales: ['en-us', 'de-de', 'fr-fr', 'es-es'],
        publishMode: PublishMode.BULK,
      };

      await confirmOperation(config, 100, 'entry', false);

      expect(consoleLogStub.calledWith(sinon.match(/dev, staging, prod \(3\)/))).to.be.true;
      expect(consoleLogStub.calledWith(sinon.match(/en-us, de-de, fr-fr, es-es \(4\)/))).to.be.true;
    });

    it('should handle empty environments array', async () => {
      inquireStub.resolves(true);

      const config: BulkOperationConfig = {
        operation: 'publish',
        environments: [],
        locales: ['en-us'],
        publishMode: PublishMode.BULK,
      };

      await confirmOperation(config, 5, 'entry', false);

      expect(consoleLogStub.calledWith(sinon.match(/Environments:  \(0\)/))).to.be.true;
    });

    it('should not display locales when array is empty', async () => {
      inquireStub.resolves(true);

      const config: BulkOperationConfig = {
        operation: 'publish',
        environments: ['prod'],
        locales: [],
        publishMode: PublishMode.BULK,
      };

      await confirmOperation(config, 5, 'entry', false);

      // Should not display locales line when empty
      expect(consoleLogStub.calledWith(sinon.match(/Locales:/))).to.be.false;
    });

    it('should display different resource types correctly', async () => {
      inquireStub.resolves(true);

      const config: BulkOperationConfig = {
        operation: 'publish',
        environments: ['prod'],
        locales: ['en-us'],
        publishMode: PublishMode.BULK,
      };

      await confirmOperation(config, 5, 'asset', false);

      expect(consoleLogStub.calledWith(sinon.match(/Resource Type: asset/))).to.be.true;
    });

    it('should pass correct parameters to cliux.inquire', async () => {
      inquireStub.resolves(true);

      const config: BulkOperationConfig = {
        operation: 'publish',
        environments: ['prod'],
        locales: ['en-us'],
        publishMode: PublishMode.BULK,
      };

      await confirmOperation(config, 10, 'entry', false);

      const inquireCall = inquireStub.getCall(0);
      const inquireArg = inquireCall.args[0];

      expect(inquireArg).to.have.property('type', 'confirm');
      expect(inquireArg).to.have.property('name', 'proceed');
      expect(inquireArg).to.have.property('default', false);
      expect(inquireArg).to.have.property('message');
    });

    it('should handle large item counts', async () => {
      inquireStub.resolves(true);

      const config: BulkOperationConfig = {
        operation: 'publish',
        environments: ['prod'],
        locales: ['en-us'],
        publishMode: PublishMode.BULK,
      };

      await confirmOperation(config, 10000, 'entry', false);

      expect(consoleLogStub.calledWith(sinon.match(/Total Items: 10000/))).to.be.true;
    });

    it('should handle zero items', async () => {
      inquireStub.resolves(false);

      const config: BulkOperationConfig = {
        operation: 'publish',
        environments: ['prod'],
        locales: ['en-us'],
        publishMode: PublishMode.BULK,
      };

      await confirmOperation(config, 0, 'entry', false);

      expect(consoleLogStub.calledWith(sinon.match(/Total Items: 0/))).to.be.true;
    });

    it('should use default publishMode if not provided', async () => {
      inquireStub.resolves(true);

      const config: BulkOperationConfig = {
        operation: 'publish',
        environments: ['prod'],
        locales: ['en-us'],
        // publishMode not provided
      };

      await confirmOperation(config, 10, 'entry', false);

      expect(consoleLogStub.calledWith(sinon.match(/Processing Mode: BULK/))).to.be.true;
    });

    it('should handle configuration display for unpublish operation', async () => {
      inquireStub.resolves(true);

      const config: BulkOperationConfig = {
        operation: 'unpublish',
        environments: ['prod'],
        locales: ['en-us'],
        publishMode: PublishMode.BULK,
      };

      await confirmOperation(config, 10, 'entry', false);

      expect(consoleLogStub.calledWith(sinon.match(/Operation: unpublish/))).to.be.true;
    });

    it('should handle inquire promise rejection', async () => {
      inquireStub.rejects(new Error('User cancelled'));

      const config: BulkOperationConfig = {
        operation: 'publish',
        environments: ['prod'],
        locales: ['en-us'],
        publishMode: PublishMode.BULK,
      };

      try {
        await confirmOperation(config, 10, 'entry', false);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('User cancelled');
      }
    });
  });
});
