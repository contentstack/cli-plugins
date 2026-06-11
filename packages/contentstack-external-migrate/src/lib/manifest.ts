import fs from 'fs';
import path from 'path';

export const MANIFEST_FILENAME = 'migration-manifest.json';
export const MANIFEST_VERSION = 1;

export interface MigrationManifestStats {
  locales: number;
  contentTypes: number;
  entries: number;
}

export interface MigrationManifestSource {
  spaceId?: string;
  exportedAt?: string;
  exportFile?: string;
}

export interface MigrationManifestConvert {
  completedAt?: string;
  bundleDir?: string;
  masterLocale?: string;
  affix?: string;
  stats?: MigrationManifestStats;
}

export interface MigrationManifestAudit {
  lastRunAt?: string;
  reportPath?: string;
}

export interface MigrationManifestImport {
  completedAt?: string | null;
  stackApiKeyPrefix?: string;
  status?: 'pending' | 'completed' | 'failed';
}

export interface MigrationManifest {
  version: number;
  legacy: string;
  workspace: string;
  source?: MigrationManifestSource;
  convert?: MigrationManifestConvert;
  audit?: MigrationManifestAudit;
  import?: MigrationManifestImport;
}

export function manifestFilePath(workspace: string): string {
  return path.join(path.resolve(workspace), MANIFEST_FILENAME);
}

export function stackApiKeyPrefix(stackApiKey: string): string {
  const trimmed = stackApiKey.trim();
  if (trimmed.length <= 7) {
    return trimmed;
  }
  return `${trimmed.slice(0, 7)}…`;
}

/** Path relative to workspace root for manifest storage (POSIX-style for readability). */
export function toWorkspaceRelative(workspace: string, targetPath: string): string {
  const rel = path.relative(path.resolve(workspace), path.resolve(targetPath));
  if (!rel || rel === '.') {
    return '.';
  }
  return rel.split(path.sep).join('/');
}

export function findWorkspaceRoot(startPath: string): string | null {
  let dir = path.resolve(startPath);
  if (!fs.existsSync(dir)) {
    dir = path.dirname(dir);
  } else if (fs.statSync(dir).isFile()) {
    dir = path.dirname(dir);
  }

  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(manifestFilePath(dir))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}

export interface InferWorkspaceOptions {
  workspace?: string;
  output?: string;
  input?: string;
  dataDir?: string;
}

export function inferWorkspace(options: InferWorkspaceOptions): string {
  if (options.workspace) {
    return path.resolve(options.workspace);
  }

  for (const hint of [options.dataDir, options.input, options.output]) {
    if (!hint) continue;
    const found = findWorkspaceRoot(hint);
    if (found) {
      return found;
    }
  }

  if (options.output) {
    const resolved = path.resolve(options.output);
    if (path.basename(resolved) === 'contentstack-import') {
      return path.dirname(resolved);
    }
    return resolved;
  }

  if (options.dataDir) {
    const bundle = path.resolve(options.dataDir);
    const parent = path.basename(bundle) === 'bundle' ? path.dirname(bundle) : bundle;
    if (path.basename(parent) === 'contentstack-import') {
      return path.dirname(parent);
    }
    return path.dirname(parent);
  }

  return process.cwd();
}

export function workspaceLabel(workspace: string): string {
  const rel = path.relative(process.cwd(), path.resolve(workspace));
  if (rel && !rel.startsWith('..')) {
    return rel.split(path.sep).join('/') || '.';
  }
  return path.resolve(workspace);
}

export async function readManifest(workspace: string): Promise<MigrationManifest | null> {
  const filePath = manifestFilePath(workspace);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(raw) as MigrationManifest;
}

function mergeManifest(
  base: MigrationManifest,
  patch: Partial<MigrationManifest>,
): MigrationManifest {
  return {
    ...base,
    ...patch,
    version: patch.version ?? base.version,
    legacy: patch.legacy ?? base.legacy,
    workspace: patch.workspace ?? base.workspace,
    source: patch.source ? { ...base.source, ...patch.source } : base.source,
    convert: patch.convert ? { ...base.convert, ...patch.convert } : base.convert,
    audit: patch.audit ? { ...base.audit, ...patch.audit } : base.audit,
    import: patch.import ? { ...base.import, ...patch.import } : base.import,
  };
}

