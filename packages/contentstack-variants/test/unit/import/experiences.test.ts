import { expect } from 'chai';
import sinon from 'sinon';
import cloneDeep from 'lodash/cloneDeep';
import { FsUtility } from '@contentstack/cli-utilities';

import importConf from '../mock/import-config.json';
import { Import, ImportConfig } from '../../../src';

/** Predictable new UID returned for each experience name by createExperience stub */
const NAME_TO_NEW_UID: Record<string, string> = {
  'AB Test No Audiences': 'new-uid-empty',
  'Experience Lytics Only': 'new-uid-lytics',
  'Valid Experience': 'new-uid-valid',
  'Mixed Audiences Experience': 'new-uid-mixed',
  'No Versions File Experience': 'new-uid-no-versions',
};

function buildConfig(): ImportConfig {
  const config = cloneDeep(importConf) as unknown as ImportConfig;
  (config.modules as any).personalize = {
    ...(config.modules as any).personalization,
    dirName: 'personalize',
    project_id: 'PROJ-TEST',
    importData: true,
    baseURL: { 'AWS-NA': 'https://personalization.na-api.contentstack.com' },
  };
  (config as any).region = { name: 'AWS-NA', cma: 'https://api.contentstack.io' };
  config.context = (config as any).context || {};
  return config;
}

