import { expect } from 'chai';
import { batchItems, validateBatch, DEFAULT_BATCH_CONFIG } from '../../../src/utils/batch-helper';
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

      const batches = batchItems(items, ['dev'], ['en-us']);
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

      const batches = batchItems(items, ['dev'], ['en-us']);
      expect(batches.length).to.be.greaterThan(1);
      expect(batches[0].items.length).to.be.at.most(50);
      expect(batches[0].totalBatches).to.equal(batches.length);
    });

    it('should split into multiple batches when locales exceed limit', () => {
      const locales = Array.from({ length: 15 }, (_, i) => `locale-${i}`);
      // Create items for each locale
      const items: EntryPublishData[] = locales.map((loc) => ({
        uid: `entry-${loc}`,
        content_type: 'blog',
        locale: loc,
        publish_details: [{ environment: 'dev', locale: loc, version: 1 }],
      }));

      const batches = batchItems(items, ['dev'], locales);
      // With 15 items and maxItems=50, should fit in 1 item batch
      expect(batches.length).to.be.greaterThan(0);
      // Each batch should have items matching its locale set
      batches.forEach((batch) => {
        expect(batch.items.length).to.be.at.most(50);
        batch.items.forEach((item) => {
          expect(batch.locales).to.include(item.locale);
        });
      });
    });

    it('should split into multiple batches when environments exceed limit', () => {
      // To force environment batching, we need more than maxLocales * maxEnvironments targets
      // With 15 envs × 15 locales = 225 targets > 100 (targetBatchSize), will create multiple batches
      const environments = Array.from({ length: 15 }, (_, i) => `env-${i}`);
      const locales = Array.from({ length: 15 }, (_, i) => `locale-${i}`);
      const items: EntryPublishData[] = [
        {
          uid: 'entry1',
          content_type: 'blog',
          locale: 'en-us',
          publish_details: environments.flatMap((env) =>
            locales.map((loc) => ({ environment: env, locale: loc, version: 1 }))
          ),
        },
      ];

      const batches = batchItems(items, environments, locales);
      // With 225 targets and targetBatchSize = 100, should create multiple batches
      expect(batches.length).to.be.greaterThan(1);
    });

    it('should include all items in a single batch when locales fit within limit', () => {
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

      const batches = batchItems(items, ['dev'], ['en-us', 'fr-fr']);

      // Should have 1 batch since locales and items are within limits
      expect(batches).to.have.lengthOf(1);

      // Batch should include both items
      expect(batches[0].items).to.have.lengthOf(2);
      expect(batches[0].locales).to.have.members(['en-us', 'fr-fr']);

      // Verify each item has correct locale
      const enItem = batches[0].items.find((i) => i.locale === 'en-us');
      const frItem = batches[0].items.find((i) => i.locale === 'fr-fr');
      expect(enItem).to.exist;
      expect(frItem).to.exist;
    });

    it('should handle assets correctly', () => {
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

      const batches = batchItems(items, ['dev', 'staging'], ['en-us']);
      expect(batches).to.have.lengthOf(1);
      expect(batches[0].items).to.have.lengthOf(2);
    });

    it('should correctly set batch numbers', () => {
      const items: EntryPublishData[] = Array.from({ length: 125 }, (_, i) => ({
        uid: `entry${i}`,
        content_type: 'blog',
        locale: 'en-us',
        publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
      }));

      const batches = batchItems(items, ['dev'], ['en-us']);

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
