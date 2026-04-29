import { expect } from 'chai';
import { CLIError } from '@contentstack/cli-utilities';
import { QueryParser } from '../../src/utils/query-parser';
import { QueryExportConfig } from '../../src/types';

describe('Query Parser Simple Tests', () => {
  let queryParser: QueryParser;
  let mockConfig: QueryExportConfig;

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

    queryParser = new QueryParser(mockConfig);
  });

  describe('JSON string parsing and validation', () => {
    it('should parse and validate a simple valid query', async () => {
      const queryString = '{"modules": {"content-types": {"title": {"$exists": true}}}}';

      const result = await queryParser.parse(queryString);

      expect(result).to.be.an('object');
      expect(result.modules).to.have.property('content-types');
      expect(result.modules['content-types']).to.deep.equal({
        title: { $exists: true },
      });
    });

    it('should validate and reject queries without modules', async () => {
      const queryString = '{"title": {"$exists": true}}';

      try {
        await queryParser.parse(queryString);
        expect.fail('Expected validation error');
      } catch (error) {
        expect(error).to.be.instanceOf(CLIError);
        expect(error.message).to.equal('The query must contain a "modules" object.');
      }
    });

    it('should validate and reject queries with empty modules', async () => {
      const queryString = '{"modules": {}}';

      try {
        await queryParser.parse(queryString);
        expect.fail('Expected validation error');
      } catch (error) {
        expect(error).to.be.instanceOf(CLIError);
        expect(error.message).to.equal('The query must contain at least one module.');
      }
    });

    it('should validate and reject queries with non-queryable modules', async () => {
      const queryString = '{"modules": {"invalid-module": {"title": {"$exists": true}}}}';

      try {
        await queryParser.parse(queryString);
        expect.fail('Expected validation error');
      } catch (error) {
        expect(error).to.be.instanceOf(CLIError);
        expect(error.message).to.include('Module "invalid-module" is not queryable');
      }
    });

    it('should handle invalid JSON gracefully', async () => {
      const invalidQuery = '{"modules": invalid json}';

      try {
        await queryParser.parse(invalidQuery);
        expect.fail('Expected JSON parse error');
      } catch (error) {
        expect(error).to.be.instanceOf(CLIError);
        expect(error.message).to.include('Invalid JSON query');
      }
    });

    it('should handle complex valid queries', async () => {
      const complexQuery = {
        modules: {
          'content-types': {
            $and: [{ title: { $exists: true } }, { updated_at: { $gte: '2024-01-01' } }],
          },
        },
      };

      const result = await queryParser.parse(JSON.stringify(complexQuery));

      expect(result).to.deep.equal(complexQuery);
    });

    it('should reject null queries', async () => {
      try {
        await queryParser.parse('null');
        expect.fail('Expected validation error');
      } catch (error) {
        expect(error).to.be.instanceOf(CLIError);
        expect(error.message).to.equal('The query must be a valid JSON object.');
      }
    });

    it('should reject string queries', async () => {
      try {
        await queryParser.parse('"string query"');
        expect.fail('Expected validation error');
      } catch (error) {
        expect(error).to.be.instanceOf(CLIError);
        expect(error.message).to.equal('The query must be a valid JSON object.');
      }
    });
  });
});
