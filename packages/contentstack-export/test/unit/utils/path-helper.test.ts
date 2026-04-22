import { expect } from 'chai';
import { getExportBasePath } from '../../../src/utils/path-helper';
import { ExportConfig } from '../../../src/types';

describe('path-helper getExportBasePath', () => {
  const exportDir = '/test/export';

  it('should return exportDir', () => {
    const config = {
      exportDir,
    } as Partial<ExportConfig> as ExportConfig;
    expect(getExportBasePath(config)).to.equal(exportDir);
  });
});
