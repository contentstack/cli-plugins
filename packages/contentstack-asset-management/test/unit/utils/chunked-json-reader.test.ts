import { expect } from 'chai';
import sinon from 'sinon';
import * as os from 'os';
import * as fsReal from 'fs';
import * as path from 'path';
import { FsUtility } from '@contentstack/cli-utilities';

import { forEachChunkedJsonStore, forEachChunkRecordsFromFs } from '../../../src/utils/chunked-json-reader';

describe('chunked-json-reader', () => {
  afterEach(() => sinon.restore());

  const makeFakeFs = (indexer: Record<string, unknown>, chunks: unknown[]): FsUtility => {
    let idx = 0;
    return {
      indexFileContent: indexer,
      readChunkFiles: { next: async () => chunks[idx++] ?? null },
      getPlainMeta: () => ({}),
    } as unknown as FsUtility;
  };

  describe('forEachChunkRecordsFromFs', () => {
    it('does nothing when indexer is empty', async () => {
      const onChunk = sinon.stub();
      await forEachChunkRecordsFromFs(makeFakeFs({}, []), { chunkReadLogLabel: 'test' }, onChunk);
      expect(onChunk.callCount).to.equal(0);
    });

    it('calls onChunk with Object.values of each chunk record', async () => {
      const r1 = { uid: 'uid-1', url: 'https://a.com' };
      const r2 = { uid: 'uid-2', url: 'https://b.com' };
      const collected: unknown[] = [];
      await forEachChunkRecordsFromFs(
        makeFakeFs({ '0': true }, [{ 'uid-1': r1, 'uid-2': r2 }]),
        { chunkReadLogLabel: 'assets' },
        async (records) => { collected.push(...records); },
      );
      expect(collected).to.deep.equal([r1, r2]);
    });

    it('processes multiple chunks in order', async () => {
      const order: string[] = [];
      await forEachChunkRecordsFromFs(
        makeFakeFs({ '0': true, '1': true }, [
          { 'uid-A': { uid: 'uid-A' } },
          { 'uid-B': { uid: 'uid-B' } },
        ]),
        { chunkReadLogLabel: 'test' },
        async (records: any[]) => { order.push(...records.map((r) => r.uid)); },
      );
      expect(order).to.deep.equal(['uid-A', 'uid-B']);
    });

    it('skips a chunk when readChunkFiles.next() rejects', async () => {
      const onChunk = sinon.stub();
      const fakeFs = {
        indexFileContent: { '0': true },
        readChunkFiles: { next: sinon.stub().rejects(new Error('disk error')) },
      } as unknown as FsUtility;
      await forEachChunkRecordsFromFs(fakeFs, { chunkReadLogLabel: 'test' }, onChunk);
      expect(onChunk.callCount).to.equal(0);
    });

    it('skips null chunks returned by readChunkFiles', async () => {
      const onChunk = sinon.stub();
      await forEachChunkRecordsFromFs(
        makeFakeFs({ '0': true }, [null]),
        { chunkReadLogLabel: 'test' },
        onChunk,
      );
      expect(onChunk.callCount).to.equal(0);
    });
  });

  describe('forEachChunkedJsonStore', () => {
    it('calls onOpenError and does not call onEmptyIndexer or onChunk when FsUtility constructor throws', async () => {
      sinon.stub(FsUtility.prototype, 'indexFileContent' as any).get(() => {
        throw new Error('constructor error');
      });
      const onOpenError = sinon.stub();
      const onEmptyIndexer = sinon.stub();
      const onChunk = sinon.stub();

      await forEachChunkedJsonStore(
        '/nonexistent/path',
        'index.json',
        { chunkReadLogLabel: 'test', onOpenError, onEmptyIndexer },
        onChunk,
      );

      expect(onOpenError.callCount).to.equal(1);
      expect(onEmptyIndexer.callCount).to.equal(0);
      expect(onChunk.callCount).to.equal(0);
    });

    it('calls onEmptyIndexer when the index file exists but has no entries', async () => {
      const tmpDir = path.join(os.tmpdir(), `cjr-empty-${Date.now()}`);
      fsReal.mkdirSync(tmpDir, { recursive: true });
      fsReal.writeFileSync(path.join(tmpDir, 'index.json'), '{}');

      const onOpenError = sinon.stub();
      const onEmptyIndexer = sinon.stub();
      const onChunk = sinon.stub();

      await forEachChunkedJsonStore(
        tmpDir,
        'index.json',
        { chunkReadLogLabel: 'test', onOpenError, onEmptyIndexer },
        onChunk,
      );

      expect(onEmptyIndexer.callCount).to.equal(1);
      expect(onChunk.callCount).to.equal(0);
    });

    it('calls onChunk with records when the index has entries', async () => {
      const tmpDir = path.join(os.tmpdir(), `cjr-chunks-${Date.now()}`);
      fsReal.mkdirSync(tmpDir, { recursive: true });
      fsReal.writeFileSync(path.join(tmpDir, 'index.json'), '{"0": true}');

      const record = { uid: 'field-1', name: 'My Field' };
      sinon.stub(FsUtility.prototype, 'indexFileContent' as any).get(() => ({ '0': true }));
      sinon.stub(FsUtility.prototype, 'readChunkFiles' as any).get(() => ({
        next: sinon.stub().resolves({ 'field-1': record }),
      }));

      const onOpenError = sinon.stub();
      const onEmptyIndexer = sinon.stub();
      const collected: unknown[] = [];

      await forEachChunkedJsonStore(
        tmpDir,
        'index.json',
        { chunkReadLogLabel: 'fields', onOpenError, onEmptyIndexer },
        async (records) => { collected.push(...records); },
      );

      expect(onOpenError.callCount).to.equal(0);
      expect(onEmptyIndexer.callCount).to.equal(0);
      expect(collected).to.deep.equal([record]);
    });
  });
});
