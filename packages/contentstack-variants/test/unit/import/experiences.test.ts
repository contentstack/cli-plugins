import { expect } from 'chai';
import { Import, ImportConfig } from '../../../src';

const makeImportConfig = (branchName?: string): ImportConfig =>
  ({
    modules: {
      personalize: {
        project_id: 'TEST-PROJECT-001',
        baseURL: { na: 'https://personalize.na-api.contentstack.com' },
        dirName: 'personalize',
        importData: true,
        audiences: { dirName: 'audiences' },
        events: { dirName: 'events' },
        experiences: {
          dirName: 'experiences',
          fileName: 'experiences.json',
          thresholdTimer: 1000,
          checkIntervalDuration: 100,
        },
      },
    },
    region: { name: 'na', cma: 'https://api.contentstack.io' },
    apiKey: 'TEST-STACK-API-KEY',
    contentDir: '/tmp/test-content',
    backupDir: '/tmp/test-backup',
    context: {},
    ...(branchName ? { branchName } : {}),
  } as unknown as ImportConfig);

describe('ImportExperiences — branch header', () => {
  describe('constructor (cmaConfig headers)', () => {
    it('includes branch header in cmaConfig.headers when branchName is set', () => {
      const instance = new Import.Experiences(makeImportConfig('feature-branch'));
      expect((instance as any).adapterConfig.cmaConfig.headers.branch).to.equal('feature-branch');
    });

    it('does NOT include branch header in cmaConfig.headers when branchName is absent', () => {
      const instance = new Import.Experiences(makeImportConfig());
      expect((instance as any).adapterConfig.cmaConfig.headers.branch).to.be.undefined;
    });

    it('always includes api_key in cmaConfig.headers regardless of branchName', () => {
      const instance = new Import.Experiences(makeImportConfig('staging'));
      expect((instance as any).adapterConfig.cmaConfig.headers.api_key).to.equal('TEST-STACK-API-KEY');
    });

    it('sets correct cmaConfig baseURL from region', () => {
      const instance = new Import.Experiences(makeImportConfig('dev'));
      expect((instance as any).adapterConfig.cmaConfig.baseURL).to.equal('https://api.contentstack.io/v3');
    });

    it('branch header value matches branchName exactly', () => {
      const instance = new Import.Experiences(makeImportConfig('eu-branch-2025'));
      expect((instance as any).adapterConfig.cmaConfig.headers.branch).to.equal('eu-branch-2025');
    });

    it('cmaConfig.headers has only api_key when branchName is not set', () => {
      const instance = new Import.Experiences(makeImportConfig());
      const headers = (instance as any).adapterConfig.cmaConfig.headers;
      expect(Object.keys(headers)).to.deep.equal(['api_key']);
    });

    it('cmaConfig.headers has api_key and branch when branchName is set', () => {
      const instance = new Import.Experiences(makeImportConfig('main'));
      const headers = (instance as any).adapterConfig.cmaConfig.headers;
      expect(headers).to.deep.equal({ api_key: 'TEST-STACK-API-KEY', branch: 'main' });
    });
  });
});
