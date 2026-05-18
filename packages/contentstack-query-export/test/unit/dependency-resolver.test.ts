import { expect } from 'chai';
import * as sinon from 'sinon';
import { ContentTypeDependenciesHandler } from '../../src/utils/dependency-resolver';
import { QueryExportConfig } from '../../src/types';

describe('Dependency Resolver Utilities', () => {
  let handler: ContentTypeDependenciesHandler;
  let mockConfig: QueryExportConfig;
  let mockStackAPIClient: any;

  beforeEach(() => {
    // Create a mock stack API client
    mockStackAPIClient = {
      extension: sinon.stub().returns({
        query: sinon.stub().returns({
          find: sinon.stub().resolves({
            items: [],
          }),
        }),
      }),
    };

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

    // Fix: Pass both required arguments to the constructor
    handler = new ContentTypeDependenciesHandler(mockStackAPIClient, mockConfig);
  });

  describe('Schema dependency extraction logic', () => {
    it('should extract global field dependencies from schema', () => {
      const schema = [
        {
          uid: 'seo',
          data_type: 'global_field',
          reference_to: 'seo_fields',
        },
        {
          uid: 'metadata',
          data_type: 'global_field',
          reference_to: 'common_metadata',
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      // Access private method for testing
      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.has('seo_fields')).to.be.true;
      expect(dependencies.globalFields.has('common_metadata')).to.be.true;
      expect(dependencies.globalFields.size).to.equal(2);
    });

    it('should extract extension dependencies from schema', () => {
      const schema = [
        {
          uid: 'rich_text',
          data_type: 'text',
          extension_uid: 'rich_text_editor',
        },
        {
          uid: 'color_picker',
          data_type: 'text',
          extension_uid: 'color_picker_ext',
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.extensions.has('rich_text_editor')).to.be.true;
      expect(dependencies.extensions.has('color_picker_ext')).to.be.true;
      expect(dependencies.extensions.size).to.equal(2);
    });

    it('should extract taxonomy dependencies from schema', () => {
      const schema = [
        {
          uid: 'categories',
          data_type: 'taxonomy',
          taxonomies: [{ taxonomy_uid: 'product_categories' }, { taxonomy_uid: 'product_tags' }],
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.taxonomies.has('product_categories')).to.be.true;
      expect(dependencies.taxonomies.has('product_tags')).to.be.true;
      expect(dependencies.taxonomies.size).to.equal(2);
    });

    it('should handle group fields with nested dependencies', () => {
      const schema = [
        {
          uid: 'content_section',
          data_type: 'group',
          schema: [
            {
              uid: 'seo',
              data_type: 'global_field',
              reference_to: 'nested_seo',
            },
            {
              uid: 'rich_content',
              data_type: 'text',
              extension_uid: 'nested_editor',
            },
          ],
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.has('nested_seo')).to.be.true;
      expect(dependencies.extensions.has('nested_editor')).to.be.true;
    });

    it('should handle block fields with nested dependencies', () => {
      const schema = [
        {
          uid: 'content_blocks',
          data_type: 'blocks',
          blocks: {
            hero_block: {
              schema: [
                {
                  uid: 'seo',
                  data_type: 'global_field',
                  reference_to: 'hero_seo',
                },
              ],
            },
            content_block: {
              schema: [
                {
                  uid: 'editor',
                  data_type: 'text',
                  extension_uid: 'content_editor',
                },
                {
                  uid: 'tags',
                  data_type: 'taxonomy',
                  taxonomies: [{ taxonomy_uid: 'content_tags' }],
                },
              ],
            },
          },
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.has('hero_seo')).to.be.true;
      expect(dependencies.extensions.has('content_editor')).to.be.true;
      expect(dependencies.taxonomies.has('content_tags')).to.be.true;
    });

    it('should handle complex nested structures', () => {
      const schema = [
        {
          uid: 'sections',
          data_type: 'group',
          schema: [
            {
              uid: 'content_blocks',
              data_type: 'blocks',
              blocks: {
                nested_block: {
                  schema: [
                    {
                      uid: 'nested_group',
                      data_type: 'group',
                      schema: [
                        {
                          uid: 'deep_global',
                          data_type: 'global_field',
                          reference_to: 'deep_nested_global',
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.has('deep_nested_global')).to.be.true;
    });

    it('should ignore fields without dependency information', () => {
      const schema = [
        {
          uid: 'title',
          data_type: 'text',
        },
        {
          uid: 'description',
          data_type: 'text',
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.size).to.equal(0);
      expect(dependencies.extensions.size).to.equal(0);
      expect(dependencies.taxonomies.size).to.equal(0);
    });

    it('should handle taxonomies without taxonomy_uid gracefully', () => {
      const schema = [
        {
          uid: 'categories',
          data_type: 'taxonomy',
          taxonomies: [
            { name: 'Category 1' }, // Missing taxonomy_uid
            { taxonomy_uid: 'valid_taxonomy' },
          ],
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.taxonomies.has('valid_taxonomy')).to.be.true;
      expect(dependencies.taxonomies.size).to.equal(1);
    });

    it('should handle mixed dependency types in single schema', () => {
      const schema = [
        {
          uid: 'seo',
          data_type: 'global_field',
          reference_to: 'seo_global',
        },
        {
          uid: 'rich_text',
          data_type: 'text',
          extension_uid: 'editor_ext',
        },
        {
          uid: 'categories',
          data_type: 'taxonomy',
          taxonomies: [{ taxonomy_uid: 'categories_tax' }],
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.has('seo_global')).to.be.true;
      expect(dependencies.extensions.has('editor_ext')).to.be.true;
      expect(dependencies.taxonomies.has('categories_tax')).to.be.true;
      expect(dependencies.globalFields.size).to.equal(1);
      expect(dependencies.extensions.size).to.equal(1);
      expect(dependencies.taxonomies.size).to.equal(1);
    });

    it('should handle empty schema arrays', () => {
      const schema: any[] = [];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.size).to.equal(0);
      expect(dependencies.extensions.size).to.equal(0);
      expect(dependencies.taxonomies.size).to.equal(0);
    });

    it('should collect nested global field inside a global field schema', () => {
      const schema = [
        {
          uid: 'outer_global',
          data_type: 'global_field',
          reference_to: 'outer_gf_uid',
          schema: [
            {
              uid: 'inner_global',
              data_type: 'global_field',
              reference_to: 'inner_gf_uid',
            },
          ],
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.has('outer_gf_uid')).to.be.true;
      expect(dependencies.globalFields.has('inner_gf_uid')).to.be.true;
      expect(dependencies.globalFields.size).to.equal(2);
    });

    it('should collect extension nested inside a global field schema', () => {
      const schema = [
        {
          uid: 'seo_block',
          data_type: 'global_field',
          reference_to: 'seo_gf',
          schema: [
            {
              uid: 'rich_editor',
              data_type: 'text',
              extension_uid: 'nested_editor_ext',
            },
          ],
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.has('seo_gf')).to.be.true;
      expect(dependencies.extensions.has('nested_editor_ext')).to.be.true;
    });

    it('should collect taxonomy nested inside a global field schema', () => {
      const schema = [
        {
          uid: 'tags_block',
          data_type: 'global_field',
          reference_to: 'tags_gf',
          schema: [
            {
              uid: 'categories',
              data_type: 'taxonomy',
              taxonomies: [{ taxonomy_uid: 'nested_taxonomy_uid' }],
            },
          ],
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.has('tags_gf')).to.be.true;
      expect(dependencies.taxonomies.has('nested_taxonomy_uid')).to.be.true;
    });

    it('should collect deeply nested global field inside a global field inside a group', () => {
      const schema = [
        {
          uid: 'content_section',
          data_type: 'group',
          schema: [
            {
              uid: 'outer_gf',
              data_type: 'global_field',
              reference_to: 'outer_gf_uid',
              schema: [
                {
                  uid: 'inner_gf',
                  data_type: 'global_field',
                  reference_to: 'inner_gf_uid',
                  schema: [
                    {
                      uid: 'deepest_gf',
                      data_type: 'global_field',
                      reference_to: 'deepest_gf_uid',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      const dependencies = {
        globalFields: new Set<string>(),
        extensions: new Set<string>(),
        taxonomies: new Set<string>(),
      };

      (handler as any).traverseSchemaForDependencies(schema, dependencies);

      expect(dependencies.globalFields.has('outer_gf_uid')).to.be.true;
      expect(dependencies.globalFields.has('inner_gf_uid')).to.be.true;
      expect(dependencies.globalFields.has('deepest_gf_uid')).to.be.true;
      expect(dependencies.globalFields.size).to.equal(3);
    });
  });

  describe('extractDependencies — explicit schemas parameter', () => {
    let extensionQueryStub: sinon.SinonStub;

    beforeEach(() => {
      extensionQueryStub = sinon.stub().returns({ find: sinon.stub().resolves({ items: [] }) });
      mockStackAPIClient.extension = sinon.stub().returns({ query: extensionQueryStub });
      handler = new ContentTypeDependenciesHandler(mockStackAPIClient, mockConfig);
    });

    it('should collect global field deps from provided CT schemas', async () => {
      const schemas = [
        { uid: 'page', schema: [{ uid: 'seo', data_type: 'global_field', reference_to: 'seo_gf' }] },
      ];

      const deps = await handler.extractDependencies(schemas);

      expect(deps.globalFields.has('seo_gf')).to.be.true;
    });

    it('should collect global field deps from provided GF schemas (transitive case)', async () => {
      // GF A's schema contains a reference to GF B — simulates what happens when
      // the caller passes the combined [CT doc, GF A doc] list.
      const schemas = [
        { uid: 'page', schema: [{ uid: 'gf_a_field', data_type: 'global_field', reference_to: 'gf_a' }] },
        {
          uid: 'gf_a',
          schema: [{ uid: 'gf_b_field', data_type: 'global_field', reference_to: 'gf_b' }],
        },
      ];

      const deps = await handler.extractDependencies(schemas);

      expect(deps.globalFields.has('gf_a')).to.be.true;
      expect(deps.globalFields.has('gf_b')).to.be.true;
    });

    it('should collect extension deps from GF schemas', async () => {
      // Return the extension as a regular extension from the API so it ends up in deps.extensions.
      extensionQueryStub = sinon.stub().returns({
        find: sinon.stub().resolves({ items: [{ uid: 'color_picker_ext' }] }),
      });
      mockStackAPIClient.extension = sinon.stub().returns({ query: extensionQueryStub });
      handler = new ContentTypeDependenciesHandler(mockStackAPIClient, mockConfig);

      const schemas = [
        { uid: 'page', schema: [{ uid: 'gf_a_field', data_type: 'global_field', reference_to: 'gf_a' }] },
        {
          uid: 'gf_a',
          schema: [{ uid: 'bg_color', data_type: 'text', extension_uid: 'color_picker_ext' }],
        },
      ];

      const deps = await handler.extractDependencies(schemas);

      expect(deps.globalFields.has('gf_a')).to.be.true;
      expect(deps.extensions.has('color_picker_ext')).to.be.true;
    });

    it('should collect taxonomy deps from GF schemas', async () => {
      const schemas = [
        { uid: 'page', schema: [{ uid: 'gf_a_field', data_type: 'global_field', reference_to: 'gf_a' }] },
        {
          uid: 'gf_a',
          schema: [
            {
              uid: 'tags',
              data_type: 'taxonomy',
              taxonomies: [{ taxonomy_uid: 'product_taxonomy' }],
            },
          ],
        },
      ];

      const deps = await handler.extractDependencies(schemas);

      expect(deps.taxonomies.has('product_taxonomy')).to.be.true;
    });

    it('should return empty sets when schemas array is empty', async () => {
      const deps = await handler.extractDependencies([]);

      expect(deps.globalFields.size).to.equal(0);
      expect(deps.extensions.size).to.equal(0);
      expect(deps.taxonomies.size).to.equal(0);
      expect(deps.marketplaceApps.size).to.equal(0);
    });

    it('should skip docs that have no schema array', async () => {
      const schemas = [
        { uid: 'page' }, // no schema property
        { uid: 'blog', schema: [{ uid: 'seo', data_type: 'global_field', reference_to: 'seo_gf' }] },
      ];

      const deps = await handler.extractDependencies(schemas);

      expect(deps.globalFields.has('seo_gf')).to.be.true;
      expect(deps.globalFields.size).to.equal(1);
    });
  });
});
