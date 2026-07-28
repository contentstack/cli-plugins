import { expect } from 'chai';
import { getAdapter } from '../../src/adapters/registry';

describe('getAdapter', () => {
  it('returns contentful adapter', () => {
    expect(getAdapter('contentful').legacy).to.equal('contentful');
  });

  it('throws for unsupported legacy CMS', () => {
    expect(() => getAdapter('sanity')).to.throw('Unsupported legacy CMS');
  });
});
