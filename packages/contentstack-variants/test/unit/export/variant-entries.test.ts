import { expect } from 'chai';
import sinon from 'sinon';
import { FsUtility } from '@contentstack/cli-utilities';

import exportConf from '../mock/export-config.json';
import { Export, ExportConfig, VariantHttpClient, VariantsOption } from '../../../src';

describe('Variant Entries Export', () => {
  let config: ExportConfig;
  let sandbox: sinon.SinonSandbox;

  const exportEntryData = {
    locale: 'en-us',
    contentTypeUid: 'CT-ID',
    entries: [{ uid: 'E-UID-1', title: 'Entry 1' }],
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    config = exportConf as unknown as ExportConfig;
    sandbox.stub(FsUtility.prototype, 'completeFile').returns(undefined as any);
    sandbox.stub(FsUtility.prototype, 'writeIntoFile').returns(undefined as any);
    sandbox.stub(FsUtility.prototype, 'createFolderIfNotExist').returns(undefined as any);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('exportVariantEntry method', () => {
    it('should call export variant entry method (API call)', async () => {
      sandbox.stub(VariantHttpClient.prototype, 'variantEntries').resolves();

      const entryVariantInstance = new Export.VariantEntries(config);
      await entryVariantInstance.exportVariantEntry(exportEntryData);

      const variantEntriesStub = VariantHttpClient.prototype.variantEntries as sinon.SinonStub;
      const completeFileStub = FsUtility.prototype.completeFile as sinon.SinonStub;
      const createFolderStub = FsUtility.prototype.createFolderIfNotExist as sinon.SinonStub;

      expect(variantEntriesStub.callCount).to.equal(1);
      expect(completeFileStub.callCount).to.equal(1);
      expect(createFolderStub.callCount).to.equal(1);
      expect(completeFileStub.alwaysCalledWith(true)).to.be.true;
    });

    it('should write data in files (As chunk)', async () => {
      sandbox.stub(VariantHttpClient.prototype, 'variantEntries').callsFake(async (...args: any) => {
        const { callback } = args[0] as VariantsOption;
        if (callback) callback([{ uid: 'E-UID-1', title: 'Entry 1' }]);
      });

      const entryVariantInstance = new Export.VariantEntries(config);
      await entryVariantInstance.exportVariantEntry(exportEntryData);

      const writeIntoFileStub = FsUtility.prototype.writeIntoFile as sinon.SinonStub;
      expect(writeIntoFileStub.callCount).to.equal(1);
      expect(writeIntoFileStub.alwaysCalledWith([{ uid: 'E-UID-1', title: 'Entry 1' }])).to.be.true;
    });

    it('should skip write when API returns empty data, should set default chunk 1MB if not in config', async () => {
      sandbox.stub(VariantHttpClient.prototype, 'variantEntries').callsFake(async (...args: any) => {
        const { callback } = args[0] as VariantsOption;
        if (callback) callback([]);
      });

      config.modules.variantEntry.chunkFileSize = null as any;
      const entryVariantInstance = new Export.VariantEntries(config);
      await entryVariantInstance.exportVariantEntry(exportEntryData);

      const writeIntoFileStub = FsUtility.prototype.writeIntoFile as sinon.SinonStub;
      const variantEntriesStub = VariantHttpClient.prototype.variantEntries as sinon.SinonStub;
      expect(writeIntoFileStub.callCount).to.equal(0);
      expect(variantEntriesStub.callCount).to.equal(1);
    });
  });
});
