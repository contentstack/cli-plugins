import { expect } from 'chai';
import { buildImportSpacesOptions } from '../../../src/utils/build-import-spaces-options';
import type { ImportConfig } from '../../../src/types';

describe('buildImportSpacesOptions', () => {
  const baseConfig = {
    contentDir: '/tmp/content',
    apiKey: 'stack-api-key',
    org_uid: 'org-123',
    host: 'https://api.contentstack.io/v3',
    region: { cma: 'https://api.contentstack.io/v3' },
    source_stack: 'source-api-key',
    context: {} as any,
    backupDir: '/tmp/backup',
    fetchConcurrency: 5,
    modules: {
      'asset-management': {
        dirName: 'spaces',
        uploadAssetsConcurrency: 3,
        importFoldersConcurrency: 2,
        mapperRootDir: 'mapper',
        mapperAssetsModuleDir: 'assets',
        mapperUidFileName: 'uid-mapping.json',
        mapperUrlFileName: 'url-mapping.json',
        mapperSpaceUidFileName: 'space-uid-mapping.json',
      },
    },
  } as unknown as ImportConfig;

  it('should map basic importConfig fields to ImportSpacesOptions', () => {
    const result = buildImportSpacesOptions(baseConfig, 'https://am.example.com');

    expect(result.contentDir).to.equal('/tmp/content');
    expect(result.csAssetsUrl).to.equal('https://am.example.com');
    expect(result.org_uid).to.equal('org-123');
    expect(result.apiKey).to.equal('stack-api-key');
    expect(result.host).to.equal('https://api.contentstack.io/v3');
    expect(result.sourceApiKey).to.equal('source-api-key');
    expect(result.backupDir).to.equal('/tmp/backup');
    expect(result.apiConcurrency).to.equal(5);
    expect(result.uploadAssetsConcurrency).to.equal(3);
    expect(result.importFoldersConcurrency).to.equal(2);
  });

  it('should leave targetDefaultSpaceUid and targetDefaultWorkspaceUid undefined when no overrides provided', () => {
    const result = buildImportSpacesOptions(baseConfig, 'https://am.example.com');

    expect(result.targetDefaultSpaceUid).to.be.undefined;
    expect(result.targetDefaultWorkspaceUid).to.be.undefined;
  });

  it('should populate targetDefaultSpaceUid when provided via overrides', () => {
    const result = buildImportSpacesOptions(baseConfig, 'https://am.example.com', {
      targetDefaultSpaceUid: 'space-3-uid',
    });

    expect(result.targetDefaultSpaceUid).to.equal('space-3-uid');
    expect(result.targetDefaultWorkspaceUid).to.be.undefined;
  });

  it('should populate both target default fields when provided via overrides', () => {
    const result = buildImportSpacesOptions(baseConfig, 'https://am.example.com', {
      targetDefaultSpaceUid: 'space-3-uid',
      targetDefaultWorkspaceUid: 'ws-link-3',
    });

    expect(result.targetDefaultSpaceUid).to.equal('space-3-uid');
    expect(result.targetDefaultWorkspaceUid).to.equal('ws-link-3');
  });

  it('should use org_uid empty string when importConfig.org_uid is undefined', () => {
    const configWithoutOrg = { ...baseConfig, org_uid: undefined } as unknown as ImportConfig;
    const result = buildImportSpacesOptions(configWithoutOrg, 'https://am.example.com');

    expect(result.org_uid).to.equal('');
  });

  it('should prefer region.cma over host for the host field', () => {
    const configWithRegion = {
      ...baseConfig,
      region: { cma: 'https://region.api.com' },
      host: 'https://fallback.api.com',
    } as unknown as ImportConfig;

    const result = buildImportSpacesOptions(configWithRegion, 'https://am.example.com');

    expect(result.host).to.equal('https://region.api.com');
  });

  it('should fall back to host when region.cma is absent', () => {
    const configNoRegion = {
      ...baseConfig,
      region: undefined,
      host: 'https://fallback.api.com',
    } as unknown as ImportConfig;

    const result = buildImportSpacesOptions(configNoRegion, 'https://am.example.com');

    expect(result.host).to.equal('https://fallback.api.com');
  });
});
