import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { Asset } from '../../../src/interfaces';
import messages, { $t } from '../../../src/messages';
import { AssetService } from '../../../src/services/asset-service';

describe('AssetService', () => {
  let assetService: AssetService;
  let mockStack: any;
  let mockLogger: any;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockLogger = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
      debug: sandbox.stub(),
    };

    mockStack = {
      asset: sandbox.stub(),
    };

    assetService = new AssetService(mockStack, null, mockLogger);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('fetchAllAssets', () => {
    it('should fetch all assets with pagination using include_count', async () => {
      const mockAssets1 = Array(100).fill({ uid: 'asset-1', filename: 'image1.jpg' });
      const mockAssets2 = Array(50).fill({ uid: 'asset-2', filename: 'image2.jpg' });

      const mockQuery = {
        find: sandbox
          .stub()
          .onFirstCall()
          .resolves({ items: mockAssets1, count: 150 })
          .onSecondCall()
          .resolves({ items: mockAssets2, count: 150 }),
      };

      mockStack.asset.returns({
        query: sandbox.stub().returns(mockQuery),
      });

      const result = await assetService.fetchAllAssets();

      expect(result).to.have.lengthOf(150);
      expect(mockLogger.info.calledWith($t(messages.FETCHING_ASSETS))).to.be.true;
      expect(mockStack.asset().query.firstCall.args[0]).to.deep.include({ include_count: true });
    });

    it('should handle empty results', async () => {
      const mockQuery = {
        find: sandbox.stub().resolves({ items: [] }),
      };

      mockStack.asset.returns({
        query: sandbox.stub().returns(mockQuery),
      });

      const result = await assetService.fetchAllAssets();

      expect(result).to.have.lengthOf(0);
      expect(mockLogger.info.calledWith($t(messages.FETCHED_TOTAL_ASSETS, { total: 0 }))).to.be.true;
    });

    it('should throw error on fetch failure', async () => {
      const mockError = new Error('API Error');
      const mockQuery = {
        find: sandbox.stub().rejects(mockError),
      };

      mockStack.asset.returns({
        query: sandbox.stub().returns(mockQuery),
      });

      try {
        await assetService.fetchAllAssets();
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal('API Error');
        expect(mockLogger.error.called).to.be.true;
      }
    });

    it('should use fallback pagination when count is undefined', async () => {
      const mockAssets1 = Array(100).fill({ uid: 'asset-1' });
      const mockAssets2 = Array(50).fill({ uid: 'asset-2' });

      const mockQuery = {
        find: sandbox
          .stub()
          .onFirstCall()
          .resolves({ items: mockAssets1 }) // No count
          .onSecondCall()
          .resolves({ items: mockAssets2 }),
      };

      mockStack.asset.returns({
        query: sandbox.stub().returns(mockQuery),
      });

      const result = await assetService.fetchAllAssets();

      expect(result).to.have.lengthOf(150);
    });
  });

  describe('fetchAssetsByUIDs', () => {
    it('should fetch assets by specific UIDs', async () => {
      const mockAssets = [
        { uid: 'asset1', filename: 'image1.jpg' },
        { uid: 'asset2', filename: 'image2.jpg' },
      ];

      mockStack.asset
        .withArgs('asset1')
        .returns({ fetch: sandbox.stub().resolves(mockAssets[0]) })
        .withArgs('asset2')
        .returns({ fetch: sandbox.stub().resolves(mockAssets[1]) });

      const result = await assetService.fetchAssetsByUIDs(['asset1', 'asset2']);

      expect(result).to.have.lengthOf(2);
      expect(result[0].uid).to.equal('asset1');
      expect(mockLogger.info.calledWith($t(messages.FETCHED_ASSETS_BY_UID, { count: 2 }))).to.be.true;
    });

    it('should return empty array for empty UIDs', async () => {
      const result = await assetService.fetchAssetsByUIDs([]);

      expect(result).to.have.lengthOf(0);
      expect(mockStack.asset.called).to.be.false;
    });

    it('should continue on individual asset fetch error', async () => {
      mockStack.asset
        .withArgs('asset1')
        .returns({ fetch: sandbox.stub().resolves({ uid: 'asset1' }) })
        .withArgs('asset2')
        .returns({ fetch: sandbox.stub().rejects(new Error('Not found')) });

      const result = await assetService.fetchAssetsByUIDs(['asset1', 'asset2']);

      expect(result).to.have.lengthOf(1);
      expect(result[0].uid).to.equal('asset1');
      expect(mockLogger.warn.called).to.be.true;
    });
  });

  describe('fetchAssetsByFolder', () => {
    it('should fetch assets from specific folder with pagination', async () => {
      const mockAssets1 = Array(100).fill({ uid: 'asset1', parent_uid: 'folder1' });
      const mockAssets2 = Array(25).fill({ uid: 'asset2', parent_uid: 'folder1' });

      const mockQuery = {
        find: sandbox
          .stub()
          .onFirstCall()
          .resolves({ items: mockAssets1, count: 125 })
          .onSecondCall()
          .resolves({ items: mockAssets2, count: 125 }),
      };

      mockStack.asset.returns({
        query: sandbox.stub().returns(mockQuery),
      });

      const result = await assetService.fetchAssetsByFolder('folder1');

      expect(result).to.have.lengthOf(125);
      expect(mockLogger.info.calledWith($t(messages.FETCHED_ASSETS_BY_FOLDER, { total: 125, folderUid: 'folder1' }))).to
        .be.true;
    });

    it('should return empty array when no assets in folder', async () => {
      const mockQuery = {
        find: sandbox.stub().resolves({ items: [] }),
      };

      mockStack.asset.returns({
        query: sandbox.stub().returns(mockQuery),
      });

      const result = await assetService.fetchAssetsByFolder('folder1');

      expect(result).to.have.lengthOf(0);
    });
  });

  describe('fetchAllPublishedAssets', () => {
    it('should fetch and filter published assets for environment', async () => {
      const mockAssets = [
        { uid: 'asset1', publish_details: [{ environment: 'production' }] },
        { uid: 'asset2', publish_details: [{ environment: 'dev' }] },
        { uid: 'asset3', publish_details: [{ environment: 'production' }] },
      ];

      // Mock delivery SDK
      const mockDeliveryStack = {
        asset: sandbox.stub().returns({
          query: sandbox.stub().returns({
            limit: sandbox.stub().returnsThis(),
            skip: sandbox.stub().returnsThis(),
            includeCount: sandbox.stub().returnsThis(),
            find: sandbox.stub().resolves({ assets: mockAssets, count: 3 }),
          }),
        }),
      };

      assetService = new AssetService(mockStack, mockDeliveryStack as any, mockLogger);

      const result = await assetService.fetchAllPublishedAssets('production');

      expect(result).to.have.lengthOf(3);
      expect(result[0].uid).to.equal('asset1');
    });

    it('should handle pagination with count', async () => {
      const mockAssets1 = Array(100).fill({
        uid: 'asset1',
        publish_details: [{ environment: 'production' }],
      });
      const mockAssets2 = Array(50).fill({
        uid: 'asset2',
        publish_details: [{ environment: 'production' }],
      });

      const findStub = sandbox
        .stub()
        .onFirstCall()
        .resolves({ assets: mockAssets1, count: 150 })
        .onSecondCall()
        .resolves({ assets: mockAssets2, count: 150 });

      // Mock delivery SDK
      const mockDeliveryStack = {
        asset: sandbox.stub().returns({
          query: sandbox.stub().returns({
            limit: sandbox.stub().returnsThis(),
            skip: sandbox.stub().returnsThis(),
            includeCount: sandbox.stub().returnsThis(),
            find: findStub,
          }),
        }),
      };

      assetService = new AssetService(mockStack, mockDeliveryStack as any, mockLogger);

      const result = await assetService.fetchAllPublishedAssets('production');

      expect(result).to.have.lengthOf(150);
    });
  });

  describe('fetchPublishedAssetsByUIDs', () => {
    it('should fetch published assets by UIDs', async () => {
      const mockAsset1 = { uid: 'asset1', publish_details: [{ environment: 'production' }] };
      const mockAsset2 = { uid: 'asset2', publish_details: [{ environment: 'dev' }] };

      // Mock delivery SDK
      const mockDeliveryStack = {
        asset: sandbox.stub().callsFake((uid: string) => ({
          fetch: sandbox.stub().resolves(uid === 'asset1' ? mockAsset1 : mockAsset2),
        })),
      };

      assetService = new AssetService(mockStack, mockDeliveryStack as any, mockLogger);

      const result = await assetService.fetchPublishedAssetsByUIDs(['asset1', 'asset2'], 'production');

      expect(result).to.have.lengthOf(2);
      expect(result[0].uid).to.equal('asset1');
    });

    it('should handle asset not found errors', async () => {
      mockStack.asset.withArgs('asset1').returns({
        fetch: sandbox.stub().rejects(new Error('Not found')),
      });

      const result = await assetService.fetchPublishedAssetsByUIDs(['asset1'], 'production');

      expect(result).to.have.lengthOf(0);
      expect(mockLogger.debug.called).to.be.true;
    });

    it('should batch process large UID lists', async () => {
      const uids = Array(25)
        .fill(null)
        .map((_, i) => `asset${i}`);
      const mockAssets = uids.map((uid) => ({
        uid,
        publish_details: [{ environment: 'production' }],
      }));

      // Mock delivery SDK
      const mockDeliveryStack = {
        asset: sandbox.stub().callsFake((uid: string) => ({
          fetch: sandbox.stub().resolves(mockAssets.find((a) => a.uid === uid)),
        })),
      };

      assetService = new AssetService(mockStack, mockDeliveryStack as any, mockLogger);

      const result = await assetService.fetchPublishedAssetsByUIDs(uids, 'production');

      expect(result).to.have.lengthOf(25);
    });

    it('should return empty array for empty UIDs', async () => {
      const result = await assetService.fetchPublishedAssetsByUIDs([], 'production');

      expect(result).to.have.lengthOf(0);
    });
  });

  describe('filterUnpublishedAssets', () => {
    it('should filter assets not published to target environment', async () => {
      const assets: Asset[] = [
        {
          uid: 'asset1',
          filename: 'image1.jpg',
          _version: 1,
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        } as Asset,
        {
          uid: 'asset2',
          filename: 'image2.jpg',
          _version: 1,
          publish_details: [{ environment: 'production', locale: 'en-us', version: 1 }],
        } as Asset,
        {
          uid: 'asset3',
          filename: 'image3.jpg',
          _version: 1,
          publish_details: [],
        } as Asset,
      ];

      const result = await assetService.filterUnpublishedAssets(assets, 'production');

      expect(result).to.have.lengthOf(2);
      expect(result[0].uid).to.equal('asset1');
      expect(result[1].uid).to.equal('asset3');
    });

    it('should include assets with no publish_details', async () => {
      const assets: Asset[] = [
        {
          uid: 'asset1',
          filename: 'image1.jpg',
          _version: 1,
        } as Asset,
      ];

      const result = await assetService.filterUnpublishedAssets(assets, 'production');

      expect(result).to.have.lengthOf(1);
    });
  });

  describe('getAsset', () => {
    it('should fetch a single asset by UID', async () => {
      const mockAsset = { uid: 'asset1', filename: 'image1.jpg' };

      mockStack.asset.withArgs('asset1').returns({
        fetch: sandbox.stub().resolves(mockAsset),
      });

      const result = await assetService.getAsset('asset1');

      expect(result.uid).to.equal('asset1');
    });

    it('should throw error if asset fetch fails', async () => {
      mockStack.asset.withArgs('asset1').returns({
        fetch: sandbox.stub().rejects(new Error('Not found')),
      });

      try {
        await assetService.getAsset('asset1');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal('Not found');
        expect(mockLogger.error.called).to.be.true;
      }
    });
  });
});
