import { expect } from 'chai';
import sinon from 'sinon';
import * as fs from 'node:fs/promises';
import { resolve as pResolve } from 'node:path';
import { tmpdir } from 'node:os';
import { HttpClient, authenticationHandler } from '@contentstack/cli-utilities';

import { CsAssetsQueryExporter } from '../../../src/query-export/cs-assets-query-exporter';
import ExportAssetTypes from '../../../src/export/asset-types';
import ExportFields from '../../../src/export/fields';
import { CSAssetsExportAdapter } from '../../../src/export/base';
import { CSAssetsAdapter } from '../../../src/utils/cs-assets-api-adapter';
import * as retryModule from '../../../src/utils/retry';

import type { CsAssetsQueryExportOptions } from '../../../src/types/cs-assets-api';

describe('CsAssetsQueryExporter', () => {
  let exportDir: string;
  let searchAssetsStub: sinon.SinonStub;
  const baseOptions: CsAssetsQueryExportOptions = {
    linkedWorkspaces: [{ uid: 'main', space_uid: 'space-1', is_default: true }],
    exportDir: '',
    branchName: 'main',
    csAssetsUrl: 'https://am.example.com',
    org_uid: 'org-1',
    context: { command: 'export-query' },
    assetBatchSize: 2,
  };

  beforeEach(async () => {
    exportDir = await fs.mkdtemp(pResolve(tmpdir(), 'cs-assets-query-export-'));
    baseOptions.exportDir = exportDir;

    sinon.stub(ExportFields.prototype, 'start').resolves();
    sinon.stub(ExportAssetTypes.prototype, 'start').resolves();
    sinon.stub(CSAssetsExportAdapter.prototype, 'init').resolves();
    sinon.stub(CSAssetsExportAdapter.prototype, 'getSpace').resolves({
      space: { uid: 'space-1', title: 'Test Space' },
    });
    searchAssetsStub = sinon.stub(CSAssetsExportAdapter.prototype, 'searchAssets').resolves({
      count: 2,
      relation: 'eq',
      results: [
        { uid: 'asset-1', url: 'https://cdn.example.com/a1.png', file_name: 'a1.png', is_dir: false },
        { uid: 'asset-2', url: 'https://cdn.example.com/a2.png', file_name: 'a2.png', is_dir: false },
      ],
    });
    sinon.stub(CSAssetsExportAdapter.prototype as any, 'writeItemsToChunkedJson').resolves();
    // Downloads now run through makeConcurrentCall; fake it by invoking the
    // promisifyHandler synchronously over each element of every apiBatch.
    sinon.stub(CSAssetsAdapter.prototype, 'makeConcurrentCall').callsFake(async (env: any, handler: any) => {
      const batches = env?.apiBatches ?? [];
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        for (let index = 0; index < batches[batchIndex].length; index++) {
          if (handler) await handler({ index, batchIndex, isLastRequest: false });
        }
      }
    });
    // Run the download retry wrapper inline (single attempt, no backoff) and serve a fake binary
    // so download attempts don't hit the network or wait on real retry delays.
    sinon.stub(retryModule, 'withRetry').callsFake(async (fn: () => Promise<unknown>) => fn());
    sinon.stub(globalThis, 'fetch').callsFake(
      async () =>
        ({
          ok: true,
          status: 200,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('x'));
              controller.close();
            },
          }),
        }) as any,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should return early when no asset UIDs are provided', async () => {
    const exporter = new CsAssetsQueryExporter(baseOptions);
    await exporter.export([]);

    expect((ExportFields.prototype.start as sinon.SinonStub).called).to.be.false;
  });

  it('should bootstrap shared fields and asset types', async () => {
    const exporter = new CsAssetsQueryExporter(baseOptions);
    await exporter.export(['asset-1']);

    expect((ExportFields.prototype.start as sinon.SinonStub).calledOnceWith('space-1')).to.be.true;
    expect((ExportAssetTypes.prototype.start as sinon.SinonStub).calledOnceWith('space-1')).to.be.true;
  });

  it('should call searchAssets with batched UIDs and space reference', async () => {
    const exporter = new CsAssetsQueryExporter(baseOptions);
    await exporter.export(['asset-1', 'asset-2', 'asset-3']);

    expect(searchAssetsStub.called).to.be.true;
    const firstCall = searchAssetsStub.getCall(0).args[0];
    expect(firstCall.spaces).to.deep.equal([{ space_uid: 'space-1', workspace: 'main' }]);
    expect(firstCall.assetUIDs).to.deep.equal(['asset-1', 'asset-2']);
  });

  it('should write space metadata and asset files under spaces/', async () => {
    const exporter = new CsAssetsQueryExporter(baseOptions);
    await exporter.export(['asset-1']);

    const metadataPath = pResolve(exportDir, 'spaces', 'space-1', 'metadata.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    expect(metadata.uid).to.equal('space-1');
    expect(metadata.workspace_uid).to.equal('main');

    const foldersPath = pResolve(exportDir, 'spaces', 'space-1', 'assets', 'folders.json');
    const folders = JSON.parse(await fs.readFile(foldersPath, 'utf-8'));
    expect(folders).to.be.an('array').that.is.empty;
  });
});

describe('CSAssetsAdapter.searchAssets', () => {
  const baseConfig = {
    baseURL: 'https://am.example.com',
    headers: { organization_uid: 'org-1' },
  };

  let fetchStub: sinon.SinonStub;

  beforeEach(() => {
    sinon.stub(HttpClient.prototype, 'headers').returnsThis();
    sinon.stub(HttpClient.prototype, 'baseUrl').returnsThis();
    sinon.stub(authenticationHandler, 'getAuthDetails').resolves();
    sinon.stub(authenticationHandler, 'isOauthEnabled').get(() => false);
    sinon.stub(authenticationHandler, 'accessToken').get(() => 'test-token');

    fetchStub = sinon.stub(global, 'fetch').resolves({
      ok: true,
      json: async () => ({ count: 1, assets: [{ uid: 'a1' }] }),
    } as Response);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should POST to /api/search with $and-wrapped uid $in query and required fields', async () => {
    const adapter = new CSAssetsAdapter(baseConfig);
    await adapter.searchAssets({
      assetUIDs: ['uid-1', 'uid-2'],
      spaces: [{ space_uid: 'space-1', workspace: 'main' }],
      skip: 0,
      limit: 50,
    });

    expect(fetchStub.calledOnce).to.be.true;
    const [url, init] = fetchStub.firstCall.args;
    expect(url).to.equal('https://am.example.com/api/search');
    expect(init.method).to.equal('POST');
    const body = JSON.parse(init.body);
    expect(body.query).to.deep.equal({ $and: [{ uid: { $in: ['uid-1', 'uid-2'] } }] });
    expect(body.object_type).to.equal('asset');
    expect(body.desc).to.equal('updated_at');
    expect(body.search_text).to.equal('');
    expect(body.search_field).to.equal('all');
    expect(body.search_terms_operator).to.equal('or');
    expect(body.spaces).to.deep.equal([{ space_uid: 'space-1', workspace: 'main' }]);
  });

  it('should return empty result when assetUIDs is empty', async () => {
    const adapter = new CSAssetsAdapter(baseConfig);
    const result = await adapter.searchAssets({
      assetUIDs: [],
      spaces: [{ space_uid: 'space-1', workspace: 'main' }],
    });

    expect(fetchStub.called).to.be.false;
    expect(result).to.deep.equal({ count: 0, assets: [] });
  });
});
