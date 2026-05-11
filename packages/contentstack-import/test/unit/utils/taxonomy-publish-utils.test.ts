import { expect } from 'chai';
import * as sinon from 'sinon';
import { serializePublishTaxonomies } from '../../../src/utils/taxonomy-publish-utils';
import type { ApiOptions } from '../../../src/import/modules/base-class';

describe('taxonomy-publish-utils', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('serializePublishTaxonomies', () => {
    it('maps source environment UIDs to destination UIDs and sets items to uid only', () => {
      const envUidMapper = { bltSrc: 'bltDest' };
      const apiOptions: ApiOptions = {
        entity: 'publish-taxonomies',
        apiData: {
          taxonomy: {
            uid: 'tax1',
            locale: 'en-us',
            publish_details: [{ environment: 'bltSrc', time: '', user: '' }],
          },
        },
        resolve: sandbox.stub(),
        reject: sandbox.stub(),
      };

      const result = serializePublishTaxonomies(apiOptions, envUidMapper);

      expect(result.apiData).to.deep.equal({
        environments: ['bltDest'],
        locales: ['en-us'],
        items: [{ uid: 'tax1' }],
      });
    });

    it('dedupes multiple publish_details environments', () => {
      const envUidMapper = { e1: 'd1', e2: 'd2' };
      const apiOptions: ApiOptions = {
        entity: 'publish-taxonomies',
        apiData: {
          taxonomy: {
            uid: 'tax2',
            locale: 'fr-fr',
            publish_details: [{ environment: 'e1' }, { environment: 'e2' }, { environment: 'e1' }],
          },
        },
        resolve: sandbox.stub(),
        reject: sandbox.stub(),
      };

      const result = serializePublishTaxonomies(apiOptions, envUidMapper);

      expect((result.apiData as any).environments).to.deep.equal(['d1', 'd2']);
      expect((result.apiData as any).locales).to.deep.equal(['fr-fr']);
      expect((result.apiData as any).items).to.deep.equal([{ uid: 'tax2' }]);
    });

    it('returns undefined when publish_details empty', () => {
      const envUidMapper = { x: 'y' };
      const apiOptions: ApiOptions = {
        entity: 'publish-taxonomies',
        apiData: {
          taxonomy: { uid: 't', locale: 'en-us', publish_details: [] },
        },
        resolve: sandbox.stub(),
        reject: sandbox.stub(),
      };

      expect(serializePublishTaxonomies(apiOptions, envUidMapper).apiData).to.be.undefined;
    });

    it('returns undefined when no env mapping resolves', () => {
      const envUidMapper = {};
      const apiOptions: ApiOptions = {
        entity: 'publish-taxonomies',
        apiData: {
          taxonomy: {
            uid: 'tax1',
            locale: 'en-us',
            publish_details: [{ environment: 'missing' }],
          },
        },
        resolve: sandbox.stub(),
        reject: sandbox.stub(),
      };

      expect(serializePublishTaxonomies(apiOptions, envUidMapper).apiData).to.be.undefined;
    });

    it('returns undefined when taxonomy.locale missing', () => {
      const envUidMapper = { e: 'd' };
      const apiOptions: ApiOptions = {
        entity: 'publish-taxonomies',
        apiData: {
          taxonomy: {
            uid: 'tax1',
            publish_details: [{ environment: 'e' }],
          },
        },
        resolve: sandbox.stub(),
        reject: sandbox.stub(),
      };

      expect(serializePublishTaxonomies(apiOptions, envUidMapper).apiData).to.be.undefined;
    });
  });
});