describe('Experiences Import', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(Import.Experiences.prototype, 'init').resolves();
    sandbox.stub(FsUtility.prototype, 'writeFile').returns(undefined as any);
    sandbox.stub(FsUtility.prototype, 'makeDirectory').resolves(undefined);
  });

  afterEach(() => {
    sandbox.restore();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // importExperienceVersions — unit tests (direct method call)
  // ──────────────────────────────────────────────────────────────────────────
  describe('importExperienceVersions', () => {
    let updateVersionStub: sinon.SinonStub;
    let createVersionStub: sinon.SinonStub;

    beforeEach(() => {
      updateVersionStub = sandbox.stub(Import.Experiences.prototype, 'updateExperienceVersion').resolves();
      createVersionStub = sandbox.stub(Import.Experiences.prototype, 'createExperienceVersion').resolves();
    });

    it('returns false when no versions file exists on disk', async () => {
      const instance = new Import.Experiences(buildConfig());
      const result = await instance.importExperienceVersions(
        { uid: 'new-uid-nofile', latestVersion: 'ver-nofile' } as any,
        'exp-no-versions-file',
      );
      expect(result).to.equal(false);
      expect(updateVersionStub.callCount).to.equal(0);
      expect(createVersionStub.callCount).to.equal(0);
    });

    it('returns false when version has variants: [] (experience had no audiences)', async () => {
      const instance = new Import.Experiences(buildConfig());
      const result = await instance.importExperienceVersions(
        { uid: 'new-uid-empty', latestVersion: 'ver-empty-latest' } as any,
        'exp-empty-audiences',
      );
      expect(result).to.equal(false);
      expect(updateVersionStub.callCount).to.equal(0);
    });

    it('returns false when all Lytics audiences are stripped by lookUpAudiences', async () => {
      const instance = new Import.Experiences(buildConfig());
      const result = await instance.importExperienceVersions(
        { uid: 'new-uid-lytics', latestVersion: 'ver-lytics-latest' } as any,
        'exp-lytics-only',
      );
      expect(result).to.equal(false);
      expect(updateVersionStub.callCount).to.equal(0);
    });

    it('returns true when version has a valid mapped CS audience', async () => {
      const instance = new Import.Experiences(buildConfig());
      const result = await instance.importExperienceVersions(
        { uid: 'new-uid-valid', latestVersion: 'ver-valid-latest' } as any,
        'exp-valid',
      );
      expect(result).to.equal(true);
    });

    it('calls updateExperienceVersion for ACTIVE status version', async () => {
      const instance = new Import.Experiences(buildConfig());
      await instance.importExperienceVersions(
        { uid: 'new-uid-valid', latestVersion: 'ver-valid-latest' } as any,
        'exp-valid',
      );
      expect(updateVersionStub.callCount).to.equal(1);
      expect(updateVersionStub.firstCall.args[0]).to.equal('new-uid-valid');
      expect(updateVersionStub.firstCall.args[2].status).to.equal('ACTIVE');
      expect(createVersionStub.callCount).to.equal(0);
    });

    it('returns true when mixed CS+Lytics variant — CS audience survives, Lytics stripped', async () => {
      const instance = new Import.Experiences(buildConfig());
      const result = await instance.importExperienceVersions(
        { uid: 'new-uid-mixed', latestVersion: 'ver-mixed-latest' } as any,
        'exp-mixed',
      );
      expect(result).to.equal(true);
    });

    it('calls updateExperienceVersion for DRAFT when no ACTIVE version exists', async () => {
      const instance = new Import.Experiences(buildConfig());
      const result = await instance.importExperienceVersions(
        { uid: 'new-uid-draft-only', latestVersion: 'ver-draft-only-latest' } as any,
        'exp-draft-only',
      );
      expect(result).to.equal(true);
      expect(updateVersionStub.callCount).to.equal(1);
      expect(updateVersionStub.firstCall.args[2].status).to.equal('DRAFT');
      expect(createVersionStub.callCount).to.equal(0);
    });

    it('calls updateExperienceVersion for ACTIVE then createExperienceVersion for DRAFT when both exist', async () => {
      const instance = new Import.Experiences(buildConfig());
      const result = await instance.importExperienceVersions(
        { uid: 'new-uid-active-and-draft', latestVersion: 'ver-ad-latest' } as any,
        'exp-active-and-draft',
      );
      expect(result).to.equal(true);
      expect(updateVersionStub.callCount).to.equal(1);
      expect(updateVersionStub.firstCall.args[2].status).to.equal('ACTIVE');
      expect(createVersionStub.callCount).to.equal(1);
      expect(createVersionStub.firstCall.args[1].status).to.equal('DRAFT');
    });

    it('does not call any version API when all variants stripped after audience mapping', async () => {
      const instance = new Import.Experiences(buildConfig());
      await instance.importExperienceVersions(
        { uid: 'new-uid-lytics', latestVersion: 'ver-lytics-latest' } as any,
        'exp-lytics-only',
      );
      expect(updateVersionStub.callCount).to.equal(0);
      expect(createVersionStub.callCount).to.equal(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // import() — integration tests across all 5 mock experiences
  // ──────────────────────────────────────────────────────────────────────────
  describe('import()', () => {
    let capturedPendingList: string[];
    let attachCTsStub: sinon.SinonStub;
    let createExperienceStub: sinon.SinonStub;

    beforeEach(() => {
      capturedPendingList = [];

      createExperienceStub = sandbox.stub(Import.Experiences.prototype, 'createExperience')
        .callsFake(async function (payload: any) {
          const uid = NAME_TO_NEW_UID[payload.name] ?? `new-uid-${payload.name}`;
          return { uid, latestVersion: `ver-${uid}-latest` };
        } as any);

      sandbox.stub(Import.Experiences.prototype, 'updateExperienceVersion').resolves();
      sandbox.stub(Import.Experiences.prototype, 'createExperienceVersion').resolves();

      sandbox.stub(Import.Experiences.prototype, 'validateVariantGroupAndVariantsCreated')
        .callsFake(async function (this: any) {
          capturedPendingList = [...this.pendingVariantAndVariantGrpForExperience];
          return true;
        });

      attachCTsStub = sandbox.stub(Import.Experiences.prototype, 'attachCTsInExperience').resolves();
      sandbox.stub(Import.Experiences.prototype, 'createVariantIdMapper').resolves();
    });

    it('pendingVariantAndVariantGrpForExperience contains only experiences with valid variants', async () => {
      const instance = new Import.Experiences(buildConfig());
      await instance.import();

      expect(capturedPendingList).to.include('new-uid-valid');
      expect(capturedPendingList).to.include('new-uid-mixed');
    });

    it('pendingVariantAndVariantGrpForExperience excludes experiences with no valid variants', async () => {
      const instance = new Import.Experiences(buildConfig());
      await instance.import();

      expect(capturedPendingList).to.not.include('new-uid-empty');
      expect(capturedPendingList).to.not.include('new-uid-lytics');
      expect(capturedPendingList).to.not.include('new-uid-no-versions');
    });

    it('pendingVariantAndVariantGrpForExperience has exactly 2 entries (valid + mixed)', async () => {
      const instance = new Import.Experiences(buildConfig());
      await instance.import();

      expect(capturedPendingList).to.have.length(2);
    });

    it('calls attachCTsInExperience when validateVariantGroupAndVariantsCreated returns true', async () => {
      const instance = new Import.Experiences(buildConfig());
      await instance.import();

      expect(attachCTsStub.callCount).to.equal(1);
    });

    it('does NOT call attachCTsInExperience when validateVariantGroupAndVariantsCreated returns false', async () => {
      // Override validate stub to return false (simulates backend timeout)
      (Import.Experiences.prototype.validateVariantGroupAndVariantsCreated as sinon.SinonStub)
        .callsFake(async function (this: any) {
          capturedPendingList = [...this.pendingVariantAndVariantGrpForExperience];
          return false;
        });

      const instance = new Import.Experiences(buildConfig());
      await instance.import();

      expect(attachCTsStub.callCount).to.equal(0);
    });

    it('when all experiences produce no valid variants, pending list is empty and attachCTsInExperience is still called', async () => {
      // Override importExperienceVersions to always return false for all experiences
      sandbox.stub(Import.Experiences.prototype, 'importExperienceVersions').resolves(false);

      // Reset validate stub: empty pending list → real impl returns true immediately
      // but validate is already stubbed to capture and return true, so it still works
      const instance = new Import.Experiences(buildConfig());
      await instance.import();

      expect(capturedPendingList).to.have.length(0);
      expect(attachCTsStub.callCount).to.equal(1);
    });

    it('calls createExperience for every experience in experiences.json', async () => {
      const instance = new Import.Experiences(buildConfig());
      await instance.import();

      // 5 experiences in mock: empty, lytics, valid, mixed, no-versions-file
      expect(createExperienceStub.callCount).to.equal(5);
    });
  });
});
