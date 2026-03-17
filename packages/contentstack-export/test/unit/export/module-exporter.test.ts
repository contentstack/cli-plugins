import { expect } from 'chai';
import sinon from 'sinon';
import ModuleExporter from '../../../src/export/module-exporter';
import { ExportConfig } from '../../../src/types';

describe('ModuleExporter exportByBranches', () => {
  let sandbox: sinon.SinonSandbox;
  const exportDir = '/test/export';

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should set branchDir to exportDir when no branch specified (default main)', async () => {
    const branches = [
      { uid: 'main', source: '', name: 'main' },
      { uid: 'dev', source: 'main', name: 'dev' },
    ];
    const exportConfig: Partial<ExportConfig> = {
      exportDir,
      branches,
      apiKey: 'test-key',
      management_token: 'token',
      context: {} as any,
      modules: { types: ['stack'] } as any,
    };
    const mockStackClient = { stackHeaders: {} };
    const mockManagementClient = {
      stack: sinon.stub().returns(mockStackClient),
    };

    const exporter = new ModuleExporter(
      mockManagementClient as any,
      exportConfig as ExportConfig,
    );
    const exportStub = sandbox.stub(exporter, 'export').resolves();

    await exporter.exportByBranches();

    expect(exportConfig.branchDir).to.equal(exportDir);
    expect(exportConfig.branchName).to.equal('main');
    expect(exportStub.calledOnce).to.be.true;
  });

  it('should set branchDir to exportDir when branch is specified via branchName', async () => {
    const branches = [
      { uid: 'main', source: '', name: 'main' },
      { uid: 'dev', source: 'main', name: 'dev' },
    ];
    const exportConfig: Partial<ExportConfig> = {
      exportDir,
      branchName: 'dev',
      branches,
      apiKey: 'test-key',
      management_token: 'token',
      context: {} as any,
      modules: { types: ['stack'] } as any,
    };
    const mockStackClient = { stackHeaders: {} };
    const mockManagementClient = {
      stack: sinon.stub().returns(mockStackClient),
    };

    const exporter = new ModuleExporter(
      mockManagementClient as any,
      exportConfig as ExportConfig,
    );
    const exportStub = sandbox.stub(exporter, 'export').resolves();

    await exporter.exportByBranches();

    expect(exportConfig.branchDir).to.equal(exportDir);
    expect(exportConfig.branchName).to.equal('dev');
    expect(exportStub.calledOnce).to.be.true;
  });

  it('should throw when specified branch not found in branches', async () => {
    const branches = [{ uid: 'main', source: '', name: 'main' }];
    const exportConfig: Partial<ExportConfig> = {
      exportDir,
      branchName: 'nonexistent',
      branches,
      apiKey: 'test-key',
      management_token: 'token',
      context: {} as any,
      modules: { types: [] } as any,
    };
    const mockManagementClient = { stack: sinon.stub().returns({ stackHeaders: {} }) };

    const exporter = new ModuleExporter(
      mockManagementClient as any,
      exportConfig as ExportConfig,
    );

    try {
      await exporter.exportByBranches();
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).to.include("Branch 'nonexistent' not found");
    }
  });

  it('should throw when no main branch in branches', async () => {
    const branches = [{ uid: 'dev', source: '', name: 'dev' }];
    const exportConfig: Partial<ExportConfig> = {
      exportDir,
      branches,
      apiKey: 'test-key',
      management_token: 'token',
      context: {} as any,
      modules: { types: [] } as any,
    };
    const mockManagementClient = { stack: sinon.stub().returns({ stackHeaders: {} }) };

    const exporter = new ModuleExporter(
      mockManagementClient as any,
      exportConfig as ExportConfig,
    );

    try {
      await exporter.exportByBranches();
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).to.include('No main branch');
    }
  });
});
