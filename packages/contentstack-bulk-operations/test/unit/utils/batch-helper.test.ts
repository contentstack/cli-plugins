import { expect } from 'chai';
import { batchItems, validateBatch, hasPublishTargets, DEFAULT_BATCH_CONFIG } from '../../../src/utils/batch-helper';
import { getUniqueEnvironments, getUniqueLocales } from '../../../src/utils/helpers';
import { EntryPublishData, AssetPublishData } from '../../../src/interfaces';

describe('Batch Helper', () => {
  describe('getUniqueEnvironments', () => {
    it('should extract unique environments from items', () => {
      const items: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          publish_details: [
            { environment: 'dev', locale: 'en-us', version: 1 },
            { environment: 'staging', locale: 'en-us', version: 1 },
          ],
        },
        {
          uid: 'entry2',
          content_type: 'blog',
          locale: 'en-us',
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
      ];

      const environments = getUniqueEnvironments(items);
      expect(environments).to.have.members(['dev', 'staging']);
      expect(environments).to.have.lengthOf(2);
    });

    it('should return empty array for items without publish_details', () => {
      const items: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
        },
      ];

      const environments = getUniqueEnvironments(items);
      expect(environments).to.be.an('array').that.is.empty;
    });
  });

  describe('getUniqueLocales', () => {
    it('should extract unique locales from items', () => {
      const items: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
        },
        {
          uid: 'entry2',
          content_type: 'blog',
          locale: 'fr-fr',
        },
        {
          uid: 'entry3',
          content_type: 'blog',
          locale: 'en-us',
        },
      ];

      const locales = getUniqueLocales(items);
      expect(locales).to.have.members(['en-us', 'fr-fr']);
      expect(locales).to.have.lengthOf(2);
    });
  });

  // Note: estimateBatchCount tests removed as this function no longer exists
  // Batch estimation is now handled by the batch calculator utility

  describe('batchItems', () => {
    it('should create a single batch when within limits', () => {
      const items: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
        {
          uid: 'entry2',
          content_type: 'blog',
          locale: 'en-us',
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
      ];

      const batches = batchItems(items);
      expect(batches).to.have.lengthOf(1);
      expect(batches[0].items).to.have.lengthOf(2);
      expect(batches[0].environments).to.deep.equal(['dev']);
      expect(batches[0].locales).to.deep.equal(['en-us']);
    });

    it('should split items into multiple batches when exceeding item limit', () => {
      const items: EntryPublishData[] = Array.from({ length: 75 }, (_, i) => ({
        uid: `entry${i}`,
        content_type: 'blog',
        locale: 'en-us',
        publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
      }));

      const batches = batchItems(items);
      expect(batches.length).to.be.greaterThan(1);
      expect(batches[0].items.length).to.be.at.most(50);
      expect(batches[0].totalBatches).to.equal(batches.length);
    });

    it('should give every locale its own batch', () => {
      const locales = Array.from({ length: 15 }, (_, i) => `locale-${i}`);
      const items: EntryPublishData[] = locales.map((loc) => ({
        uid: `entry-${loc}`,
        content_type: 'blog',
        locale: loc,
        publish_details: [{ environment: 'dev', locale: loc, version: 1 }],
      }));

      const batches = batchItems(items);
      expect(batches).to.have.lengthOf(15);

      batches.forEach((batch) => {
        expect(batch.locales).to.have.lengthOf(1);
        batch.items.forEach((item) => {
          expect(batch.locales).to.deep.equal([item.locale]);
        });
      });
    });

    it('should split an environment set larger than the API cap, staying single-locale', () => {
      const environments = Array.from({ length: 15 }, (_, i) => `env-${i}`);
      const items: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          publish_details: environments.map((env) => ({ environment: env, locale: 'en-us', version: 1 })),
        },
      ];

      const batches = batchItems(items);
      // 15 environments, cap of 10 -> 2 batches, both for the one locale.
      expect(batches).to.have.lengthOf(2);
      batches.forEach((batch) => {
        expect(batch.locales).to.deep.equal(['en-us']);
        expect(batch.environments.length).to.be.at.most(DEFAULT_BATCH_CONFIG.maxEnvironments);
      });
      const batched = batches.flatMap((b) => b.environments);
      expect(batched).to.have.members(environments);
    });

    it('should never mix locales in one batch', () => {
      const items: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
        {
          uid: 'entry2',
          content_type: 'blog',
          locale: 'fr-fr',
          publish_details: [{ environment: 'dev', locale: 'fr-fr', version: 1 }],
        },
      ];

      const batches = batchItems(items);

      // One batch per locale — a shared batch would publish entry1 in fr-fr and entry2 in en-us.
      expect(batches).to.have.lengthOf(2);

      const enBatch = batches.find((b) => b.locales[0] === 'en-us');
      const frBatch = batches.find((b) => b.locales[0] === 'fr-fr');
      expect(enBatch?.items.map((i) => i.uid)).to.deep.equal(['entry1']);
      expect(frBatch?.items.map((i) => i.uid)).to.deep.equal(['entry2']);
    });

    it('should not widen an item to another item environments', () => {
      const items: AssetPublishData[] = [
        {
          uid: 'asset1',
          locale: 'en-us',
          publish_details: [
            { environment: 'dev', locale: 'en-us', version: 1 },
            { environment: 'staging', locale: 'en-us', version: 1 },
          ],
        },
        {
          uid: 'asset2',
          locale: 'en-us',
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
      ];

      const batches = batchItems(items);

      // Different environment sets cannot share a batch.
      expect(batches).to.have.lengthOf(2);

      const devOnly = batches.find((b) => b.environments.length === 1);
      expect(devOnly?.environments).to.deep.equal(['dev']);
      expect(devOnly?.items.map((i) => i.uid)).to.deep.equal(['asset2']);

      const both = batches.find((b) => b.environments.length === 2);
      expect(both?.environments).to.deep.equal(['dev', 'staging']);
      expect(both?.items.map((i) => i.uid)).to.deep.equal(['asset1']);
    });

    it('should batch a per-locale environment split separately', () => {
      const items: AssetPublishData[] = [
        {
          uid: 'asset1',
          locale: 'en-us',
          publish_details: [
            { environment: 'dev', locale: 'en-us', version: 1 },
            { environment: 'prod', locale: 'fr-fr', version: 1 },
          ],
        },
      ];

      const batches = batchItems(items);
      expect(batches).to.have.lengthOf(2);

      const en = batches.find((b) => b.locales[0] === 'en-us');
      const fr = batches.find((b) => b.locales[0] === 'fr-fr');
      expect(en?.environments).to.deep.equal(['dev']);
      expect(fr?.environments).to.deep.equal(['prod']);
      expect(en?.items[0].publish_details).to.deep.equal([{ environment: 'dev', locale: 'en-us', version: undefined }]);
    });

    it('should group on the requested locale without rewriting the entry locale', () => {
      // A non-localized entry resolves to its fallback locale, so item.locale legitimately differs
      // from the locale being published to. Grouping must follow publish_details, and the entry's
      // own locale must survive as the hint sent in entries[].
      const items: EntryPublishData[] = [
        {
          uid: 'localized',
          content_type: 'blog',
          locale: 'fr-fr',
          publish_details: [{ environment: 'dev', locale: 'fr-fr' }],
        },
        {
          uid: 'fallback',
          content_type: 'blog',
          locale: 'en-us', // no fr-fr document; resolved to master
          publish_details: [{ environment: 'dev', locale: 'fr-fr' }],
        },
      ];

      const batches = batchItems(items);

      // Both publish to fr-fr, so both belong to the same batch despite differing item locales.
      expect(batches).to.have.lengthOf(1);
      expect(batches[0].locales).to.deep.equal(['fr-fr']);
      expect(batches[0].items.map((i) => i.uid)).to.have.members(['localized', 'fallback']);

      const fallback = batches[0].items.find((i) => i.uid === 'fallback');
      expect(fallback?.locale).to.equal('en-us');
      expect(fallback?.publish_details?.[0].locale).to.equal('fr-fr');
    });

    it('should drop items with no usable publish target', () => {
      const items: EntryPublishData[] = [
        { uid: 'entry1', content_type: 'blog', locale: 'en-us', publish_details: [] },
        { uid: 'entry2', content_type: 'blog', locale: 'en-us' },
      ];

      expect(hasPublishTargets(items[0])).to.equal(false);
      expect(hasPublishTargets(items[1])).to.equal(false);
      expect(batchItems(items)).to.have.lengthOf(0);
    });

    it('should correctly set batch numbers', () => {
      const items: EntryPublishData[] = Array.from({ length: 125 }, (_, i) => ({
        uid: `entry${i}`,
        content_type: 'blog',
        locale: 'en-us',
        publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
      }));

      const batches = batchItems(items);

      expect(batches[0].batchNumber).to.equal(1);
      expect(batches[1].batchNumber).to.equal(2);
      expect(batches[2].batchNumber).to.equal(3);

      batches.forEach((batch) => {
        expect(batch.totalBatches).to.equal(batches.length);
      });
    });
  });

  describe('validateBatch', () => {
    it('should validate a batch within limits', () => {
      const batch = {
        items: Array.from({ length: 5 }, (_, i) => ({
          uid: `entry${i}`,
          content_type: 'blog',
          locale: 'en-us',
        })) as EntryPublishData[],
        environments: ['dev', 'staging'],
        locales: ['en-us', 'fr-fr'],
        batchNumber: 1,
        totalBatches: 1,
      };

      const result = validateBatch(batch);
      expect(result.valid).to.be.true;
      expect(result.warnings).to.be.empty;
    });

    it('should warn when item count exceeds limit', () => {
      const batch = {
        items: Array.from({ length: 55 }, (_, i) => ({
          uid: `entry${i}`,
          content_type: 'blog',
          locale: 'en-us',
        })) as EntryPublishData[],
        environments: ['dev'],
        locales: ['en-us'],
        batchNumber: 1,
        totalBatches: 1,
      };

      const result = validateBatch(batch);
      expect(result.valid).to.be.false;
      expect(result.warnings).to.have.lengthOf(1);
      expect(result.warnings[0]).to.include('55 items');
      expect(result.warnings[0]).to.include('exceeds limit of 50');
    });

    it('should warn when locale count exceeds limit', () => {
      const batch = {
        items: [
          {
            uid: 'entry1',
            content_type: 'blog',
            locale: 'en-us',
          },
        ] as EntryPublishData[],
        environments: ['dev'],
        locales: Array.from({ length: 15 }, (_, i) => `locale-${i}`),
        batchNumber: 1,
        totalBatches: 1,
      };

      const result = validateBatch(batch);
      expect(result.valid).to.be.false;
      expect(result.warnings).to.have.lengthOf(1);
      expect(result.warnings[0]).to.include('15 locales');
    });

    it('should warn when environment count exceeds limit', () => {
      const batch = {
        items: [
          {
            uid: 'entry1',
            content_type: 'blog',
            locale: 'en-us',
          },
        ] as EntryPublishData[],
        environments: Array.from({ length: 15 }, (_, i) => `env-${i}`),
        locales: ['en-us'],
        batchNumber: 1,
        totalBatches: 1,
      };

      const result = validateBatch(batch);
      expect(result.valid).to.be.false;
      expect(result.warnings).to.have.lengthOf(1);
      expect(result.warnings[0]).to.include('15 environments');
    });

    it('should warn when total operations exceed limit', () => {
      const batch = {
        items: Array.from({ length: 10 }, (_, i) => ({
          uid: `entry${i}`,
          content_type: 'blog',
          locale: 'en-us',
        })) as EntryPublishData[],
        environments: Array.from({ length: 10 }, (_, i) => `env-${i}`),
        locales: Array.from({ length: 10 }, (_, i) => `locale-${i}`),
        batchNumber: 1,
        totalBatches: 1,
      };

      const result = validateBatch(batch);
      expect(result.valid).to.be.true; // Individual limits are OK
      expect(result.warnings).to.be.empty; // 10*10*10 = 1000 operations (exactly at limit)
    });

    it('should provide multiple warnings for multiple violations', () => {
      const batch = {
        items: Array.from({ length: 55 }, (_, i) => ({
          uid: `entry${i}`,
          content_type: 'blog',
          locale: 'en-us',
        })) as EntryPublishData[],
        environments: Array.from({ length: 15 }, (_, i) => `env-${i}`),
        locales: Array.from({ length: 15 }, (_, i) => `locale-${i}`),
        batchNumber: 1,
        totalBatches: 1,
      };

      const result = validateBatch(batch);
      expect(result.valid).to.be.false;
      expect(result.warnings.length).to.be.greaterThan(1);
    });
  });

  describe('DEFAULT_BATCH_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_BATCH_CONFIG.maxItems).to.equal(50);
      expect(DEFAULT_BATCH_CONFIG.maxLocales).to.equal(10);
      expect(DEFAULT_BATCH_CONFIG.maxEnvironments).to.equal(10);
    });
  });
});
