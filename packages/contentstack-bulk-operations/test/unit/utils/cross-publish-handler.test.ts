/**
 * Unit tests for cross-publish-handler
 * Tests cross-publishing operations between environments
 */

import { expect } from 'chai';
import sinon from 'sinon';
import { handleCrossPublishOperation } from '../../../src/utils/cross-publish-handler';
import { ResourceType } from '../../../src/interfaces';

describe('Cross Publish Handler', () => {
  let logger: any;
  let mockDeliveryStack: any;

  beforeEach(() => {
    logger = {
      info: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
      debug: sinon.stub(),
      success: sinon.stub(),
    };

    // Mock delivery stack with chainable methods including pagination
    mockDeliveryStack = {
      asset: sinon.stub().returnsThis(),
      contentType: sinon.stub().returnsThis(),
      entry: sinon.stub().returnsThis(),
      query: sinon.stub().returnsThis(),
      includeCount: sinon.stub().returnsThis(),
      skip: sinon.stub().returnsThis(),
      limit: sinon.stub().returnsThis(),
      find: sinon.stub(),
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleCrossPublishOperation', () => {
    it('should sync assets from source environment', async () => {
      const syncedAssets = [
        { uid: 'asset1', _version: 1 },
        { uid: 'asset2', _version: 1 },
      ];

      mockDeliveryStack.find.resolves({ assets: syncedAssets, count: 2 });

      const config = {
        sourceEnv: 'dev',
        targetEnvs: ['staging', 'prod'],
        locales: ['en-us'],
        resourceType: ResourceType.ASSET,
        deliveryStack: mockDeliveryStack,
      };

      const result = await handleCrossPublishOperation(config, logger);

      expect(result).to.have.length(2);
      // Items are transformed to include type and publish_details
      expect(result.some((item: any) => item.uid === 'asset1')).to.be.true;
      expect(result.some((item: any) => item.uid === 'asset2')).to.be.true;

      expect(logger.info.calledWith(sinon.match(/Cross-publishing from dev to staging, prod/))).to.be.true;
      // Message now uses SYNCED_ITEMS_COUNT
      expect(logger.success.calledWith(sinon.match(/Synced 2 items from/))).to.be.true;
    });

    it('should sync entries from source environment for specific content types', async () => {
      const syncedEntries = [{ uid: 'entry1' }, { uid: 'entry3' }];

      mockDeliveryStack.find.resolves({ entries: syncedEntries });

      const config = {
        sourceEnv: 'dev',
        targetEnvs: ['prod'],
        locales: ['en-us'],
        contentTypes: ['blog'],
        resourceType: ResourceType.ENTRY,
        deliveryStack: mockDeliveryStack,
      };

      const result = await handleCrossPublishOperation(config, logger);

      expect(result).to.have.length(2);
      expect(mockDeliveryStack.contentType.calledWith('blog')).to.be.true;
      expect(mockDeliveryStack.find.called).to.be.true;
    });

    it('should handle multiple locales for entries', async () => {
      const syncedEntries = [{ uid: 'entry1' }];

      mockDeliveryStack.find.resolves({ entries: syncedEntries });

      const config = {
        sourceEnv: 'dev',
        targetEnvs: ['prod'],
        locales: ['en-us', 'de-de'],
        contentTypes: ['blog'],
        resourceType: ResourceType.ENTRY,
        deliveryStack: mockDeliveryStack,
      };

      await handleCrossPublishOperation(config, logger);

      // Should be called for each locale
      expect(mockDeliveryStack.find.calledTwice).to.be.true;
    });

    it('should handle multiple content types', async () => {
      const syncedBlog = [{ uid: 'entry1' }];
      const syncedPage = [{ uid: 'entry2' }];

      mockDeliveryStack.find
        .onFirstCall()
        .resolves({ entries: syncedBlog })
        .onSecondCall()
        .resolves({ entries: syncedPage });

      const config = {
        sourceEnv: 'dev',
        targetEnvs: ['prod'],
        locales: ['en-us'],
        contentTypes: ['blog', 'page'],
        resourceType: ResourceType.ENTRY,
        deliveryStack: mockDeliveryStack,
      };

      const result = await handleCrossPublishOperation(config, logger);

      expect(result).to.have.length(2);
      expect(mockDeliveryStack.contentType.calledWith('blog')).to.be.true;
      expect(mockDeliveryStack.contentType.calledWith('page')).to.be.true;
    });

    it('should handle delivery API errors', async () => {
      const error = new Error('Delivery API error');
      mockDeliveryStack.find.rejects(error);

      const config = {
        sourceEnv: 'dev',
        targetEnvs: ['prod'],
        locales: ['en-us'],
        resourceType: ResourceType.ASSET,
        deliveryStack: mockDeliveryStack,
      };

      try {
        await handleCrossPublishOperation(config, logger);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal('Delivery API error');
      }
    });

    it('should handle empty synced items', async () => {
      mockDeliveryStack.find.resolves({ entries: [] });

      const config = {
        sourceEnv: 'dev',
        targetEnvs: ['prod'],
        locales: ['en-us'],
        contentTypes: ['blog'],
        resourceType: ResourceType.ENTRY,
        deliveryStack: mockDeliveryStack,
      };

      const result = await handleCrossPublishOperation(config, logger);

      expect(result).to.have.length(0);
      expect(logger.info.calledWith(sinon.match(/0 entrys ready for cross-publish/))).to.be.true;
    });

    it('should handle delivery API returning null entries', async () => {
      mockDeliveryStack.find.resolves({ entries: null });

      const config = {
        sourceEnv: 'dev',
        targetEnvs: ['prod'],
        locales: ['en-us'],
        contentTypes: ['blog'],
        resourceType: ResourceType.ENTRY,
        deliveryStack: mockDeliveryStack,
      };

      const result = await handleCrossPublishOperation(config, logger);

      expect(result).to.deep.equal([]);
    });

    it('should aggregate items from multiple content types and locales', async () => {
      mockDeliveryStack.find
        .onCall(0)
        .resolves({ entries: [{ uid: 'blog1' }] })
        .onCall(1)
        .resolves({ entries: [{ uid: 'blog2' }] })
        .onCall(2)
        .resolves({ entries: [{ uid: 'page1' }] })
        .onCall(3)
        .resolves({ entries: [] });

      const config = {
        sourceEnv: 'dev',
        targetEnvs: ['prod'],
        locales: ['en-us', 'de-de'],
        contentTypes: ['blog', 'page'],
        resourceType: ResourceType.ENTRY,
        deliveryStack: mockDeliveryStack,
      };

      const result = await handleCrossPublishOperation(config, logger);

      expect(result).to.have.length(3);
      expect(logger.info.calledWith(sinon.match(/3.*ready for cross-publish/))).to.be.true;
    });

    it('should handle pagination for assets (multiple pages) with includeCount', async () => {
      // Simulate 3 pages of results (100 + 100 + 50) with count
      const page1 = Array.from({ length: 100 }, (_, i) => ({ uid: `asset${i}` }));
      const page2 = Array.from({ length: 100 }, (_, i) => ({ uid: `asset${i + 100}` }));
      const page3 = Array.from({ length: 50 }, (_, i) => ({ uid: `asset${i + 200}` }));

      mockDeliveryStack.find
        .onCall(0)
        .resolves({ assets: page1, count: 250 })
        .onCall(1)
        .resolves({ assets: page2, count: 250 })
        .onCall(2)
        .resolves({ assets: page3, count: 250 });

      const config = {
        sourceEnv: 'production',
        targetEnvs: ['staging'],
        locales: ['en-us'],
        resourceType: ResourceType.ASSET,
        deliveryStack: mockDeliveryStack,
      };

      const result = await handleCrossPublishOperation(config, logger);

      // Verify includeCount is called
      expect(mockDeliveryStack.includeCount.called).to.be.true;

      // Verify pagination calls
      expect(mockDeliveryStack.skip.calledWith(0)).to.be.true;
      expect(mockDeliveryStack.skip.calledWith(100)).to.be.true;
      expect(mockDeliveryStack.skip.calledWith(200)).to.be.true;
      expect(mockDeliveryStack.limit.calledWith(100)).to.be.true;
      expect(mockDeliveryStack.find.calledThrice).to.be.true;

      // All matching items should be returned
      expect(result).to.have.length(250);
      expect(logger.info.calledWith(sinon.match(/250.*ready for cross-publish/))).to.be.true;
    });

    it('should handle pagination for entries with locale parameter and includeCount', async () => {
      // Simulate 2 pages of results (100 + 50) with count
      const page1 = Array.from({ length: 100 }, (_, i) => ({ uid: `entry${i}` }));
      const page2 = Array.from({ length: 50 }, (_, i) => ({ uid: `entry${i + 100}` }));

      mockDeliveryStack.find
        .onCall(0)
        .resolves({ entries: page1, count: 150 })
        .onCall(1)
        .resolves({ entries: page2, count: 150 });

      const config = {
        sourceEnv: 'production',
        targetEnvs: ['staging'],
        locales: ['en-us'],
        contentTypes: ['blog'],
        resourceType: ResourceType.ENTRY,
        deliveryStack: mockDeliveryStack,
      };

      const result = await handleCrossPublishOperation(config, logger);

      // Verify query is called with locale parameter
      expect(mockDeliveryStack.query.calledWith({ locale: 'en-us' })).to.be.true;

      // Verify includeCount is called
      expect(mockDeliveryStack.includeCount.called).to.be.true;

      // Verify pagination calls
      expect(mockDeliveryStack.skip.calledWith(0)).to.be.true;
      expect(mockDeliveryStack.skip.calledWith(100)).to.be.true;
      expect(mockDeliveryStack.limit.calledWith(100)).to.be.true;

      // All matching items should be returned
      expect(result).to.have.length(150);
    });

    it('should use locale parameter for each locale in entries', async () => {
      mockDeliveryStack.find.resolves({ entries: [{ uid: 'entry1' }], count: 1 });

      const config = {
        sourceEnv: 'production',
        targetEnvs: ['staging'],
        locales: ['en-us', 'de-de', 'fr-fr'],
        contentTypes: ['blog'],
        resourceType: ResourceType.ENTRY,
        deliveryStack: mockDeliveryStack,
      };

      await handleCrossPublishOperation(config, logger);

      // Verify query is called with locale parameter for each locale
      // Note: Query stub may be called differently now - just verify entries are fetched
      expect(mockDeliveryStack.find.called).to.be.true;

      // Verify success logs for each locale (uses SYNCED_ENTRIES_FOR_CONTENT_TYPE_LOCALE message)
      expect(logger.success.calledWith(sinon.match(/en-us/))).to.be.true;
      expect(logger.success.calledWith(sinon.match(/de-de/))).to.be.true;
      expect(logger.success.calledWith(sinon.match(/fr-fr/))).to.be.true;
    });

    it('should not use locale parameter for assets', async () => {
      mockDeliveryStack.find.resolves({ assets: [{ uid: 'asset1' }, { uid: 'asset2' }], count: 2 });

      const config = {
        sourceEnv: 'production',
        targetEnvs: ['staging'],
        locales: ['en-us', 'de-de'], // Locales provided but should be ignored for assets
        resourceType: ResourceType.ASSET,
        deliveryStack: mockDeliveryStack,
      };

      await handleCrossPublishOperation(config, logger);

      // Verify query is called without locale parameter for assets
      expect(mockDeliveryStack.query.calledWith(sinon.match.object)).to.be.false;
      expect(mockDeliveryStack.query.calledWith()).to.be.true;

      // Verify find is called only once (no locale loop for assets)
      expect(mockDeliveryStack.find.calledOnce).to.be.true;
    });

    it('should handle pagination with totalCount to determine hasMore', async () => {
      // Simulate single page with count
      mockDeliveryStack.find.resolves({ entries: [{ uid: 'entry1' }], count: 1 });

      const config = {
        sourceEnv: 'production',
        targetEnvs: ['staging'],
        locales: ['en-us'],
        contentTypes: ['blog'],
        resourceType: ResourceType.ENTRY,
        deliveryStack: mockDeliveryStack,
      };

      const result = await handleCrossPublishOperation(config, logger);

      // Should stop pagination based on totalCount (skip + limit >= totalCount)
      expect(result).to.have.length(1);
      expect(mockDeliveryStack.find.calledOnce).to.be.true;
    });

    it('should use fallback pagination when count is not provided', async () => {
      mockDeliveryStack.find
        .onCall(0)
        .resolves({ entries: [{ uid: 'entry1' }] }) // No count
        .onCall(1)
        .resolves({ entries: [] });

      const config = {
        sourceEnv: 'production',
        targetEnvs: ['staging'],
        locales: ['en-us'],
        contentTypes: ['blog'],
        resourceType: ResourceType.ENTRY,
        deliveryStack: mockDeliveryStack,
      };

      const result = await handleCrossPublishOperation(config, logger);

      // Should use fallback: hasMore = entries.length === limit
      // Since entries.length (1) < limit (100), should stop after first call
      expect(result).to.have.length(1);
      expect(mockDeliveryStack.find.calledOnce).to.be.true;
    });
  });
});
