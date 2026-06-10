import fs from 'fs';
import path from 'path';
import { fetchContentfulReleases } from '../../adapters/contentful/export';
import { createReleaseWithItems, type ReleaseItem } from '../../lib/create-stack';

export interface MappedRelease {
  name: string;
  description: string;
  items: ReleaseItem[];
  /** Source item links that couldn't be mapped (entry not migrated). */
  skipped: number;
}

/**
 * Map Contentful releases → Contentstack release payloads. Each Contentful
 * release `entities.items` (links to entries/assets) becomes Contentstack
 * release items. An entry item needs its content-type uid, supplied via
 * `entryCtUid`; assets use the built-in `sys_assets`. Items whose entry wasn't
 * migrated (no content-type uid) are skipped (counted, not silently lost).
 *
 * Pure function — unit-testable without any live API.
 */
export function mapContentfulReleases(
  releases: any[],
  opts: {
    /** Contentful entry id → Contentstack entry uid (csdx reassigns uids on import). */
    entryUidMap: Record<string, string>;
    /** Contentful asset id → Contentstack asset uid. */
    assetUidMap: Record<string, string>;
    /** Contentful entry id → Contentstack content-type uid. */
    entryCtUid: Record<string, string>;
    locale: string;
  },
): MappedRelease[] {
  const out: MappedRelease[] = [];
  for (const rel of releases ?? []) {
    const name = rel?.title || rel?.sys?.id;
    if (!name) continue;
    const links: any[] = rel?.entities?.items ?? [];
    const items: ReleaseItem[] = [];
    let skipped = 0;
    for (const link of links) {
      const linkType = link?.sys?.linkType;
      const id = link?.sys?.id;
      if (!id) continue;
      if (linkType === 'Asset') {
        // Asset — translate to the Contentstack asset uid assigned at import.
        const csUid = opts.assetUidMap[id];
        if (csUid) {
          items.push({ uid: csUid, content_type_uid: 'sys_assets', action: 'publish', locale: opts.locale });
        } else {
          skipped += 1;
        }
      } else {
        // Entry — needs both the Contentstack uid (post-import) and its content-type uid.
        const csUid = opts.entryUidMap[id];
        const ct = opts.entryCtUid[id];
        if (csUid && ct) {
          items.push({ uid: csUid, content_type_uid: ct, action: 'publish', locale: opts.locale });
        } else {
          skipped += 1;
        }
      }
    }
    out.push({ name, description: rel?.description || '', items, skipped });
  }
  return out;
}

/**
 * Read csdx's post-import id remapping (Contentful id → Contentstack uid) for
 * entries and assets from an import backup dir's mapper. csdx reassigns uids on
 * import, so release items must use these translated uids.
 */
export function readImportUidMaps(backupDir: string): {
  entryUidMap: Record<string, string>;
  assetUidMap: Record<string, string>;
} {
  const read = (p: string): Record<string, string> => {
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      return j && typeof j === 'object' ? j : {};
    } catch {
      return {};
    }
  };
  return {
    entryUidMap: read(path.join(backupDir, 'mapper', 'entries', 'uid-mapping.json')),
    assetUidMap: read(path.join(backupDir, 'mapper', 'assets', 'uid-mapping.json')),
  };
}

/** Build entry-uid → content-type-uid map from a converted bundle's entries dir. */
export function buildEntryContentTypeMap(bundleDir: string): Record<string, string> {
  const map: Record<string, string> = {};
  const entriesRoot = path.join(bundleDir, 'entries');
  let cts: string[];
  try {
    cts = fs.readdirSync(entriesRoot);
  } catch {
    return map;
  }
  for (const ct of cts) {
    const ctDir = path.join(entriesRoot, ct);
    const walk = (p: string) => {
      let dirents: fs.Dirent[];
      try {
        dirents = fs.readdirSync(p, { withFileTypes: true });
      } catch {
        return;
      }
      for (const d of dirents) {
        const fp = path.join(p, d.name);
        if (d.isDirectory()) walk(fp);
        else if (/-entries\.json$/.test(d.name)) {
          try {
            const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
            for (const uid of Object.keys(data || {})) if (!map[uid]) map[uid] = ct;
          } catch {
            // skip
          }
        }
      }
    };
    try {
      if (fs.statSync(ctDir).isDirectory()) walk(ctDir);
    } catch {
      // skip
    }
  }
  return map;
}

export interface ReleaseMigrationResult {
  total: number;
  created: Array<{ name: string; uid: string; items: number; skipped: number }>;
  failed: Array<{ name: string; error: string }>;
}

/**
 * Migrate a Contentful environment's Releases into Contentstack: fetch them from
 * the live CF API, map their items to migrated entry/asset uids, and create a
 * Contentstack Release per source release (items added, NOT auto-deployed).
 * Runs after import (entries/assets must exist). Best-effort.
 */
export async function migrateReleases(opts: {
  spaceId: string;
  environmentId: string;
  managementToken?: string;
  apiKey: string;
  bundleDir: string;
  /** Contentful id → Contentstack uid maps (read from the import backup, since
   *  csdx reassigns uids on import). */
  entryUidMap: Record<string, string>;
  assetUidMap: Record<string, string>;
  locale: string;
  branch?: string;
}): Promise<ReleaseMigrationResult> {
  const result: ReleaseMigrationResult = { total: 0, created: [], failed: [] };
  const releases = await fetchContentfulReleases(opts.spaceId, opts.environmentId, opts.managementToken);
  if (!releases.length) return result;

  const entryCtUid = buildEntryContentTypeMap(opts.bundleDir);
  const mapped = mapContentfulReleases(releases, {
    entryUidMap: opts.entryUidMap,
    assetUidMap: opts.assetUidMap,
    entryCtUid,
    locale: opts.locale,
  });
  result.total = mapped.length;

  for (const m of mapped) {
    try {
      const res = await createReleaseWithItems(opts.apiKey, {
        name: m.name,
        description: m.description,
        locale: opts.locale,
        items: m.items,
        branch: opts.branch,
      });
      result.created.push({ name: m.name, uid: res.uid, items: res.itemsAdded, skipped: m.skipped });
    } catch (err: any) {
      const detail =
        err?.response?.data?.error_message ||
        (err?.response?.data?.errors && JSON.stringify(err.response.data.errors)) ||
        err?.message ||
        'unknown error';
      result.failed.push({ name: m.name, error: typeof detail === 'string' ? detail : JSON.stringify(detail) });
    }
  }
  return result;
}
