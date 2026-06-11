import { expect } from 'chai';

import { chunkArray, mapInBatches, runInBatches } from '../../../src/utils/concurrent-batch';

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

  describe('mapInBatches', () => {
    it('should collect results in input order', async () => {
      const results = await mapInBatches([1, 2, 3, 4, 5], 2, async (n) => n * 10);
      expect(results).to.deep.equal([10, 20, 30, 40, 50]);
    });

    it('should pass the correct absolute index across batches', async () => {
      const indexes: number[] = [];
      await mapInBatches(['a', 'b', 'c', 'd', 'e'], 2, async (_item, index) => {
        indexes.push(index);
        return index;
      });
      expect([...indexes].sort((a, b) => a - b)).to.deep.equal([0, 1, 2, 3, 4]);
    });

    it('should never run more than `concurrency` tasks at once', async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      await mapInBatches(Array.from({ length: 10 }, (_, i) => i), 3, async (n) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setImmediate(resolve));
        inFlight -= 1;
        return n;
      });
      expect(maxInFlight).to.be.at.most(3);
    });

    it('should return [] for an empty array without invoking fn', async () => {
      let called = false;
      const results = await mapInBatches([], 5, async (n) => {
        called = true;
        return n;
      });
      expect(results).to.deep.equal([]);
      expect(called).to.equal(false);
    });

    it('should fail fast when a task rejects', async () => {
      let error: Error | undefined;
      try {
        await mapInBatches([1, 2, 3], 2, async (n) => {
          if (n === 2) throw new Error('boom');
          return n;
        });
      } catch (e) {
        error = e as Error;
      }
      expect(error).to.be.instanceOf(Error);
      expect(error?.message).to.equal('boom');
    });

    it('should treat concurrency < 1 as 1', async () => {
      const results = await mapInBatches([1, 2, 3], 0, async (n) => n);
      expect(results).to.deep.equal([1, 2, 3]);
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
