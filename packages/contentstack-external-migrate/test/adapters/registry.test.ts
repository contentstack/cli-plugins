import { describe, it, expect } from 'vitest';
import { getAdapter } from '../../src/adapters/registry';

describe('getAdapter', () => {
  it('returns contentful adapter', () => {
    expect(getAdapter('contentful').legacy).toBe('contentful');
  });

  it('throws for unsupported legacy CMS', () => {
    expect(() => getAdapter('sanity')).toThrow('Unsupported legacy CMS');
  });
});
