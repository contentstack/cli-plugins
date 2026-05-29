import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { fetchEntries, fetchAssets } from '../../../src/utils/item-fetcher';
import { EntryService } from '../../../src/services/entry-service';
import { AssetService } from '../../../src/services/asset-service';
import { BulkOperationConfig, FilterType, ManagementStack, DeliveryStack, Entry, Asset } from '../../../src/interfaces';

describe('Item Fetcher Utilities', () => {
  let sandbox: sinon.SinonSandbox;
  let mockManagementStack: ManagementStack;
  let mockDeliveryStack: DeliveryStack | null;
  let mockLogger: any;
  let entryServiceStub: sinon.SinonStubbedInstance<EntryService>;
  let assetServiceStub: sinon.SinonStubbedInstance<AssetService>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockManagementStack = {} as ManagementStack;
    mockDeliveryStack = null;
    mockLogger = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
      debug: sandbox.stub(),
    };

    // Stub the service classes
    entryServiceStub = sandbox.createStubInstance(EntryService);
    assetServiceStub = sandbox.createStubInstance(AssetService);

    // Mock the service constructors
    sandbox
      .stub(EntryService.prototype, 'fetchEntriesByContentType')
      .callsFake(entryServiceStub.fetchEntriesByContentType);
    sandbox.stub(EntryService.prototype, 'filterDraftEntries').callsFake(entryServiceStub.filterDraftEntries);
    sandbox
      .stub(EntryService.prototype, 'filterUnpublishedEntries')
      .callsFake(entryServiceStub.filterUnpublishedEntries);
    sandbox.stub(EntryService.prototype, 'filterModifiedEntries').callsFake(entryServiceStub.filterModifiedEntries);

    sandbox.stub(AssetService.prototype, 'fetchAllAssets').callsFake(assetServiceStub.fetchAllAssets);
    sandbox.stub(AssetService.prototype, 'filterUnpublishedAssets').callsFake(assetServiceStub.filterUnpublishedAssets);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('fetchEntries', () => {
    describe('Entry Operations', () => {
      it('should fetch entries for given content types', async () => {
        const config: BulkOperationConfig = {
          contentTypes: ['blog'],
          locales: ['en-us'],
          environments: ['dev'],
        };

        const mockEntries: Entry[] = [
          {
            uid: 'entry1',
            content_type_uid: 'blog',
            _version: 1,
            locale: 'en-us',
            updated_at: new Date().toISOString(),
          },
        ];

        entryServiceStub.fetchEntriesByContentType.resolves(mockEntries);

        const result = await fetchEntries(config, mockManagementStack, mockDeliveryStack, mockLogger);

        expect(result).to.have.lengthOf(1);
        expect(result[0].type).to.equal('entry');
        expect(result[0].uid).to.equal('entry1');
        if (result[0].type === 'entry') {
          expect(result[0].content_type).to.equal('blog');
        }
        // Logger is called at debug level for fetching entries
        expect(mockLogger.debug.called).to.be.true;
      });

      it('should handle multiple content types', async () => {
        const config: BulkOperationConfig = {
          contentTypes: ['blog', 'article'],
          locales: ['en-us'],
          environments: ['dev'],
        };

        const mockEntries: Entry[] = [
          {
            uid: 'entry1',
            content_type_uid: 'blog',
            _version: 1,
            locale: 'en-us',
            updated_at: new Date().toISOString(),
          },
        ];

        entryServiceStub.fetchEntriesByContentType.resolves(mockEntries);

        const result = await fetchEntries(config, mockManagementStack, mockDeliveryStack, mockLogger);

        expect(result).to.have.lengthOf(2); // One for each content type
        expect(entryServiceStub.fetchEntriesByContentType.calledTwice).to.be.true;
      });

      it('should handle multiple locales', async () => {
        const config: BulkOperationConfig = {
          contentTypes: ['blog'],
          locales: ['en-us', 'fr-fr', 'de-de'],
          environments: ['dev'],
        };

        const mockEntriesEnUs: Entry[] = [
          {
            uid: 'entry1',
            content_type_uid: 'blog',
            _version: 1,
            locale: 'en-us',
            updated_at: new Date().toISOString(),
          },
        ];

        const mockEntriesFrFr: Entry[] = [
          {
            uid: 'entry1',
            content_type_uid: 'blog',
            _version: 1,
            locale: 'fr-fr',
            updated_at: new Date().toISOString(),
          },
        ];

        const mockEntriesDeDe: Entry[] = [
          {
            uid: 'entry1',
            content_type_uid: 'blog',
            _version: 1,
            locale: 'de-de',
            updated_at: new Date().toISOString(),
          },
        ];

        entryServiceStub.fetchEntriesByContentType
          .onFirstCall()
          .resolves(mockEntriesEnUs)
          .onSecondCall()
          .resolves(mockEntriesFrFr)
          .onThirdCall()
          .resolves(mockEntriesDeDe);

        const result = await fetchEntries(config, mockManagementStack, mockDeliveryStack, mockLogger);

        expect(result).to.have.lengthOf(3); // One for each locale
        expect(entryServiceStub.fetchEntriesByContentType.callCount).to.equal(3);
        expect(result[0].locale).to.equal('en-us');
        expect(result[1].locale).to.equal('fr-fr');
        expect(result[2].locale).to.equal('de-de');
      });

      it('should handle multiple content types and multiple locales', async () => {
        const config: BulkOperationConfig = {
          contentTypes: ['blog', 'article'],
          locales: ['en-us', 'fr-fr'],
          environments: ['dev'],
        };

        const mockEntries: Entry[] = [
          {
            uid: 'entry1',
            content_type_uid: 'blog',
            _version: 1,
            locale: 'en-us',
            updated_at: new Date().toISOString(),
          },
        ];

        entryServiceStub.fetchEntriesByContentType.resolves(mockEntries);

        const result = await fetchEntries(config, mockManagementStack, mockDeliveryStack, mockLogger);

        // 2 content types × 2 locales = 4 calls
        expect(result).to.have.lengthOf(4);
        expect(entryServiceStub.fetchEntriesByContentType.callCount).to.equal(4);
      });

      it('should throw error when no content types specified', async () => {
        const config: BulkOperationConfig = {
          contentTypes: [],
          locales: ['en-us'],
          environments: ['dev'],
        };

        try {
          await fetchEntries(config, mockManagementStack, mockDeliveryStack, mockLogger);
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error.message).to.match(/Content type list cannot be empty/);
          expect(mockLogger.error.calledWith(sinon.match(/At least one content type/))).to.be.true;
        }
      });

      it('should throw error when no locales specified', async () => {
        const config: BulkOperationConfig = {
          contentTypes: ['blog'],
          environments: ['dev'],
        };

        try {
          await fetchEntries(config, mockManagementStack, mockDeliveryStack, mockLogger);
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error.message).to.match(/Locale list cannot be empty/);
          expect(mockLogger.error.called).to.be.true;
        }
      });

      it('should throw error when no environments specified', async () => {
        const config: BulkOperationConfig = {
          contentTypes: ['blog'],
          locales: ['en-us'],
          environments: [],
        };

        try {
          await fetchEntries(config, mockManagementStack, mockDeliveryStack, mockLogger);
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error.message).to.match(/Environment list cannot be empty/);
          expect(mockLogger.error.called).to.be.true;
        }
      });
    });

    describe('Asset Operations', () => {
      it('should fetch assets when resourceType is ASSET', async () => {
        const config: BulkOperationConfig = {
          locales: ['en-us'],
          environments: ['dev'],
        };

        const mockAssets: Asset[] = [
          {
            uid: 'asset1',
            filename: 'image.jpg',
            _version: 1,
          },
        ];

        assetServiceStub.fetchAllAssets.resolves(mockAssets);

        const result = await fetchAssets(config, mockManagementStack, mockDeliveryStack, mockLogger);

        expect(result).to.have.lengthOf(1);
        expect(result[0].type).to.equal('asset');
        expect(result[0].uid).to.equal('asset1');
        // Logs at debug level now
        expect(mockLogger.debug.called).to.be.true;
      });

      it('should require locales for assets', async () => {
        const config: BulkOperationConfig = {
          environments: ['dev'],
          locales: ['en-us'], // Locales are required
        };

        const mockAssets: Asset[] = [
          {
            uid: 'asset1',
            filename: 'image.jpg',
            _version: 1,
          },
        ];

        assetServiceStub.fetchAllAssets.resolves(mockAssets);

        const result = await fetchAssets(config, mockManagementStack, mockDeliveryStack, mockLogger);

        expect(result).to.have.lengthOf(1);
        expect(result[0].locale).to.equal('en-us');
      });

      it('should handle empty asset results', async () => {
        const config: BulkOperationConfig = {
          locales: ['en-us'],
          environments: ['dev'],
        };

        assetServiceStub.fetchAllAssets.resolves([]);

        const result = await fetchAssets(config, mockManagementStack, mockDeliveryStack, mockLogger);

        expect(result).to.have.lengthOf(0);
      });

      it('should create asset publish data for multiple locales', async () => {
        const config: BulkOperationConfig = {
          locales: ['en-us', 'fr-fr', 'de-de'],
          environments: ['dev'],
        };

        const mockAssets: Asset[] = [
          {
            uid: 'asset1',
            filename: 'image.jpg',
            _version: 1,
          },
          {
            uid: 'asset2',
            filename: 'document.pdf',
            _version: 1,
          },
        ];

        assetServiceStub.fetchAllAssets.resolves(mockAssets);

        const result = await fetchAssets(config, mockManagementStack, mockDeliveryStack, mockLogger);

        // 2 assets × 3 locales = 6 publish data items
        expect(result).to.have.lengthOf(6);
        expect(result.filter((r) => r.locale === 'en-us')).to.have.lengthOf(2);
        expect(result.filter((r) => r.locale === 'fr-fr')).to.have.lengthOf(2);
        expect(result.filter((r) => r.locale === 'de-de')).to.have.lengthOf(2);
      });
    });

    describe('ALL Resource Type', () => {
      it('should fetch both entries and assets when resourceType is ALL', async () => {
        const config: BulkOperationConfig = {
          contentTypes: ['blog'],
          locales: ['en-us'],
          environments: ['dev'],
        };

        const mockEntries: Entry[] = [
          {
            uid: 'entry1',
            content_type_uid: 'blog',
            _version: 1,
            locale: 'en-us',
            updated_at: new Date().toISOString(),
          },
        ];

        const mockAssets: Asset[] = [
          {
            uid: 'asset1',
            filename: 'image.jpg',
            _version: 1,
          },
        ];

        entryServiceStub.fetchEntriesByContentType.resolves(mockEntries);
        assetServiceStub.fetchAllAssets.resolves(mockAssets);

        const entries = await fetchEntries(config, mockManagementStack, mockDeliveryStack, mockLogger);
        const assets = await fetchAssets(config, mockManagementStack, mockDeliveryStack, mockLogger);
        const result = [...entries, ...assets];

        expect(result).to.have.lengthOf(2);
        expect(result[0].type).to.equal('entry');
        expect(result[1].type).to.equal('asset');
      });
    });

    describe('Filter Operations - Entries', () => {
      it('should apply DRAFT filter to entries', async () => {
        const config: BulkOperationConfig = {
          contentTypes: ['blog'],
          locales: ['en-us'],
          environments: ['dev'],
          filters: {
            filterType: FilterType.DRAFT,
          },
        };

        const mockEntries: Entry[] = [
          {
            uid: 'entry1',
            content_type_uid: 'blog',
            _version: 1,
            locale: 'en-us',
            updated_at: new Date().toISOString(),
          },
          {
            uid: 'entry2',
            content_type_uid: 'blog',
            _version: 1,
            locale: 'en-us',
            updated_at: new Date().toISOString(),
          },
        ];

        const draftEntries: Entry[] = [mockEntries[0]];

        entryServiceStub.fetchEntriesByContentType.resolves(mockEntries);
        entryServiceStub.filterDraftEntries.resolves(draftEntries);

        const result = await fetchEntries(config, mockManagementStack, mockDeliveryStack, mockLogger);

        expect(result).to.have.lengthOf(1);
        expect(entryServiceStub.filterDraftEntries.calledOnce).to.be.true;
        expect(entryServiceStub.filterDraftEntries.calledWith(mockEntries, 'blog', 'dev')).to.be.true;
        expect(mockLogger.debug.calledWith(sinon.match(/draft entries/))).to.be.true;
      });

      it('should apply UNPUBLISHED filter to entries', async () => {
        const config: BulkOperationConfig = {
          contentTypes: ['blog'],
          locales: ['en-us'],
          environments: ['dev'],
          filters: {
            filterType: FilterType.UNPUBLISHED,
          },
        };

        const mockEntries: Entry[] = [
          {
            uid: 'entry1',
            content_type_uid: 'blog',
            _version: 1,
            locale: 'en-us',
            updated_at: new Date().toISOString(),
          },
        ];

        entryServiceStub.fetchEntriesByContentType.resolves(mockEntries);
        entryServiceStub.filterUnpublishedEntries.resolves(mockEntries);

        const result = await fetchEntries(config, mockManagementStack, mockDeliveryStack, mockLogger);

        expect(result).to.have.lengthOf(1);
        expect(entryServiceStub.filterUnpublishedEntries.calledOnce).to.be.true;
        expect(mockLogger.debug.calledWith(sinon.match(/unpublished entries/))).to.be.true;
      });

      it('should apply onlyUnpublished filter to entries', async () => {
        const config: BulkOperationConfig = {
          contentTypes: ['blog'],
          locales: ['en-us'],
          environments: ['dev'],
          filters: {
            onlyUnpublished: true,
          },
        };

        const mockEntries: Entry[] = [
          {
            uid: 'entry1',
            content_type_uid: 'blog',
            _version: 1,
            locale: 'en-us',
            updated_at: new Date().toISOString(),
          },
        ];

        entryServiceStub.fetchEntriesByContentType.resolves(mockEntries);
        entryServiceStub.filterUnpublishedEntries.resolves(mockEntries);

        const result = await fetchEntries(config, mockManagementStack, mockDeliveryStack, mockLogger);

        expect(result).to.have.lengthOf(1);
        expect(entryServiceStub.filterUnpublishedEntries.calledOnce).to.be.true;
      });

      it('should apply MODIFIED filter to entries', async () => {
        const config: BulkOperationConfig = {
          contentTypes: ['blog'],
          locales: ['en-us'],
          environments: ['dev'],
          filters: {
            filterType: FilterType.MODIFIED,
          },
        };

        const mockEntries: Entry[] = [
          {
            uid: 'entry1',
            content_type_uid: 'blog',
            _version: 2,
            locale: 'en-us',
            updated_at: new Date().toISOString(),
          },
        ];

        entryServiceStub.fetchEntriesByContentType.resolves(mockEntries);
        entryServiceStub.filterModifiedEntries.resolves(mockEntries);

        const result = await fetchEntries(config, mockManagementStack, mockDeliveryStack, mockLogger);

        expect(result).to.have.lengthOf(1);
        expect(entryServiceStub.filterModifiedEntries.calledOnce).to.be.true;
        // Modified filter uses target environment (first in environments array)
        expect(entryServiceStub.filterModifiedEntries.calledWith(mockEntries, 'blog', 'dev')).to.be.true;
        expect(mockLogger.debug.calledWith(sinon.match(/modified entries/))).to.be.true;
      });

      // modifiedAfter filter feature was removed - these tests are skipped
      it.skip('should apply modifiedAfter date filter to entries', async () => {
        // Feature removed
      });

      it.skip('should filter out entries without updated_at when using modifiedAfter', async () => {
        // Feature removed
      });
    });

    describe('Filter Operations - Assets', () => {
      it('should apply onlyUnpublished filter to assets', async () => {
        const config: BulkOperationConfig = {
          locales: ['en-us'],
          environments: ['dev'],
          filters: {
            onlyUnpublished: true,
          },
        };

        const mockAssets: Asset[] = [
          {
            uid: 'asset1',
            filename: 'image.jpg',
            _version: 1,
          },
        ];

        const unpublishedAssets: Asset[] = [mockAssets[0]];

        assetServiceStub.fetchAllAssets.resolves(mockAssets);
        assetServiceStub.filterUnpublishedAssets.resolves(unpublishedAssets);

        const result = await fetchAssets(config, mockManagementStack, mockDeliveryStack, mockLogger);

        expect(result).to.have.lengthOf(1);
        expect(assetServiceStub.filterUnpublishedAssets.calledOnce).to.be.true;
        expect(mockLogger.debug.calledWith(sinon.match(/unpublished assets/))).to.be.true;
      });

      it('should not filter assets when onlyUnpublished is false', async () => {
        const config: BulkOperationConfig = {
          locales: ['en-us'],
          environments: ['dev'],
          filters: {
            onlyUnpublished: false,
          },
        };

        const mockAssets: Asset[] = [
          {
            uid: 'asset1',
            filename: 'image.jpg',
            _version: 1,
          },
          {
            uid: 'asset2',
            filename: 'image2.jpg',
            _version: 1,
          },
        ];

        assetServiceStub.fetchAllAssets.resolves(mockAssets);

        const result = await fetchAssets(config, mockManagementStack, mockDeliveryStack, mockLogger);

        expect(result).to.have.lengthOf(2);
        expect(assetServiceStub.filterUnpublishedAssets.called).to.be.false;
      });
    });

    describe('Publish Details', () => {
      it('should create correct publish_details for multiple environments', async () => {
        const config: BulkOperationConfig = {
          contentTypes: ['blog'],
          locales: ['en-us'],
          environments: ['dev', 'staging', 'production'],
        };

        const mockEntries: Entry[] = [
          {
            uid: 'entry1',
            content_type_uid: 'blog',
            _version: 1,
            locale: 'en-us',
            updated_at: new Date().toISOString(),
          },
        ];

        entryServiceStub.fetchEntriesByContentType.resolves(mockEntries);

        const result = await fetchEntries(config, mockManagementStack, mockDeliveryStack, mockLogger);

        expect(result).to.have.lengthOf(1);
        expect(result[0].publish_details).to.have.lengthOf(3);
        expect(result[0].publish_details?.[0].environment).to.equal('dev');
        expect(result[0].publish_details?.[1].environment).to.equal('staging');
        expect(result[0].publish_details?.[2].environment).to.equal('production');
      });

      it('should create publish_details with correct locale for each environment', async () => {
        const config: BulkOperationConfig = {
          locales: ['fr-fr'],
          environments: ['dev', 'staging'],
        };

        const mockAssets: Asset[] = [
          {
            uid: 'asset1',
            filename: 'image.jpg',
            _version: 1,
          },
        ];

        assetServiceStub.fetchAllAssets.resolves(mockAssets);

        const result = await fetchAssets(config, mockManagementStack, mockDeliveryStack, mockLogger);

        expect(result).to.have.lengthOf(1);
        expect(result[0].publish_details).to.have.lengthOf(2);
        expect(result[0].publish_details?.[0]).to.deep.equal({ environment: 'dev', locale: 'fr-fr' });
        expect(result[0].publish_details?.[1]).to.deep.equal({ environment: 'staging', locale: 'fr-fr' });
      });

      it('should use entry locale in publish_details', async () => {
        const config: BulkOperationConfig = {
          contentTypes: ['blog'],
          locales: ['en-us'],
          environments: ['dev'],
        };

        const mockEntries: Entry[] = [
          {
            uid: 'entry1',
            content_type_uid: 'blog',
            _version: 1,
            locale: 'fr-fr',
            updated_at: new Date().toISOString(),
          },
        ];

        entryServiceStub.fetchEntriesByContentType.resolves(mockEntries);

        const result = await fetchEntries(config, mockManagementStack, mockDeliveryStack, mockLogger);

        expect(result[0].locale).to.equal('fr-fr');
        expect(result[0].publish_details?.[0].locale).to.equal('fr-fr');
      });
    });

    describe('Error Handling', () => {
      it('should handle service errors gracefully', async () => {
        const config: BulkOperationConfig = {
          contentTypes: ['blog'],
          locales: ['en-us'],
          environments: ['dev'],
        };

        entryServiceStub.fetchEntriesByContentType.rejects(new Error('Service error'));

        try {
          await fetchEntries(config, mockManagementStack, mockDeliveryStack, mockLogger);
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error.message).to.include('Service error');
        }
      });
    });
  });
});
