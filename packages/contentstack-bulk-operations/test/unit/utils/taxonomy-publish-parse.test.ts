import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseTaxonomyPublishItems } from '../../../src/utils/taxonomy-publish-parse';

describe('parseTaxonomyPublishItems', () => {
  it('should parse single taxonomy uid', () => {
    const result = parseTaxonomyPublishItems('taxonomy_a');
    expect(result).to.deep.equal([{ uid: 'taxonomy_a' }]);
  });

  it('should parse multiple comma-separated taxonomy uids', () => {
    const result = parseTaxonomyPublishItems('tax_a, tax_b');
    expect(result).to.deep.equal([{ uid: 'tax_a' }, { uid: 'tax_b' }]);
  });

  it('should trim whitespace', () => {
    const result = parseTaxonomyPublishItems('  my_tax  ');
    expect(result).to.deep.equal([{ uid: 'my_tax' }]);
  });

  it('should throw when legacy taxonomy_uid:term_uid format is used', () => {
    expect(() => parseTaxonomyPublishItems('tax:term')).to.throw(/comma-separated taxonomy UIDs only/);
  });

  it('should return empty array for empty string', () => {
    expect(parseTaxonomyPublishItems('')).to.deep.equal([]);
  });
});
