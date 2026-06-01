import { expect } from 'chai';
import { describe, it } from 'mocha';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import {
  loadAssetUidsFromFile,
  loadBulkDeleteItemsFromFile,
  LoadAssetUidsError,
  validateAndBuildBulkDeleteItems,
  validateAssetUidsParsedJson,
} from '../../../src/utils/asset-uids-from-file';

describe('validateAssetUidsParsedJson', () => {
  const pathLabel = '/virtual/path.json';

  it('returns uids when shape is valid', () => {
    const out = validateAssetUidsParsedJson(JSON.parse(JSON.stringify({ uids: ['a', 'b'] })), pathLabel);
    expect(out).to.deep.equal(['a', 'b']);
  });

  it('throws SCHEMA for bare root array', () => {
    try {
      validateAssetUidsParsedJson(JSON.parse(JSON.stringify(['a'])), pathLabel);
      expect.fail('expected LoadAssetUidsError');
    } catch (e: unknown) {
      expect(e).to.be.instanceOf(LoadAssetUidsError);
      expect((e as LoadAssetUidsError).kind).to.equal('SCHEMA');
    }
  });

  it('throws SCHEMA for extra top-level keys', () => {
    try {
      validateAssetUidsParsedJson({ uids: ['x'], other: 1 }, pathLabel);
      expect.fail('expected LoadAssetUidsError');
    } catch (e: unknown) {
      expect(e).to.be.instanceOf(LoadAssetUidsError);
      expect((e as LoadAssetUidsError).kind).to.equal('SCHEMA');
    }
  });

  it('throws SCHEMA for empty uids array', () => {
    try {
      validateAssetUidsParsedJson({ uids: [] }, pathLabel);
      expect.fail('expected LoadAssetUidsError');
    } catch (e: unknown) {
      expect(e).to.be.instanceOf(LoadAssetUidsError);
      expect((e as LoadAssetUidsError).kind).to.equal('SCHEMA');
    }
  });

  it('throws SCHEMA for empty string uid', () => {
    try {
      validateAssetUidsParsedJson({ uids: ['ok', ''] }, pathLabel);
      expect.fail('expected LoadAssetUidsError');
    } catch (e: unknown) {
      expect(e).to.be.instanceOf(LoadAssetUidsError);
      expect((e as LoadAssetUidsError).kind).to.equal('SCHEMA');
    }
  });

  it('throws SCHEMA when uid entry is not a string', () => {
    try {
      validateAssetUidsParsedJson({ uids: ['ok', 1] }, pathLabel);
      expect.fail('expected LoadAssetUidsError');
    } catch (e: unknown) {
      expect(e).to.be.instanceOf(LoadAssetUidsError);
      expect((e as LoadAssetUidsError).kind).to.equal('SCHEMA');
    }
  });
});

