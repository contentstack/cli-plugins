import { expect } from 'chai';
import { ExportExperiences, ExportConfig } from '../../../src';

const makeExportConfig = (branchName?: string): ExportConfig =>
  ({
    modules: {
      personalize: {
        baseURL: { na: 'https://personalize.na-api.contentstack.com' },
        dirName: 'personalize',
      },
    },
    region: { name: 'na', cma: 'https://api.contentstack.io' },
    project_id: 'TEST-PROJECT-001',
    apiKey: 'TEST-STACK-API-KEY',
    exportDir: '/tmp/test-export',
    context: {},
    ...(branchName ? { branchName } : {}),
  } as unknown as ExportConfig);

describe('ExportExperiences — branch header', () => {
  describe('constructor (cmaConfig headers)', () => {
    it('includes branch header in cmaConfig.headers when branchName is set', () => {
      const instance = new ExportExperiences(makeExportConfig('feature-branch'));
      expect((instance as any).adapterConfig.cmaConfig.headers.branch).to.equal('feature-branch');
    });

    it('does NOT include branch header in cmaConfig.headers when branchName is absent', () => {
      const instance = new ExportExperiences(makeExportConfig());
      expect((instance as any).adapterConfig.cmaConfig.headers.branch).to.be.undefined;
    });

    it('always includes api_key in cmaConfig.headers regardless of branchName', () => {
      const instance = new ExportExperiences(makeExportConfig('staging'));
      expect((instance as any).adapterConfig.cmaConfig.headers.api_key).to.equal('TEST-STACK-API-KEY');
    });

    it('sets correct cmaConfig baseURL from region', () => {
      const instance = new ExportExperiences(makeExportConfig('dev'));
      expect((instance as any).adapterConfig.cmaConfig.baseURL).to.equal('https://api.contentstack.io/v3');
    });

    it('branch header value matches branchName exactly', () => {
      const instance = new ExportExperiences(makeExportConfig('eu-branch-2025'));
      expect((instance as any).adapterConfig.cmaConfig.headers.branch).to.equal('eu-branch-2025');
    });

    it('cmaConfig.headers has only api_key when branchName is not set', () => {
      const instance = new ExportExperiences(makeExportConfig());
      const headers = (instance as any).adapterConfig.cmaConfig.headers;
      expect(Object.keys(headers)).to.deep.equal(['api_key']);
    });

    it('cmaConfig.headers has api_key and branch when branchName is set', () => {
      const instance = new ExportExperiences(makeExportConfig('main'));
      const headers = (instance as any).adapterConfig.cmaConfig.headers;
      expect(headers).to.deep.equal({ api_key: 'TEST-STACK-API-KEY', branch: 'main' });
    });
  });
});
