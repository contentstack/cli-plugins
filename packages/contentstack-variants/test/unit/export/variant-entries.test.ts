import sinon from 'sinon';
import { expect } from 'chai';
import { FsUtility } from '@contentstack/cli-utilities';

import exportConf from '../mock/export-config.json';
import { Export, ExportConfig, VariantHttpClient, VariantsOption } from '../../../src';

describe('Variant Entries Export', () => {
  let config: ExportConfig;

  const exportEntryData = {
    locale: 'en-us',
    contentTypeUid: 'CT-ID',
    entries: [{ uid: 'E-UID-1', title: 'Entry 1' }],
  };

  beforeEach(() => {
    config = exportConf as unknown as ExportConfig;
  });

  afterEach(() => sinon.restore());

  describe('path construction', () => {
    it('should use exportDir as base path (no branch segment in path)', () => {
      const instance = new Export.VariantEntries({
        ...config, exportDir: '/base/export', branchName: 'dev',
      } as ExportConfig);
      expect(instance.entriesDirPath).to.not.include('dev');
      expect(instance.entriesDirPath).to.include('entries');
    });
  });

  describe('branch header', () => {
    const getHeaders = (instance: any) => instance.variantInstance.adapterConfig.headers;

    it('sets branch header in adapter headers when branchName is configured', () => {
      const instance = new Export.VariantEntries({
        ...config, apiKey: 'TEST-KEY', branchName: 'feature-branch', org_uid: 'TEST-ORG', project_id: 'TEST-PROJECT',
      } as ExportConfig);
      expect(getHeaders(instance).branch).to.equal('feature-branch');
    });

    it('branch header is undefined when branchName is not set', () => {
      const instance = new Export.VariantEntries({
        ...config, apiKey: 'TEST-KEY', org_uid: 'TEST-ORG', project_id: 'TEST-PROJECT',
      } as ExportConfig);
      expect(getHeaders(instance).branch).to.be.undefined;
    });

    it('always sets api_key in adapter headers', () => {
      const instance = new Export.VariantEntries({
        ...config, apiKey: 'TEST-STACK-API-KEY', branchName: 'staging', org_uid: 'TEST-ORG', project_id: 'TEST-PROJECT',
      } as ExportConfig);
      expect(getHeaders(instance).api_key).to.equal('TEST-STACK-API-KEY');
    });

    it('branch header value matches branchName exactly', () => {
      const instance = new Export.VariantEntries({
        ...config, apiKey: 'TEST-KEY', branchName: 'eu-release-2025', org_uid: 'TEST-ORG', project_id: 'TEST-PROJECT',
      } as ExportConfig);
      expect(getHeaders(instance).branch).to.equal('eu-release-2025');
    });
  });

  describe('exportVariantEntry method', () => {
    beforeEach(() => {
      sinon.stub(VariantHttpClient.prototype, 'init').resolves();
    });

    it('should call variantEntries once per entry', async () => {
      const variantEntriesStub = sinon.stub(VariantHttpClient.prototype, 'variantEntries' as any).resolves();
      sinon.stub(FsUtility.prototype, 'completeFile' as any);
      sinon.stub(FsUtility.prototype, 'writeIntoFile' as any);

      const instance = new Export.VariantEntries(config);
      await instance.exportVariantEntry(exportEntryData);

      expect(variantEntriesStub.callCount).to.equal(1);
      expect(variantEntriesStub.firstCall.args[0]).to.include({ entry_uid: 'E-UID-1', locale: 'en-us' });
    });

    it('should write data in files when callback is invoked with entries', async () => {
      sinon.stub(VariantHttpClient.prototype, 'variantEntries' as any).callsFake(async (opts: VariantsOption) => {
        if (opts.callback) opts.callback([{ uid: 'E-UID-1', title: 'Entry 1' }]);
      });
      const writeIntoFileStub = sinon.stub(FsUtility.prototype, 'writeIntoFile' as any);

      const instance = new Export.VariantEntries(config);
      await instance.exportVariantEntry(exportEntryData);

      expect(writeIntoFileStub.callCount).to.equal(1);
      expect(writeIntoFileStub.alwaysCalledWith([{ uid: 'E-UID-1', title: 'Entry 1' }])).to.be.true;
    });

    it('should skip write when callback returns empty array; default chunk size to 1MB', async () => {
      const variantEntriesStub = sinon.stub(VariantHttpClient.prototype, 'variantEntries' as any).callsFake(async (opts: VariantsOption) => {
        if (opts.callback) opts.callback([]);
      });
      const writeIntoFileStub = sinon.stub(FsUtility.prototype, 'writeIntoFile' as any);

      config.modules.variantEntry.chunkFileSize = null as any;
      const instance = new Export.VariantEntries(config, () => {});
      await instance.exportVariantEntry(exportEntryData);

      expect(writeIntoFileStub.callCount).to.equal(0);
      expect(variantEntriesStub.callCount).to.equal(1);
    });
  });
});
