import { expect } from 'chai';
import * as sinon from 'sinon';
import { ModuleExporter } from '../../src/core/module-exporter';
import * as logger from '../../src/utils/logger';
import ExportCommand from '@contentstack/cli-cm-export';

describe('ModuleExporter', () => {
  let sandbox: sinon.SinonSandbox;
  let moduleExporter: ModuleExporter;
  let mockStackAPIClient: any;
  let mockConfig: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock stack API client
    mockStackAPIClient = {
      contentType: sandbox.stub(),
      entry: sandbox.stub(),
      asset: sandbox.stub(),
    };

    // Mock export configuration
    mockConfig = {
      exportDir: './test-export',
      stackApiKey: 'test-stack-api-key',
      managementToken: 'test-management-token',
      branchName: 'main',
      securedAssets: false,
      externalConfigPath: './config/export-config.json',
    };

    // Stub logger to prevent console output during tests
    sandbox.stub(logger, 'log');

    moduleExporter = new ModuleExporter(mockConfig);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should initialize ModuleExporter with correct configuration', () => {
      expect(moduleExporter).to.be.an('object');
      expect((moduleExporter as any).exportQueryConfig).to.equal(mockConfig);
      expect((moduleExporter as any).exportedModules).to.be.an('array').that.is.empty;
    });
  });

  describe('buildExportCommand', () => {
    it('should build basic export command with required parameters', () => {
      const cmd = (moduleExporter as any).buildExportCommand('entries', {});

      expect(cmd).to.include('-k', 'test-stack-api-key');
      expect(cmd).to.include('-d', './test-export');
      expect(cmd).to.include('--module', 'entries');
      expect(cmd).to.include('-a', 'test-management-token');
      expect(cmd).to.include('-y');
    });

    it('should include branch when specified in config', () => {
      const cmd = (moduleExporter as any).buildExportCommand('content-types', {});

      expect(cmd).to.include('--branch', 'main');
    });

    it('should include branch from options over config', () => {
      const cmd = (moduleExporter as any).buildExportCommand('content-types', {
        branch: 'development',
      });

      expect(cmd).to.include('--branch', 'development');
    });

    it('should include query when provided in options', () => {
      const query = {
        modules: {
          entries: { content_type_uid: 'page' },
        },
      };

      const cmd = (moduleExporter as any).buildExportCommand('entries', { query });

      expect(cmd).to.include('--query', JSON.stringify(query));
    });

    it('should include secured assets flag when enabled in config', () => {
      mockConfig.securedAssets = true;
      moduleExporter = new ModuleExporter(mockConfig);

      const cmd = (moduleExporter as any).buildExportCommand('assets', {});

      expect(cmd).to.include('--secured-assets');
    });

    it('should include secured assets from options over config', () => {
      const cmd = (moduleExporter as any).buildExportCommand('assets', {
        securedAssets: true,
      });

      expect(cmd).to.include('--secured-assets');
    });

    it('should use alias over management token when provided', () => {
      const cmd = (moduleExporter as any).buildExportCommand('environments', {
        alias: 'production-stack',
      });

      expect(cmd).to.include('-a', 'production-stack');
      expect(cmd).to.not.include('test-management-token');
    });

    it('should include external config path when specified', () => {
      const cmd = (moduleExporter as any).buildExportCommand('locales', {});

      expect(cmd).to.include('--config', './config/export-config.json');
    });

    it('should use custom config path from options', () => {
      const cmd = (moduleExporter as any).buildExportCommand('locales', {
        configPath: './custom-config.json',
      });

      expect(cmd).to.include('--config', './custom-config.json');
    });

    it('should use custom directory from options', () => {
      const cmd = (moduleExporter as any).buildExportCommand('entries', {
        directory: './custom-export',
      });

      expect(cmd).to.include('-d', './custom-export');
    });

    it('should handle missing optional parameters', () => {
      mockConfig.branchName = undefined;
      mockConfig.externalConfigPath = undefined;
      mockConfig.managementToken = undefined;
      moduleExporter = new ModuleExporter(mockConfig);

      const cmd = (moduleExporter as any).buildExportCommand('entries', {});

      expect(cmd).to.include('-k', 'test-stack-api-key');
      expect(cmd).to.include('-d', './test-export');
      expect(cmd).to.not.include('--branch');
      expect(cmd).to.not.include('--config');
      expect(cmd).to.not.include('-a');
    });
  });

  describe('exportModule', () => {
    let runStub: sinon.SinonStub;

    beforeEach(() => {
      // Stub ExportCommand.run to prevent actual exports
      runStub = sandbox.stub(ExportCommand, 'run').resolves();
    });

    it('should export a module with correct parameters', async () => {
      await moduleExporter.exportModule('entries');

      expect(runStub.calledOnce).to.be.true;
      const args = runStub.firstCall.args[0];
      expect(args).to.include('--module', 'entries');
    });

    it('should handle errors during export', async () => {
      const error = new Error('Export failed');
      runStub.rejects(error);

      try {
        await moduleExporter.exportModule('entries');
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });

    it('should apply delay before exporting', async () => {
      const clock = sandbox.useFakeTimers();
      const exportPromise = moduleExporter.exportModule('entries');

      expect(runStub.called).to.be.false;
      clock.tick(2000); // Default delay
      await exportPromise;

      expect(runStub.calledOnce).to.be.true;
    });

    it('should use custom delay from config', async () => {
      mockConfig.exportDelayMs = 5000;
      moduleExporter = new ModuleExporter(mockConfig);

      const clock = sandbox.useFakeTimers();
      const exportPromise = moduleExporter.exportModule('entries');

      clock.tick(2000); // Not enough time
      expect(runStub.called).to.be.false;

      clock.tick(3000); // Complete the delay
      await exportPromise;

      expect(runStub.calledOnce).to.be.true;
    });
  });
});
