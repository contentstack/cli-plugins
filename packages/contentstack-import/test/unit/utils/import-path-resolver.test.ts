import { expect } from 'chai';
import sinon from 'sinon';
import * as path from 'path';
import {
  resolveImportPath,
  updateImportConfigWithResolvedPath,
  executeImportPathLogic,
} from '../../../src/utils/import-path-resolver';
import { ImportConfig } from '../../../src/types';
import * as fileHelper from '../../../src/utils/file-helper';
import * as cliUtilities from '@contentstack/cli-utilities';
import defaultConfig from '../../../src/config';

describe('Import Path Resolver', () => {
  let sandbox: sinon.SinonSandbox;
  let fileExistsSyncStub: sinon.SinonStub;
  let logStub: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    fileExistsSyncStub = sandbox.stub(fileHelper, 'fileExistsSync');

    logStub = {
      debug: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
    };
    sandbox.stub(cliUtilities, 'log').value(logStub);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('resolveImportPath', () => {
    let mockConfig: ImportConfig;
    let mockStackAPIClient: any;

    beforeEach(() => {
      mockStackAPIClient = {};
      mockConfig = {
        contentDir: '/test/content',
        apiKey: 'test',
      } as ImportConfig;
    });

    it('should throw error when content directory does not exist', async () => {
      fileExistsSyncStub.withArgs('/test/content').returns(false);

      try {
        await resolveImportPath(mockConfig, mockStackAPIClient);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Content directory does not exist');
      }
    });

    it('should return contentDir when module folders exist at export root', async () => {
      fileExistsSyncStub.withArgs('/test/content').returns(true);
      const modulePath = path.join('/test/content', defaultConfig.modules.types[0]);
      fileExistsSyncStub.withArgs(modulePath).returns(true);

      const result = await resolveImportPath(mockConfig, mockStackAPIClient);

      expect(result).to.equal('/test/content');
    });

    it('should return contentDir when no module folders exist', async () => {
      mockConfig.contentDir = '/test/data';
      fileExistsSyncStub.withArgs('/test/data').returns(true);
      defaultConfig.modules.types.forEach((moduleType) => {
        fileExistsSyncStub.withArgs(path.join('/test/data', moduleType)).returns(false);
      });

      const result = await resolveImportPath(mockConfig, mockStackAPIClient);

      expect(result).to.equal('/test/data');
    });
  });

  describe('updateImportConfigWithResolvedPath', () => {
    let mockConfig: ImportConfig;

    beforeEach(() => {
      mockConfig = {
        contentDir: '/test/content',
        apiKey: 'test',
      } as ImportConfig;
    });

    it('should skip update when resolved path does not exist', async () => {
      const resolvedPath = '/test/resolved';
      fileExistsSyncStub.withArgs(resolvedPath).returns(false);

      await updateImportConfigWithResolvedPath(mockConfig, resolvedPath);

      expect(mockConfig.contentDir).to.equal('/test/content');
    });

    it('should update contentDir with resolved path when it exists', async () => {
      const resolvedPath = '/test/resolved';
      fileExistsSyncStub.withArgs(resolvedPath).returns(true);

      await updateImportConfigWithResolvedPath(mockConfig, resolvedPath);

      expect(mockConfig.contentDir).to.equal(resolvedPath);
    });
  });

  describe('executeImportPathLogic', () => {
    let mockConfig: ImportConfig;
    let mockStackAPIClient: any;

    beforeEach(() => {
      mockStackAPIClient = {};
      mockConfig = {
        contentDir: '/test/content',
        apiKey: 'test',
      } as ImportConfig;
    });

    it('should resolve path and set contentDir on config', async () => {
      fileExistsSyncStub.withArgs('/test/content').returns(true);
      defaultConfig.modules.types.forEach((moduleType) => {
        fileExistsSyncStub.withArgs(path.join('/test/content', moduleType)).returns(false);
      });

      const result = await executeImportPathLogic(mockConfig, mockStackAPIClient);

      expect(result).to.equal('/test/content');
      expect(mockConfig.contentDir).to.equal('/test/content');
    });
  });
});
