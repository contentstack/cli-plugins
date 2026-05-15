import { expect } from 'chai';
import { stub, restore, SinonStub } from 'sinon';
import * as path from 'path';
import { ReferencedContentTypesHandler } from '../../src/utils/content-type-helper';
import * as logger from '../../src/utils/logger';
import { QueryExportConfig } from '../../src/types';

describe('Content Type Helper Utilities', () => {
  let handler: ReferencedContentTypesHandler;
  let mockConfig: QueryExportConfig;
  let logStub: SinonStub;
  let pathJoinStub: SinonStub;

  beforeEach(() => {
    mockConfig = {
      maxCTReferenceDepth: 20,
      contentVersion: 2,
      host: 'https://api.contentstack.io/v3',
      exportDir: '/test/export',
      stackApiKey: 'test-api-key',
      managementToken: 'test-token',
      query: '',
      skipReferences: false,
      skipDependencies: false,
      branchName: 'main',
      securedAssets: false,
      isQueryBasedExport: true,
      logsPath: '/test/logs',
      dataPath: '/test/data',
      modules: {
        general: ['stack', 'locales', 'environments'],
        queryable: ['content-types'],
        dependent: ['global-fields', 'extensions', 'taxonomies'],
        content: ['entries', 'assets'],
        exportOrder: ['stack', 'content-types'],
      },
      queryConfig: {
        maxRecursionDepth: 10,
        batchSize: 100,
        metadataFileName: '_query-meta.json',
        validation: {
          maxQueryDepth: 5,
          maxArraySize: 1000,
          allowedDateFormats: ['ISO8601'],
        },
      },
      fetchConcurrency: 5,
      writeConcurrency: 5,
      apis: {
        stacks: '/stacks/',
        locales: '/locales/',
        environments: '/environments/',
        content_types: '/content_types/',
        global_fields: '/global_fields/',
        extensions: '/extensions/',
        taxonomies: '/taxonomies/',
        entries: '/entries/',
        assets: '/assets/',
      },
    };

    handler = new ReferencedContentTypesHandler(mockConfig);
    restore();
  });

  afterEach(() => {
    restore();
  });

  describe('extractReferencedContentTypes', () => {
    it('should extract reference field targets', async () => {
      const contentTypeBatch = [
        {
          uid: 'blog',
          schema: [
            {
              uid: 'author',
              data_type: 'reference',
              reference_to: ['author', 'editor'],
            },
            {
              uid: 'category',
              data_type: 'reference',
              reference_to: ['category'],
            },
          ],
        },
      ];

      logStub = stub(logger, 'log');

      const result = await handler.extractReferencedContentTypes(contentTypeBatch);

      expect(result).to.deep.equal(['author', 'editor', 'category']);
    });

    it('should exclude sys_assets from references', async () => {
      const contentTypeBatch = [
        {
          uid: 'blog',
          schema: [
            {
              uid: 'image',
              data_type: 'reference',
              reference_to: ['sys_assets', 'custom_asset'],
            },
          ],
        },
      ];

      logStub = stub(logger, 'log');

      const result = await handler.extractReferencedContentTypes(contentTypeBatch);

      expect(result).to.deep.equal(['custom_asset']);
      expect(result).to.not.include('sys_assets');
    });

    it('should handle group fields with nested schemas', async () => {
      const contentTypeBatch = [
        {
          uid: 'blog',
          schema: [
            {
              uid: 'metadata',
              data_type: 'group',
              schema: [
                {
                  uid: 'author',
                  data_type: 'reference',
                  reference_to: ['author'],
                },
              ],
            },
          ],
        },
      ];

      logStub = stub(logger, 'log');

      const result = await handler.extractReferencedContentTypes(contentTypeBatch);

      expect(result).to.deep.equal(['author']);
    });

    it('should handle global fields with nested schemas', async () => {
      const contentTypeBatch = [
        {
          uid: 'blog',
          schema: [
            {
              uid: 'seo',
              data_type: 'global_field',
              schema: [
                {
                  uid: 'related_page',
                  data_type: 'reference',
                  reference_to: ['page'],
                },
              ],
            },
          ],
        },
      ];

      logStub = stub(logger, 'log');

      const result = await handler.extractReferencedContentTypes(contentTypeBatch);

      expect(result).to.deep.equal(['page']);
    });

    it('should handle blocks with nested schemas', async () => {
      const contentTypeBatch = [
        {
          uid: 'page',
          schema: [
            {
              uid: 'content_blocks',
              data_type: 'blocks',
              blocks: {
                hero_block: {
                  schema: [
                    {
                      uid: 'background_image',
                      data_type: 'reference',
                      reference_to: ['image_gallery'],
                    },
                  ],
                },
                testimonial_block: {
                  schema: [
                    {
                      uid: 'testimonial',
                      data_type: 'reference',
                      reference_to: ['testimonial'],
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      logStub = stub(logger, 'log');

      const result = await handler.extractReferencedContentTypes(contentTypeBatch);

      expect(result).to.deep.equal(['image_gallery', 'testimonial']);
    });

    it('should handle JSON RTE with embedded entries', async () => {
      const contentTypeBatch = [
        {
          uid: 'article',
          schema: [
            {
              uid: 'content',
              data_type: 'json',
              field_metadata: {
                rich_text_type: true,
                embed_entry: true,
              },
              reference_to: ['related_article', 'quote'],
            },
          ],
        },
      ];

      logStub = stub(logger, 'log');

      const result = await handler.extractReferencedContentTypes(contentTypeBatch);

      expect(result).to.deep.equal(['related_article', 'quote']);
    });

    it('should handle Text RTE with embedded entries', async () => {
      const contentTypeBatch = [
        {
          uid: 'article',
          schema: [
            {
              uid: 'content',
              data_type: 'text',
              field_metadata: {
                rich_text_type: true,
                embed_entry: true,
              },
              reference_to: ['related_article'],
            },
          ],
        },
      ];

      logStub = stub(logger, 'log');

      const result = await handler.extractReferencedContentTypes(contentTypeBatch);

      expect(result).to.deep.equal(['related_article']);
    });

    it('should handle content types without schemas', async () => {
      const contentTypeBatch = [
        {
          uid: 'simple',
          // No schema property
        },
        {
          uid: 'with_schema',
          schema: [
            {
              uid: 'reference_field',
              data_type: 'reference',
              reference_to: ['author'],
            },
          ],
        },
      ];

      logStub = stub(logger, 'log');

      const result = await handler.extractReferencedContentTypes(contentTypeBatch);

      expect(result).to.deep.equal(['author']);
    });

    it('should return empty array for content types with no references', async () => {
      const contentTypeBatch = [
        {
          uid: 'simple',
          schema: [
            {
              uid: 'title',
              data_type: 'text',
            },
            {
              uid: 'description',
              data_type: 'text',
            },
          ],
        },
      ];

      logStub = stub(logger, 'log');

      const result = await handler.extractReferencedContentTypes(contentTypeBatch);

      expect(result).to.deep.equal([]);
    });

    it('should handle complex nested structures', async () => {
      const contentTypeBatch = [
        {
          uid: 'complex_page',
          schema: [
            {
              uid: 'sections',
              data_type: 'group',
              schema: [
                {
                  uid: 'content_blocks',
                  data_type: 'blocks',
                  blocks: {
                    hero: {
                      schema: [
                        {
                          uid: 'author',
                          data_type: 'reference',
                          reference_to: ['author'],
                        },
                        {
                          uid: 'nested_group',
                          data_type: 'group',
                          schema: [
                            {
                              uid: 'category',
                              data_type: 'reference',
                              reference_to: ['category'],
                            },
                          ],
                        },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
      ];

      logStub = stub(logger, 'log');

      const result = await handler.extractReferencedContentTypes(contentTypeBatch);

      expect(result).to.deep.equal(['author', 'category']);
    });

    it('should remove duplicates from referenced content types', async () => {
      const contentTypeBatch = [
        {
          uid: 'blog1',
          schema: [
            {
              uid: 'author1',
              data_type: 'reference',
              reference_to: ['author', 'category'],
            },
          ],
        },
        {
          uid: 'blog2',
          schema: [
            {
              uid: 'author2',
              data_type: 'reference',
              reference_to: ['author', 'tag'],
            },
          ],
        },
      ];

      logStub = stub(logger, 'log');

      const result = await handler.extractReferencedContentTypes(contentTypeBatch);

      expect(result).to.deep.equal(['author', 'category', 'tag']);
      expect(result.filter((item) => item === 'author')).to.have.length(1);
    });
  });

  describe('filterNewlyFetchedContentTypes', () => {
    it('should filter out content types that were previously fetched', () => {
      const allContentTypes = [
        { uid: 'blog', title: 'Blog' },
        { uid: 'author', title: 'Author' },
        { uid: 'category', title: 'Category' },
        { uid: 'tag', title: 'Tag' },
      ];

      const previousUIDs = new Set(['blog', 'category']);

      const result = handler.filterNewlyFetchedContentTypes(allContentTypes, previousUIDs);

      expect(result).to.deep.equal([
        { uid: 'author', title: 'Author' },
        { uid: 'tag', title: 'Tag' },
      ]);
    });

    it('should return all content types when no previous UIDs', () => {
      const allContentTypes = [
        { uid: 'blog', title: 'Blog' },
        { uid: 'author', title: 'Author' },
      ];

      const previousUIDs = new Set<string>();

      const result = handler.filterNewlyFetchedContentTypes(allContentTypes, previousUIDs);

      expect(result).to.deep.equal(allContentTypes);
    });

    it('should return empty array when all content types were previously fetched', () => {
      const allContentTypes = [
        { uid: 'blog', title: 'Blog' },
        { uid: 'author', title: 'Author' },
      ];

      const previousUIDs = new Set(['blog', 'author']);

      const result = handler.filterNewlyFetchedContentTypes(allContentTypes, previousUIDs);

      expect(result).to.deep.equal([]);
    });

    it('should handle empty content types array', () => {
      const allContentTypes: any[] = [];
      const previousUIDs = new Set(['blog']);

      const result = handler.filterNewlyFetchedContentTypes(allContentTypes, previousUIDs);

      expect(result).to.deep.equal([]);
    });
  });

  describe('extractReferencedContentTypes — global field and guard behaviour', () => {
    it('should not throw when a global_field has no schema property (stub form)', async () => {
      const batch = [
        {
          uid: 'page',
          schema: [
            {
              uid: 'seo',
              data_type: 'global_field',
              reference_to: 'seo_gf',
              // no schema array — this is the "stub" representation in a CT's inline schema
            },
          ],
        },
      ];

      logStub = stub(logger, 'log');
      const result = await handler.extractReferencedContentTypes(batch);
      expect(result).to.deep.equal([]);
    });

    it('should find CT references inside a global field document passed directly', async () => {
      // The caller passes both the CT doc and the GF doc in the same batch.
      const batch = [
        {
          uid: 'page',
          schema: [{ uid: 'seo', data_type: 'global_field', reference_to: 'seo_gf' }],
        },
        {
          uid: 'seo_gf',
          schema: [{ uid: 'author_ref', data_type: 'reference', reference_to: ['author'] }],
        },
      ];

      logStub = stub(logger, 'log');
      const result = await handler.extractReferencedContentTypes(batch);
      expect(result).to.include('author');
    });

    it('should not recurse into global_field stub when schema is an empty array', async () => {
      const batch = [
        {
          uid: 'page',
          schema: [
            { uid: 'seo', data_type: 'global_field', reference_to: 'seo_gf', schema: [] as any[] },
          ],
        },
      ];

      logStub = stub(logger, 'log');
      const result = await handler.extractReferencedContentTypes(batch);
      expect(result).to.deep.equal([]);
    });
  });
});
