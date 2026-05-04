import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { rebuildContentTypesSchemaJson, readContentTypesFromExportDir } from '../../src/utils/read-content-type-schemas';

describe('read-content-type-schemas', () => {
  describe('rebuildContentTypesSchemaJson', () => {
    let tmp: string;

    beforeEach(() => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qe-ctschema-'));
    });

    afterEach(() => {
      if (tmp && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('merges all per-UID JSON files into schema.json', () => {
      fs.writeFileSync(path.join(tmp, 'a.json'), JSON.stringify({ uid: 'a', title: 'A', schema: [] }));
      fs.writeFileSync(path.join(tmp, 'b.json'), JSON.stringify({ uid: 'b', title: 'B', schema: [] }));
      fs.writeFileSync(path.join(tmp, 'schema.json'), JSON.stringify([{ uid: 'stale', schema: [] }]));

      rebuildContentTypesSchemaJson(tmp);

      const merged = readContentTypesFromExportDir(tmp);
      const uids = merged.map((x: { uid: string }) => x.uid).sort();
      expect(uids).to.deep.equal(['a', 'b']);
    });

    it('dedupes by uid when the same uid appears twice', () => {
      fs.writeFileSync(path.join(tmp, 'x.json'), JSON.stringify({ uid: 'same', title: 'first', schema: [] }));
      fs.writeFileSync(path.join(tmp, 'y.json'), JSON.stringify({ uid: 'same', title: 'second', schema: [] }));

      rebuildContentTypesSchemaJson(tmp);

      const merged = readContentTypesFromExportDir(tmp);
      expect(merged).to.have.lengthOf(1);
      expect((merged[0] as { title: string }).title).to.equal('second');
    });

    it('ignores non-object or missing uid files', () => {
      fs.writeFileSync(path.join(tmp, 'bad.json'), JSON.stringify([1, 2]));
      fs.writeFileSync(path.join(tmp, 'good.json'), JSON.stringify({ uid: 'good', schema: [] }));

      rebuildContentTypesSchemaJson(tmp);

      const merged = readContentTypesFromExportDir(tmp);
      expect(merged.map((x: { uid: string }) => x.uid)).to.deep.equal(['good']);
    });
  });
});
