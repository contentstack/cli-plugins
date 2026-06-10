import { fetchContentfulEntryTasks } from '../../adapters/contentful/export';
import { createEntryDiscussion, addEntryDiscussionMessage } from '../../lib/create-stack';

export interface MappedEntryTasks {
  cfEntryId: string;
  entryUid: string;
  contentTypeUid: string;
  /** One comment string per Contentful task. */
  messages: string[];
}

/** Build the comment text for one Contentful task (body + assignee/status/due note). */
function taskMessage(task: any): string {
  const body = String(task?.body || '').trim() || '(no description)';
  const status = task?.status ? `status: ${task.status}` : '';
  const assignee = task?.assignedTo?.sys?.id ? `assignee: ${task.assignedTo.sys.id}` : '';
  const due = task?.dueDate ? `due: ${task.dueDate}` : '';
  const meta = [assignee, status, due].filter(Boolean).join(' · ');
  return meta ? `${body}\n\n(migrated from Contentful task — ${meta})` : `${body}\n\n(migrated from Contentful task)`;
}

/**
 * Map Contentful tasks (grouped by entry) → one Contentstack entry discussion
 * per entry with one comment per task. Contentstack comments are per-field and
 * allow one active discussion per field, while Contentful tasks are entry-level
 * — so we attach a single discussion to the entry's title field and add each
 * task as a comment. Entry ids are translated to post-import uids; tasks on
 * un-migrated entries are skipped. Pure + unit-testable.
 */
export function mapTasks(
  tasksByEntry: Array<{ cfEntryId: string; tasks: any[] }>,
  opts: { entryUidMap: Record<string, string>; entryCtUid: Record<string, string> },
): { mapped: MappedEntryTasks[]; skipped: number } {
  const mapped: MappedEntryTasks[] = [];
  let skipped = 0;
  for (const { cfEntryId, tasks } of tasksByEntry ?? []) {
    const list = tasks ?? [];
    if (!list.length) continue;
    const uid = opts.entryUidMap[cfEntryId];
    const ct = opts.entryCtUid[cfEntryId];
    if (!uid || !ct) {
      skipped += list.length;
      continue;
    }
    mapped.push({ cfEntryId, entryUid: uid, contentTypeUid: ct, messages: list.map(taskMessage) });
  }
  return { mapped, skipped };
}

export interface TaskMigrationResult {
  entriesWithTasks: number;
  commentsCreated: number;
  skipped: number;
  failed: number;
}

/**
 * Migrate Contentful entry Tasks → Contentstack entry comments. Per migrated
 * entry that has tasks: create ONE discussion on the title field, then add each
 * task as a comment. Best-effort + skip-safe.
 */
export async function migrateTasks(opts: {
  spaceId: string;
  environmentId: string;
  managementToken?: string;
  apiKey: string;
  entryUidMap: Record<string, string>;
  entryCtUid: Record<string, string>;
  locale: string;
  fieldUid?: string;
  branch?: string;
}): Promise<TaskMigrationResult> {
  const result: TaskMigrationResult = { entriesWithTasks: 0, commentsCreated: 0, skipped: 0, failed: 0 };
  const cfEntryIds = Object.keys(opts.entryUidMap);
  if (!cfEntryIds.length) return result;

  // Fetch tasks only for migrated entries, small concurrency.
  const tasksByEntry: Array<{ cfEntryId: string; tasks: any[] }> = [];
  const CONCURRENCY = 5;
  for (let i = 0; i < cfEntryIds.length; i += CONCURRENCY) {
    const batch = cfEntryIds.slice(i, i + CONCURRENCY);
    const fetched = await Promise.all(
      batch.map(async (cfEntryId) => ({
        cfEntryId,
        tasks: await fetchContentfulEntryTasks(opts.spaceId, opts.environmentId, cfEntryId, opts.managementToken),
      })),
    );
    for (const f of fetched) if (f.tasks.length) tasksByEntry.push(f);
  }

  const { mapped, skipped } = mapTasks(tasksByEntry, {
    entryUidMap: opts.entryUidMap,
    entryCtUid: opts.entryCtUid,
  });
  result.skipped = skipped;
  result.entriesWithTasks = mapped.length;

  const fieldUid = opts.fieldUid || 'title';
  for (const e of mapped) {
    try {
      const duid = await createEntryDiscussion(opts.apiKey, {
        contentTypeUid: e.contentTypeUid,
        entryUid: e.entryUid,
        locale: opts.locale,
        fieldUid,
        title: 'Migrated Contentful tasks',
        branch: opts.branch,
      });
      for (const message of e.messages) {
        try {
          await addEntryDiscussionMessage(opts.apiKey, {
            contentTypeUid: e.contentTypeUid,
            entryUid: e.entryUid,
            discussionUid: duid,
            message,
            branch: opts.branch,
          });
          result.commentsCreated += 1;
        } catch {
          result.failed += 1;
        }
      }
    } catch {
      result.failed += e.messages.length;
    }
  }
  return result;
}
