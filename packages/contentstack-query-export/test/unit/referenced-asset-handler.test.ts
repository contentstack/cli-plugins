import { expect } from 'chai';
import { AssetReferenceHandler } from '../../src/utils/referenced-asset-handler';
import { QueryExportConfig } from '../../src/types';

describe('Referenced Asset Handler Utilities', () => {
  let handler: AssetReferenceHandler;
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

    handler = new AssetReferenceHandler(mockConfig);
  });

  describe('Asset UID extraction from content strings', () => {
    it('should extract asset UIDs from HTML img tags', () => {
      // Simulate JSON.stringify() content as it would appear in real usage
      // Note: The regex expects asset_uid to be the first attribute after <img
      const htmlContent = `
        <p>Some content with images:</p>
        <img asset_uid="asset123" src="some-url" alt="Image 1">
        <img asset_uid="asset456" src="another-url" alt="Image 2">
        <p>More content</p>
        <img asset_uid="asset789" />
      `;
      const content = JSON.stringify({ field: htmlContent });

      const result = (handler as any).extractAssetUIDsFromString(content);

      expect(result).to.include('asset123');
      expect(result).to.include('asset456');
      expect(result).to.include('asset789');
      expect(result.length).to.equal(3);
    });

    it('should extract asset UIDs from Contentstack asset URLs', () => {
      const content = `
        Check out this asset: "https://images.contentstack.io/v3/assets/stack123/asset456/version789/filename.jpg"
        And this one: "https://eu-images.contentstack.io/v3/assets/stack456/asset123/version456/image.png"
        Also: "https://assets.contentstack.com/v3/assets/stackabc/assetdef/versionghi/file.pdf"
      `;

      const result = (handler as any).extractAssetUIDsFromString(content);

      expect(result).to.include('asset456');
      expect(result).to.include('asset123');
      expect(result).to.include('assetdef');
      expect(result.length).to.equal(3);
    });

    it('should handle mixed asset references in content', () => {
      const htmlContent = `
        <div>
          <img asset_uid="img_asset_123" src="test.jpg" />
          <p>Link to: "https://images.contentstack.io/v3/assets/mystack/url_asset_456/v1/document.pdf"</p>
          <img asset_uid="img_asset_789" />
        </div>
      `;
      const content = JSON.stringify({ field: htmlContent });

      const result = (handler as any).extractAssetUIDsFromString(content);

      expect(result).to.include('img_asset_123');
      expect(result).to.include('url_asset_456');
      expect(result).to.include('img_asset_789');
      expect(result.length).to.equal(3);
    });

    it('should handle Azure region URLs', () => {
      const content = `
        "https://azure-na-images.contentstack.io/v3/assets/stack123/azure_asset_123/v1/file.jpg"
        "https://azure-eu-images.contentstack.io/v3/assets/stack456/azure_asset_456/v2/document.pdf"
      `;

      const result = (handler as any).extractAssetUIDsFromString(content);

      expect(result).to.include('azure_asset_123');
      expect(result).to.include('azure_asset_456');
      expect(result.length).to.equal(2);
    });

    it('should handle GCP region URLs', () => {
      const content = `
        "https://gcp-na-images.contentstack.io/v3/assets/stack123/gcp_asset_123/v1/file.jpg"
        "https://gcp-eu-images.contentstack.io/v3/assets/stack456/gcp_asset_456/v2/document.pdf"
      `;

      const result = (handler as any).extractAssetUIDsFromString(content);

      expect(result).to.include('gcp_asset_123');
      expect(result).to.include('gcp_asset_456');
      expect(result.length).to.equal(2);
    });

    it('should return empty array for content without assets', () => {
      const content = `
        <div>
          <h1>Title</h1>
          <p>Just some text content without any asset references.</p>
          <a href="https://example.com">External link</a>
        </div>
      `;

      const result = (handler as any).extractAssetUIDsFromString(content);

      expect(result).to.be.an('array');
      expect(result.length).to.equal(0);
    });

    it('should handle malformed asset references gracefully', () => {
      const content = `
        <img asset_uid="" src="test.jpg" />
        <img asset_uid src="test2.jpg" />
        "https://images.contentstack.io/v3/assets/"
        "https://images.contentstack.io/v3/assets/stack123/"
      `;

      const result = (handler as any).extractAssetUIDsFromString(content);

      // Should not include empty or malformed UIDs
      expect(result).to.be.an('array');
      expect(result.length).to.equal(0);
    });

    it('should deduplicate asset UIDs from same content', () => {
      const htmlContent = `
        <img asset_uid="duplicate_asset" src="image1.jpg" />
        <img asset_uid="duplicate_asset" src="image2.jpg" />
        "https://images.contentstack.io/v3/assets/stack123/duplicate_asset/v1/file.jpg"
        <img asset_uid="unique_asset" src="image3.jpg" />
      `;
      const content = JSON.stringify({ field: htmlContent });

      const result = (handler as any).extractAssetUIDsFromString(content);

      expect(result).to.include('duplicate_asset');
      expect(result).to.include('unique_asset');
      expect(result.length).to.equal(2);

      // Check that duplicate_asset appears only once
      const duplicateCount = result.filter((uid: any) => uid === 'duplicate_asset').length;
      expect(duplicateCount).to.equal(1);
    });

    it('should handle escaped quotes in HTML', () => {
      const content = `<img asset_uid=\\"escaped_asset_123\\" src=\\"test.jpg\\" />`;

      const result = (handler as any).extractAssetUIDsFromString(content);

      expect(result).to.include('escaped_asset_123');
      expect(result.length).to.equal(1);
    });

    it('should handle JSON-stringified content with asset references', () => {
      const jsonContent = JSON.stringify({
        content: '<img asset_uid="json_asset_123" src="test.jpg" />',
        url: 'https://images.contentstack.io/v3/assets/stack123/json_asset_456/v1/file.jpg',
      });

      const result = (handler as any).extractAssetUIDsFromString(jsonContent);

      expect(result).to.include('json_asset_123');
      expect(result).to.include('json_asset_456');
      expect(result.length).to.equal(2);
    });

    it('should handle content with special characters in asset UIDs', () => {
      const htmlContent = `
        <img asset_uid="asset-with-dashes-123" src="test1.jpg" />
        <img asset_uid="asset_with_underscores_456" src="test2.jpg" />
        <img asset_uid="asset123ABC" src="test3.jpg" />
      `;
      const content = JSON.stringify({ field: htmlContent });

      const result = (handler as any).extractAssetUIDsFromString(content);

      expect(result).to.include('asset-with-dashes-123');
      expect(result).to.include('asset_with_underscores_456');
      expect(result).to.include('asset123ABC');
      expect(result.length).to.equal(3);
    });

    it('should handle large content strings efficiently', () => {
      // Create a large content string with asset references
      const assetReferences: string[] = [];
      let htmlContent = '<div>';

      for (let i = 0; i < 100; i++) {
        const assetUID = `asset_${i}`;
        assetReferences.push(assetUID);
        htmlContent += `<img asset_uid="${assetUID}" src="image${i}.jpg" />`;
      }
      htmlContent += '</div>';

      const content = JSON.stringify({ field: htmlContent });

      const result = (handler as any).extractAssetUIDsFromString(content);

      expect(result.length).to.equal(100);
      assetReferences.forEach((uid) => {
        expect(result).to.include(uid);
      });
    });

    it('should handle contentstack.com domain URLs', () => {
      const content = `
        "https://assets.contentstack.com/v3/assets/stack123/com_asset_123/v1/file.jpg"
        "https://images.contentstack.com/v3/assets/stack456/com_asset_456/v2/image.png"
      `;

      const result = (handler as any).extractAssetUIDsFromString(content);

      expect(result).to.include('com_asset_123');
      expect(result).to.include('com_asset_456');
      expect(result.length).to.equal(2);
    });
  });

  describe('Constructor and initialization', () => {
    it('should initialize with correct export directory path', () => {
      expect(handler).to.be.instanceOf(AssetReferenceHandler);

      // Check that entriesDir is set correctly
      const entriesDir = (handler as any).entriesDir;
      expect(entriesDir).to.include('/test/export');
      expect(entriesDir).to.include('entries');
    });

    it('should store export configuration', () => {
      const config = (handler as any).exportQueryConfig;
      expect(config).to.equal(mockConfig);
      expect(config.exportDir).to.equal('/test/export');
    });
  });
});
