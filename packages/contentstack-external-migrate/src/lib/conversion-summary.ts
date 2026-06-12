import fs from 'fs';
import path from 'path';
import { parseJsonLoose } from './parse-json-loose';

export type ModuleStatus = 'passed' | 'partial' | 'failed' | 'skipped';

export interface ModuleRow {
  module: string;
  /** Actual count of items in the source export (raw, incl. duplicates). */
  source: number;
  /** Duplicate source items collapsed by id/code (so unique = source − duplicate). */
  duplicate: number;
  converted: number;
  status: ModuleStatus;
}

export interface ContentTypeFieldRow {
  contentType: string;
  cfFields: number;
  csFields: number;
  failed: number;
}

export interface ConversionSummary {
  rows: ModuleRow[];
  contentTypeFields?: ContentTypeFieldRow[];
  generatedAt?: string;
}

const SUMMARY_FILE = 'conversion-summary.json';

/** Contentful role names that map onto a Contentstack built-in (not created as custom). */
const BUILTIN_ROLE_SYNONYMS = new Set([
  'owner',
  'admin',
  'administrator',
  'developer',
  'dev',
  'content manager',
  'content-manager',
  'editor',
  'author',
]);

function statusFor(source: number, converted: number): ModuleStatus {
  if (source === 0) return 'skipped';
  if (converted === 0) return 'failed';
  if (converted >= source) return 'passed';
  return 'partial';
}

/** Count items in a JSON file — array length or object key count; 0 if missing. */
function jsonCount(file: string): number {
  try {
    const j = parseJsonLoose(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(j)) return j.length;
    if (j && typeof j === 'object') return Object.keys(j).length;
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Count converted entries as UNIQUE entry uids across every *-entries.json file.
 * (Localized variants of one entry share a uid across locale files, so a plain
 * sum would over-count vs the source's unique-entry count.)
 */
function countConvertedEntries(bundleDir: string): number {
  const root = path.join(bundleDir, 'entries');
  const uids = new Set<string>();
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
          const j = parseJsonLoose(fs.readFileSync(fp, 'utf8'));
          if (j && typeof j === 'object') for (const k of Object.keys(j)) uids.add(k);
        } catch {
          // skip unreadable file
        }
      }
    }
  };
  walk(root);
  return uids.size;
}

/** Converted locales = master-locale.json + locales.json key counts. */
function countConvertedLocales(bundleDir: string): number {
  return (
    jsonCount(path.join(bundleDir, 'locales', 'master-locale.json')) +
    jsonCount(path.join(bundleDir, 'locales', 'locales.json'))
  );
}

/** Converted roles = custom roles created + source roles that map to a built-in. */
function countConvertedRoles(sourceRoles: any[], bundleDir: string): number {
  const custom = jsonCount(path.join(bundleDir, 'custom-roles', 'custom-roles.json'));
  const builtin = sourceRoles.filter((r) =>
    BUILTIN_ROLE_SYNONYMS.has(String(r?.name || '').trim().toLowerCase()),
  ).length;
  return custom + builtin;
}

/**
 * Compare a Contentful export (source) against the converted bundle and produce
 * a per-module summary: how many of each module the source had vs how many
 * landed in the bundle, with a pass/partial/fail status. The same QA view csdx
 * shows after an audit, but for the conversion step.
 */
