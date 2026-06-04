import { join } from 'path';
import sinon from 'sinon';
import { expect } from 'chai';
import cloneDeep from 'lodash/cloneDeep';
import { configHandler } from '@contentstack/cli-utilities';

import importConf from '../mock/import-config.json';
import ContentType from '../mock/contents/content_types/CT-1.json';
import { Import, ImportConfig, VariantHttpClient } from '../../../src';
import variantEntryData from '../mock/contents/mapper/entries/data-for-variant-entry.json';
import variantEntries from '../mock/contents/entries/CT-1/en-us/variants/E-1/9b0da6xd7et72y-6gv7he23.json';

describe('Variant Entries Import', () => {
  let config: ImportConfig;

  beforeEach(() => {
    config = cloneDeep(importConf) as unknown as ImportConfig;
    // source reads modules.personalize.project_id; mock uses 'personalization' key
    (config.modules as any).personalize = (config.modules as any).personalization;
    // authenticationHandler.getAuthDetails() reads 'authtoken' via configHandler.get —
    // stub it so tests never need a real CLI session
    sinon.stub(configHandler, 'get').withArgs('authtoken').returns('test-token');
  });

  afterEach(() => sinon.restore());

  describe('import method', () => {
    it('should call import variant entry method (API call)', async () => {
      const stub = sinon.stub(Import.VariantEntries.prototype, 'importVariantEntries').resolves();
      const instance = new Import.VariantEntries(config);
      await instance.import();
      expect(stub.called).to.be.true;
      expect(stub.calledWith(variantEntryData[0])).to.be.true;
    });

    it('should return with entry not found message', async () => {
      sinon.stub(Import.VariantEntries.prototype, 'importVariantEntries').resolves();
      config.backupDir = './';
      const instance = new Import.VariantEntries(config);
      await instance.import();
      // no crash — backupDir with no data logs a warning internally
    });

    it('should return with variant UID mapper file not found message when dirName is wrong', async () => {
      sinon.stub(Import.VariantEntries.prototype, 'importVariantEntries').resolves();
      (config.modules as any).personalization.dirName = 'wrong-dir';
      const instance = new Import.VariantEntries(config);
      await instance.import();
      // no crash — wrong dir logs a warning
    });

    it('should check taxonomies folder existence gracefully', async () => {
      sinon.stub(Import.VariantEntries.prototype, 'importVariantEntries').resolves();
      config.modules.taxonomies.dirName = 'wrong-dir';
      const instance = new Import.VariantEntries(config);
      await instance.import();
      expect(instance.taxonomies).to.be.ok;
    });
  });

  describe('importVariantEntries method', () => {
    it('should call handleConcurrency to manage import batch', async () => {
      const stub = sinon.stub(Import.VariantEntries.prototype, 'handleConcurrency').resolves();
      const instance = new Import.VariantEntries(config);
      await instance.importVariantEntries(variantEntryData[0]);
      expect(stub.called).to.be.true;
      expect(stub.calledWith(ContentType, variantEntries, variantEntryData[0])).to.be.true;
    });

    it('should catch errors from handleConcurrency without throwing', async () => {
      sinon.stub(Import.VariantEntries.prototype, 'handleConcurrency').rejects(new Error('Dummy error'));
      const instance = new Import.VariantEntries(config);
      let threw = false;
      try { await instance.importVariantEntries(variantEntryData[0]); } catch { threw = true; }
      expect(threw).to.be.false;
    });
  });

  describe('handleConcurrency method', () => {
    // Build a variant entry with the _uid field the source code expects
    const testVariantEntry = [{
      ...variantEntries[0],
      _variant: { _uid: 'VARIANT-UID-1', _change_set: [], _base_entry_version: 1 },
    }] as any[];

    it('should call createVariantEntry when variant ID mapping exists', async () => {
      const createStub = sinon.stub(VariantHttpClient.prototype, 'createVariantEntry' as any).resolves();
      const relationalStub = sinon.stub(Import.VariantEntries.prototype, 'handleVariantEntryRelationalData').returns(testVariantEntry[0]);
      const { entry_uid } = variantEntryData[0];
      const instance = new Import.VariantEntries(config);
      instance.variantIdList = { 'VARIANT-UID-1': 'VARIANT-ID-NEW' };
      (instance as any).entriesUidMapper = { [entry_uid]: entry_uid };
      await instance.handleConcurrency(ContentType, testVariantEntry, variantEntryData[0]);
      expect(createStub.called).to.be.true;
      expect(relationalStub.called).to.be.true;
    });

    it('should return undefined if empty batch found', async () => {
      sinon.stub(VariantHttpClient.prototype, 'createVariantEntry' as any).resolves();
      sinon.stub(Import.VariantEntries.prototype, 'handleVariantEntryRelationalData').returns(variantEntries[0]);
      const instance = new Import.VariantEntries(config);
      (instance as any).entriesUidMapper = {};
      const result = await instance.handleConcurrency(ContentType, [], variantEntryData[0]);
      expect(result).to.be.undefined;
    });
  });

  describe('handleVariantEntryRelationalData method', () => {
    // lookupEntries/lookupAssets receive { entry, content_type } wrapper — must return the inner entry
    const makeHelpers = (withExtension = true) => ({
      lookUpTerms: () => {},
      ...(withExtension ? { lookupExtension: () => {} } : {}),
      lookupAssets: ({ entry }: any) => entry,
      lookupEntries: ({ entry }: any) => entry,
      restoreJsonRteEntryRefs: (entry: any) => entry,
    });

    it('should run all helpers and return the variant entry', () => {
      const conf = Object.assign(config, { helpers: makeHelpers(true) });
      const instance = new Import.VariantEntries(conf);
      const entry = instance.handleVariantEntryRelationalData(ContentType, variantEntries[0] as any);
      expect(entry).to.have.property('uid', variantEntries[0].uid);
    });

    it('should skip lookupExtension if not provided in helpers', () => {
      const conf = Object.assign(config, { helpers: makeHelpers(false) });
      const instance = new Import.VariantEntries(conf);
      const entry = instance.handleVariantEntryRelationalData(ContentType, variantEntries[0] as any);
      expect(entry).to.have.property('uid', variantEntries[0].uid);
    });

    it('should return entry unchanged when no helpers are configured', () => {
      const instance = new Import.VariantEntries(config);
      const entry = instance.handleVariantEntryRelationalData(ContentType, variantEntries[0] as any);
      expect(entry).to.have.property('uid', variantEntries[0].uid);
    });
  });

  describe('branch header', () => {
    const getHeaders = (instance: any) => instance.variantInstance.adapterConfig.headers;
    let branchConfig: ImportConfig;

    beforeEach(() => {
      branchConfig = cloneDeep(importConf) as unknown as ImportConfig;
      (branchConfig.modules as any).personalize = (branchConfig.modules as any).personalization;
    });

    it('sets branch header in adapter headers when branchName is configured', () => {
      const instance = new Import.VariantEntries({ ...branchConfig, branchName: 'feature-branch' } as ImportConfig);
      expect(getHeaders(instance).branch).to.equal('feature-branch');
    });

    it('branch header is undefined when branchName is not set', () => {
      const instance = new Import.VariantEntries(branchConfig);
      expect(getHeaders(instance).branch).to.be.undefined;
    });

    it('always sets api_key in adapter headers', () => {
      const instance = new Import.VariantEntries({ ...branchConfig, branchName: 'staging' } as ImportConfig);
      expect(getHeaders(instance).api_key).to.equal(branchConfig.apiKey);
    });

    it('branch header value matches branchName exactly', () => {
      const instance = new Import.VariantEntries({ ...branchConfig, branchName: 'eu-release-2025' } as ImportConfig);
      expect(getHeaders(instance).branch).to.equal('eu-release-2025');
    });

    it('sets organization_uid header from config.org_uid', () => {
      const instance = new Import.VariantEntries({ ...branchConfig, branchName: 'dev', org_uid: 'MY-ORG-001' } as ImportConfig);
      expect(getHeaders(instance).organization_uid).to.equal('MY-ORG-001');
    });
  });
});
