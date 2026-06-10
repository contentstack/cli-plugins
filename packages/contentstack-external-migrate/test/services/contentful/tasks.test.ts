import { describe, expect, it } from 'vitest';
import { mapTasks } from '../../../src/services/contentful/tasks';

// Synthetic CF tasks grouped by entry (per the CF Tasks API shape).
const TASKS_BY_ENTRY = [
  {
    cfEntryId: 'entryA',
    tasks: [
      { sys: { id: 't1' }, body: 'Review SEO', status: 'active', assignedTo: { sys: { linkType: 'User', id: 'u1' } } },
      { sys: { id: 't2' }, body: 'Legal sign-off', status: 'resolved' },
    ],
  },
  { cfEntryId: 'notMigrated', tasks: [{ sys: { id: 't3' }, body: 'x', status: 'active' }] },
  { cfEntryId: 'entryB', tasks: [] }, // no tasks → ignored
];

describe('mapTasks', () => {
  const opts = { entryUidMap: { entryA: 'blt_a' }, entryCtUid: { entryA: 'home_page' } };
  const { mapped, skipped } = mapTasks(TASKS_BY_ENTRY, opts);

  it('groups one discussion per migrated entry with one comment per task', () => {
    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({ cfEntryId: 'entryA', entryUid: 'blt_a', contentTypeUid: 'home_page' });
    expect(mapped[0].messages).toHaveLength(2);
  });

  it('embeds the task body + assignee/status in the comment', () => {
    expect(mapped[0].messages[0]).toContain('Review SEO');
    expect(mapped[0].messages[0]).toContain('assignee: u1');
    expect(mapped[0].messages[0]).toContain('status: active');
  });

  it('skips tasks on un-migrated entries (counted, not lost)', () => {
    expect(skipped).toBe(1); // notMigrated had 1 task
  });
});
