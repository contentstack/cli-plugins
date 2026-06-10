import { fetchContentfulScheduledActions } from '../../adapters/contentful/export';
import { scheduleEntryAction } from '../../lib/create-stack';

export interface MappedSchedule {
  entryUid: string;
  contentTypeUid: string;
  action: 'publish' | 'unpublish';
  scheduledAt: string;
  cfId: string;
}

/**
 * Map Contentful scheduled actions → Contentstack scheduled publish/unpublish
 * intents. Only FUTURE-dated actions are kept (past ones are meaningless after
 * migration). Entity ids are translated to the post-import Contentstack uids
 * (csdx reassigns uids); entities not migrated are skipped.
 *
 * Pure function — unit-testable offline. `now` is injectable for tests.
 */
export function mapScheduledActions(
  actions: any[],
  opts: {
    entryUidMap: Record<string, string>;
    assetUidMap: Record<string, string>;
    entryCtUid: Record<string, string>;
  },
  now: number = Date.now(),
): { scheduled: MappedSchedule[]; skipped: number } {
  const scheduled: MappedSchedule[] = [];
  let skipped = 0;
  for (const a of actions ?? []) {
    const action = a?.action; // 'publish' | 'unpublish'
    const when = a?.scheduledFor?.datetime;
    const link = a?.entity?.sys;
    if (!action || !when || !link?.id) {
      skipped += 1;
      continue;
    }
    if (new Date(when).getTime() <= now) {
      skipped += 1; // past — skip
      continue;
    }
    const cfId = link.id;
    if (link.linkType === 'Asset') {
      const uid = opts.assetUidMap[cfId];
      if (uid) scheduled.push({ entryUid: uid, contentTypeUid: 'sys_assets', action, scheduledAt: when, cfId });
      else skipped += 1;
    } else if (link.linkType === 'Entry') {
      const uid = opts.entryUidMap[cfId];
      const ct = opts.entryCtUid[cfId];
      if (uid && ct) scheduled.push({ entryUid: uid, contentTypeUid: ct, action, scheduledAt: when, cfId });
      else skipped += 1;
    } else {
      // Release-scheduled actions etc. aren't handled here.
      skipped += 1;
    }
  }
  return { scheduled, skipped };
}

export interface ScheduleMigrationResult {
  total: number;
  scheduled: number;
  skipped: number;
  failed: Array<{ cfId: string; error: string }>;
}

/**
 * Migrate a Contentful environment's future scheduled actions into Contentstack
 * scheduled publishes. Fetch (live API) → map (future-dated, uid-translated) →
 * CMA schedule per entity. Runs after import. Best-effort + skip-safe.
 */
export async function migrateScheduledActions(opts: {
  spaceId: string;
  environmentId: string;
  managementToken?: string;
  apiKey: string;
  entryUidMap: Record<string, string>;
  assetUidMap: Record<string, string>;
  entryCtUid: Record<string, string>;
  environment: string;
  locale: string;
  branch?: string;
}): Promise<ScheduleMigrationResult> {
  const result: ScheduleMigrationResult = { total: 0, scheduled: 0, skipped: 0, failed: [] };
  const actions = await fetchContentfulScheduledActions(opts.spaceId, opts.environmentId, opts.managementToken);
  if (!actions.length) return result;
  result.total = actions.length;

  const { scheduled, skipped } = mapScheduledActions(actions, {
    entryUidMap: opts.entryUidMap,
    assetUidMap: opts.assetUidMap,
    entryCtUid: opts.entryCtUid,
  });
  result.skipped = skipped;

  for (const s of scheduled) {
    try {
      await scheduleEntryAction(opts.apiKey, {
        contentTypeUid: s.contentTypeUid,
        entryUid: s.entryUid,
        action: s.action,
        environment: opts.environment,
        locale: opts.locale,
        scheduledAt: s.scheduledAt,
        branch: opts.branch,
      });
      result.scheduled += 1;
    } catch (err: any) {
      const detail =
        err?.response?.data?.error_message || err?.message || 'unknown error';
      result.failed.push({ cfId: s.cfId, error: typeof detail === 'string' ? detail : JSON.stringify(detail) });
    }
  }
  return result;
}
