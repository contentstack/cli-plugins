import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  buildContentfulSpaceExportArgs,
  exportContentful,
  resolveContentfulManagementToken,
} from '../../../src/adapters/contentful/export';
import { formatContentfulCliInvocation } from '../../../src/lib/contentful-cli-spawn';

const tempDirs: string[] = [];

// Track env vars overridden during a test so afterEach can restore the originals
// (no built-in env-stubbing helper, so we back up and restore process.env manually).
const envBackup: Record<string, string | undefined> = {};
function stubEnv(key: string, value: string): void {
  if (!(key in envBackup)) envBackup[key] = process.env[key];
  process.env[key] = value;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  for (const [key, value] of Object.entries(envBackup)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  for (const key of Object.keys(envBackup)) delete envBackup[key];
});

describe('resolveContentfulManagementToken', () => {
  it('prefers flag over env', () => {
    stubEnv('CONTENTFUL_MANAGEMENT_TOKEN', 'env-token');
    expect(resolveContentfulManagementToken('flag-token')).to.equal('flag-token');
  });

  it('falls back to env when flag is missing', () => {
    stubEnv('CONTENTFUL_MANAGEMENT_TOKEN', 'env-token');
    expect(resolveContentfulManagementToken()).to.equal('env-token');
  });
});

describe('buildContentfulSpaceExportArgs', () => {
  it('maps required export flags', () => {
    const args = buildContentfulSpaceExportArgs(
      { outputDir: './migration-workspace', spaceId: 'abc123' },
      'secret-token',
    );
    expect(args).to.include('space');
    expect(args).to.include('export');
    expect(args).to.include.members([
      '--space-id',
      'abc123',
      '--management-token',
      'secret-token',
      '--export-dir',
      path.resolve('./migration-workspace'),
      '--content-file',
      'export.json',
    ]);
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
    expect(args).to.include('--include-drafts');
    expect(args).to.include('--include-archived');
    expect(args).to.include('--download-assets');
  });

  it('never logs the management token', () => {
    const args = buildContentfulSpaceExportArgs(
      { outputDir: './ws', spaceId: '1' },
      'super-secret',
    );
    const logged = formatContentfulCliInvocation(args);
    expect(logged).to.not.include('super-secret');
    expect(logged).to.include('***');
  });
});

describe('exportContentful', () => {
  it('validates export.json after a successful CLI run', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-export-'));
    tempDirs.push(dir);
    const fixture = path.resolve(__dirname, '../../fixtures/contentful-export.json');
    const exportFile = path.join(dir, 'export.json');
    fs.copyFileSync(fixture, exportFile);

    const spawnFn = sinon.stub().resolves(0);

    const result = await exportContentful(
      { outputDir: dir, spaceId: 'space-1', managementToken: 'tok' },
      spawnFn as any,
    );

    expect(spawnFn.calledOnce).to.equal(true);
    expect(result.exportFile).to.equal(exportFile);
  });

  it('throws when management token is missing', async () => {
    let error: any;
    try {
      await exportContentful({ outputDir: '/tmp', spaceId: '1' });
    } catch (err) {
      error = err;
    }
    expect(error, 'expected exportContentful to reject').to.be.an('error');
    expect(error.message).to.match(/CONTENTFUL_MANAGEMENT_TOKEN/);
  });
});
