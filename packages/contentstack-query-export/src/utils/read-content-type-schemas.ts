import * as fs from 'fs';
import * as path from 'path';
import { sanitizePath } from '@contentstack/cli-utilities';
import { fsUtil } from './file-helper';

function normalizeToArray(raw: unknown): any[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') return Object.values(raw as Record<string, unknown>);
  return [];
}

/**
 * CLI v1 aggregate content types under `content_types/schema.json`.
 */
export function readContentTypesFromExportDir(dir: string): any[] {
  const schemaPath = path.join(sanitizePath(dir), 'schema.json');
  try {
    const raw = fsUtil.readFile(sanitizePath(schemaPath));
    return normalizeToArray(raw);
  } catch {
    return [];
  }
}

function readGlobalFieldSchemasFromSubdirs(base: string): any[] {
  if (!fs.existsSync(base)) return [];
  const out: any[] = [];
  for (const name of fs.readdirSync(base)) {
    if (name === 'globalfields.json' || name === 'schema.json') continue;
    const full = path.join(base, name);
    let st: fs.Stats;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    if (!st.isDirectory()) {
      if (name.endsWith('.json')) {
        try {
          const doc = fsUtil.readFile(sanitizePath(full));
          if (doc && typeof doc === 'object') out.push(doc);
        } catch {
          /* skip invalid */
        }
      }
      continue;
    }
    const uid = name;
    const candidates = [path.join(full, `${uid}.json`), path.join(full, 'index.json')];
    let loaded = false;
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const doc = fsUtil.readFile(sanitizePath(p));
          if (doc && typeof doc === 'object') {
            out.push(doc);
            loaded = true;
            break;
          }
        } catch {
          /* try next */
        }
      }
    }
    if (loaded) continue;
    try {
      for (const f of fs.readdirSync(full)) {
        if (!f.endsWith('.json')) continue;
        const doc = fsUtil.readFile(sanitizePath(path.join(full, f)));
        if (doc && typeof doc === 'object') {
          out.push(doc);
          break;
        }
      }
    } catch {
      /* skip */
    }
  }
  return out;
}

/**
 * Global fields: prefer `global_fields/globalfields.json` (cm-export v1), then per-file / per-subfolder layouts.
 */
export function readGlobalFieldSchemasFromDir(dir: string): any[] {
  const base = sanitizePath(dir);
  const aggPath = path.join(base, 'globalfields.json');
  if (fs.existsSync(aggPath)) {
    try {
      const raw = fsUtil.readFile(sanitizePath(aggPath));
      const list = normalizeToArray(raw);
      if (list.length > 0) return list;
    } catch {
      /* fall through to subdir scan */
    }
  }
  return readGlobalFieldSchemasFromSubdirs(base);
}

/**
 * Rebuild `content_types/schema.json` from every per–content-type `*.json` in the folder
 * (excluding `schema.json` itself). Each `cm:stacks:export --module content-types` run
 * overwrites `schema.json` with that run’s batch only; query-export runs that module
 * multiple times, so without this merge the aggregate omits earlier types and the
 * entries module (which only reads `schema.json`) skips their entries.
 */
export function rebuildContentTypesSchemaJson(ctDir: string): void {
  const dir = sanitizePath(ctDir);
  if (!fs.existsSync(dir)) return;

  const byUid = new Map<string, any>();
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json') || name === 'schema.json') continue;
    const fp = path.join(dir, name);
    let st: fs.Stats;
    try {
      st = fs.statSync(fp);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    try {
      const doc = fsUtil.readFile(sanitizePath(fp));
      if (doc && typeof doc === 'object' && !Array.isArray(doc) && typeof (doc as { uid?: unknown }).uid === 'string') {
        byUid.set((doc as { uid: string }).uid, doc);
      }
    } catch {
      /* skip invalid JSON */
    }
  }

  const merged = Array.from(byUid.values());
  if (merged.length === 0) return;

  const schemaPath = path.join(dir, 'schema.json');
  fsUtil.writeFile(sanitizePath(schemaPath), merged);
}
