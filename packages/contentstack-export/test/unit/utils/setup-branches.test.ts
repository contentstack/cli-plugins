import { expect } from 'chai';
import sinon from 'sinon';
import setupBranches from '../../../src/utils/setup-branches';
import * as fileHelper from '../../../src/utils/file-helper';
import { ExportConfig } from '../../../src/types';

describe('Setup Branches', () => {
  let sandbox: sinon.SinonSandbox;
  let mockStackAPIClient: any;
  let mockConfig: ExportConfig;
  let makeDirectoryStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Create mock stack API client
    mockStackAPIClient = {
      branch: sandbox.stub()
    };

    // Mock config
    mockConfig = {
      exportDir: '/test/export',
      branchName: '',
      branches: []
    } as Partial<ExportConfig> as ExportConfig;

    makeDirectoryStub = sandbox.stub(fileHelper, 'makeDirectory');

  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Config Validation', () => {
    it('should throw error when config is not an object', async () => {
      try {
        await setupBranches(null as any, mockStackAPIClient);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Cannot read properties of null');
      }
    });

    it('should throw error when config is undefined', async () => {
      try {
        await setupBranches(undefined as any, mockStackAPIClient);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal('Invalid config to setup the branch');
      }
    });
  });

  describe('Branch Name Provided', () => {
    it('should fetch and setup branch when branch name is provided and branch exists', async () => {
      const branchName = 'test-branch';
      const mockBranch = {
        uid: 'branch-123',
        name: branchName,
        source: 'main'
      };

      mockConfig.branchName = branchName;
      mockConfig.exportDir = '/test/export';

      const mockBranchClient = {
        fetch: sandbox.stub().resolves(mockBranch)
      };
      mockStackAPIClient.branch.returns(mockBranchClient);

      await setupBranches(mockConfig, mockStackAPIClient);

      expect(mockStackAPIClient.branch.calledWith(branchName)).to.be.true;
      expect(mockBranchClient.fetch.called).to.be.true;
      expect(makeDirectoryStub.calledWith(mockConfig.exportDir)).to.be.true;
      expect(mockConfig.branches).to.deep.equal([mockBranch]);
    });

    it('should throw error when branch name is provided but branch does not exist', async () => {
      const branchName = 'non-existent-branch';
      mockConfig.branchName = branchName;

      const mockBranchClient = {
        fetch: sandbox.stub().rejects(new Error('Branch not found'))
      };
      mockStackAPIClient.branch.returns(mockBranchClient);

      try {
        await setupBranches(mockConfig, mockStackAPIClient);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal('No branch found with the given name ' + branchName);
      }

      expect(makeDirectoryStub.called).to.be.false;
    });

    it('should throw error when branch fetch returns invalid result', async () => {
      const branchName = 'test-branch';
      mockConfig.branchName = branchName;

      const mockBranchClient = {
        fetch: sandbox.stub().resolves(null)
      };
      mockStackAPIClient.branch.returns(mockBranchClient);

      try {
        await setupBranches(mockConfig, mockStackAPIClient);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal('No branch found with the given name ' + branchName);
      }
    });

    it('should throw error when branch fetch returns non-object', async () => {
      const branchName = 'test-branch';
      mockConfig.branchName = branchName;

      const mockBranchClient = {
        fetch: sandbox.stub().resolves('invalid-result')
      };
      mockStackAPIClient.branch.returns(mockBranchClient);

      try {
        await setupBranches(mockConfig, mockStackAPIClient);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal('No branch found with the given name ' + branchName);
      }
    });
  });

  describe('No Branch Name Provided', () => {
    it('should fetch all branches and setup when branches exist', async () => {
      const mockBranches = [
        { uid: 'branch-1', name: 'branch1', source: 'main' },
        { uid: 'branch-2', name: 'branch2', source: 'main' }
      ];

      mockConfig.branchName = '';
      mockConfig.exportDir = '/test/export';

      const mockQuery = {
        find: sandbox.stub().resolves({ items: mockBranches })
      };
      const mockBranchClient = {
        query: sandbox.stub().returns(mockQuery)
      };
      mockStackAPIClient.branch.returns(mockBranchClient);

      await setupBranches(mockConfig, mockStackAPIClient);

      expect(mockStackAPIClient.branch.calledWith()).to.be.true;
      expect(mockBranchClient.query.called).to.be.true;
      expect(mockQuery.find.called).to.be.true;
      expect(makeDirectoryStub.calledWith(mockConfig.exportDir)).to.be.true;
      expect(mockConfig.branches).to.deep.equal(mockBranches);
    });

    it('should return early when no branches found', async () => {
      mockConfig.branchName = '';

      const mockQuery = {
        find: sandbox.stub().resolves({ items: [] })
      };
      const mockBranchClient = {
        query: sandbox.stub().returns(mockQuery)
      };
      mockStackAPIClient.branch.returns(mockBranchClient);

      const result = await setupBranches(mockConfig, mockStackAPIClient);

      expect(result).to.be.undefined;
      expect(makeDirectoryStub.called).to.be.false;
    });

    it('should return early when result has no items', async () => {
      mockConfig.branchName = '';

      const mockQuery = {
        find: sandbox.stub().resolves({ items: null })
      };
      const mockBranchClient = {
        query: sandbox.stub().returns(mockQuery)
      };
      mockStackAPIClient.branch.returns(mockBranchClient);

      const result = await setupBranches(mockConfig, mockStackAPIClient);

      expect(result).to.be.undefined;
      expect(makeDirectoryStub.called).to.be.false;
    });

    it('should return early when items is not an array', async () => {
      mockConfig.branchName = '';

      const mockQuery = {
        find: sandbox.stub().resolves({ items: 'not-an-array' })
      };
      const mockBranchClient = {
        query: sandbox.stub().returns(mockQuery)
      };
      mockStackAPIClient.branch.returns(mockBranchClient);

      const result = await setupBranches(mockConfig, mockStackAPIClient);

      expect(result).to.be.undefined;
      expect(makeDirectoryStub.called).to.be.false;
    });

    it('should handle query errors gracefully and return early', async () => {
      mockConfig.branchName = '';

      const mockQuery = {
        find: sandbox.stub().rejects(new Error('Query failed'))
      };
      const mockBranchClient = {
        query: sandbox.stub().returns(mockQuery)
      };
      mockStackAPIClient.branch.returns(mockBranchClient);

      const result = await setupBranches(mockConfig, mockStackAPIClient);

      expect(result).to.be.undefined;
      expect(makeDirectoryStub.called).to.be.false;
    });

    it('should handle query catch rejection and return early', async () => {
      mockConfig.branchName = '';

      const mockQuery = {
        find: sandbox.stub().returns(Promise.reject(new Error('Query failed')).catch(() => {}))
      };
      const mockBranchClient = {
        query: sandbox.stub().returns(mockQuery)
      };
      mockStackAPIClient.branch.returns(mockBranchClient);

      const result = await setupBranches(mockConfig, mockStackAPIClient);

      expect(result).to.be.undefined;
      expect(makeDirectoryStub.called).to.be.false;
    });
  });

  describe('File Operations', () => {
    it('should create export directory when branches are resolved', async () => {
      const mockBranch = { uid: 'branch-123', name: 'test-branch' };
      mockConfig.branchName = 'test-branch';
      mockConfig.exportDir = '/test/export/../export';

      const mockBranchClient = {
        fetch: sandbox.stub().resolves(mockBranch)
      };
      mockStackAPIClient.branch.returns(mockBranchClient);

      await setupBranches(mockConfig, mockStackAPIClient);

      expect(makeDirectoryStub.calledWith(mockConfig.exportDir)).to.be.true;
    });
  });

  describe('Config Updates', () => {
    it('should add branches array to config object', async () => {
      const mockBranch = { uid: 'branch-123', name: 'test-branch' };
      mockConfig.branchName = 'test-branch';
      mockConfig.branches = []; // Initially empty

      const mockBranchClient = {
        fetch: sandbox.stub().resolves(mockBranch)
      };
      mockStackAPIClient.branch.returns(mockBranchClient);

      await setupBranches(mockConfig, mockStackAPIClient);

      expect(mockConfig.branches).to.deep.equal([mockBranch]);
    });

    it('should update config with multiple branches when no branch name provided', async () => {
      const mockBranches = [
        { uid: 'branch-1', name: 'branch1' },
        { uid: 'branch-2', name: 'branch2' }
      ];

      mockConfig.branchName = '';
      mockConfig.branches = [];

      const mockQuery = {
        find: sandbox.stub().resolves({ items: mockBranches })
      };
      const mockBranchClient = {
        query: sandbox.stub().returns(mockQuery)
      };
      mockStackAPIClient.branch.returns(mockBranchClient);

      await setupBranches(mockConfig, mockStackAPIClient);

      expect(mockConfig.branches).to.deep.equal(mockBranches);
      expect(mockConfig.branches.length).to.equal(2);
    });
  });
});

