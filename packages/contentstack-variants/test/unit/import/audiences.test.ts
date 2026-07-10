import { expect } from 'chai';
import sinon from 'sinon';
import cloneDeep from 'lodash/cloneDeep';

import importConf from '../mock/import-config.json';
import { Import, ImportConfig } from '../../../src';

describe('Audiences Import', () => {
  let config: ImportConfig;
  let createAudienceCalls: Array<{ name: string }> = [];
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    config = cloneDeep(importConf) as unknown as ImportConfig;
    createAudienceCalls = [];
    config.modules.personalize = {
      ...(config.modules as any).personalization,
      dirName: 'personalize',
      baseURL: {
        na: 'https://personalization.na-api.contentstack.com',
        eu: 'https://personalization.eu-api.contentstack.com',
      },
    } as any;
    config.region = { name: 'eu' } as any;
    config.context = (config as any).context || {};

    sandbox.stub(Import.Audiences.prototype, 'init').resolves();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('import method - Lytics audience skip', () => {
    beforeEach(() => {
      sandbox.stub(Import.Audiences.prototype, 'createAudience').callsFake(async (payload: any) => {
        createAudienceCalls.push({ name: payload.name });
        return { uid: `new-${payload.name.replace(/\s/g, '-')}`, name: payload.name } as any;
      });
    });

    it('should skip Lytics audiences and not call createAudience for them', async () => {
      const audiencesInstance = new Import.Audiences(config);
      await audiencesInstance.import();

      const lyticsNames = createAudienceCalls.filter(
        (c) => c.name === 'Lytics Audience' || c.name === 'Lytics Lowercase',
      );
      expect(lyticsNames.length).to.equal(0);
    });

    it('should process audiences with undefined source', async () => {
      const audiencesInstance = new Import.Audiences(config);
      await audiencesInstance.import();

      const noSourceCall = createAudienceCalls.find((c) => c.name === 'No Source Audience');
      expect(noSourceCall).to.not.be.undefined;
    });

    it('should skip audience with source "lytics" (lowercase)', async () => {
      const audiencesInstance = new Import.Audiences(config);
      await audiencesInstance.import();

      const lyticsLowercaseCall = createAudienceCalls.find((c) => c.name === 'Lytics Lowercase');
      expect(lyticsLowercaseCall).to.be.undefined;
    });

    it('should call createAudience only for non-Lytics audiences', async () => {
      const audiencesInstance = new Import.Audiences(config);
      await audiencesInstance.import();

      // 4 audiences in mock: 2 Lytics (skip), 2 non-Lytics (Contentstack Test, No Source)
      expect(createAudienceCalls.length).to.equal(2);
    });

    it('should not add Lytics audiences to audiencesUidMapper', async () => {
      const audiencesInstance = new Import.Audiences(config);
      await audiencesInstance.import();

      const mapper = (audiencesInstance as any).audiencesUidMapper;
      expect(mapper['lytics-audience-001']).to.be.undefined;
      expect(mapper['lytics-lowercase-001']).to.be.undefined;
    });

    it('should add Contentstack audiences to audiencesUidMapper', async () => {
      const audiencesInstance = new Import.Audiences(config);
      await audiencesInstance.import();

      const mapper = (audiencesInstance as any).audiencesUidMapper;
      expect(mapper['contentstack-audience-001']).to.equal('new-contentstack-uid');
    });
  });
});