export function computeConversionSummary(source: any, bundleDir: string): ConversionSummary {
  const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
  // Raw count + unique count (by a key field) so we can report duplicates that
  // the bundle collapses (it keys by id/code). dup = raw − unique.
  const uniq = (items: any[], keyFn: (x: any) => any) => {
    const ids = new Set<string>();
    for (const it of items) {
      const k = keyFn(it);
      if (k != null && k !== '') ids.add(String(k));
    }
    return { raw: items.length, unique: ids.size };
  };
  const byId = (x: any) => x?.sys?.id;

  const cts = uniq(arr(source?.contentTypes), byId);
  const entries = uniq(arr(source?.entries), byId);
  const assets = uniq(arr(source?.assets), byId);
  const locales = uniq(arr(source?.locales), (l: any) => l?.code);
  const webhooks = uniq(arr(source?.webhooks), byId);
  const roleArr = arr(source?.roles);
  const roles = uniq(roleArr, (r: any) => r?.name);

  const defs: Array<{ module: string; unique: number; raw: number; converted: number }> = [
    {
      module: 'Content Types',
      unique: cts.unique,
      raw: cts.raw,
      converted: jsonCount(path.join(bundleDir, 'content_types', 'schema.json')),
    },
    {
      module: 'Entries',
      unique: entries.unique,
      raw: entries.raw,
      converted: countConvertedEntries(bundleDir),
    },
    {
      // The canonical converted-assets list is assets/index.json (keyed by uid);
      // assets.json can carry a stray placeholder entry, so don't count it.
      module: 'Assets',
      unique: assets.unique,
      raw: assets.raw,
      converted: jsonCount(path.join(bundleDir, 'assets', 'index.json')),
    },
    {
      module: 'Locales',
      unique: locales.unique,
      raw: locales.raw,
      converted: countConvertedLocales(bundleDir),
    },
    {
      module: 'Webhooks',
      unique: webhooks.unique,
      raw: webhooks.raw,
      converted: jsonCount(path.join(bundleDir, 'webhooks', 'webhooks.json')),
    },
    {
      module: 'Roles',
      unique: roles.unique,
      raw: roles.raw,
      converted: countConvertedRoles(roleArr, bundleDir),
    },
  ];

  const rows: ModuleRow[] = defs.map((d) => {
    const duplicate = Math.max(0, d.raw - d.unique);
    // Source = the actual count in the export; duplicates collapse by id/code,
    // so status compares converted against the unique (source − duplicate).
    return {
      module: d.module,
      source: d.raw,
      duplicate,
      converted: d.converted,
      status: statusFor(d.raw - duplicate, d.converted),
    };
  });
  return { rows };
}

const STATUS_ICON: Record<ModuleStatus, string> = {
  passed: '✓ passed',
  partial: '⚠ partial',
  failed: '✗ failed',
  skipped: '— none',
};

/** Render the summary as a bordered ASCII table (csdx-style). */
export function renderConversionSummary(summary: ConversionSummary, title = 'Conversion summary'): string {
  const header = ['Module', 'Source', 'Duplicate', 'Converted', 'Status'];
  const rows = summary.rows.map((r) => [
    r.module,
    String(r.source),
    String(r.duplicate ?? 0),
    String(r.converted),
    STATUS_ICON[r.status],
  ]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => row[i].length)),
  );
  const pad = (s: string, w: number) => s + ' '.repeat(w - s.length);
  const line = (l: string, m: string, r: string) =>
    l + widths.map((w) => '─'.repeat(w + 2)).join(m) + r;
  const fmt = (cells: string[]) =>
    '│ ' + cells.map((c, i) => pad(c, widths[i])).join(' │ ') + ' │';

  const out: string[] = [];
  out.push(title);
  out.push(line('┌', '┬', '┐'));
  out.push(fmt(header));
  out.push(line('├', '┼', '┤'));
  for (const row of rows) out.push(fmt(row));
  out.push(line('└', '┴', '┘'));

  const failed = summary.rows.filter((r) => r.status === 'failed');
  const partial = summary.rows.filter((r) => r.status === 'partial');
  const dups = summary.rows.filter((r) => (r.duplicate ?? 0) > 0);
  if (failed.length) out.push(`✗ ${failed.length} module(s) failed: ${failed.map((r) => r.module).join(', ')}`);
  if (partial.length) out.push(`⚠ ${partial.length} module(s) partial: ${partial.map((r) => r.module).join(', ')}`);
  if (!failed.length && !partial.length) out.push('✓ All modules converted fully.');
  if (dups.length) {
    out.push(
      `ℹ Duplicate source items collapsed by id: ${dups
        .map((r) => `${r.module} (${r.duplicate})`)
        .join(', ')}`,
    );
  }
  return out.join('\n');
}

/** Normalize an id/name for loose comparison (lowercase, alphanumerics only). */
function norm(s: any): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Read the CS schema (field list) for every converted content type, by uid. */
function readBundleContentTypes(bundleDir: string): Array<{ uid: string; title: string; schema: any[] }> {
  const out: Array<{ uid: string; title: string; schema: any[] }> = [];
  // schema.json is the canonical array of all converted content types.
  const schemaFile = path.join(bundleDir, 'content_types', 'schema.json');
  try {
    const arr = parseJsonLoose(fs.readFileSync(schemaFile, 'utf8'));
    if (Array.isArray(arr)) {
      for (const ct of arr) {
        out.push({ uid: ct?.uid || '', title: ct?.title || ct?.uid || '', schema: Array.isArray(ct?.schema) ? ct.schema : [] });
      }
    }
  } catch {
    // ignore
  }
  return out;
}

