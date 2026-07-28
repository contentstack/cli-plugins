import { expect } from 'chai';
import sinon from 'sinon';
import { PassThrough } from 'node:stream';
import { authHandler, authenticationHandler, configHandler } from '@contentstack/cli-utilities';

import {
  getArrayFromResponse,
  getAssetItems,
  getReadableStreamFromDownloadResponse,
  getSecuredAssetAuth,
  writeStreamToFile,
} from '../../../src/utils/export-helpers';

describe('export-helpers', () => {
  describe('getArrayFromResponse', () => {
    it('should return the input when it is already an array', () => {
      const arr = [1, 2, 3];
      expect(getArrayFromResponse(arr, 'items')).to.equal(arr);
    });

    it('should extract nested array by key', () => {
      const data = { fields: [{ uid: 'f1' }, { uid: 'f2' }] };
      const result = getArrayFromResponse(data, 'fields');
      expect(result).to.deep.equal([{ uid: 'f1' }, { uid: 'f2' }]);
    });

    it('should return [] when key exists but value is not an array', () => {
      const data = { fields: 'not-an-array' };
      expect(getArrayFromResponse(data, 'fields')).to.deep.equal([]);
    });

    it('should return [] when key is missing', () => {
      const data = { other: [1] };
      expect(getArrayFromResponse(data, 'fields')).to.deep.equal([]);
    });

    it('should return [] for null input', () => {
      expect(getArrayFromResponse(null, 'key')).to.deep.equal([]);
    });

    it('should return [] for undefined input', () => {
      expect(getArrayFromResponse(undefined, 'key')).to.deep.equal([]);
    });

    it('should return [] for non-object input (number)', () => {
      expect(getArrayFromResponse(42, 'key')).to.deep.equal([]);
    });
  });

  describe('getAssetItems', () => {
    it('should return the input when it is already an array', () => {
      const arr = [{ uid: 'a1' }];
      expect(getAssetItems(arr)).to.equal(arr);
    });

    it('should extract from data.items', () => {
      const data = { items: [{ uid: 'a1', url: 'http://example.com/a1' }] };
      expect(getAssetItems(data)).to.deep.equal(data.items);
    });

    it('should extract from data.assets', () => {
      const data = { assets: [{ uid: 'a2', filename: 'img.png' }] };
      expect(getAssetItems(data)).to.deep.equal(data.assets);
    });

    it('should prefer data.items over data.assets', () => {
      const data = { items: [{ uid: 'from-items' }], assets: [{ uid: 'from-assets' }] };
      expect(getAssetItems(data)).to.deep.equal([{ uid: 'from-items' }]);
    });

    it('should return [] when neither key exists', () => {
      expect(getAssetItems({ other: 'value' })).to.deep.equal([]);
    });

    it('should return [] for null input', () => {
      expect(getAssetItems(null)).to.deep.equal([]);
    });
  });

  describe('getReadableStreamFromDownloadResponse', () => {
    it('should return null for null input', () => {
      expect(getReadableStreamFromDownloadResponse(null)).to.be.null;
    });

    it('should extract response.data when present', () => {
      const inner = new PassThrough();
      const response = { data: inner };
      expect(getReadableStreamFromDownloadResponse(response)).to.equal(inner);
    });

    it('should return the stream itself if it has .pipe', () => {
      const stream = new PassThrough();
      expect(getReadableStreamFromDownloadResponse(stream as any)).to.equal(stream);
    });

    it('should return null for non-stream objects without data', () => {
      const obj = { something: 'else' } as any;
      expect(getReadableStreamFromDownloadResponse(obj)).to.be.null;
    });
  });

  describe('getSecuredAssetAuth', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return an authorization header when OAuth is enabled', async () => {
      sinon.stub(authenticationHandler, 'getAuthDetails').resolves();
      sinon.stub(authenticationHandler, 'isOauthEnabled').get(() => true);
      sinon.stub(authenticationHandler, 'accessToken').get(() => 'Bearer oauth-token-123');

      const auth = await getSecuredAssetAuth();
      expect(auth.headers).to.deep.equal({ authorization: 'Bearer oauth-token-123' });
      expect(auth.authtoken).to.be.undefined;
    });

    it('should return the authtoken for basic auth', async () => {
      sinon.stub(authenticationHandler, 'getAuthDetails').resolves();
      sinon.stub(authenticationHandler, 'isOauthEnabled').get(() => false);
      sinon.stub(configHandler, 'get').withArgs('authtoken').returns('basic-token-456');

      const auth = await getSecuredAssetAuth();
      expect(auth.authtoken).to.equal('basic-token-456');
      expect(auth.headers).to.be.undefined;
    });

    it('should return an empty object when no authtoken is configured', async () => {
      sinon.stub(authenticationHandler, 'getAuthDetails').resolves();
      sinon.stub(authenticationHandler, 'isOauthEnabled').get(() => false);
      sinon.stub(configHandler, 'get').withArgs('authtoken').returns(undefined);

      const auth = await getSecuredAssetAuth();
      expect(auth).to.deep.equal({});
    });

    it('should refresh auth details before resolving the token', async () => {
      const getAuthDetailsStub = sinon.stub(authenticationHandler, 'getAuthDetails').resolves();
      sinon.stub(authenticationHandler, 'isOauthEnabled').get(() => true);
      sinon.stub(authenticationHandler, 'accessToken').get(() => 'Bearer fresh-token');

      await getSecuredAssetAuth();
      expect(getAuthDetailsStub.calledOnce).to.be.true;
    });

    it('should force an upstream token refresh when forceRefresh is set and OAuth is enabled', async () => {
      const compareStub = sinon.stub(authHandler, 'compareOAuthExpiry').resolves();
      sinon.stub(authenticationHandler, 'getAuthDetails').resolves();
      sinon.stub(authenticationHandler, 'isOauthEnabled').get(() => true);
      sinon.stub(authenticationHandler, 'accessToken').get(() => 'Bearer fresh');

      const auth = await getSecuredAssetAuth(true);
      expect(compareStub.calledOnceWith(true)).to.be.true;
      expect(auth.headers).to.deep.equal({ authorization: 'Bearer fresh' });
    });

    it('should not force a refresh for basic auth (cannot be refreshed)', async () => {
      const compareStub = sinon.stub(authHandler, 'compareOAuthExpiry').resolves();
      sinon.stub(authenticationHandler, 'getAuthDetails').resolves();
      sinon.stub(authenticationHandler, 'isOauthEnabled').get(() => false);
      sinon.stub(configHandler, 'get').withArgs('authtoken').returns('basic-token');

      const auth = await getSecuredAssetAuth(true);
      expect(compareStub.called).to.be.false;
      expect(auth.authtoken).to.equal('basic-token');
    });
  });

  describe('writeStreamToFile', () => {
    it('should resolve when stream finishes writing', async () => {
      const source = new PassThrough();
      const tmpPath = require('node:path').join(require('node:os').tmpdir(), `test-write-${Date.now()}.txt`);

      const promise = writeStreamToFile(source, tmpPath);
      source.end('hello world');
      await promise;

      const content = require('node:fs').readFileSync(tmpPath, 'utf-8');
      expect(content).to.equal('hello world');
      require('node:fs').unlinkSync(tmpPath);
    });

    it('should reject when the write stream errors', async () => {
      const source = new PassThrough();
      const badPath = '/nonexistent-dir-xyz/file.txt';

      try {
        await writeStreamToFile(source, badPath);
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err.code).to.equal('ENOENT');
      }
    });
  });
});
