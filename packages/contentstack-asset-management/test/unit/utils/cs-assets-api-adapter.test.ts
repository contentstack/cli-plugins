import { expect } from 'chai';
import sinon from 'sinon';
import { HttpClient, authenticationHandler } from '@contentstack/cli-utilities';

import { CSAssetsAdapter } from '../../../src/utils/cs-assets-api-adapter';

import type { CSAssetsAPIConfig } from '../../../src/types/cs-assets-api';

describe('CSAssetsAdapter', () => {
  const baseConfig: CSAssetsAPIConfig = {
    baseURL: 'https://am.example.com',
    headers: { organization_uid: 'org-1' },
  };

  let headersStub: sinon.SinonStub;
  let baseUrlStub: sinon.SinonStub;
  let getStub: sinon.SinonStub;

  beforeEach(() => {
    headersStub = sinon.stub(HttpClient.prototype, 'headers').returnsThis();
    baseUrlStub = sinon.stub(HttpClient.prototype, 'baseUrl').returnsThis();
    getStub = sinon.stub(HttpClient.prototype, 'get');
    sinon.stub(authenticationHandler, 'getAuthDetails').resolves();
    sinon.stub(authenticationHandler, 'isOauthEnabled').get(() => false);
    sinon.stub(authenticationHandler, 'accessToken').get(() => 'test-token-123');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('should set the baseURL with trailing slash stripped', () => {
      new CSAssetsAdapter({ baseURL: 'https://am.example.com/' });
      expect(baseUrlStub.firstCall.args[0]).to.equal('https://am.example.com');
    });

    it('should set default headers with x-cs-api-version when no extra headers provided', () => {
      new CSAssetsAdapter({ baseURL: 'https://am.example.com' });
      const allHeaderArgs = headersStub.getCalls().map((c) => c.args[0]);
      const apiVersionCall = allHeaderArgs.find((h) => 'x-cs-api-version' in h);
      expect(apiVersionCall).to.exist;
      expect(apiVersionCall['x-cs-api-version']).to.equal('4');
      expect(apiVersionCall['Accept']).to.equal('application/json');
    });

    it('should merge extra headers with default headers', () => {
      new CSAssetsAdapter(baseConfig);
      const allHeaderArgs = headersStub.getCalls().map((c) => c.args[0]);
      const apiVersionCall = allHeaderArgs.find((h) => 'x-cs-api-version' in h);
      expect(apiVersionCall).to.exist;
      expect(apiVersionCall['x-cs-api-version']).to.equal('4');
      expect(apiVersionCall['organization_uid']).to.equal('org-1');
    });

    it('should handle empty baseURL gracefully', () => {
      new CSAssetsAdapter({ baseURL: '' });
      expect(baseUrlStub.firstCall.args[0]).to.equal('');
    });
  });

  describe('init', () => {
    it('should set access_token header when OAuth is disabled', async () => {
      const adapter = new CSAssetsAdapter(baseConfig);
      await adapter.init();

      const authCallArgs = headersStub.getCalls().map((c) => c.args[0]);
      const authCall = authCallArgs.find((a) => 'access_token' in a);
      expect(authCall).to.exist;
      expect(authCall.access_token).to.equal('test-token-123');
    });

    describe('when OAuth is enabled', () => {
      beforeEach(() => {
        sinon.restore();
        sinon.stub(HttpClient.prototype, 'headers').returnsThis();
        sinon.stub(HttpClient.prototype, 'baseUrl').returnsThis();
        sinon.stub(HttpClient.prototype, 'get');
        sinon.stub(authenticationHandler, 'getAuthDetails').resolves();
        sinon.stub(authenticationHandler, 'isOauthEnabled').get(() => true);
        sinon.stub(authenticationHandler, 'accessToken').get(() => 'oauth-bearer-token');
      });

      it('should set authorization header', async () => {
        const capturedHeaders = HttpClient.prototype.headers as sinon.SinonStub;
        const adapter = new CSAssetsAdapter(baseConfig);
        await adapter.init();

        const authCallArgs = capturedHeaders.getCalls().map((c) => c.args[0]);
        const authCall = authCallArgs.find((a: any) => 'authorization' in a);
        expect(authCall).to.exist;
        expect(authCall.authorization).to.equal('oauth-bearer-token');
      });
    });

    it('should re-throw errors from getAuthDetails', async () => {
      (authenticationHandler.getAuthDetails as sinon.SinonStub).rejects(new Error('auth-failed'));
      const adapter = new CSAssetsAdapter(baseConfig);

      try {
        await adapter.init();
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.message).to.equal('auth-failed');
      }
    });

    it('should merge config headers with auth header when config.headers is present', async () => {
      const adapter = new CSAssetsAdapter(baseConfig);
      await adapter.init();

      const capturedHeaders = headersStub.getCalls().map((c) => c.args[0]);
      const authCall = capturedHeaders.find((a) => 'access_token' in a);
      expect(authCall).to.include({ organization_uid: 'org-1' });
    });
  });

  describe('getSpace', () => {
    it('should GET /api/spaces/{spaceUid}?addl_fields=... and return the space', async () => {
      getStub.resolves({ status: 200, data: { space: { uid: 'sp-1' } } });
      const adapter = new CSAssetsAdapter(baseConfig);
      const result = await adapter.getSpace('sp-1');

      const path = getStub.firstCall.args[0] as string;
      expect(path).to.include('/api/spaces/sp-1');
      expect(path).to.include('addl_fields');
      expect(result).to.deep.equal({ space: { uid: 'sp-1' } });
    });

    it('should throw when response status is non-2xx', async () => {
      getStub.resolves({ status: 404, data: null });
      const adapter = new CSAssetsAdapter(baseConfig);

      try {
        await adapter.getSpace('missing-space');
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.message).to.include('404');
      }
    });
  });

  describe('getWorkspaceFields', () => {
    it('should GET /api/fields and return the response data', async () => {
      const fieldsResponse = { count: 1, relation: 'org', fields: [{ uid: 'f1' }] };
      getStub.resolves({ status: 200, data: fieldsResponse });
      const adapter = new CSAssetsAdapter(baseConfig);
      const result = await adapter.getWorkspaceFields('sp-1');

      expect(getStub.firstCall.args[0]).to.equal('/api/fields');
      expect(result).to.deep.equal(fieldsResponse);
    });
  });

  describe('getWorkspaceAssets', () => {
    it('should GET /api/spaces/{spaceUid}/assets', async () => {
      getStub.resolves({ status: 200, data: { items: [] } });
      const adapter = new CSAssetsAdapter(baseConfig);
      await adapter.getWorkspaceAssets('sp-1');

      expect(getStub.firstCall.args[0]).to.include('/api/spaces/sp-1/assets');
    });

    it('should URL-encode the spaceUid in the path', async () => {
      getStub.resolves({ status: 200, data: { items: [] } });
      const adapter = new CSAssetsAdapter(baseConfig);
      await adapter.getWorkspaceAssets('sp uid/special');

      const path = getStub.firstCall.args[0] as string;
      expect(path).to.include('sp%20uid%2Fspecial');
    });
  });

  describe('getWorkspaceFolders', () => {
    it('should GET /api/spaces/{spaceUid}/folders', async () => {
      getStub.resolves({ status: 200, data: [] });
      const adapter = new CSAssetsAdapter(baseConfig);
      await adapter.getWorkspaceFolders('sp-1');

      expect(getStub.firstCall.args[0]).to.include('/api/spaces/sp-1/folders');
    });
  });

  describe('getWorkspaceAssetTypes', () => {
    it('should GET /api/asset_types?include_fields=true and return the response data', async () => {
      const atResponse = { count: 1, relation: 'org', asset_types: [{ uid: 'at1' }] };
      getStub.resolves({ status: 200, data: atResponse });
      const adapter = new CSAssetsAdapter(baseConfig);
      const result: unknown = await adapter.getWorkspaceAssetTypes('sp-1');

      const path = getStub.firstCall.args[0] as string;
      expect(path).to.include('/api/asset_types');
      expect(path).to.include('include_fields=true');
      expect(result).to.deep.equal(atResponse);
    });
  });

  describe('buildQueryString (via public methods)', () => {
    it('should encode array values as repeated key=value pairs', async () => {
      getStub.resolves({ status: 200, data: { space: { uid: 'sp-1' } } });
      const adapter = new CSAssetsAdapter(baseConfig);
      await adapter.getSpace('sp-1');

      const path = getStub.firstCall.args[0] as string;
      expect(path).to.include('addl_fields=meta_info');
      expect(path).to.include('addl_fields=users');
    });

    it('should return empty string and no "?" when params are empty', async () => {
      getStub.resolves({ status: 200, data: { count: 0, relation: '', fields: [] } });
      const adapter = new CSAssetsAdapter(baseConfig);
      await adapter.getWorkspaceFields('sp-1');

      const path = getStub.firstCall.args[0] as string;
      expect(path).to.equal('/api/fields');
      expect(path).to.not.include('?');
    });
  });

  describe('listSpaces (paginated)', () => {
    it('should return all spaces in a single page when count <= pageSize', async () => {
      const spaces = [{ uid: 'sp-1' }, { uid: 'sp-2' }];
      getStub.resolves({ status: 200, data: { spaces, count: 2 } });
      const adapter = new CSAssetsAdapter(baseConfig);
      const result = await adapter.listSpaces(100, 5);

      expect(getStub.callCount).to.equal(1);
      expect(getStub.firstCall.args[0]).to.include('/api/spaces');
      expect(getStub.firstCall.args[0]).to.include('limit=100');
      expect(getStub.firstCall.args[0]).to.include('skip=0');
      expect(result.spaces).to.deep.equal(spaces);
      expect(result.count).to.equal(2);
    });

    it('should issue additional page requests when total exceeds first page', async () => {
      const page1 = Array.from({ length: 2 }, (_, i) => ({ uid: `sp-${i}` }));
      const page2 = Array.from({ length: 1 }, (_, i) => ({ uid: `sp-${i + 2}` }));
      getStub.onCall(0).resolves({ status: 200, data: { spaces: page1, count: 3 } });
      getStub.onCall(1).resolves({ status: 200, data: { spaces: page2, count: 3 } });
      const adapter = new CSAssetsAdapter(baseConfig);
      const result = await adapter.listSpaces(2, 5);

      expect(getStub.callCount).to.equal(2);
      expect(getStub.secondCall.args[0]).to.include('skip=2');
      expect(result.spaces).to.have.lengthOf(3);
      expect(result.count).to.equal(3);
    });

    it('should return empty spaces when count is 0', async () => {
      getStub.resolves({ status: 200, data: { spaces: [], count: 0 } });
      const adapter = new CSAssetsAdapter(baseConfig);
      const result = await adapter.listSpaces();

      expect(getStub.callCount).to.equal(1);
      expect(result.spaces).to.deep.equal([]);
      expect(result.count).to.equal(0);
    });

    it('should batch additional page requests by fetchConcurrency', async () => {
      // 5 total, pageSize=1, concurrency=2 → 4 additional pages in 2 batches
      const pages = Array.from({ length: 5 }, (_, i) => [{ uid: `sp-${i}` }]);
      getStub.onCall(0).resolves({ status: 200, data: { spaces: pages[0], count: 5 } });
      getStub.onCall(1).resolves({ status: 200, data: { spaces: pages[1], count: 5 } });
      getStub.onCall(2).resolves({ status: 200, data: { spaces: pages[2], count: 5 } });
      getStub.onCall(3).resolves({ status: 200, data: { spaces: pages[3], count: 5 } });
      getStub.onCall(4).resolves({ status: 200, data: { spaces: pages[4], count: 5 } });
      const adapter = new CSAssetsAdapter(baseConfig);
      const result = await adapter.listSpaces(1, 2);

      expect(getStub.callCount).to.equal(5);
      expect(result.spaces).to.have.lengthOf(5);
    });
  });

  describe('getWorkspaceAssets (paginated)', () => {
    it('should fetch all assets across multiple pages', async () => {
      const page1 = [{ uid: 'a-1' }, { uid: 'a-2' }];
      const page2 = [{ uid: 'a-3' }];
      getStub.onCall(0).resolves({ status: 200, data: { assets: page1, count: 3 } });
      getStub.onCall(1).resolves({ status: 200, data: { assets: page2, count: 3 } });
      const adapter = new CSAssetsAdapter(baseConfig);
      const result = await adapter.getWorkspaceAssets('sp-1', undefined, 2, 5) as any;

      expect(result.assets).to.have.lengthOf(3);
      expect(result.count).to.equal(3);
    });

    it('should include workspace query param when workspaceUid is provided', async () => {
      getStub.resolves({ status: 200, data: { assets: [], count: 0 } });
      const adapter = new CSAssetsAdapter(baseConfig);
      await adapter.getWorkspaceAssets('sp-1', 'ws-main', 100, 5);

      const path = getStub.firstCall.args[0] as string;
      expect(path).to.include('workspace=ws-main');
    });

    it('should NOT include workspace param when workspaceUid is undefined', async () => {
      getStub.resolves({ status: 200, data: { assets: [], count: 0 } });
      const adapter = new CSAssetsAdapter(baseConfig);
      await adapter.getWorkspaceAssets('sp-1', undefined, 100, 5);

      const path = getStub.firstCall.args[0] as string;
      expect(path).to.not.include('workspace=');
    });
  });

  describe('getWorkspaceFolders (paginated)', () => {
    it('should fetch all folders across multiple pages', async () => {
      const page1 = [{ uid: 'f-1' }];
      const page2 = [{ uid: 'f-2' }];
      getStub.onCall(0).resolves({ status: 200, data: { folders: page1, count: 2 } });
      getStub.onCall(1).resolves({ status: 200, data: { folders: page2, count: 2 } });
      const adapter = new CSAssetsAdapter(baseConfig);
      const result = await adapter.getWorkspaceFolders('sp-1', undefined, 1, 5) as any;

      expect(result.folders).to.have.lengthOf(2);
      expect(result.count).to.equal(2);
    });

    it('should include workspace param when workspaceUid is provided', async () => {
      getStub.resolves({ status: 200, data: { folders: [], count: 0 } });
      const adapter = new CSAssetsAdapter(baseConfig);
      await adapter.getWorkspaceFolders('sp-1', 'ws-main', 100, 5);

      const path = getStub.firstCall.args[0] as string;
      expect(path).to.include('workspace=ws-main');
    });
  });

  describe('POST methods (createSpace, createFolder, createField, createAssetType, bulkDelete, bulkMove)', () => {
    let fetchStub: sinon.SinonStub;

    beforeEach(() => {
      fetchStub = sinon.stub(global, 'fetch' as any);
    });

    const okJsonResponse = (data: unknown) => ({
      ok: true,
      json: async () => data,
      text: async () => JSON.stringify(data),
    });

    const failResponse = (status: number, body = 'error body') => ({
      ok: false,
      status,
      json: async () => ({}),
      text: async () => body,
    });

    describe('createSpace', () => {
      it('POSTs to /api/spaces and returns the created space', async () => {
        const created = { space: { uid: 'new-space-uid', title: 'My Space' } };
        fetchStub.resolves(okJsonResponse(created));

        const adapter = new CSAssetsAdapter(baseConfig);
        const result = await adapter.createSpace({ title: 'My Space' });

        const [url, opts] = fetchStub.firstCall.args;
        expect(url).to.include('/api/spaces');
        expect(opts.method).to.equal('POST');
        expect(result).to.deep.equal(created);
      });

      it('throws when POST returns non-ok status', async () => {
        fetchStub.resolves(failResponse(400, 'bad request'));
        const adapter = new CSAssetsAdapter(baseConfig);

        try {
          await adapter.createSpace({ title: 'Bad Space' });
          expect.fail('should have thrown');
        } catch (err: any) {
          expect(err.message).to.include('400');
        }
      });
    });

    describe('createFolder', () => {
      it('POSTs to /api/spaces/{spaceUid}/folders with space_key header', async () => {
        const created = { folder: { uid: 'folder-new' } };
        fetchStub.resolves(okJsonResponse(created));

        const adapter = new CSAssetsAdapter(baseConfig);
        const result = await adapter.createFolder('sp-1', { title: 'Docs' });

        const [url, opts] = fetchStub.firstCall.args;
        expect(url).to.include('/api/spaces/sp-1/folders');
        expect(opts.headers['space_key']).to.equal('sp-1');
        expect(result).to.deep.equal(created);
      });

      it('URL-encodes spaceUid with special characters', async () => {
        fetchStub.resolves(okJsonResponse({ folder: { uid: 'f1' } }));
        const adapter = new CSAssetsAdapter(baseConfig);
        await adapter.createFolder('sp uid/1', { title: 'X' });

        const [url] = fetchStub.firstCall.args;
        expect(url).to.include('sp%20uid%2F1');
      });
    });

    describe('createField', () => {
      it('POSTs to /api/fields and returns the created field', async () => {
        const created = { field: { uid: 'field-1' } };
        fetchStub.resolves(okJsonResponse(created));

        const adapter = new CSAssetsAdapter(baseConfig);
        const result = await adapter.createField({ uid: 'field-1', label: 'My Field' } as any);

        const [url] = fetchStub.firstCall.args;
        expect(url).to.include('/api/fields');
        expect(result).to.deep.equal(created);
      });
    });

    describe('createAssetType', () => {
      it('POSTs to /api/asset_types and returns the created asset type', async () => {
        const created = { asset_type: { uid: 'at-1' } };
        fetchStub.resolves(okJsonResponse(created));

        const adapter = new CSAssetsAdapter(baseConfig);
        const result = await adapter.createAssetType({ uid: 'at-1' } as any);

        const [url] = fetchStub.firstCall.args;
        expect(url).to.include('/api/asset_types');
        expect(result).to.deep.equal(created);
      });
    });

    describe('bulkDeleteAssets', () => {
      it('POSTs to the bulk delete endpoint with workspace query param', async () => {
        fetchStub.resolves(okJsonResponse({ deleted: 2 }));
        const adapter = new CSAssetsAdapter(baseConfig);
        await adapter.bulkDeleteAssets('sp-1', 'ws-main', { asset_uids: ['a1', 'a2'] } as any);

        const [url, opts] = fetchStub.firstCall.args;
        expect(url).to.include('/api/spaces/sp-1/assets/bulk/delete');
        expect(url).to.include('workspace=ws-main');
        expect(opts.headers['space_key']).to.equal('sp-1');
      });

      it('uses "main" as default workspace uid', async () => {
        fetchStub.resolves(okJsonResponse({}));
        const adapter = new CSAssetsAdapter(baseConfig);
        await adapter.bulkDeleteAssets('sp-1', undefined as any, {} as any);

        const [url] = fetchStub.firstCall.args;
        expect(url).to.include('workspace=main');
      });
    });

    describe('bulkMoveAssets', () => {
      it('POSTs to the bulk-move endpoint with workspace query param', async () => {
        fetchStub.resolves(okJsonResponse({ moved: 1 }));
        const adapter = new CSAssetsAdapter(baseConfig);
        await adapter.bulkMoveAssets('sp-1', 'ws-main', { asset_uids: ['a1'], folder_uid: 'f1' } as any);

        const [url, opts] = fetchStub.firstCall.args;
        expect(url).to.include('/api/spaces/sp-1/assets/bulk-move');
        expect(url).to.include('workspace=ws-main');
        expect(opts.headers['space_key']).to.equal('sp-1');
      });
    });

    describe('postJson error handling', () => {
      it('wraps non-API errors in a consistent error message', async () => {
        fetchStub.rejects(new Error('network failure'));
        const adapter = new CSAssetsAdapter(baseConfig);

        try {
          await adapter.createField({} as any);
          expect.fail('should have thrown');
        } catch (err: any) {
          expect(err.message).to.include('CS Assets API POST failed');
          expect(err.message).to.include('network failure');
        }
      });
    });

    describe('uploadAsset', () => {
      const os = require('os');
      const path = require('path');
      const fsReal = require('fs');

      it('reads the file, builds multipart form, and POSTs to /api/spaces/{uid}/assets', async () => {
        const tmpFile = path.join(os.tmpdir(), `upload-test-${Date.now()}.png`);
        fsReal.writeFileSync(tmpFile, 'fake-image-content');
        fetchStub.resolves(okJsonResponse({ asset: { uid: 'new-asset', url: 'https://cdn.com/x.png' } }));

        const adapter = new CSAssetsAdapter(baseConfig);
        const result = await adapter.uploadAsset('sp-1', tmpFile, { title: 'My Image' });

        const [url, opts] = fetchStub.firstCall.args;
        expect(url).to.include('/api/spaces/sp-1/assets');
        expect(opts.method).to.equal('POST');
        expect(opts.headers['space_key']).to.equal('sp-1');
        expect(result).to.deep.equal({ asset: { uid: 'new-asset', url: 'https://cdn.com/x.png' } });

        fsReal.unlinkSync(tmpFile);
      });

      it('appends description and parent_uid to the form when provided', async () => {
        const tmpFile = path.join(os.tmpdir(), `upload-test-desc-${Date.now()}.png`);
        fsReal.writeFileSync(tmpFile, 'data');
        const formAppendSpy = sinon.spy(FormData.prototype, 'append');
        fetchStub.resolves(okJsonResponse({ asset: { uid: 'a1', url: 'https://cdn.com/a1.png' } }));

        const adapter = new CSAssetsAdapter(baseConfig);
        await adapter.uploadAsset('sp-1', tmpFile, {
          title: 'T', description: 'Desc', parent_uid: 'folder-uid',
        });

        const appendCalls = formAppendSpy.getCalls().map((c) => c.args[0]);
        expect(appendCalls).to.include('description');
        expect(appendCalls).to.include('parent_uid');

        fsReal.unlinkSync(tmpFile);
      });

      it('throws when multipart POST returns non-ok status', async () => {
        const tmpFile = path.join(os.tmpdir(), `upload-fail-${Date.now()}.png`);
        fsReal.writeFileSync(tmpFile, 'data');
        fetchStub.resolves(failResponse(413, 'file too large'));

        const adapter = new CSAssetsAdapter(baseConfig);
        try {
          await adapter.uploadAsset('sp-1', tmpFile, { title: 'Big File' });
          expect.fail('should have thrown');
        } catch (err: any) {
          expect(err.message).to.include('413');
        }

        fsReal.unlinkSync(tmpFile);
      });

      it('wraps network errors from multipart fetch in a consistent error message', async () => {
        const tmpFile = path.join(os.tmpdir(), `upload-net-${Date.now()}.png`);
        fsReal.writeFileSync(tmpFile, 'data');
        fetchStub.rejects(new Error('connection reset'));

        const adapter = new CSAssetsAdapter(baseConfig);
        try {
          await adapter.uploadAsset('sp-1', tmpFile, { title: 'File' });
          expect.fail('should have thrown');
        } catch (err: any) {
          expect(err.message).to.include('CS Assets API multipart POST failed');
          expect(err.message).to.include('connection reset');
        }

        fsReal.unlinkSync(tmpFile);
      });
    });
  });
});
