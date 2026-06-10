import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildContentfulSpaceExportArgs,
  exportContentful,
  resolveContentfulManagementToken,
} from '../../../src/adapters/contentful/export';
import { formatContentfulCliInvocation } from '../../../src/lib/contentful-cli-spawn';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  vi.unstubAllEnvs();
});

describe('resolveContentfulManagementToken', () => {
  it('prefers flag over env', () => {
    vi.stubEnv('CONTENTFUL_MANAGEMENT_TOKEN', 'env-token');
    expect(resolveContentfulManagementToken('flag-token')).toBe('flag-token');
  });

  it('falls back to env when flag is missing', () => {
    vi.stubEnv('CONTENTFUL_MANAGEMENT_TOKEN', 'env-token');
    expect(resolveContentfulManagementToken()).toBe('env-token');
  });
});

describe('buildContentfulSpaceExportArgs', () => {
  it('maps required export flags', () => {
    const args = buildContentfulSpaceExportArgs(
      { outputDir: './migration-workspace', spaceId: 'abc123' },
      'secret-token',
    );
    expect(args).toContain('space');
    expect(args).toContain('export');
    expect(args).toEqual(
      expect.arrayContaining([
        '--space-id',
        'abc123',
        '--management-token',
        'secret-token',
        '--export-dir',
        path.resolve('./migration-workspace'),
        '--content-file',
        'export.json',
      ]),
    );
  });

  it('adds optional draft, archived, and asset flags', () => {
    const args = buildContentfulSpaceExportArgs(
      {
        outputDir: '/tmp/ws',
        spaceId: '1',
        includeDrafts: true,
        includeArchived: true,
        downloadAssets: true,
      },
      'tok',
    );
    expect(args).toContain('--include-drafts');
    expect(args).toContain('--include-archived');
    expect(args).toContain('--download-assets');
  });

  it('never logs the management token', () => {
    const args = buildContentfulSpaceExportArgs(
      { outputDir: './ws', spaceId: '1' },
      'super-secret',
    );
    const logged = formatContentfulCliInvocation(args);
    expect(logged).not.toContain('super-secret');
    expect(logged).toContain('***');
  });
});

describe('exportContentful', () => {
  it('validates export.json after a successful CLI run', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-export-'));
    tempDirs.push(dir);
    const fixture = path.resolve(__dirname, '../../fixtures/contentful-export.json');
    const exportFile = path.join(dir, 'export.json');
    fs.copyFileSync(fixture, exportFile);

    const spawnFn = vi.fn().mockResolvedValue(0);

    const result = await exportContentful(
      { outputDir: dir, spaceId: 'space-1', managementToken: 'tok' },
      spawnFn,
    );

    expect(spawnFn).toHaveBeenCalledOnce();
    expect(result.exportFile).toBe(exportFile);
  });

  it('throws when management token is missing', async () => {
    await expect(
      exportContentful({ outputDir: '/tmp', spaceId: '1' }),
    ).rejects.toThrow(/CONTENTFUL_MANAGEMENT_TOKEN/);
  });
});
