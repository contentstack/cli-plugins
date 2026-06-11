import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  formatMigrationStatus,
  inferWorkspace,
  MANIFEST_FILENAME,
  patchManifest,
  readManifest,
  stackApiKeyPrefix,
  suggestNextCommand,
  toWorkspaceRelative,
  writeManifest,
} from '../../src/lib/manifest';
import type { MigrationManifest } from '../../src/lib/manifest';

const tempDirs: string[] = [];

function makeWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-ws-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('manifest I/O', () => {
  it('writes and reads migration-manifest.json', async () => {
    const ws = makeWorkspace();
    const manifest: MigrationManifest = {
      version: 1,
      legacy: 'contentful',
      workspace: 'migration-workspace',
      source: { exportFile: 'export.json' },
    };
    await writeManifest(ws, manifest);
    expect(fs.existsSync(path.join(ws, MANIFEST_FILENAME))).toBe(true);
    expect(await readManifest(ws)).toEqual(manifest);
  });

  it('patchManifest merges nested sections', async () => {
    const ws = makeWorkspace();
    await patchManifest(ws, { source: { spaceId: 'abc' } }, { legacy: 'contentful' });
    await patchManifest(ws, {
      convert: {
        completedAt: '2026-01-01T00:00:00.000Z',
        stats: { locales: 2, contentTypes: 3, entries: 10 },
      },
    });
    const manifest = await readManifest(ws);
    expect(manifest?.source?.spaceId).toBe('abc');
    expect(manifest?.convert?.stats?.entries).toBe(10);
  });

  it('never stores full stack API keys', () => {
    expect(stackApiKeyPrefix('blt1234567890abcdef')).toBe('blt1234…');
    const raw = JSON.stringify({ import: { stackApiKeyPrefix: stackApiKeyPrefix('bltSECRETKEY') } });
    expect(raw).not.toContain('SECRETKEY');
  });
});

describe('inferWorkspace', () => {
  it('treats contentstack-import parent as workspace', () => {
    const ws = makeWorkspace();
    const importDir = path.join(ws, 'contentstack-import');
    fs.mkdirSync(importDir, { recursive: true });
    expect(inferWorkspace({ output: importDir })).toBe(ws);
  });

  it('finds workspace from existing manifest', async () => {
    const ws = makeWorkspace();
    await patchManifest(ws, { source: { spaceId: '1' } }, { legacy: 'contentful' });
    const bundle = path.join(ws, 'contentstack-import', 'bundle');
    fs.mkdirSync(bundle, { recursive: true });
    expect(inferWorkspace({ dataDir: bundle })).toBe(ws);
  });
});

describe('formatMigrationStatus', () => {
  it('suggests import after audit', () => {
    const ws = makeWorkspace();
    const manifest: MigrationManifest = {
      version: 1,
      legacy: 'contentful',
      workspace: '.',
      source: { exportedAt: 't', exportFile: 'export.json' },
      convert: {
        completedAt: 't',
        bundleDir: 'contentstack-import/bundle',
        stats: { locales: 1, contentTypes: 2, entries: 3 },
      },
      audit: { lastRunAt: 't', reportPath: 'audit-reports' },
    };
    const lines = formatMigrationStatus(manifest, ws);
    expect(lines.some((l) => l.includes('[✓] export'))).toBe(true);
    expect(lines.some((l) => l.includes('[✓] audit'))).toBe(true);
    expect(suggestNextCommand(manifest, ws)).toContain('migrate:import');
  });

  it('uses workspace-relative paths', () => {
    const ws = makeWorkspace();
    const rel = toWorkspaceRelative(ws, path.join(ws, 'export.json'));
    expect(rel).toBe('export.json');
  });
});
