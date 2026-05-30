import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { fetchTaxonomyList } from '../../../src/utils/item-fetcher';
import type { ManagementStack } from '../../../src/interfaces';

describe('item-fetcher taxonomy list', () => {
  describe('fetchTaxonomyList', () => {
    it('should map taxonomy query items to uid and name', async () => {
      const findStub = sinon.stub().resolves({
        items: [
          { uid: 'tax_a', name: 'Taxonomy A' },
          { uid: 'tax_b', name: 'Taxonomy B' },
        ],
      });
      const stack = {
        taxonomy: () => ({
          query: () => ({ find: findStub }),
        }),
      } as unknown as ManagementStack;

      const result = await fetchTaxonomyList(stack);

      expect(result).to.deep.equal([
        { uid: 'tax_a', name: 'Taxonomy A' },
        { uid: 'tax_b', name: 'Taxonomy B' },
      ]);
      expect(findStub.calledOnce).to.equal(true);
    });

    it('should pass branch to taxonomy query when non-main branch is provided', async () => {
      const findStub = sinon.stub().resolves({ items: [{ uid: 'tax_a', name: 'Taxonomy A' }] });
      const queryStub = sinon.stub().returns({ find: findStub });
      const stack = {
        taxonomy: () => ({
          query: queryStub,
        }),
      } as unknown as ManagementStack;

      const result = await fetchTaxonomyList(stack, 'feature');

      expect(result.length).to.equal(1);
      expect(queryStub.calledOnceWithExactly({ branch: 'feature' })).to.equal(true);
      expect(findStub.calledOnce).to.equal(true);
    });

    it('should map taxonomy query taxonomies response to uid and name', async () => {
      const findStub = sinon.stub().resolves({
        taxonomies: [
          { uid: 'sample_four', name: 'Sample Four' },
          { uid: 'sample_three', name: 'Sample Three' },
        ],
      });
      const stack = {
        taxonomy: () => ({
          query: () => ({ find: findStub }),
        }),
      } as unknown as ManagementStack;

      const result = await fetchTaxonomyList(stack);

      expect(result).to.deep.equal([
        { uid: 'sample_four', name: 'Sample Four' },
        { uid: 'sample_three', name: 'Sample Three' },
      ]);
      expect(findStub.calledOnce).to.equal(true);
    });
  });
});
