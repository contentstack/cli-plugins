import { expect } from 'chai';
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
    expect(mapped).to.have.lengthOf(1);
    expect(mapped[0]).to.deep.include({ cfEntryId: 'entryA', entryUid: 'blt_a', contentTypeUid: 'home_page' });
    expect(mapped[0].messages).to.have.lengthOf(2);
  });

  it('embeds the task body + assignee/status in the comment', () => {
    expect(mapped[0].messages[0]).to.include('Review SEO');
    expect(mapped[0].messages[0]).to.include('assignee: u1');
    expect(mapped[0].messages[0]).to.include('status: active');
  });

  it('skips tasks on un-migrated entries (counted, not lost)', () => {
    expect(skipped).to.equal(1); // notMigrated had 1 task
  });
});
