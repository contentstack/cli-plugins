import { expect } from 'chai';
import { getExportBasePath } from '../../../src/utils/path-helper';
import { ExportConfig } from '../../../src/types';

describe('path-helper getExportBasePath', () => {
  const exportDir = '/test/export';

  it('should return branchDir when branchDir is set', () => {
    const config = {
      exportDir,
      branchDir: '/custom/branch/path',
    } as Partial<ExportConfig> as ExportConfig;
    expect(getExportBasePath(config)).to.equal('/custom/branch/path');
  });

  it('should return exportDir when branchDir is not set', () => {
    const config = {
      exportDir,
    } as Partial<ExportConfig> as ExportConfig;
    expect(getExportBasePath(config)).to.equal(exportDir);
  });

  it('should return exportDir when branchDir is undefined', () => {
    const config = {
      exportDir,
      branchDir: undefined,
    } as Partial<ExportConfig> as ExportConfig;
    expect(getExportBasePath(config)).to.equal(exportDir);
  });
});
