import sinon from 'sinon';
import { expect } from 'chai';
import * as fs from 'fs';
import { Import, ImportConfig } from '../../../src';
import { fsUtil } from '../../../src/utils';

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

// ─── helpers ────────────────────────────────────────────────────────────────

function makeExperience(uid: string, latestVersion = 1) {
  return { uid, latestVersion, name: `Experience ${uid}` };
}

function makeVersion(status: string, audiences: string[] = ['aud-001']) {
  return {
    uid: `ver-${status.toLowerCase()}`,
    status,
    variants: [{ __type: 'SegmentedVariant', audiences }],
  };
}

// ─── importExperienceVersions ─────────────────────────────────────────────────

describe('ImportExperiences — importExperienceVersions (DX-9469 fix)', () => {
  let instance: any;
  let tmpDir: string;

  beforeEach(() => {
    instance = new Import.Experiences(makeImportConfig());
    instance.audiencesUid = { 'aud-001': 'aud-new-001' };
    instance.eventsUid = {};
    tmpDir = fs.mkdtempSync(require('os').tmpdir() + '/exp-test-');
    fs.mkdirSync(require('path').join(tmpDir, 'versions'), { recursive: true });
    instance.experiencesDirPath = tmpDir;
  });

  afterEach(() => {
    sinon.restore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeVersionFile(uid: string, versions: any[]) {
    fs.writeFileSync(
      require('path').join(tmpDir, 'versions', `${uid}.json`),
      JSON.stringify(versions),
    );
  }

  it('returns false (not undefined) when versions file does not exist', async () => {
    // no file written → path does not exist
    const result = await instance.importExperienceVersions(makeExperience('exp-001'), 'exp-no-file');
    expect(result).to.equal(false);
  });

  it('returns false when all versions have Lytics-only audiences (versionMap all-undefined)', async () => {
    const lyticsVersion = {
      uid: 'ver-active',
      status: 'ACTIVE',
      variants: [{ __type: 'SegmentedVariant', lyticsAudiences: ['lytics-123'], audiences: [] }],
    };
    writeVersionFile('exp-002', [lyticsVersion]);
    const handleStub = sinon.stub(instance, 'handleVersionUpdateOrCreate').resolves();

    const result = await instance.importExperienceVersions(makeExperience('exp-002'), 'exp-002');

    expect(result).to.equal(false);
    expect(handleStub.called).to.be.false;
  });

  it('returns false when all versions have unmapped CS audiences (variants stripped to empty)', async () => {
    writeVersionFile('exp-003', [makeVersion('ACTIVE', ['aud-unmapped'])]);
    const handleStub = sinon.stub(instance, 'handleVersionUpdateOrCreate').resolves();

    const result = await instance.importExperienceVersions(makeExperience('exp-003'), 'exp-003');

    expect(result).to.equal(false);
    expect(handleStub.called).to.be.false;
  });

  it('returns true when at least one valid version exists and calls handleVersionUpdateOrCreate', async () => {
    writeVersionFile('exp-004', [makeVersion('ACTIVE')]);
    const handleStub = sinon.stub(instance, 'handleVersionUpdateOrCreate').resolves();

    const result = await instance.importExperienceVersions(makeExperience('exp-004'), 'exp-004');

    expect(result).to.equal(true);
    expect(handleStub.calledOnce).to.be.true;
  });

  it('returns true when only DRAFT version is valid (ACTIVE missing)', async () => {
    writeVersionFile('exp-005', [makeVersion('DRAFT')]);
    const handleStub = sinon.stub(instance, 'handleVersionUpdateOrCreate').resolves();

    const result = await instance.importExperienceVersions(makeExperience('exp-005'), 'exp-005');

    expect(result).to.equal(true);
    expect(handleStub.calledOnce).to.be.true;
  });
});

// ─── import() — Set-based pending list (DX-9469 fix) ─────────────────────────

describe('ImportExperiences — pending list only includes experiences with variants', () => {
  let instance: any;

  afterEach(() => sinon.restore());

  it('empty experiences list → pendingVariantAndVariantGrpForExperience stays empty', async () => {
    instance = new Import.Experiences(makeImportConfig());
    sinon.stub(instance, 'analyzeExperiences' as any).resolves([false, 0]);

    await instance.import();

    expect(instance.pendingVariantAndVariantGrpForExperience).to.deep.equal([]);
  });

  it('experience with no valid versions is NOT added to pending list', async () => {
    instance = new Import.Experiences(makeImportConfig());
    sinon.stub(instance, 'analyzeExperiences' as any).resolves([true, 1]);
    sinon.stub(instance, 'init' as any).resolves();
    sinon.stub(fsUtil, 'makeDirectory').resolves();
    instance.experiences = [makeExperience('old-exp-a')];
    sinon.stub(instance, 'createExperience' as any).resolves(makeExperience('new-exp-a'));
    // importExperienceVersions returns false → UID must NOT enter the Set
    sinon.stub(instance, 'importExperienceVersions' as any).resolves(false);
    sinon.stub(instance, 'validateVariantGroupAndVariantsCreated').resolves(true);
    sinon.stub(instance, 'attachCTsInExperience').resolves();
    sinon.stub(instance, 'createVariantIdMapper').resolves();
    sinon.stub(fsUtil, 'writeFile').returns(undefined);
    sinon.stub(instance, 'updateProgress' as any).returns(undefined);
    sinon.stub(instance, 'createSimpleProgress' as any).returns({ tick: () => {}, complete: () => {} });
    sinon.stub(instance, 'completeProgress' as any).returns(undefined);

    await instance.import();

    expect(instance.pendingVariantAndVariantGrpForExperience).to.deep.equal([]);
  });

  it('experience with valid versions IS added to pending list', async () => {
    instance = new Import.Experiences(makeImportConfig());
    sinon.stub(instance, 'analyzeExperiences' as any).resolves([true, 1]);
    sinon.stub(instance, 'init' as any).resolves();
    sinon.stub(fsUtil, 'makeDirectory').resolves();
    instance.experiences = [makeExperience('old-exp-b')];
    sinon.stub(instance, 'createExperience' as any).resolves(makeExperience('new-exp-b'));
    // importExperienceVersions returns true → UID MUST enter the Set
    sinon.stub(instance, 'importExperienceVersions' as any).resolves(true);
    sinon.stub(instance, 'validateVariantGroupAndVariantsCreated').resolves(true);
    sinon.stub(instance, 'attachCTsInExperience').resolves();
    sinon.stub(instance, 'createVariantIdMapper').resolves();
    sinon.stub(fsUtil, 'writeFile').returns(undefined);
    sinon.stub(instance, 'updateProgress' as any).returns(undefined);
    sinon.stub(instance, 'createSimpleProgress' as any).returns({ tick: () => {}, complete: () => {} });
    sinon.stub(instance, 'completeProgress' as any).returns(undefined);

    await instance.import();

    expect(instance.pendingVariantAndVariantGrpForExperience).to.deep.equal(['new-exp-b']);
  });
});

// ─── validateVariantGroupAndVariantsCreated — empty pending list ──────────────

describe('ImportExperiences — validateVariantGroupAndVariantsCreated with empty pending list', () => {
  afterEach(() => sinon.restore());

  it('resolves true immediately when pendingVariantAndVariantGrpForExperience is empty', async () => {
    const instance = new Import.Experiences(makeImportConfig());
    instance.pendingVariantAndVariantGrpForExperience = [];
    const getExpStub = sinon.stub(instance, 'getExperience' as any).resolves({});

    const result = await instance.validateVariantGroupAndVariantsCreated();

    expect(result).to.equal(true);
    expect(getExpStub.called).to.be.false;
  });
});

// ─── attachCTsInExperience — null guard (DX-9469 fix) ────────────────────────

describe('ImportExperiences — attachCTsInExperience null guard', () => {
  afterEach(() => sinon.restore());

  it('skips CT attachment gracefully when getVariantGroup returns no variantGroup', async () => {
    const instance = new Import.Experiences(makeImportConfig());
    instance.experiencesUidMapper = { 'old-exp': 'new-exp' };
    sinon.stub(fsUtil, 'readFile')
      .onFirstCall().returns(['ct-uid-1'])
      .onSecondCall().returns({ 'old-exp': [{ uid: 'ct-uid-1', status: 'linked' }] });
    // getVariantGroup returns empty variant_groups → variantGroup is undefined
    sinon.stub(instance, 'getVariantGroup' as any).resolves({ variant_groups: [] });
    const updateStub = sinon.stub(instance, 'updateVariantGroup' as any).resolves();

    await instance.attachCTsInExperience();

    // Must not throw; updateVariantGroup must NOT be called since variantGroup is missing
    expect(updateStub.called).to.be.false;
  });

  it('attaches CTs normally when variantGroup exists', async () => {
    const instance = new Import.Experiences(makeImportConfig());
    instance.experiencesUidMapper = { 'old-exp': 'new-exp' };
    sinon.stub(fsUtil, 'readFile')
      .onFirstCall().returns(['ct-uid-1'])
      .onSecondCall().returns({ 'old-exp': [{ uid: 'ct-uid-1', status: 'linked' }] });
    const fakeGroup = { uid: 'vg-001', content_types: [] };
    sinon.stub(instance, 'getVariantGroup' as any).resolves({ variant_groups: [fakeGroup] });
    const updateStub = sinon.stub(instance, 'updateVariantGroup' as any).resolves();

    await instance.attachCTsInExperience();

    expect(updateStub.calledOnce).to.be.true;
    expect(fakeGroup.content_types).to.deep.equal([{ uid: 'ct-uid-1', status: 'linked' }]);
  });
});

// ─── branch header (pre-existing) ────────────────────────────────────────────

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
