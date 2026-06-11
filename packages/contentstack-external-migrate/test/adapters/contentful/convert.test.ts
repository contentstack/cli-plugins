import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { convertContentfulExport } from '../../../src/adapters/contentful/convert';

const FIXTURE = path.resolve(__dirname, '../../fixtures/contentful-export.json');
const LARGE_EXPORT = path.resolve(
  __dirname,
  '../../../../references/contentful-export-nty6h2uki8mm-master-2026-06-02T15-32-37.json',
);

describe('convertContentfulExport', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs.length = 0;
    const staging = path.join(process.cwd(), 'contentfulMigrationData');
    if (fs.existsSync(staging)) {
      fs.rmSync(staging, { recursive: true, force: true });
    }
  });

  it('writes mapper.json and content_types/ into bundle/', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-migrate-alt-'));
    tmpDirs.push(outputDir);

    const result = await convertContentfulExport({
      input: FIXTURE,
      outputDir,
      masterLocale: 'en-US',
      verbose: false,
    });

    expect(fs.existsSync(path.join(result.bundleDir, 'mapper.json'))).toBe(true);
    expect(fs.existsSync(path.join(result.bundleDir, 'content_types'))).toBe(true);
    expect(fs.existsSync(path.join(result.bundleDir, 'locales'))).toBe(true);
    expect(fs.existsSync(path.join(result.bundleDir, 'export-info.json'))).toBe(true);
    expect(result.stats.contentTypes).toBeGreaterThan(0);
  });

  it('processes all export assets (not capped at 10)', async () => {
    if (!fs.existsSync(LARGE_EXPORT)) return;

    const exportData = JSON.parse(fs.readFileSync(LARGE_EXPORT, 'utf8'));
    const exportAssetCount = exportData.assets?.length ?? 0;
    if (exportAssetCount <= 10) return;

    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-migrate-alt-assets-'));
    tmpDirs.push(outputDir);

    const result = await convertContentfulExport({
      input: LARGE_EXPORT,
      outputDir,
      masterLocale: 'en-US',
    });

    const indexPath = path.join(result.bundleDir, 'assets', 'index.json');
    expect(fs.existsSync(indexPath)).toBe(true);
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    const convertedCount = Object.keys(index).length;
    expect(convertedCount).toBeGreaterThan(10);
    expect(convertedCount).toBeLessThanOrEqual(exportAssetCount);
  });
});
