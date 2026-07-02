import { expect } from 'chai';

import { chunkArray, runInBatches } from '../../../src/utils/concurrent-batch';

describe('concurrent-batch', () => {
  describe('chunkArray', () => {
    it('should split an array into chunks of at most `size`', () => {
      expect(chunkArray([1, 2, 3, 4, 5], 2)).to.deep.equal([[1, 2], [3, 4], [5]]);
    });

    it('should return a single chunk when size >= length', () => {
      expect(chunkArray([1, 2, 3], 10)).to.deep.equal([[1, 2, 3]]);
    });

    it('should return the whole array as one chunk when size <= 0', () => {
      expect(chunkArray([1, 2, 3], 0)).to.deep.equal([[1, 2, 3]]);
    });

    it('should return [] for an empty array', () => {
      expect(chunkArray([], 3)).to.deep.equal([]);
    });
  });

  describe('runInBatches', () => {
    it('should invoke fn for every item with the correct absolute index', async () => {
      const seen: Array<{ item: string; index: number }> = [];
      await runInBatches(['a', 'b', 'c'], 2, async (item, index) => {
        seen.push({ item, index });
      });
      expect(seen.sort((a, b) => a.index - b.index)).to.deep.equal([
        { item: 'a', index: 0 },
        { item: 'b', index: 1 },
        { item: 'c', index: 2 },
      ]);
    });

    it('should not abort the batch when one task rejects (fault-tolerant)', async () => {
      const completed: number[] = [];
      await runInBatches([1, 2, 3, 4], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        completed.push(n);
      });
      expect(completed.sort((a, b) => a - b)).to.deep.equal([1, 3, 4]);
    });

    it('should be a no-op for an empty array', async () => {
      let called = false;
      await runInBatches([], 5, async () => {
        called = true;
      });
      expect(called).to.equal(false);
    });
  });
});
