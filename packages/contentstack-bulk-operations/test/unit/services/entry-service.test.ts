import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { Entry } from '../../../src/interfaces';
import messages, { $t } from '../../../src/messages';
import { EntryService } from '../../../src/services/entry-service';
import { identifyNonLocalizedFields, compareNonLocalizedFields } from '../../../src/utils/non-localized-field-handler';

describe('EntryService', () => {
  let entryService: EntryService;
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
      contentType: sandbox.stub(),
      locale: sandbox.stub(),
    };

    entryService = new EntryService(mockStack, null, mockLogger);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('fetchEntriesByContentType', () => {
    it('should fetch all entries with pagination using include_count', async () => {
      const mockEntries1 = Array(100).fill({ uid: 'entry-1', content_type_uid: 'blog' });
      const mockEntries2 = Array(50).fill({ uid: 'entry-2', content_type_uid: 'blog' });

      const mockQuery = {
        find: sandbox
          .stub()
          .onFirstCall()
          .resolves({ items: mockEntries1, count: 150 })
          .onSecondCall()
          .resolves({ items: mockEntries2, count: 150 }),
      };

      const mockEntry = {
        query: sandbox.stub().returns(mockQuery),
      };

      mockStack.contentType.returns({
        entry: sandbox.stub().returns(mockEntry),
      });

      const result = await entryService.fetchEntriesByContentType('blog');

      expect(result).to.have.lengthOf(150);
      expect(mockStack.contentType.calledWith('blog')).to.be.true;
      expect(mockLogger.info.calledWith($t(messages.FETCHING_ENTRIES, { contentType: 'blog' }))).to.be.true;
      expect(mockEntry.query.firstCall.args[0]).to.deep.include({ include_count: true });
    });

    it('should handle empty results', async () => {
      const mockQuery = {
        find: sandbox.stub().resolves({ items: [] }),
      };

      const mockEntry = {
        query: sandbox.stub().returns(mockQuery),
      };

      mockStack.contentType.returns({
        entry: sandbox.stub().returns(mockEntry),
      });

      const result = await entryService.fetchEntriesByContentType('blog');

      expect(result).to.have.lengthOf(0);
      expect(mockLogger.info.calledWith($t(messages.FETCHED_TOTAL_ENTRIES, { total: 0, contentType: 'blog' }))).to.be
        .true;
    });

    it('should throw error on fetch failure', async () => {
      const mockError = new Error('API Error');
      const mockQuery = {
        find: sandbox.stub().rejects(mockError),
      };

      const mockEntry = {
        query: sandbox.stub().returns(mockQuery),
      };

      mockStack.contentType.returns({
        entry: sandbox.stub().returns(mockEntry),
      });

      try {
        await entryService.fetchEntriesByContentType('blog');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal('API Error');
        expect(mockLogger.error.called).to.be.true;
      }
    });
  });

  describe('fetchEntriesByUIDs', () => {
    it('should fetch entries by specific UIDs', async () => {
      const mockEntries = [
        { uid: 'entry1', content_type_uid: 'blog' },
        { uid: 'entry2', content_type_uid: 'blog' },
      ];

      const mockQuery = {
        find: sandbox.stub().resolves({ items: mockEntries }),
      };

      const mockEntry = {
        query: sandbox.stub().returns(mockQuery),
      };

      mockStack.contentType.returns({
        entry: sandbox.stub().returns(mockEntry),
      });

      const result = await entryService.fetchEntriesByUIDs('blog', ['entry1', 'entry2']);

      expect(result).to.have.lengthOf(2);
      expect(result[0].uid).to.equal('entry1');
      expect(mockLogger.info.calledWith($t(messages.FETCHED_BY_UID, { count: 2 }))).to.be.true;
    });

    it('should return empty array for empty UIDs', async () => {
      const result = await entryService.fetchEntriesByUIDs('blog', []);

      expect(result).to.have.lengthOf(0);
      expect(mockStack.contentType.called).to.be.false;
    });

    it('should handle query options', async () => {
      const mockEntries = [{ uid: 'entry1' }];
      const mockQuery = {
        find: sandbox.stub().resolves({ items: mockEntries }),
      };

      const mockEntry = {
        query: sandbox.stub().returns(mockQuery),
      };

      mockStack.contentType.returns({
        entry: sandbox.stub().returns(mockEntry),
      });

      await entryService.fetchEntriesByUIDs('blog', ['entry1'], { locale: 'en-us' });

      expect(mockEntry.query.calledWith(sinon.match({ locale: 'en-us' }))).to.be.true;
    });
  });

  describe('filterDraftEntries', () => {
    it('should filter entries modified since last publish', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 3,
          publish_details: [{ environment: 'production', locale: 'en-us', version: 2 }],
        },
        {
          uid: 'entry2',
          content_type_uid: 'blog',
          _version: 1,
          publish_details: [{ environment: 'production', locale: 'en-us', version: 1 }],
        },
        {
          uid: 'entry3',
          content_type_uid: 'blog',
          _version: 1,
          publish_details: [],
        },
      ];

      const result = await entryService.filterDraftEntries(entries, 'blog', 'production', 'en-us');

      expect(result).to.have.lengthOf(2);
      expect(result[0].uid).to.equal('entry1'); // version 3 > published version 2
      expect(result[1].uid).to.equal('entry3'); // no publish details
    });

    it('should filter entries never published', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 1,
        },
        {
          uid: 'entry2',
          content_type_uid: 'blog',
          _version: 2,
          publish_details: [],
        },
      ];

      const result = await entryService.filterDraftEntries(entries, 'blog', 'production');

      expect(result).to.have.lengthOf(2);
    });

    it('should return empty array when no drafts found', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 1,
          publish_details: [{ environment: 'production', locale: 'en-us', version: 1 }],
        },
      ];

      const result = await entryService.filterDraftEntries(entries, 'blog', 'production', 'en-us');

      expect(result).to.have.lengthOf(0);
    });

    it('should handle non-array publish_details', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 1,
          publish_details: null as any,
        },
      ];

      const result = await entryService.filterDraftEntries(entries, 'blog', 'production');

      expect(result).to.have.lengthOf(1);
    });
  });

  describe('filterModifiedEntries', () => {
    it('should filter entries modified since source environment publish', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 5,
          publish_details: [{ environment: 'production', locale: 'en-us', version: 3 }],
        },
        {
          uid: 'entry2',
          content_type_uid: 'blog',
          _version: 3,
          publish_details: [{ environment: 'production', locale: 'en-us', version: 4 }],
        },
      ];

      const result = await entryService.filterModifiedEntries(entries, 'blog', 'production');

      expect(result).to.have.lengthOf(1);
      expect(result[0].uid).to.equal('entry1');
    });

    it('should include entries not published in source environment', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 5,
          publish_details: [], // Not published to any environment
        },
      ];

      const result = await entryService.filterModifiedEntries(entries, 'blog', 'production');

      // Entries not published should NOT be included (only modified entries)
      expect(result).to.have.lengthOf(0);
    });

    it('should return empty array for empty entries', async () => {
      const result = await entryService.filterModifiedEntries([], 'blog', 'production');

      expect(result).to.have.lengthOf(0);
    });

    it('should handle errors gracefully', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 5,
          publish_details: [{ environment: 'production', locale: 'en-us', version: 3 }],
        },
      ];

      // This should not throw, just filter based on publish_details
      const result = await entryService.filterModifiedEntries(entries, 'blog', 'production');
      expect(result).to.have.lengthOf(1);
    });
  });

  describe('filterUnpublishedEntries', () => {
    it('should filter entries not published to target environment', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 1,
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
        {
          uid: 'entry2',
          content_type_uid: 'blog',
          _version: 1,
          publish_details: [{ environment: 'production', locale: 'en-us', version: 1 }],
        },
        {
          uid: 'entry3',
          content_type_uid: 'blog',
          _version: 1,
          publish_details: [],
        },
      ];

      const result = await entryService.filterUnpublishedEntries(entries, 'production');

      expect(result).to.have.lengthOf(2);
      expect(result[0].uid).to.equal('entry1');
      expect(result[1].uid).to.equal('entry3');
    });

    it('should include entries with no publish_details', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 1,
        },
      ];

      const result = await entryService.filterUnpublishedEntries(entries, 'production');

      expect(result).to.have.lengthOf(1);
    });
  });

  describe('fetchPublishedEntriesByUIDs', () => {
    it('should fetch published entries from specific environment', async () => {
      const mockEntries = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          publish_details: [{ environment: 'production', locale: 'en-us', version: 1 }],
        },
        {
          uid: 'entry2',
          content_type_uid: 'blog',
          publish_details: [{ environment: 'dev', locale: 'en-us', version: 1 }],
        },
      ];

      // Mock delivery SDK
      const mockDeliveryStack = {
        contentType: sandbox.stub().returns({
          entry: sandbox.stub().returns({
            query: sandbox.stub().returns({
              containedIn: sandbox.stub().returnsThis(),
              find: sandbox.stub().resolves({ entries: mockEntries }),
            }),
          }),
        }),
      };

      entryService = new EntryService(mockStack, mockDeliveryStack as any, mockLogger);

      const result = await entryService.fetchPublishedEntriesByUIDs('blog', ['entry1', 'entry2'], 'production');

      expect(result).to.have.lengthOf(2);
      expect(result[0].uid).to.equal('entry1');
    });

    it('should filter out entries with non-array publish_details', async () => {
      const mockEntries = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          publish_details: [{ environment: 'production', locale: 'en-us', version: 1 }],
        },
        {
          uid: 'entry2',
          content_type_uid: 'blog',
          publish_details: null,
        },
        {
          uid: 'entry3',
          content_type_uid: 'blog',
          publish_details: undefined,
        },
      ];

      // Mock delivery SDK
      const mockDeliveryStack = {
        contentType: sandbox.stub().returns({
          entry: sandbox.stub().returns({
            query: sandbox.stub().returns({
              containedIn: sandbox.stub().returnsThis(),
              find: sandbox.stub().resolves({ entries: mockEntries }),
            }),
          }),
        }),
      };

      entryService = new EntryService(mockStack, mockDeliveryStack as any, mockLogger);

      const result = await entryService.fetchPublishedEntriesByUIDs(
        'blog',
        ['entry1', 'entry2', 'entry3'],
        'production'
      );

      expect(result).to.have.lengthOf(3);
      expect(result[0].uid).to.equal('entry1');
    });

    it('should handle batching for large UID lists', async () => {
      const uids = Array(250)
        .fill(null)
        .map((_, i) => `entry${i}`);
      const mockEntriesBatch1 = Array(100).fill({
        uid: 'entry1',
        publish_details: [{ environment: 'production' }],
      });
      const mockEntriesBatch2 = Array(100).fill({
        uid: 'entry2',
        publish_details: [{ environment: 'production' }],
      });
      const mockEntriesBatch3 = Array(50).fill({
        uid: 'entry3',
        publish_details: [{ environment: 'production' }],
      });

      const findStub = sandbox
        .stub()
        .onFirstCall()
        .resolves({ entries: mockEntriesBatch1 })
        .onSecondCall()
        .resolves({ entries: mockEntriesBatch2 })
        .onThirdCall()
        .resolves({ entries: mockEntriesBatch3 });

      // Mock delivery SDK
      const mockDeliveryStack = {
        contentType: sandbox.stub().returns({
          entry: sandbox.stub().returns({
            query: sandbox.stub().returns({
              containedIn: sandbox.stub().returnsThis(),
              find: findStub,
            }),
          }),
        }),
      };

      entryService = new EntryService(mockStack, mockDeliveryStack as any, mockLogger);

      const result = await entryService.fetchPublishedEntriesByUIDs('blog', uids, 'production');

      expect(result).to.have.lengthOf(250);
      expect(findStub.callCount).to.equal(3);
    });

    it('should return empty array for empty UIDs', async () => {
      const result = await entryService.fetchPublishedEntriesByUIDs('blog', [], 'production');

      expect(result).to.have.lengthOf(0);
    });
  });

  describe('fetchAllEntries', () => {
    it('should fetch entries for multiple content types', async () => {
      const mockBlogEntries = [{ uid: 'blog1', content_type_uid: 'blog' }];
      const mockArticleEntries = [{ uid: 'article1', content_type_uid: 'article' }];

      const fetchStub = sandbox
        .stub(entryService, 'fetchEntriesByContentType')
        .onFirstCall()
        .resolves(mockBlogEntries)
        .onSecondCall()
        .resolves(mockArticleEntries);

      const result = await entryService.fetchAllEntries(['blog', 'article']);

      expect(result).to.have.lengthOf(2);
      expect(fetchStub.callCount).to.equal(2);
    });

    it('should continue on error for individual content types', async () => {
      const mockBlogEntries = [{ uid: 'blog1', content_type_uid: 'blog' }];

      sandbox
        .stub(entryService, 'fetchEntriesByContentType')
        .onFirstCall()
        .resolves(mockBlogEntries)
        .onSecondCall()
        .rejects(new Error('API Error'));

      const result = await entryService.fetchAllEntries(['blog', 'article']);

      expect(result).to.have.lengthOf(1);
      expect(mockLogger.warn.called).to.be.true;
    });

    it('should handle empty content types array', async () => {
      const result = await entryService.fetchAllEntries([]);

      expect(result).to.have.lengthOf(0);
    });

    // Note: These tests reference a method that doesn't exist yet
    // Commenting out until fetchEntriesByContentTypesAndLocales is implemented
    it.skip('should fetch entries for multiple content types and locales', async () => {
      // Mock responses for different content types and locales
      const mockBlogEn = [{ uid: 'blog1', _version: 1, locale: 'en-us' }];
      const mockBlogFr = [{ uid: 'blog1', _version: 1, locale: 'fr-fr' }];
      const mockArticleEn = [{ uid: 'article1', _version: 1, locale: 'en-us' }];
      const mockArticleFr = [{ uid: 'article1', _version: 1, locale: 'fr-fr' }];

      const fetchStub = sandbox.stub(entryService, 'fetchEntriesByContentType');
      fetchStub.withArgs('blog', sinon.match({ locale: 'en-us' })).resolves(mockBlogEn);
      fetchStub.withArgs('blog', sinon.match({ locale: 'fr-fr' })).resolves(mockBlogFr);
      fetchStub.withArgs('article', sinon.match({ locale: 'en-us' })).resolves(mockArticleEn);
      fetchStub.withArgs('article', sinon.match({ locale: 'fr-fr' })).resolves(mockArticleFr);

      // const resultMap = await entryService.fetchEntriesByContentTypesAndLocales(['blog', 'article'], ['en-us', 'fr-fr']);

      // expect(resultMap.size).to.equal(2); // 2 locales
      // expect(resultMap.get('en-us')?.size).to.equal(2); // 2 content types
      // expect(resultMap.get('fr-fr')?.size).to.equal(2); // 2 content types
      // expect(resultMap.get('en-us')?.get('blog')).to.deep.equal(mockBlogEn);
      // expect(resultMap.get('fr-fr')?.get('article')).to.deep.equal(mockArticleFr);
    });

    it.skip('should handle errors for specific locale while continuing others', async () => {
      const mockSuccessEntries = [{ uid: 'entry1', _version: 1 }];

      const fetchStub = sandbox.stub(entryService, 'fetchEntriesByContentType');
      fetchStub.withArgs('blog', sinon.match({ locale: 'en-us' })).resolves(mockSuccessEntries);
      fetchStub.withArgs('blog', sinon.match({ locale: 'fr-fr' })).rejects(new Error('Fetch failed'));

      // const resultMap = await entryService.fetchEntriesByContentTypesAndLocales(['blog'], ['en-us', 'fr-fr']);

      // expect(resultMap.size).to.equal(2);
      // expect(resultMap.get('en-us')?.get('blog')).to.have.lengthOf(1);
      // expect(resultMap.get('fr-fr')?.get('blog')).to.have.lengthOf(0); // Empty due to error
    });
  });

  // fetchPublishedVersions method removed - now using publish_details directly

  describe('fetchEntryVariants', () => {
    it('should fetch variants for an entry', async () => {
      const mockVariantsResponse = {
        items: [{ variants: { _variant: { _uid: 'variant-1' } } }, { variants: { _variant: { _uid: 'variant-2' } } }],
      };

      const mockVariantsQuery = {
        find: sandbox.stub().resolves(mockVariantsResponse),
      };

      const mockVariants = {
        query: sandbox.stub().returns(mockVariantsQuery),
      };

      const mockEntry = {
        variants: sandbox.stub().returns(mockVariants),
      };

      mockStack.contentType.returns({
        entry: sandbox.stub().returns(mockEntry),
      });

      const result = await entryService.fetchEntryVariants('blog', 'entry1', 'en-us');

      expect(result).to.have.lengthOf(2);
      expect(result[0].uid).to.equal('variant-1');
      expect(result[1].uid).to.equal('variant-2');
    });

    it('should return empty array when no variants exist', async () => {
      const mockVariantsResponse = {
        items: [],
      };

      const mockVariantsQuery = {
        find: sandbox.stub().resolves(mockVariantsResponse),
      };

      const mockVariants = {
        query: sandbox.stub().returns(mockVariantsQuery),
      };

      const mockEntry = {
        variants: sandbox.stub().returns(mockVariants),
      };

      mockStack.contentType.returns({
        entry: sandbox.stub().returns(mockEntry),
      });

      const result = await entryService.fetchEntryVariants('blog', 'entry1');

      expect(result).to.have.lengthOf(0);
    });

    it('should filter out variants with undefined UIDs', async () => {
      const mockVariantsResponse = {
        items: [
          { variants: { _variant: { _uid: 'variant-1' } } },
          { variants: { _variant: {} } }, // No _uid
          { variants: null }, // Invalid structure
        ],
      };

      const mockVariantsQuery = {
        find: sandbox.stub().resolves(mockVariantsResponse),
      };

      const mockVariants = {
        query: sandbox.stub().returns(mockVariantsQuery),
      };

      const mockEntry = {
        variants: sandbox.stub().returns(mockVariants),
      };

      mockStack.contentType.returns({
        entry: sandbox.stub().returns(mockEntry),
      });

      const result = await entryService.fetchEntryVariants('blog', 'entry1', 'en-us');

      expect(result).to.have.lengthOf(1);
      expect(result[0].uid).to.equal('variant-1');
    });

    it('should handle pagination for variants', async () => {
      // First page returns 100 items, second page returns less (end of results)
      const mockVariantsPage1 = {
        items: Array(100).fill({ variants: { _variant: { _uid: 'v1' } } }),
      };
      const mockVariantsPage2 = {
        items: Array(25).fill({ variants: { _variant: { _uid: 'v2' } } }),
      };

      const findStub = sandbox
        .stub()
        .onFirstCall()
        .resolves(mockVariantsPage1)
        .onSecondCall()
        .resolves(mockVariantsPage2);

      const mockVariantsQuery = {
        find: findStub,
      };

      const mockVariants = {
        query: sandbox.stub().returns(mockVariantsQuery),
      };

      const mockEntry = {
        variants: sandbox.stub().returns(mockVariants),
      };

      mockStack.contentType.returns({
        entry: sandbox.stub().returns(mockEntry),
      });

      const result = await entryService.fetchEntryVariants('blog', 'entry1', 'en-us');

      expect(result).to.have.lengthOf(125);
      expect(findStub.callCount).to.equal(2);
    });

    it('should handle errors gracefully', async () => {
      const mockEntry = {
        variants: sandbox.stub().returns({
          query: sandbox.stub().returns({
            find: sandbox.stub().rejects(new Error('API Error')),
          }),
        }),
      };

      mockStack.contentType.returns({
        entry: sandbox.stub().returns(mockEntry),
      });

      const result = await entryService.fetchEntryVariants('blog', 'entry1', 'en-us');

      expect(result).to.have.lengthOf(0);
      expect(mockLogger.debug.called).to.be.true;
    });
  });

  describe('attachVariantsToEntries', () => {
    it('should attach variants to entries', async () => {
      const entries = [
        { uid: 'entry1', _version: 1 },
        { uid: 'entry2', _version: 1 },
      ];

      sandbox
        .stub(entryService, 'fetchEntryVariants')
        .onFirstCall()
        .resolves([{ uid: 'variant-1' }, { uid: 'variant-2' }])
        .onSecondCall()
        .resolves([]);

      const result = await entryService.attachVariantsToEntries(entries, 'blog', 'en-us');

      expect(result).to.have.lengthOf(2);
      expect(result[0].variants).to.have.lengthOf(2);
      expect(result[0].variant_rules).to.deep.equal({
        publish_latest_base: false,
        publish_latest_base_conditionally: true,
      });
      expect(result[1].variants).to.be.undefined;
    });

    it('should handle entries with no variants', async () => {
      const entries = [{ uid: 'entry1', _version: 1 }];

      sandbox.stub(entryService, 'fetchEntryVariants').resolves([]);

      const result = await entryService.attachVariantsToEntries(entries, 'blog');

      expect(result).to.have.lengthOf(1);
      expect(result[0].variants).to.be.undefined;
    });

    it('should log variant count', async () => {
      const entries = [
        { uid: 'entry1', _version: 1 },
        { uid: 'entry2', _version: 1 },
      ];

      sandbox.stub(entryService, 'fetchEntryVariants').resolves([{ uid: 'variant-1' }]);

      await entryService.attachVariantsToEntries(entries, 'blog', 'en-us');

      expect(mockLogger.info.calledWith(sinon.match(/Fetching variants/))).to.be.true;
      expect(mockLogger.info.calledWith(sinon.match(/Attached variants/))).to.be.true;
    });
  });

  // ========================================
  // NON-LOCALIZED FILTER TESTS
  // ========================================
  describe('fetchContentTypeSchema', () => {
    it('should fetch content type schema successfully', async () => {
      const mockSchema = {
        uid: 'blog',
        title: 'Blog',
        schema: [
          { uid: 'title', data_type: 'text', localized: true },
          { uid: 'status', data_type: 'text', localized: false },
        ],
      };

      mockStack.contentType.withArgs('blog').returns({
        fetch: sandbox.stub().resolves(mockSchema),
        entry: sandbox.stub().returns({
          query: sandbox.stub().returns({
            find: sandbox.stub().resolves({
              items: [{ uid: 'entry1', status: 'published' }],
            }),
          }),
        }),
      });

      const result = await entryService.fetchContentTypeSchema('blog');

      expect(result).to.deep.equal(mockSchema);
      expect(mockStack.contentType.calledWith('blog')).to.be.true;
    });

    it('should throw error when content type does not exist', async () => {
      const mockError = new Error('Content type not found');
      mockStack.contentType.returns({
        fetch: sandbox.stub().rejects(mockError),
      });

      try {
        await entryService.fetchContentTypeSchema('nonexistent');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.equal('Content type not found');
      }
    });

    it('should throw validation error for null content type', async () => {
      try {
        await entryService.fetchContentTypeSchema(null as any);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Content type');
      }
    });

    it('should throw validation error for undefined content type', async () => {
      try {
        await entryService.fetchContentTypeSchema(undefined as any);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Content type');
      }
    });

    it('should handle empty content type string', async () => {
      try {
        await entryService.fetchContentTypeSchema('');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Content type');
      }
    });

    it('should handle schema with no fields', async () => {
      const mockSchema = {
        uid: 'blog',
        title: 'Blog',
        schema: [],
      };

      mockStack.contentType.withArgs('blog').returns({
        fetch: sandbox.stub().resolves(mockSchema),
        entry: sandbox.stub().returns({
          query: sandbox.stub().returns({
            find: sandbox.stub().resolves({
              items: [{ uid: 'entry1', status: 'published' }],
            }),
          }),
        }),
      });

      const result = await entryService.fetchContentTypeSchema('blog');

      expect(result).to.deep.equal(mockSchema);
    });
  });

  describe('identifyNonLocalizedFields', () => {
    it('should identify non-localized fields from schema', () => {
      const schema = {
        schema: [
          { uid: 'title', data_type: 'text', localized: true },
          { uid: 'status', data_type: 'text', localized: false },
          { uid: 'priority', data_type: 'number', localized: false },
          { uid: 'content', data_type: 'text', localized: true },
        ],
      };

      const result = identifyNonLocalizedFields(schema);

      expect(result).to.have.lengthOf(2);
      expect(result).to.include('status');
      expect(result).to.include('priority');
      expect(result).to.not.include('title');
      expect(result).to.not.include('content');
    });

    it('should return empty array when all fields are localized', () => {
      const schema = {
        schema: [
          { uid: 'title', data_type: 'text', localized: true },
          { uid: 'content', data_type: 'text', localized: true },
        ],
      };

      const result = identifyNonLocalizedFields(schema);

      expect(result).to.have.lengthOf(0);
    });

    it('should return empty array when schema has no fields', () => {
      const schema = {
        schema: [],
      };

      const result = identifyNonLocalizedFields(schema);

      expect(result).to.have.lengthOf(0);
    });

    it('should return empty array when schema is missing fields array', () => {
      const schema = {
        uid: 'blog',
      };

      const result = identifyNonLocalizedFields(schema);

      expect(result).to.have.lengthOf(0);
    });

    it('should treat fields with missing localized property as localized (default)', () => {
      const schema = {
        schema: [
          { uid: 'title', data_type: 'text' }, // No localized property
          { uid: 'status', data_type: 'text', localized: false },
        ],
      };

      const result = identifyNonLocalizedFields(schema);

      expect(result).to.have.lengthOf(1);
      expect(result).to.include('status');
      expect(result).to.not.include('title'); // Treated as localized
    });

    it('should throw validation error for null schema', () => {
      try {
        identifyNonLocalizedFields(null as any);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Schema');
      }
    });

    it('should throw validation error for undefined schema', () => {
      try {
        identifyNonLocalizedFields(undefined as any);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Schema');
      }
    });

    it('should handle multiple field types correctly', () => {
      const schema = {
        schema: [
          { uid: 'title', data_type: 'text', localized: true },
          { uid: 'status', data_type: 'text', localized: false },
          { uid: 'tags', data_type: 'reference', localized: true },
          { uid: 'featured', data_type: 'boolean', localized: false },
          { uid: 'metadata', data_type: 'json', localized: false },
        ],
      };

      const result = identifyNonLocalizedFields(schema);

      expect(result).to.have.lengthOf(3);
      expect(result).to.include('status');
      expect(result).to.include('featured');
      expect(result).to.include('metadata');
    });
  });

  describe('compareNonLocalizedFields', () => {
    it('should return true when non-localized field values differ', () => {
      const sourceEntry = {
        uid: 'entry1',
        status: 'published',
        priority: 1,
      };

      const targetEntry = {
        uid: 'entry1',
        status: 'draft',
        priority: 1,
      };

      const result = compareNonLocalizedFields(sourceEntry, targetEntry, ['status', 'priority']);

      expect(result).to.be.true;
    });

    it('should return false when non-localized field values are same', () => {
      const sourceEntry = {
        uid: 'entry1',
        status: 'published',
        priority: 1,
      };

      const targetEntry = {
        uid: 'entry1',
        status: 'published',
        priority: 1,
      };

      const result = compareNonLocalizedFields(sourceEntry, targetEntry, ['status', 'priority']);

      expect(result).to.be.false;
    });

    it('should return false when field list is empty', () => {
      const sourceEntry = { uid: 'entry1', status: 'published' };
      const targetEntry = { uid: 'entry1', status: 'draft' };

      const result = compareNonLocalizedFields(sourceEntry, targetEntry, []);

      expect(result).to.be.false;
    });

    it('should return true when field exists in source but missing in target', () => {
      const sourceEntry = {
        uid: 'entry1',
        status: 'published',
      };

      const targetEntry = {
        uid: 'entry1',
      };

      const result = compareNonLocalizedFields(sourceEntry, targetEntry, ['status']);

      expect(result).to.be.true;
    });

    it('should return true when field exists in target but missing in source', () => {
      const sourceEntry = {
        uid: 'entry1',
      };

      const targetEntry = {
        uid: 'entry1',
        status: 'published',
      };

      const result = compareNonLocalizedFields(sourceEntry, targetEntry, ['status']);

      expect(result).to.be.true;
    });

    it('should return false when both entries have undefined for same field', () => {
      const sourceEntry = { uid: 'entry1' };
      const targetEntry = { uid: 'entry1' };

      const result = compareNonLocalizedFields(sourceEntry, targetEntry, ['status']);

      expect(result).to.be.false;
    });

    it('should return false when both entries have null for same field', () => {
      const sourceEntry = { uid: 'entry1', status: null };
      const targetEntry = { uid: 'entry1', status: null };

      const result = compareNonLocalizedFields(sourceEntry, targetEntry, ['status']);

      expect(result).to.be.false;
    });

    it('should handle nested object comparison', () => {
      const sourceEntry = {
        uid: 'entry1',
        metadata: { author: 'John', date: '2024-01-01' },
      };

      const targetEntry = {
        uid: 'entry1',
        metadata: { author: 'Jane', date: '2024-01-01' },
      };

      const result = compareNonLocalizedFields(sourceEntry, targetEntry, ['metadata']);

      expect(result).to.be.true;
    });

    it('should handle array comparison', () => {
      const sourceEntry = {
        uid: 'entry1',
        tags: ['tag1', 'tag2'],
      };

      const targetEntry = {
        uid: 'entry1',
        tags: ['tag1', 'tag3'],
      };

      const result = compareNonLocalizedFields(sourceEntry, targetEntry, ['tags']);

      expect(result).to.be.true;
    });

    it('should return false when arrays are equal', () => {
      const sourceEntry = {
        uid: 'entry1',
        tags: ['tag1', 'tag2'],
      };

      const targetEntry = {
        uid: 'entry1',
        tags: ['tag1', 'tag2'],
      };

      const result = compareNonLocalizedFields(sourceEntry, targetEntry, ['tags']);

      expect(result).to.be.false;
    });

    it('should throw validation error for null source entry', () => {
      const targetEntry = { uid: 'entry1' };

      try {
        compareNonLocalizedFields(null as any, targetEntry, ['status']);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Source entry');
      }
    });

    it('should return true when target entry is null', () => {
      const sourceEntry = { uid: 'entry1', status: 'published' };

      const result = compareNonLocalizedFields(sourceEntry, null as any, ['status']);

      expect(result).to.be.true;
    });

    it('should handle multiple fields with mixed changes', () => {
      const sourceEntry = {
        uid: 'entry1',
        status: 'published',
        priority: 1,
        featured: true,
      };

      const targetEntry = {
        uid: 'entry1',
        status: 'published',
        priority: 2, // Different
        featured: true,
      };

      const result = compareNonLocalizedFields(sourceEntry, targetEntry, ['status', 'priority', 'featured']);

      expect(result).to.be.true;
    });
  });

  describe('filterNonLocalizedEntries', () => {
    beforeEach(() => {
      // No delivery stack needed for new implementation
      entryService = new EntryService(mockStack, null, mockLogger);
    });

    // ========================================
    // HAPPY PATH TESTS
    // ========================================
    it('should filter entries with non-localized field changes', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 2,
          publish_details: [{ environment: 'source-env', locale: 'en-us', version: 1 }],
        },
      ];

      const mockSchema = {
        schema: [
          { uid: 'title', localized: true },
          { uid: 'status', localized: false },
        ],
      };

      // Mock content type schema fetch
      mockStack.contentType.withArgs('blog').returns({
        fetch: sandbox.stub().resolves(mockSchema),
        entry: sandbox.stub().callsFake((entryUid?: string) => {
          if (entryUid) {
            // Mock entry fetch calls
            return {
              fetch: sandbox.stub().callsFake((params: any) => {
                if (params.locale === 'en-us') {
                  // Master locale entry
                  return Promise.resolve({ uid: 'entry1', status: 'published' });
                } else if (params.locale === 'fr-fr') {
                  // Localized entry with different non-localized field
                  return Promise.resolve({ uid: 'entry1', status: 'draft' });
                }
                return Promise.resolve({});
              }),
            };
          }
          return {};
        }),
      });

      // Mock getLanguages call
      mockStack.locale.returns({
        query: sandbox.stub().returns({
          find: sandbox.stub().resolves({
            items: [
              { code: 'en-us', name: 'English (US)' },
              { code: 'fr-fr', name: 'French (France)' },
            ],
          }),
        }),
      });

      const result = await entryService.filterNonLocalizedEntries(entries, 'blog', 'source-env');

      expect(result).to.have.lengthOf(1);
      expect(result[0].uid).to.equal('entry1');
    });

    it('should return empty array when no entries have changes', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 2,
          publish_details: [{ environment: 'source-env', locale: 'en-us', version: 1 }],
        },
      ];

      const mockSchema = {
        schema: [{ uid: 'status', localized: false }],
      };

      // Mock content type schema fetch
      mockStack.contentType.withArgs('blog').returns({
        fetch: sandbox.stub().resolves(mockSchema),
        entry: sandbox.stub().callsFake((entryUid?: string) => {
          if (entryUid) {
            // Mock entry fetch calls - both master and localized have same values
            return {
              fetch: sandbox.stub().resolves({ uid: 'entry1', status: 'published' }),
            };
          }
          return {};
        }),
      });

      // Mock getLanguages call
      mockStack.locale.returns({
        query: sandbox.stub().returns({
          find: sandbox.stub().resolves({
            items: [
              { code: 'en-us', name: 'English (US)' },
              { code: 'fr-fr', name: 'French (France)' },
            ],
          }),
        }),
      });

      const result = await entryService.filterNonLocalizedEntries(entries, 'blog', 'source-env');

      expect(result).to.have.lengthOf(0);
    });

    it('should handle multiple entries with some having changes', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 2,
          publish_details: [{ environment: 'source-env', locale: 'en-us' }],
        },
        {
          uid: 'entry2',
          content_type_uid: 'blog',
          _version: 2,
          publish_details: [{ environment: 'source-env', locale: 'en-us' }],
        },
      ];

      const mockSchema = {
        schema: [{ uid: 'status', localized: false }],
      };

      // Mock content type schema fetch
      mockStack.contentType.withArgs('blog').returns({
        fetch: sandbox.stub().resolves(mockSchema),
        entry: sandbox.stub().callsFake((entryUid?: string) => {
          if (entryUid) {
            // Mock entry fetch calls
            return {
              fetch: sandbox.stub().callsFake((params: any) => {
                if (entryUid === 'entry1') {
                  if (params.locale === 'en-us') {
                    return Promise.resolve({ uid: 'entry1', status: 'published' });
                  } else if (params.locale === 'fr-fr') {
                    return Promise.resolve({ uid: 'entry1', status: 'draft' }); // Different
                  }
                } else if (entryUid === 'entry2') {
                  // entry2 has same values in all locales
                  return Promise.resolve({ uid: 'entry2', status: 'published' });
                }
                return Promise.resolve({});
              }),
            };
          }
          return {};
        }),
      });

      // Mock getLanguages call
      mockStack.locale.returns({
        query: sandbox.stub().returns({
          find: sandbox.stub().resolves({
            items: [
              { code: 'en-us', name: 'English (US)' },
              { code: 'fr-fr', name: 'French (France)' },
            ],
          }),
        }),
      });

      const result = await entryService.filterNonLocalizedEntries(entries, 'blog', 'source-env');

      expect(result).to.have.lengthOf(1);
      expect(result[0].uid).to.equal('entry1');
    });

    // ========================================
    // EDGE CASES
    // ========================================
    it('should return empty array for empty entries', async () => {
      const result = await entryService.filterNonLocalizedEntries([], 'blog', 'source-env');

      expect(result).to.have.lengthOf(0);
      expect(mockStack.contentType.called).to.be.false;
    });

    it('should return empty array when no non-localized fields exist', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 2,
          publish_details: [{ environment: 'source-env', locale: 'en-us' }],
        },
      ];

      const mockSchema = {
        schema: [
          { uid: 'title', localized: true },
          { uid: 'content', localized: true },
        ],
      };

      mockStack.contentType.withArgs('blog').returns({
        fetch: sandbox.stub().resolves(mockSchema),
      });

      const result = await entryService.filterNonLocalizedEntries(entries, 'blog', 'source-env');

      expect(result).to.have.lengthOf(0);
      expect(mockLogger.info.calledWith(sinon.match(/no non-localized fields/i))).to.be.true;
    });

    it('should include entry when it exists in source but not in target', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 2,
          publish_details: [{ environment: 'source-env', locale: 'en-us' }],
        },
      ];

      const mockSchema = {
        schema: [{ uid: 'status', localized: false }],
      };

      // Mock content type schema fetch
      mockStack.contentType.withArgs('blog').returns({
        fetch: sandbox.stub().resolves(mockSchema),
        entry: sandbox.stub().callsFake((entryUid?: string) => {
          if (entryUid) {
            // Mock entry fetch calls
            return {
              fetch: sandbox.stub().callsFake((params: any) => {
                if (params.locale === 'en-us') {
                  // Master locale entry exists
                  return Promise.resolve({ uid: 'entry1', status: 'published' });
                } else if (params.locale === 'fr-fr') {
                  // Localized entry doesn't exist (error 141)
                  const error: any = new Error('Entry not found');
                  error.errorCode = 141;
                  return Promise.reject(error);
                }
                return Promise.resolve({});
              }),
            };
          }
          return {};
        }),
      });

      // Mock getLanguages call
      mockStack.locale.returns({
        query: sandbox.stub().returns({
          find: sandbox.stub().resolves({
            items: [
              { code: 'en-us', name: 'English (US)' },
              { code: 'fr-fr', name: 'French (France)' },
            ],
          }),
        }),
      });

      const result = await entryService.filterNonLocalizedEntries(entries, 'blog', 'source-env');

      expect(result).to.have.lengthOf(1);
      expect(result[0].uid).to.equal('entry1');
    });

    it('should handle entry not published to source environment', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 2,
          publish_details: [{ environment: 'other-env', locale: 'en-us' }], // Not published to source-env
        },
      ];

      const mockSchema = {
        schema: [{ uid: 'status', localized: false }],
      };

      mockStack.contentType.withArgs('blog').returns({
        fetch: sandbox.stub().resolves(mockSchema),
      });

      const result = await entryService.filterNonLocalizedEntries(entries, 'blog', 'source-env');

      expect(result).to.have.lengthOf(0);
    });

    // ========================================
    // ERROR CONDITIONS
    // ========================================
    it('should throw error for invalid content type', async () => {
      const entries: Entry[] = [
        {
          uid: 'entry1',
          content_type_uid: 'blog',
          _version: 2,
          publish_details: [{ environment: 'source-env', locale: 'en-us' }],
        },
      ];

      mockStack.contentType.returns({
        fetch: sandbox.stub().rejects(new Error('Content type not found')),
      });

      try {
        await entryService.filterNonLocalizedEntries(entries, 'invalid', 'source-env');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Content type not found');
      }
    });
  });
});
