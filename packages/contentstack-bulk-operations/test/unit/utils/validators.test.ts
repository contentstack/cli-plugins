import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { validateBranch, validateEnvironments } from '../../../src/utils/validators';
import messages, { $t } from '../../../src/messages';
import { ManagementStack } from '../../../src/interfaces';

describe('Validators', () => {
  let sandbox: sinon.SinonSandbox;
  let mockManagementStack: ManagementStack;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Create fresh mock functions for each test
    mockManagementStack = {
      branch: sandbox.stub(),
      environment: sandbox.stub(),
    } as any;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('validateBranch', () => {
    it('should skip validation for "main" branch', async () => {
      // Should not throw and should not make any API calls
      await validateBranch(mockManagementStack, 'main');

      expect((mockManagementStack.branch as sinon.SinonStub).called).to.be.false;
    });

    it('should pass validation when branch exists', async () => {
      const mockBranches = [
        { uid: 'main', name: 'main' },
        { uid: 'develop', name: 'develop' },
        { uid: 'feature-branch', name: 'feature-branch' },
      ];

      const mockQuery = { find: sandbox.stub().resolves({ items: mockBranches }) };
      const mockBranchChain = { query: sandbox.stub().returns(mockQuery) };
      (mockManagementStack.branch as sinon.SinonStub).returns(mockBranchChain);

      await validateBranch(mockManagementStack, 'develop');

      // Should not throw - validation passed
      expect((mockManagementStack.branch as sinon.SinonStub).calledOnce).to.be.true;
    });

    it('should throw error when branch does not exist', async () => {
      const mockBranches = [
        { uid: 'main', name: 'main' },
        { uid: 'develop', name: 'develop' },
      ];

      const mockQuery = { find: sandbox.stub().resolves({ items: mockBranches }) };
      const mockBranchChain = { query: sandbox.stub().returns(mockQuery) };
      (mockManagementStack.branch as sinon.SinonStub).returns(mockBranchChain);

      try {
        await validateBranch(mockManagementStack, 'non-existent-branch');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal($t(messages.INVALID_BRANCH, { branch: 'non-existent-branch' }));
      }
    });

    it('should rethrow API errors without wrapping', async () => {
      const mockQuery = { find: sandbox.stub().rejects(new Error('API connection failed')) };
      const mockBranchChain = { query: sandbox.stub().returns(mockQuery) };
      (mockManagementStack.branch as sinon.SinonStub).returns(mockBranchChain);

      try {
        await validateBranch(mockManagementStack, 'develop');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal('API connection failed');
      }
    });

    it('should rethrow custom branch validation errors', async () => {
      const customError = new Error($t(messages.INVALID_BRANCH, { branch: 'test-branch' }));
      const mockQuery = { find: sandbox.stub().rejects(customError) };
      const mockBranchChain = { query: sandbox.stub().returns(mockQuery) };
      (mockManagementStack.branch as sinon.SinonStub).returns(mockBranchChain);

      try {
        await validateBranch(mockManagementStack, 'test-branch');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Branch');
        expect(error.message).to.include('test-branch');
      }
    });

    it('should handle empty branch list', async () => {
      const mockQuery = { find: sandbox.stub().resolves({ items: [] }) };
      const mockBranchChain = { query: sandbox.stub().returns(mockQuery) };
      (mockManagementStack.branch as sinon.SinonStub).returns(mockBranchChain);

      try {
        await validateBranch(mockManagementStack, 'any-branch');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal($t(messages.INVALID_BRANCH, { branch: 'any-branch' }));
      }
    });
  });

  describe('validateEnvironments', () => {
    it('should skip validation when environments array is empty', async () => {
      await validateEnvironments(mockManagementStack, []);

      expect((mockManagementStack.environment as sinon.SinonStub).called).to.be.false;
    });

    it('should skip validation when environments is undefined', async () => {
      await validateEnvironments(mockManagementStack, undefined as any);

      expect((mockManagementStack.environment as sinon.SinonStub).called).to.be.false;
    });

    it('should pass validation when all environments exist', async () => {
      const mockEnvironments = [
        { name: 'dev', uid: 'bltdev123' },
        { name: 'staging', uid: 'bltstaging123' },
        { name: 'production', uid: 'bltprod123' },
      ];

      const mockQuery = { find: sandbox.stub().resolves({ items: mockEnvironments }) };
      const mockEnvChain = { query: sandbox.stub().returns(mockQuery) };
      (mockManagementStack.environment as sinon.SinonStub).returns(mockEnvChain);

      await validateEnvironments(mockManagementStack, ['dev', 'staging']);

      // Should not throw - validation passed
      expect((mockManagementStack.environment as sinon.SinonStub).calledOnce).to.be.true;
    });

    it('should throw error when environment does not exist', async () => {
      const mockEnvironments = [
        { name: 'dev', uid: 'bltdev123' },
        { name: 'staging', uid: 'bltstaging123' },
      ];

      const mockQuery = { find: sandbox.stub().resolves({ items: mockEnvironments }) };
      const mockEnvChain = { query: sandbox.stub().returns(mockQuery) };
      (mockManagementStack.environment as sinon.SinonStub).returns(mockEnvChain);

      try {
        await validateEnvironments(mockManagementStack, ['dev', 'production']);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal($t(messages.INVALID_ENVIRONMENT, { environment: 'production' }));
      }
    });

    it('should validate all environments and report the first invalid one', async () => {
      const mockEnvironments = [{ name: 'dev', uid: 'bltdev123' }];

      const mockQuery = { find: sandbox.stub().resolves({ items: mockEnvironments }) };
      const mockEnvChain = { query: sandbox.stub().returns(mockQuery) };
      (mockManagementStack.environment as sinon.SinonStub).returns(mockEnvChain);

      try {
        await validateEnvironments(mockManagementStack, ['invalid1', 'invalid2']);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal($t(messages.INVALID_ENVIRONMENT, { environment: 'invalid1' }));
      }
    });

    it('should rethrow API errors without wrapping', async () => {
      const mockQuery = { find: sandbox.stub().rejects(new Error('API connection failed')) };
      const mockEnvChain = { query: sandbox.stub().returns(mockQuery) };
      (mockManagementStack.environment as sinon.SinonStub).returns(mockEnvChain);

      try {
        await validateEnvironments(mockManagementStack, ['dev']);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal('API connection failed');
      }
    });

    it('should rethrow custom environment validation errors', async () => {
      const customError = new Error($t(messages.INVALID_ENVIRONMENT, { environment: 'test-env' }));
      const mockQuery = { find: sandbox.stub().rejects(customError) };
      const mockEnvChain = { query: sandbox.stub().returns(mockQuery) };
      (mockManagementStack.environment as sinon.SinonStub).returns(mockEnvChain);

      try {
        await validateEnvironments(mockManagementStack, ['test-env']);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Environment');
        expect(error.message).to.include('test-env');
      }
    });

    it('should handle empty environment list from API', async () => {
      const mockQuery = { find: sandbox.stub().resolves({ items: [] }) };
      const mockEnvChain = { query: sandbox.stub().returns(mockQuery) };
      (mockManagementStack.environment as sinon.SinonStub).returns(mockEnvChain);

      try {
        await validateEnvironments(mockManagementStack, ['any-env']);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal($t(messages.INVALID_ENVIRONMENT, { environment: 'any-env' }));
      }
    });

    it('should validate single environment', async () => {
      const mockEnvironments = [{ name: 'production', uid: 'bltprod123' }];

      const mockQuery = { find: sandbox.stub().resolves({ items: mockEnvironments }) };
      const mockEnvChain = { query: sandbox.stub().returns(mockQuery) };
      (mockManagementStack.environment as sinon.SinonStub).returns(mockEnvChain);

      await validateEnvironments(mockManagementStack, ['production']);

      // Should not throw - validation passed
      expect((mockManagementStack.environment as sinon.SinonStub).calledOnce).to.be.true;
    });

    it('should validate multiple environments', async () => {
      const mockEnvironments = [
        { name: 'dev', uid: 'bltdev123' },
        { name: 'staging', uid: 'bltstaging123' },
        { name: 'production', uid: 'bltprod123' },
      ];

      const mockQuery = { find: sandbox.stub().resolves({ items: mockEnvironments }) };
      const mockEnvChain = { query: sandbox.stub().returns(mockQuery) };
      (mockManagementStack.environment as sinon.SinonStub).returns(mockEnvChain);

      await validateEnvironments(mockManagementStack, ['dev', 'staging', 'production']);

      // Should not throw - validation passed
      expect((mockManagementStack.environment as sinon.SinonStub).calledOnce).to.be.true;
    });
  });
});
