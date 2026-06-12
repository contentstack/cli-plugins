import { describe, expect, it } from 'vitest';
import { mapContentfulReleases } from '../../../src/services/contentful/releases';

// Synthetic Contentful release, shaped per the CF Releases API: each release has
// entities.items = links to Entry/Asset by id. Lets us test the mapping offline,
// without a paid Contentful tier that has the Releases feature.
const CF_RELEASES = [
  {
    sys: { id: 'rel1', type: 'Release' },
    title: 'Launch bundle',
    description: 'Homepage + hero',
    entities: {
      sys: { type: 'Array' },
      items: [
        { sys: { type: 'Link', linkType: 'Entry', id: 'entryA' } },
        { sys: { type: 'Link', linkType: 'Entry', id: 'entryB' } },
        { sys: { type: 'Link', linkType: 'Asset', id: 'assetX' } },
        { sys: { type: 'Link', linkType: 'Entry', id: 'notMigrated' } },
      ],
    },
  },
  {
    sys: { id: 'rel2' },
    title: 'Empty release',
    entities: { items: [] },
  },
];

describe('mapContentfulReleases', () => {
  // csdx reassigns uids on import: CF id → CS uid.
  const entryUidMap = { entryA: 'blt_a', entryB: 'blt_b' }; // notMigrated absent
  const assetUidMap = { assetX: 'blt_x' };
  const entryCtUid = { entryA: 'home_page', entryB: 'author' };
  const mapped = mapContentfulReleases(CF_RELEASES, { entryUidMap, assetUidMap, entryCtUid, locale: 'en-us' });

  it('maps one Contentstack release per Contentful release', () => {
    expect(mapped).toHaveLength(2);
    expect(mapped[0].name).toBe('Launch bundle');
    expect(mapped[0].description).toBe('Homepage + hero');
  });

  it('translates entry ids to CS uids with content-type uid + publish action', () => {
    const a = mapped[0].items.find((i) => i.uid === 'blt_a');
    expect(a).toEqual({ uid: 'blt_a', content_type_uid: 'home_page', action: 'publish', locale: 'en-us' });
    const b = mapped[0].items.find((i) => i.uid === 'blt_b');
    expect(b?.content_type_uid).toBe('author');
  });

  it('translates assets to their CS uid + sys_assets', () => {
    const asset = mapped[0].items.find((i) => i.uid === 'blt_x');
    expect(asset).toEqual({ uid: 'blt_x', content_type_uid: 'sys_assets', action: 'publish', locale: 'en-us' });
  });

  it('skips entries that were not migrated (no uid/content-type), counted not lost', () => {
    expect(mapped[0].items.find((i) => i.uid === 'notMigrated')).toBeUndefined();
    expect(mapped[0].items).toHaveLength(3); // blt_a, blt_b, blt_x
    expect(mapped[0].skipped).toBe(1);
  });

  it('handles an empty release', () => {
    expect(mapped[1].items).toHaveLength(0);
    expect(mapped[1].skipped).toBe(0);
  });
});
