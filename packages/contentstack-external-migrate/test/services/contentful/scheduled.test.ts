import { describe, expect, it } from 'vitest';
import { mapScheduledActions } from '../../../src/services/contentful/scheduled';

const NOW = new Date('2026-06-10T00:00:00Z').getTime();
const FUTURE = '2026-12-01T09:00:00Z';
const PAST = '2026-01-01T09:00:00Z';

// Synthetic CF scheduled actions (per the CF Scheduled Actions API shape).
const ACTIONS = [
  { sys: { id: 'sa1', status: 'scheduled' }, action: 'publish', scheduledFor: { datetime: FUTURE }, entity: { sys: { type: 'Link', linkType: 'Entry', id: 'entryA' } } },
  { sys: { id: 'sa2' }, action: 'unpublish', scheduledFor: { datetime: FUTURE }, entity: { sys: { type: 'Link', linkType: 'Asset', id: 'assetX' } } },
  { sys: { id: 'sa3' }, action: 'publish', scheduledFor: { datetime: PAST }, entity: { sys: { type: 'Link', linkType: 'Entry', id: 'entryA' } } }, // past → skip
  { sys: { id: 'sa4' }, action: 'publish', scheduledFor: { datetime: FUTURE }, entity: { sys: { type: 'Link', linkType: 'Entry', id: 'notMigrated' } } }, // no uid → skip
];

describe('mapScheduledActions', () => {
  const opts = {
    entryUidMap: { entryA: 'blt_a' },
    assetUidMap: { assetX: 'blt_x' },
    entryCtUid: { entryA: 'home_page' },
  };
  const { scheduled, skipped } = mapScheduledActions(ACTIONS, opts, NOW);

  it('keeps only future-dated, uid-translatable actions', () => {
    expect(scheduled).toHaveLength(2);
    expect(skipped).toBe(2); // past + notMigrated
  });

  it('translates a future entry publish', () => {
    const e = scheduled.find((s) => s.cfId === 'entryA');
    expect(e).toMatchObject({ entryUid: 'blt_a', contentTypeUid: 'home_page', action: 'publish', scheduledAt: FUTURE });
  });

  it('translates a future asset unpublish to sys_assets', () => {
    const a = scheduled.find((s) => s.cfId === 'assetX');
    expect(a).toMatchObject({ entryUid: 'blt_x', contentTypeUid: 'sys_assets', action: 'unpublish' });
  });
});