/**
 * Per-content-type field summary: how many fields each Contentful content type
 * had vs how many converted into the Contentstack content type, and how many
 * failed to convert. A Contentful field is considered converted when a
 * Contentstack field matches it by uid or name — accounting for the renames
 * Contentstack does (the title/display field → Title, a slug field → URL).
 */
export function computeContentTypeFieldSummary(source: any, bundleDir: string): ContentTypeFieldRow[] {
  const cfCts: any[] = Array.isArray(source?.contentTypes) ? source.contentTypes : [];
  const csCts = readBundleContentTypes(bundleDir);
  // Match CS content types to CF by normalized title/name.
  const csByName = new Map<string, { uid: string; title: string; schema: any[] }>();
  for (const cs of csCts) {
    csByName.set(norm(cs.title), cs);
    csByName.set(norm(cs.uid), cs);
  }

  const rows: ContentTypeFieldRow[] = [];
  for (const cf of cfCts) {
    const cfFields: any[] = Array.isArray(cf?.fields) ? cf.fields : [];
    const cs =
      csByName.get(norm(cf?.name)) ||
      csByName.get(norm(cf?.sys?.id)) ||
      csByName.get(norm(String(cf?.sys?.id).replace(/([A-Z])/g, '_$1')));
    const csSchema: any[] = cs?.schema ?? [];
    const csUidSet = new Set(csSchema.map((f) => norm(f?.uid)));
    const csNameSet = new Set(csSchema.map((f) => norm(f?.display_name)));
    const hasTitle = csUidSet.has('title');
    const hasUrl = csUidSet.has('url');
    const displayFieldId = cf?.displayField;

    // CS Fields = how many CF fields actually converted. We count only
    // CF-originated fields, so the auto-added built-in Title/URL are NOT counted
    // unless they came from a CF field (the title/display field, or a slug → URL).
    let matched = 0;
    for (const f of cfFields) {
      const ok =
        csUidSet.has(norm(f?.id)) ||
        csNameSet.has(norm(f?.name)) ||
        (displayFieldId && f?.id === displayFieldId && hasTitle) || // title/display field
        ((/slug/i.test(String(f?.id)) || /slug/i.test(String(f?.name))) && hasUrl); // slug → URL
      if (ok) matched += 1;
    }

    rows.push({
      contentType: cs?.title || cf?.name || cf?.sys?.id || 'unknown',
      cfFields: cfFields.length,
      csFields: matched,
      failed: cfFields.length - matched,
    });
  }
  return rows;
}

/** Render the per-content-type field table. */
export function renderContentTypeFieldSummary(
  rows: ContentTypeFieldRow[],
  title = 'Content-type field conversion',
): string {
  const header = ['Content Type', 'CF Fields', 'CS Fields', 'Failed'];
  const body = rows.map((r) => [
    r.contentType,
    String(r.cfFields),
    String(r.csFields),
    r.failed > 0 ? `✗ ${r.failed}` : '0',
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
  const pad = (s: string, w: number) => s + ' '.repeat(w - s.length);
  const line = (l: string, m: string, r: string) =>
    l + widths.map((w) => '─'.repeat(w + 2)).join(m) + r;
  const fmt = (cells: string[]) =>
    '│ ' + cells.map((c, i) => pad(c, widths[i])).join(' │ ') + ' │';
  const out: string[] = [title, line('┌', '┬', '┐'), fmt(header), line('├', '┼', '┤')];
  for (const row of body) out.push(fmt(row));
  out.push(line('└', '┴', '┘'));
  const withFailed = rows.filter((r) => r.failed > 0);
  if (withFailed.length) {
    out.push(
      `✗ ${withFailed.length} content type(s) with failed fields: ${withFailed
        .map((r) => `${r.contentType} (${r.failed})`)
        .join(', ')}`,
    );
  } else {
    out.push('✓ All content-type fields converted.');
  }
  return out.join('\n');
}

export function writeConversionSummary(bundleDir: string, summary: ConversionSummary): void {
  try {
    fs.mkdirSync(bundleDir, { recursive: true });
    fs.writeFileSync(
      path.join(bundleDir, SUMMARY_FILE),
      `${JSON.stringify(summary, null, 2)}\n`,
      'utf8',
    );
  } catch {
    // best-effort
  }
}

export function readConversionSummary(bundleDir: string): ConversionSummary | null {
  try {
    const raw = fs.readFileSync(path.join(bundleDir, SUMMARY_FILE), 'utf8');
    const parsed = parseJsonLoose(raw);
    if (parsed && Array.isArray(parsed.rows)) return parsed as ConversionSummary;
  } catch {
    // ignore
  }
  return null;
}