describe('validateAndBuildBulkDeleteItems', () => {
  const pathLabel = '/virtual/path.json';
  const locale = 'en-us';

  it('returns rows when shape is valid', () => {
    const out = validateAndBuildBulkDeleteItems(JSON.parse(JSON.stringify({ uids: ['a', 'b'] })), locale, pathLabel);
    expect(out).to.deep.equal([
      { uid: 'a', locale },
      { uid: 'b', locale },
    ]);
  });

  it('throws SCHEMA for bare root array', () => {
    try {
      validateAndBuildBulkDeleteItems(JSON.parse(JSON.stringify(['a'])), locale, pathLabel);
      expect.fail('expected LoadAssetUidsError');
    } catch (e: unknown) {
      expect(e).to.be.instanceOf(LoadAssetUidsError);
      expect((e as LoadAssetUidsError).kind).to.equal('SCHEMA');
    }
  });

  it('throws SCHEMA for extra top-level keys', () => {
    try {
      validateAndBuildBulkDeleteItems({ uids: ['x'], other: 1 }, locale, pathLabel);
      expect.fail('expected LoadAssetUidsError');
    } catch (e: unknown) {
      expect(e).to.be.instanceOf(LoadAssetUidsError);
      expect((e as LoadAssetUidsError).kind).to.equal('SCHEMA');
    }
  });

  it('throws SCHEMA for empty uids array', () => {
    try {
      validateAndBuildBulkDeleteItems({ uids: [] }, locale, pathLabel);
      expect.fail('expected LoadAssetUidsError');
    } catch (e: unknown) {
      expect(e).to.be.instanceOf(LoadAssetUidsError);
      expect((e as LoadAssetUidsError).kind).to.equal('SCHEMA');
    }
  });

  it('throws SCHEMA for empty string uid', () => {
    try {
      validateAndBuildBulkDeleteItems({ uids: ['ok', ''] }, locale, pathLabel);
      expect.fail('expected LoadAssetUidsError');
    } catch (e: unknown) {
      expect(e).to.be.instanceOf(LoadAssetUidsError);
      expect((e as LoadAssetUidsError).kind).to.equal('SCHEMA');
    }
  });

  it('throws SCHEMA when uid entry is not a string', () => {
    try {
      validateAndBuildBulkDeleteItems({ uids: ['x', null] }, locale, pathLabel);
      expect.fail('expected LoadAssetUidsError');
    } catch (e: unknown) {
      expect(e).to.be.instanceOf(LoadAssetUidsError);
      expect((e as LoadAssetUidsError).kind).to.equal('SCHEMA');
    }
  });
});

describe('loadAssetUidsFromFile', () => {
  /** Paths under POSIX `/tmp` use real mkdir/write despite test/helpers/fs mocks. */
  it('loads file from /tmp and returns uids', () => {
    const dir = join('/tmp', `cli-bulk-am-uids-${Date.now()}-${process.pid}`);
    mkdirSync(dir, { recursive: true });
    const p = join(dir, 'uids.json');
    writeFileSync(p, JSON.stringify({ uids: ['uid1'] }), 'utf8');
    try {
      const out = loadAssetUidsFromFile(p);
      expect(out).to.deep.equal(['uid1']);
    } finally {
      try {
        unlinkSync(p);
      } catch {
        /* ignore */
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws PARSE for invalid JSON in file under /tmp', () => {
    const dir = join('/tmp', `cli-bulk-am-uids-parse-${Date.now()}-${process.pid}`);
    mkdirSync(dir, { recursive: true });
    const p = join(dir, 'bad.json');
    writeFileSync(p, '{ not json', 'utf8');
    try {
      loadAssetUidsFromFile(p);
      expect.fail('expected LoadAssetUidsError');
    } catch (e: unknown) {
      expect(e).to.be.instanceOf(LoadAssetUidsError);
      expect((e as LoadAssetUidsError).kind).to.equal('PARSE');
    } finally {
      try {
        unlinkSync(p);
      } catch {
        /* ignore */
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws READ for missing absolute path', () => {
    const p = join('/tmp', `cli-bulk-am-uids-nonexistent-${Date.now()}-${process.pid}`, 'ghost.json');
    try {
      loadAssetUidsFromFile(p);
      expect.fail('expected LoadAssetUidsError');
    } catch (e: unknown) {
      expect(e).to.be.instanceOf(LoadAssetUidsError);
      expect((e as LoadAssetUidsError).kind).to.equal('READ');
    }
  });
});

describe('loadBulkDeleteItemsFromFile', () => {
  const locale = 'en-us';

  it('loads file from /tmp and returns bulk delete rows', () => {
    const dir = join('/tmp', `cli-bulk-am-delete-${Date.now()}-${process.pid}`);
    mkdirSync(dir, { recursive: true });
    const p = join(dir, 'uids.json');
    writeFileSync(p, JSON.stringify({ uids: ['u1', 'u2'] }), 'utf8');
    try {
      const out = loadBulkDeleteItemsFromFile(p, locale);
      expect(out).to.deep.equal([
        { uid: 'u1', locale },
        { uid: 'u2', locale },
      ]);
    } finally {
      try {
        unlinkSync(p);
      } catch {
        /* ignore */
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