export async function writeManifest(
  workspace: string,
  manifest: MigrationManifest,
): Promise<void> {
  const filePath = manifestFilePath(workspace);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

  const tmpPath = `${filePath}.${process.pid}.tmp`;
  await fs.promises.writeFile(tmpPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await fs.promises.rename(tmpPath, filePath);
}

export async function patchManifest(
  workspace: string,
  patch: Partial<MigrationManifest>,
  defaults?: Pick<MigrationManifest, 'legacy'>,
): Promise<MigrationManifest> {
  const resolved = path.resolve(workspace);
  const existing =
    (await readManifest(resolved)) ??
    ({
      version: MANIFEST_VERSION,
      legacy: defaults?.legacy ?? 'contentful',
      workspace: workspaceLabel(resolved),
    } satisfies MigrationManifest);

  const next = mergeManifest(existing, {
    ...patch,
    version: MANIFEST_VERSION,
    workspace: patch.workspace ?? workspaceLabel(resolved),
  });

  await writeManifest(resolved, next);
  return next;
}

export function suggestNextCommand(manifest: MigrationManifest, workspace: string): string {
  const ws = workspaceLabel(workspace);
  const bundle =
    manifest.convert?.bundleDir != null
      ? path.join(ws, manifest.convert.bundleDir)
      : `${ws}/contentstack-import/bundle`;

  if (!manifest.source?.exportedAt) {
    return `csdx migrate:export -l contentful --space-id <id> -o ${ws}`;
  }
  if (!manifest.convert?.completedAt) {
    const exportFile = manifest.source.exportFile ?? 'export.json';
    return `csdx migrate:convert -l contentful -i ${path.join(ws, exportFile)} -o ${path.join(ws, 'contentstack-import')}`;
  }
  if (!manifest.audit?.lastRunAt) {
    return `csdx migrate:audit -d ${bundle} --report-path ${ws}/audit-reports`;
  }
  if (manifest.import?.status !== 'completed') {
    return `csdx migrate:import -k <stack-api-key> -d ${bundle}`;
  }
  return 'Migration pipeline complete — configure delivery credentials (see docs/expert-workflow.md)';
}

export function formatMigrationStatus(
  manifest: MigrationManifest,
  workspace: string,
): string[] {
  const ws = workspaceLabel(workspace);
  const lines: string[] = [`Migration workspace: ${ws}`, ''];

  if (manifest.source?.exportedAt) {
    lines.push(`  [✓] export    ${manifest.source.exportFile ?? 'export.json'}`);
  } else {
    lines.push('  [ ] export    not run');
  }

  if (manifest.convert?.completedAt) {
    const stats = manifest.convert.stats;
    const summary = stats
      ? `${stats.contentTypes} types, ${stats.entries} entries`
      : 'bundle ready';
    lines.push(`  [✓] convert   ${summary} → ${manifest.convert.bundleDir ?? 'bundle'}`);
  } else {
    lines.push('  [ ] convert   not run');
  }

  if (manifest.convert?.completedAt) {
    lines.push(
      '  [ ] review    manual — inspect bundle/mapper.json (docs/phases/phase-5-manifest-and-review.md)',
    );
  }

  if (manifest.audit?.lastRunAt) {
    lines.push(`  [✓] audit     ${manifest.audit.reportPath ?? 'completed'}`);
  } else if (manifest.convert?.completedAt) {
    lines.push('  [ ] audit     not run');
  }

  if (manifest.import?.status === 'completed') {
    const prefix = manifest.import.stackApiKeyPrefix ?? 'stack';
    lines.push(`  [✓] import    ${prefix}`);
  } else if (manifest.convert?.completedAt) {
    lines.push('  [ ] import    not run');
  }

  lines.push('');
  lines.push(`Next: ${suggestNextCommand(manifest, workspace)}`);
  return lines;
}
