import { expect } from 'chai';
import sinon from 'sinon';
import setupExportDir from '../../../src/utils/setup-export-dir';
import * as fileHelper from '../../../src/utils/file-helper';
import { ExportConfig } from '../../../src/types';

describe('Setup Export Dir', () => {
  let sandbox: sinon.SinonSandbox;
  let makeDirectoryStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    makeDirectoryStub = sandbox.stub(fileHelper, 'makeDirectory');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should call makeDirectory only with exportDir when branches is undefined', async () => {
    const exportConfig = {
      exportDir: '/test/export',
    } as Partial<ExportConfig> as ExportConfig;

    await setupExportDir(exportConfig);

    expect(makeDirectoryStub.calledOnce).to.be.true;
    expect(makeDirectoryStub.firstCall.args[0]).to.equal('/test/export');
  });

  it('should call makeDirectory only with exportDir when branches is empty array', async () => {
    const exportConfig = {
      exportDir: '/test/export',
      branches: [],
    } as Partial<ExportConfig> as ExportConfig;

    await setupExportDir(exportConfig);

    expect(makeDirectoryStub.calledOnce).to.be.true;
    expect(makeDirectoryStub.firstCall.args[0]).to.equal('/test/export');
  });

  it('should call makeDirectory only with exportDir when branches has one or more branches', async () => {
    const exportConfig = {
      exportDir: '/test/export',
      branches: [
        { uid: 'main', source: '' },
        { uid: 'dev', source: 'main' },
      ],
    } as Partial<ExportConfig> as ExportConfig;

    await setupExportDir(exportConfig);

    expect(makeDirectoryStub.calledOnce).to.be.true;
    expect(makeDirectoryStub.firstCall.args[0]).to.equal('/test/export');
  });
});
