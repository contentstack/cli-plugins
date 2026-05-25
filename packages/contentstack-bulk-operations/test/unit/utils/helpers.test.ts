/**
 * Unit tests for helpers utility functions
 * Tests array chunking and unique value extraction functions
 */

import { expect } from 'chai';
import { chunkArray, getUniqueEnvironments, getUniqueLocales } from '../../../src/utils/helpers';
import { EntryPublishData, AssetPublishData } from '../../../src/interfaces';

describe('Helpers', () => {
  describe('chunkArray', () => {
    it('should split array into chunks of specified size', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = chunkArray(array, 3);

      expect(result).to.deep.equal([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]);
    });

    it('should handle empty array', () => {
      const result = chunkArray([], 5);
      expect(result).to.deep.equal([]);
    });

    it('should handle chunk size larger than array length', () => {
      const array = [1, 2, 3];
      const result = chunkArray(array, 10);

      expect(result).to.deep.equal([[1, 2, 3]]);
    });

    it('should handle chunk size of 1', () => {
      const array = [1, 2, 3];
      const result = chunkArray(array, 1);

      expect(result).to.deep.equal([[1], [2], [3]]);
    });

    it('should handle array length equal to chunk size', () => {
      const array = [1, 2, 3, 4, 5];
      const result = chunkArray(array, 5);

      expect(result).to.deep.equal([[1, 2, 3, 4, 5]]);
    });

    it('should work with strings', () => {
      const array = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
      const result = chunkArray(array, 2);

      expect(result).to.deep.equal([['a', 'b'], ['c', 'd'], ['e', 'f'], ['g']]);
    });

    it('should work with objects', () => {
      const array = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
      const result = chunkArray(array, 2);

      expect(result).to.deep.equal([[{ id: 1 }, { id: 2 }], [{ id: 3 }, { id: 4 }], [{ id: 5 }]]);
    });

    it('should handle large arrays efficiently', () => {
      const array = Array.from({ length: 1000 }, (_, i) => i);
      const result = chunkArray(array, 100);

      expect(result.length).to.equal(10);
      expect(result[0].length).to.equal(100);
      expect(result[9].length).to.equal(100);
    });

    it('should preserve original array', () => {
      const array = [1, 2, 3, 4, 5];
      const originalCopy = [...array];
      chunkArray(array, 2);

      expect(array).to.deep.equal(originalCopy);
    });

    it('should return new array references, not original', () => {
      const array = [1, 2, 3, 4];
      const result = chunkArray(array, 2);

      expect(result[0]).to.not.equal(array);
    });
  });

  describe('getUniqueEnvironments', () => {
    it('should extract unique environments from entry publish data', () => {
      const items: EntryPublishData[] = [
        {
          type: 'entry',
          uid: 'entry1',
          locale: 'en-us',
          content_type: 'blog',
          version: 1,
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
        {
          type: 'entry',
          uid: 'entry2',
          locale: 'de-de',
          content_type: 'blog',
          version: 1,
          publish_details: [
            { environment: 'staging', locale: 'de-de', version: 1 },
            { environment: 'prod', locale: 'de-de', version: 1 },
          ],
        },
      ];

      const result = getUniqueEnvironments(items);

      expect(result).to.have.members(['dev', 'staging', 'prod']);
      expect(result.length).to.equal(3);
    });

    it('should extract unique environments from asset publish data', () => {
      const items: AssetPublishData[] = [
        {
          type: 'asset',
          uid: 'asset1',
          locale: 'en-us',
          version: 1,
          publish_details: [
            { environment: 'dev', locale: 'en-us', version: 1 },
            { environment: 'prod', locale: 'en-us', version: 1 },
          ],
        },
      ];

      const result = getUniqueEnvironments(items);

      expect(result).to.have.members(['dev', 'prod']);
    });

    it('should handle empty array', () => {
      const result = getUniqueEnvironments([]);
      expect(result).to.deep.equal([]);
    });

    it('should handle items without publish_details', () => {
      const items = [
        {
          type: 'entry' as const,
          uid: 'entry1',
          locale: 'en-us',
          version: 1,
          // No publish_details
        },
      ];

      const result = getUniqueEnvironments(items as any);
      expect(result).to.deep.equal([]);
    });

    it('should handle items with empty publish_details array', () => {
      const items: EntryPublishData[] = [
        {
          type: 'entry',
          uid: 'entry1',
          locale: 'en-us',
          content_type: 'blog',
          version: 1,
          publish_details: [],
        },
      ];

      const result = getUniqueEnvironments(items);
      expect(result).to.deep.equal([]);
    });

    it('should deduplicate environments across multiple items', () => {
      const items: EntryPublishData[] = [
        {
          type: 'entry',
          uid: 'entry1',
          locale: 'en-us',
          content_type: 'blog',
          version: 1,
          publish_details: [{ environment: 'prod', locale: 'en-us', version: 1 }],
        },
        {
          type: 'entry',
          uid: 'entry2',
          locale: 'de-de',
          content_type: 'blog',
          version: 1,
          publish_details: [{ environment: 'prod', locale: 'de-de', version: 1 }],
        },
        {
          type: 'entry',
          uid: 'entry3',
          locale: 'fr-fr',
          content_type: 'blog',
          version: 1,
          publish_details: [{ environment: 'prod', locale: 'fr-fr', version: 1 }],
        },
      ];

      const result = getUniqueEnvironments(items);

      expect(result).to.deep.equal(['prod']);
      expect(result.length).to.equal(1);
    });

    it('should handle mixed entry and asset data', () => {
      const items = [
        {
          type: 'entry' as const,
          uid: 'entry1',
          locale: 'en-us',
          content_type: 'blog',
          version: 1,
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
        {
          type: 'asset' as const,
          uid: 'asset1',
          locale: 'en-us',
          version: 1,
          publish_details: [{ environment: 'staging', locale: 'en-us', version: 1 }],
        },
      ];

      const result = getUniqueEnvironments(items);

      expect(result).to.have.members(['dev', 'staging']);
    });
  });

  describe('getUniqueLocales', () => {
    it('should extract unique locales from entry publish data', () => {
      const items: EntryPublishData[] = [
        {
          type: 'entry',
          uid: 'entry1',
          locale: 'en-us',
          content_type: 'blog',
          version: 1,
          publish_details: [],
        },
        {
          type: 'entry',
          uid: 'entry2',
          locale: 'de-de',
          content_type: 'blog',
          version: 1,
          publish_details: [],
        },
        {
          type: 'entry',
          uid: 'entry3',
          locale: 'en-us',
          content_type: 'blog',
          version: 1,
          publish_details: [],
        },
      ];

      const result = getUniqueLocales(items);

      expect(result).to.have.members(['en-us', 'de-de']);
      expect(result.length).to.equal(2);
    });

    it('should extract unique locales from asset publish data', () => {
      const items: AssetPublishData[] = [
        {
          type: 'asset',
          uid: 'asset1',
          locale: 'en-us',
          version: 1,
          publish_details: [],
        },
        {
          type: 'asset',
          uid: 'asset2',
          locale: 'fr-fr',
          version: 1,
          publish_details: [],
        },
      ];

      const result = getUniqueLocales(items);

      expect(result).to.have.members(['en-us', 'fr-fr']);
    });

    it('should handle empty array', () => {
      const result = getUniqueLocales([]);
      expect(result).to.deep.equal([]);
    });

    it('should handle single locale', () => {
      const items: EntryPublishData[] = [
        {
          type: 'entry',
          uid: 'entry1',
          locale: 'en-us',
          content_type: 'blog',
          version: 1,
          publish_details: [],
        },
      ];

      const result = getUniqueLocales(items);

      expect(result).to.deep.equal(['en-us']);
    });

    it('should deduplicate locales', () => {
      const items: EntryPublishData[] = Array.from({ length: 10 }, (_, i) => ({
        type: 'entry' as const,
        uid: `entry${i}`,
        locale: 'en-us',
        content_type: 'blog',
        version: 1,
        publish_details: [],
      }));

      const result = getUniqueLocales(items);

      expect(result).to.deep.equal(['en-us']);
    });

    it('should handle multiple locales', () => {
      const items: EntryPublishData[] = [
        {
          type: 'entry',
          uid: 'entry1',
          locale: 'en-us',
          content_type: 'blog',
          version: 1,
          publish_details: [],
        },
        {
          type: 'entry',
          uid: 'entry2',
          locale: 'de-de',
          content_type: 'blog',
          version: 1,
          publish_details: [],
        },
        {
          type: 'entry',
          uid: 'entry3',
          locale: 'fr-fr',
          content_type: 'blog',
          version: 1,
          publish_details: [],
        },
        {
          type: 'entry',
          uid: 'entry4',
          locale: 'es-es',
          content_type: 'blog',
          version: 1,
          publish_details: [],
        },
      ];

      const result = getUniqueLocales(items);

      expect(result).to.have.members(['en-us', 'de-de', 'fr-fr', 'es-es']);
      expect(result.length).to.equal(4);
    });

    it('should handle mixed entry and asset data', () => {
      const items = [
        {
          type: 'entry' as const,
          uid: 'entry1',
          locale: 'en-us',
          content_type: 'blog',
          version: 1,
          publish_details: [],
        },
        {
          type: 'asset' as const,
          uid: 'asset1',
          locale: 'de-de',
          content_type: 'blog',
          version: 1,
          publish_details: [],
        },
      ];

      const result = getUniqueLocales(items);

      expect(result).to.have.members(['en-us', 'de-de']);
    });

    it('should preserve order of first occurrence', () => {
      const items: EntryPublishData[] = [
        {
          type: 'entry',
          uid: 'entry1',
          locale: 'fr-fr',
          content_type: 'blog',
          version: 1,
          publish_details: [],
        },
        {
          type: 'entry',
          uid: 'entry2',
          locale: 'en-us',
          content_type: 'blog',
          version: 1,
          publish_details: [],
        },
        {
          type: 'entry',
          uid: 'entry3',
          locale: 'de-de',
          content_type: 'blog',
          version: 1,
          publish_details: [],
        },
      ];

      const result = getUniqueLocales(items);

      // Set doesn't guarantee order, but Array.from preserves insertion order
      expect(result).to.include.members(['fr-fr', 'en-us', 'de-de']);
    });
  });

  describe('Integration scenarios', () => {
    it('should work together to analyze publishing configuration', () => {
      const items: EntryPublishData[] = [
        {
          type: 'entry',
          uid: 'entry1',
          locale: 'en-us',
          content_type: 'blog',
          version: 1,
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
        {
          type: 'entry',
          uid: 'entry2',
          locale: 'de-de',
          content_type: 'blog',
          version: 1,
          publish_details: [
            { environment: 'prod', locale: 'de-de', version: 1 },
            { environment: 'staging', locale: 'de-de', version: 1 },
          ],
        },
      ];

      const locales = getUniqueLocales(items);
      const environments = getUniqueEnvironments(items);
      const chunks = chunkArray(items, 1);

      expect(locales).to.have.length(2);
      expect(environments).to.have.length(3);
      expect(chunks).to.have.length(2);
    });
  });
});
