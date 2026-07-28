import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect } from 'chai';
import { assertBundleDir } from '../../src/lib/bundle';

const tempDirs: string[] = [];

function makeTempBundle(entries: Record<string, 'dir' | 'file'>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrate-bundle-'));
  tempDirs.push(dir);
  for (const [name, kind] of Object.entries(entries)) {
    const target = path.join(dir, name);
    if (kind === 'dir') {
      fs.mkdirSync(target, { recursive: true });
    } else {
      fs.writeFileSync(target, '{}');
    }
  }
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('assertBundleDir', () => {
  it('accepts a valid convert bundle layout', () => {
    const bundle = makeTempBundle({
      content_types: 'dir',
      locales: 'dir',
      'export-info.json': 'file',
    });
    expect(() => assertBundleDir(bundle)).to.not.throw();
  });

  it('throws when required entries are missing', () => {
    const bundle = makeTempBundle({
      content_types: 'dir',
      locales: 'dir',
    });
    expect(() => assertBundleDir(bundle)).to.throw(
      /Invalid bundle.*missing export-info\.json.*migrate:convert/,
    );
  });
});
