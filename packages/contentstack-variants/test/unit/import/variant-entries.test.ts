import { join } from 'path';
import cloneDeep from 'lodash/cloneDeep';
import { test as fancyBase, spy, expect } from '@contentstack/cli-dev-dependencies';
const fancy = fancyBase.register('spy', spy);

import importConf from '../mock/import-config.json';
import ContentType from '../mock/contents/content_types/CT-1.json';
import { Import, ImportConfig, VariantHttpClient } from '../../../src';
import variantEntryData from '../mock/contents/mapper/entries/data-for-variant-entry.json';
import variantEntries from '../mock/contents/entries/CT-1/en-us/variants/E-1/9b0da6xd7et72y-6gv7he23.json';

describe('Variant Entries Import', () => {
  let config: ImportConfig;

  const test = fancy
    .stdout({ print: process.env.PRINT === 'true' || false })
    .stub(VariantHttpClient.prototype, 'init', async () => {});

  beforeEach(() => {
    config = cloneDeep(importConf) as unknown as ImportConfig;
  });

  describe('import method', () => {
    test
      .stub(Import.VariantEntries.prototype, 'importVariantEntries', async () => {})
      .spy(Import.VariantEntries.prototype, 'importVariantEntries')
      .it('should call import variant entry method (API call)', async ({ spy }) => {
        let entryVariantInstace = new Import.VariantEntries(config);
        await entryVariantInstace.import();

        expect(spy.importVariantEntries.called).to.be.true;
        expect(spy.importVariantEntries.calledWith(variantEntryData[0])).to.be.true;
      });

    test
      .stub(Import.VariantEntries.prototype, 'importVariantEntries', async () => {})
      .spy(Import.VariantEntries.prototype, 'importVariantEntries')
      .it('should return with entry not found message', async (ctx) => {
        config.backupDir = './';
        let entryVariantInstace = new Import.VariantEntries(config);
        await entryVariantInstace.import();

        expect(ctx.stdout).to.be.includes(entryVariantInstace.messages.IMPORT_ENTRY_NOT_FOUND);
      });

    test
      .stub(Import.VariantEntries.prototype, 'importVariantEntries', async () => {})
      .spy(Import.VariantEntries.prototype, 'importVariantEntries')
      .it('should return with variant UID mapper file not found message', async (ctx) => {
        config.modules.personalization.dirName = 'wrong-dir';
        let entryVariantInstace = new Import.VariantEntries(config);
        await entryVariantInstace.import();

        expect(ctx.stdout).to.be.includes(entryVariantInstace.messages.EMPTY_VARIANT_UID_DATA);
      });

    test
      .stub(Import.VariantEntries.prototype, 'importVariantEntries', async () => {})
      .spy(Import.VariantEntries.prototype, 'importVariantEntries')
      .it('should return with entry not found message if empty content found on file', async (ctx) => {
        let entryVariantInstace = new Import.VariantEntries(config);
        entryVariantInstace.entriesMapperPath = join(entryVariantInstace.entriesMapperPath, 'empty-data');
        await entryVariantInstace.import();

        expect(ctx.stdout).to.be.includes(entryVariantInstace.messages.IMPORT_ENTRY_NOT_FOUND);
      });

    test
      .stub(Import.VariantEntries.prototype, 'importVariantEntries', async () => {})
      .spy(Import.VariantEntries.prototype, 'importVariantEntries')
      .it('should check taxonomies folder existence', async (ctx) => {
        config.modules.taxonomies.dirName = 'wrong-dir';
        let entryVariantInstace = new Import.VariantEntries(config);
        await entryVariantInstace.import();

        expect(entryVariantInstace.taxonomies).to.contain({});
      });
  });

  describe('importVariantEntries method', () => {
    test
      .stub(Import.VariantEntries.prototype, 'handleConcurrency', async () => {})
      .spy(Import.VariantEntries.prototype, 'handleConcurrency')
      .it('should call handle Cuncurrency method to manage import batch', async ({ spy }) => {
        let entryVariantInstace = new Import.VariantEntries(config);
        await entryVariantInstace.importVariantEntries(variantEntryData[0]);

        expect(spy.handleConcurrency.called).to.be.true;
        expect(spy.handleConcurrency.calledWith(ContentType, variantEntries, variantEntryData[0])).to.be.true;
      });

    test
      .stub(Import.VariantEntries.prototype, 'handleConcurrency', async () => {
        throw new Error('Dummy error');
      })
      .spy(Import.VariantEntries.prototype, 'handleConcurrency')
      .it('should catch and log errors on catch block', async (ctx) => {
        let entryVariantInstace = new Import.VariantEntries(config);
        await entryVariantInstace.importVariantEntries(variantEntryData[0]);

        expect(ctx.stdout).to.be.includes('Dummy error');
      });
  });

  describe('handleConcurrency method', () => {
    test
      .stub(VariantHttpClient.prototype, 'createVariantEntry', async () => {})
      .stub(Import.VariantEntries.prototype, 'handleVariantEntryRelationalData', () => variantEntries[0])
      .spy(VariantHttpClient.prototype, 'createVariantEntry')
      .spy(Import.VariantEntries.prototype, 'handleVariantEntryRelationalData')
      .it('should call handle Cuncurrency method to manage import batch', async ({ spy }) => {
        const variantEntry = variantEntries[0];
        const { content_type, entry_uid, locale } = variantEntryData[0];
        let entryVariantInstace = new Import.VariantEntries(config);
        entryVariantInstace.variantIdList = { 'VARIANT-ID-1': 'VARIANT-ID-2' };
        entryVariantInstace.entriesUidMapper = { [variantEntryData[0].entry_uid]: variantEntryData[0].entry_uid };
        await entryVariantInstace.handleConcurrency(ContentType, variantEntries, variantEntryData[0]);

        expect(spy.createVariantEntry.called).to.be.true;
        expect(spy.handleVariantEntryRelationalData.called).to.be.true;
        expect(spy.handleVariantEntryRelationalData.calledWith(ContentType, variantEntry)).to.be.true;
        expect(
          spy.createVariantEntry.calledWith(variantEntry, {
            locale,
            entry_uid,
            variant_id: 'VARIANT-ID-2',
            content_type_uid: content_type,
          }),
        ).to.be.true;
      });

    test
      .stub(VariantHttpClient.prototype, 'createVariantEntry', async () => {})
      .stub(Import.VariantEntries.prototype, 'handleVariantEntryRelationalData', () => variantEntries[0])
      .spy(VariantHttpClient.prototype, 'createVariantEntry')
      .spy(Import.VariantEntries.prototype, 'handleVariantEntryRelationalData')
      .it('should return without any execution if empty batch found', async (ctx) => {
        let entryVariantInstace = new Import.VariantEntries(config);
        entryVariantInstace.entriesUidMapper = {};
        const result = await entryVariantInstace.handleConcurrency(ContentType, [], variantEntryData[0]);

        expect(result).to.be.undefined;
      });

    test
      .stub(VariantHttpClient.prototype, 'createVariantEntry', async () => {})
      .stub(Import.VariantEntries.prototype, 'handleVariantEntryRelationalData', () => variantEntries[0])
      .spy(VariantHttpClient.prototype, 'createVariantEntry')
      .spy(Import.VariantEntries.prototype, 'handleVariantEntryRelationalData')
      .it('should log error message if variant UID not found on the mapper file', async (ctx) => {
        let entryVariantInstace = new Import.VariantEntries(config);
        entryVariantInstace.config.modules.variantEntry.apiConcurrency = null as any; // NOTE Missing apiConcurrency value in config
        entryVariantInstace.variantIdList = { 'VARIANT-ID-2': 'VARIANT-ID-NEW-2' };
        entryVariantInstace.entriesUidMapper = {};
        await entryVariantInstace.handleConcurrency(ContentType, variantEntries, variantEntryData[0]);

        expect(ctx.stdout).to.be.includes(entryVariantInstace.messages.VARIANT_ID_NOT_FOUND);
      });
  });

  describe('handleVariantEntryRelationalData method', () => {
    test.it('should call handle Cuncurrency method to manage import batch', async () => {
      // NOTE passing helper methods along with config
      let conf = Object.assign(config, {
        helpers: {
          lookUpTerms: () => {},
          lookupExtension: () => {},
          lookupAssets: ({ entry }: any) => entry,
          lookupEntries: ({ entry }: any) => entry,
          restoreJsonRteEntryRefs: (entry: any) => entry,
        },
      });
      const variantEntry = variantEntries[0];
      let entryVariantInstace = new Import.VariantEntries(conf);
      const entry = await entryVariantInstace.handleVariantEntryRelationalData(ContentType, variantEntry);

      expect(entry).to.contain(variantEntry);
    });

    test.it('should skip calling lookupExtension if not available in helper', async () => {
      // NOTE passing helper methods along with config
      let conf = Object.assign(config, {
        helpers: {
          lookUpTerms: () => {},
          lookupAssets: ({ entry }: any) => entry,
          lookupEntries: ({ entry }: any) => entry,
          restoreJsonRteEntryRefs: (entry: any) => entry,
        },
      });
      const variantEntry = variantEntries[0];
      let entryVariantInstace = new Import.VariantEntries(conf);
      const entry = await entryVariantInstace.handleVariantEntryRelationalData(ContentType, variantEntry);

      expect(entry).to.contain(variantEntry);
    });

    test.it('will skip calling lookup function if helper is not present in config', async () => {
      const variantEntry = variantEntries[0];
      let entryVariantInstace = new Import.VariantEntries(config);
      const entry = await entryVariantInstace.handleVariantEntryRelationalData(ContentType, variantEntry);

      expect(entry).to.contain(variantEntry);
    });
  });
});
