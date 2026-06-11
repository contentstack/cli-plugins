import { expect } from 'chai';
import sinon from 'sinon';
import { configHandler } from '@contentstack/cli-utilities';

import ExportAssets from '../../../src/export/assets';
import { CSAssetsExportAdapter } from '../../../src/export/base';
import * as chunkedJsonReader from '../../../src/utils/chunked-json-reader';
import * as retryModule from '../../../src/utils/retry';

import type { CSAssetsAPIConfig, LinkedWorkspace } from '../../../src/types/cs-assets-api';
import type { ExportContext } from '../../../src/types/export-types';

const foldersData = [{ uid: 'folder-1', name: 'Images' }];
const assetItems = [
  { uid: 'a1', url: 'https://cdn.example.com/a1.png', filename: 'image.png' },
  { uid: 'a2', url: 'https://cdn.example.com/a2.pdf', file_name: 'doc.pdf' },
];
const ASSET_META_KEYS = ['uid', 'url', 'filename', 'file_name', 'parent_uid'];

describe('ExportAssets', () => {
  const apiConfig: CSAssetsAPIConfig = { baseURL: 'https://am.example.com', headers: { organization_uid: 'org-1' } };
  const exportContext: ExportContext = { spacesRootPath: '/tmp/export/spaces' };
  const workspace: LinkedWorkspace = { uid: 'ws-1', space_uid: 'space-uid-1', is_default: true };
  const spaceDir = '/tmp/export/spaces/space-uid-1';

  let fetchStub: sinon.SinonStub;
  let writerStub: { writeIntoFile: sinon.SinonStub; completeFile: sinon.SinonStub };
  let createWriterStub: sinon.SinonStub;

  const makeFetchResponse = () => {
    const webStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('file-content'));
        controller.close();
      },
    });
    return { ok: true, status: 200, body: webStream };
  };

  /**
   * Wire the streaming flow without real pagination or disk: `streamWorkspaceAssets` feeds `items`
   * through the `onPage` sink, and the download read-back (`forEachChunkedJsonStore`) yields the
   * same `items` back as one chunk (or signals empty).
   */
  const wireStreaming = (items: Array<Record<string, unknown>>) => {
    sinon.stub(ExportAssets.prototype, 'getWorkspaceFolders').resolves(foldersData as any);
    sinon
      .stub(ExportAssets.prototype, 'streamWorkspaceAssets')
      .callsFake(async (_s: string, _ws: string | undefined, onPage: (i: unknown[]) => void | Promise<void>) => {
        await onPage(items);
        return items.length;
      });
    sinon
      .stub(chunkedJsonReader, 'forEachChunkedJsonStore')
      .callsFake(async (_base: string, _idx: string, opts: any, onChunk: (records: unknown[]) => Promise<void>) => {
        if (items.length === 0) {
          opts.onEmptyIndexer();
          return;
        }
        await onChunk(items);
      });
  };

  beforeEach(() => {
    sinon.stub(CSAssetsExportAdapter.prototype, 'init' as any).resolves();
    sinon.stub(CSAssetsExportAdapter.prototype, 'tick' as any);
    sinon.stub(CSAssetsExportAdapter.prototype, 'updateStatus' as any);
    sinon.stub(CSAssetsExportAdapter.prototype, 'writeEmptyChunkedJson' as any).resolves();
    writerStub = { writeIntoFile: sinon.stub(), completeFile: sinon.stub() };
    createWriterStub = sinon.stub(CSAssetsExportAdapter.prototype, 'createChunkedJsonWriter' as any).returns(writerStub);
    // Run the retry wrapper inline (single attempt, no backoff) so tests don't wait on real delays.
    sinon.stub(retryModule, 'withRetry').callsFake(async (fn: () => Promise<unknown>) => fn());
    fetchStub = sinon.stub(globalThis, 'fetch');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('concurrency config', () => {
    it('should use fallback download concurrency when not configured', () => {
      const exporter = new ExportAssets(apiConfig, exportContext);
      expect((exporter as any).downloadAssetsBatchConcurrency).to.equal(5);
    });

    it('should use configured download concurrency when provided', () => {
      const exporter = new ExportAssets(apiConfig, { ...exportContext, downloadAssetsConcurrency: 2 });
      expect((exporter as any).downloadAssetsBatchConcurrency).to.equal(2);
    });
  });

  describe('start method', () => {
    it('should fetch folders and stream assets using the workspace space_uid', async () => {
      wireStreaming([]);
      const exporter = new ExportAssets(apiConfig, exportContext);
      await exporter.start(workspace, spaceDir);

      const foldersStub = ExportAssets.prototype.getWorkspaceFolders as sinon.SinonStub;
      const streamStub = ExportAssets.prototype.streamWorkspaceAssets as sinon.SinonStub;
      expect(foldersStub.firstCall.args[0]).to.equal(workspace.space_uid);
      expect(streamStub.firstCall.args[0]).to.equal(workspace.space_uid);
    });

    it('should stream asset metadata into a chunked-JSON writer', async () => {
      wireStreaming(assetItems);
      fetchStub.callsFake(async () => makeFetchResponse() as any);

      const exporter = new ExportAssets(apiConfig, exportContext);
      await exporter.start(workspace, spaceDir);

      expect(createWriterStub.firstCall.args[1]).to.equal('assets.json');
      expect(createWriterStub.firstCall.args[2]).to.equal('assets');
      expect(createWriterStub.firstCall.args[3]).to.deep.equal(ASSET_META_KEYS);
      expect(writerStub.writeIntoFile.firstCall.args[0]).to.have.length(2);
      expect(writerStub.completeFile.calledOnceWith(true)).to.be.true;
    });

    it('should write an empty index (no writer) when there are no assets', async () => {
      wireStreaming([]);
      const exporter = new ExportAssets(apiConfig, exportContext);
      await exporter.start(workspace, spaceDir);

      expect(createWriterStub.called).to.be.false;
      expect((CSAssetsExportAdapter.prototype as any).writeEmptyChunkedJson.calledOnce).to.be.true;
    });

    it('should not attempt any downloads when the asset list is empty', async () => {
      wireStreaming([]);
      const exporter = new ExportAssets(apiConfig, exportContext);
      await exporter.start(workspace, spaceDir);

      expect(fetchStub.callCount).to.equal(0);
      const tickStub = (CSAssetsExportAdapter.prototype as any).tick as sinon.SinonStub;
      const assetTicks = tickStub.getCalls().filter((c) => String(c.args[1]).startsWith('asset:'));
      expect(assetTicks).to.have.length(0);
    });

    it('should tick per failed asset with success=false and the error on download failure', async () => {
      wireStreaming(assetItems);
      fetchStub.rejects(new Error('network failure'));

      const exporter = new ExportAssets(apiConfig, exportContext);
      await exporter.start(workspace, spaceDir);

      const tickStub = (CSAssetsExportAdapter.prototype as any).tick as sinon.SinonStub;
      const assetTicks = tickStub.getCalls().filter((c) => String(c.args[1]).startsWith('asset:'));
      expect(assetTicks.length).to.be.greaterThan(0);
      for (const t of assetTicks) {
        expect(t.args[0]).to.be.false;
        expect(String(t.args[2])).to.include('network failure');
      }
    });

    it('should tick per asset with success=true and null error on successful downloads', async () => {
      wireStreaming(assetItems);
      fetchStub.callsFake(async () => makeFetchResponse() as any);

      const exporter = new ExportAssets(apiConfig, exportContext);
      await exporter.start(workspace, spaceDir);

      const tickStub = (CSAssetsExportAdapter.prototype as any).tick as sinon.SinonStub;
      const assetTicks = tickStub.getCalls().filter((c) => String(c.args[1]).startsWith('asset:'));
      expect(assetTicks).to.have.length(assetItems.length);
      for (const t of assetTicks) {
        expect(t.args[0]).to.be.true;
        expect(t.args[2]).to.be.null;
      }
    });

    it('should skip assets that have neither a url nor a uid', async () => {
      wireStreaming([
        { uid: 'a1', url: null },
        { url: 'https://cdn.example.com/a2.png', filename: 'img.png' },
        { uid: null, url: null },
      ] as any);
      const exporter = new ExportAssets(apiConfig, exportContext);
      await exporter.start(workspace, spaceDir);

      expect(fetchStub.callCount).to.equal(0);
    });

    it('should process assets that have _uid instead of uid without skipping them', async () => {
      wireStreaming([{ _uid: 'a-uid', url: 'https://cdn.example.com/a.png', filename: 'a.png' }] as any);
      fetchStub.callsFake(async () => makeFetchResponse() as any);

      const exporter = new ExportAssets(apiConfig, exportContext);
      await exporter.start(workspace, spaceDir);

      expect(fetchStub.firstCall.args[0]).to.equal('https://cdn.example.com/a.png');
      const tickStub = (CSAssetsExportAdapter.prototype as any).tick as sinon.SinonStub;
      const assetTicks = tickStub.getCalls().filter((c) => String(c.args[1]).startsWith('asset:'));
      expect(assetTicks).to.have.length(1);
      expect(assetTicks[0].args[0]).to.be.true;
    });

    it('should download assets that use file_name, and fall back to "asset" when both names are absent', async () => {
      wireStreaming([
        { uid: 'a1', url: 'https://cdn.example.com/a1.pdf', file_name: 'named.pdf' },
        { uid: 'a2', url: 'https://cdn.example.com/a2.bin' },
      ] as any);
      fetchStub.callsFake(async () => makeFetchResponse() as any);

      const exporter = new ExportAssets(apiConfig, exportContext);
      await exporter.start(workspace, spaceDir);

      expect(fetchStub.callCount).to.equal(2);
      const urls = fetchStub.getCalls().map((c) => c.args[0]).sort();
      expect(urls).to.deep.equal(['https://cdn.example.com/a1.pdf', 'https://cdn.example.com/a2.bin']);
    });

    it('should append authtoken to URL when securedAssets is true', async () => {
      sinon.stub(configHandler, 'get').returns('my-auth-token');
      wireStreaming([{ uid: 'a1', url: 'https://cdn.example.com/a1.png', filename: 'img.png' }] as any);
      fetchStub.callsFake(async () => makeFetchResponse() as any);

      const exporter = new ExportAssets(apiConfig, { ...exportContext, securedAssets: true });
      await exporter.start(workspace, spaceDir);

      expect(String(fetchStub.firstCall.args[0])).to.include('authtoken=my-auth-token');
    });

    it('should use "&" separator when URL already contains "?"', async () => {
      sinon.stub(configHandler, 'get').returns('my-token');
      wireStreaming([{ uid: 'a1', url: 'https://cdn.example.com/a1?v=1', filename: 'img.png' }] as any);
      fetchStub.callsFake(async () => makeFetchResponse() as any);

      const exporter = new ExportAssets(apiConfig, { ...exportContext, securedAssets: true });
      await exporter.start(workspace, spaceDir);

      expect(String(fetchStub.firstCall.args[0])).to.include('?v=1&authtoken=');
    });

    it('should tick with success=false and the HTTP status code on non-ok response', async () => {
      wireStreaming([{ uid: 'a1', url: 'https://cdn.example.com/a1.png', filename: 'img.png' }] as any);
      fetchStub.resolves({ ok: false, status: 403, body: null } as any);

      const exporter = new ExportAssets(apiConfig, exportContext);
      await exporter.start(workspace, spaceDir);

      const tickStub = (CSAssetsExportAdapter.prototype as any).tick as sinon.SinonStub;
      const assetTicks = tickStub.getCalls().filter((c) => String(c.args[1]).startsWith('asset:'));
      expect(assetTicks).to.have.length(1);
      expect(assetTicks[0].args[0]).to.be.false;
      expect(String(assetTicks[0].args[2])).to.include('403');
    });

    it('should tick with success=false and "No response body" when body is null', async () => {
      wireStreaming([{ uid: 'a1', url: 'https://cdn.example.com/a1.png', filename: 'img.png' }] as any);
      fetchStub.resolves({ ok: true, status: 200, body: null } as any);

      const exporter = new ExportAssets(apiConfig, exportContext);
      await exporter.start(workspace, spaceDir);

      const tickStub = (CSAssetsExportAdapter.prototype as any).tick as sinon.SinonStub;
      const assetTicks = tickStub.getCalls().filter((c) => String(c.args[1]).startsWith('asset:'));
      expect(assetTicks).to.have.length(1);
      expect(assetTicks[0].args[0]).to.be.false;
      expect(assetTicks[0].args[2]).to.equal('No response body');
    });
  });
});
