import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isDirectoryNonEmpty } from '../../../src/utils/file-helper';

describe('isDirectoryNonEmpty', () => {
  it('returns false for empty string', () => {
    expect(isDirectoryNonEmpty('')).to.be.false;
  });

  it('returns false when path does not exist', () => {
    expect(isDirectoryNonEmpty(path.join(os.tmpdir(), `missing-${Date.now()}-${Math.random()}`))).to.be.false;
  });

  it('returns false when directory is empty', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-dir-'));
    try {
      expect(isDirectoryNonEmpty(dir)).to.be.false;
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it('returns true when directory has an entry', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nonempty-dir-'));
    fs.writeFileSync(path.join(dir, 'a.txt'), 'x');
    try {
      expect(isDirectoryNonEmpty(dir)).to.be.true;
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it('returns false when path is a file', () => {
    const f = path.join(os.tmpdir(), `file-only-${Date.now()}.txt`);
    fs.writeFileSync(f, 'x');
    try {
      expect(isDirectoryNonEmpty(f)).to.be.false;
    } finally {
      fs.unlinkSync(f);
    }
  });
});
