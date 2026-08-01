import fs from 'fs';
import { resolve } from 'path';
import { expect } from 'chai';
import fancy from 'fancy-test';
import Sinon from 'sinon';
import { cliux } from '@contentstack/cli-utilities';
import config from '../../../src/config';
import { $t, auditMsg } from '../../../src/messages';
import Assets from '../../../src/modules/assets';
import { ModuleConstructorParam, CtConstructorParam } from '../../../src/types';
import { mockLogger } from '../mock-logger';

const mockContentsPath = resolve(__dirname, '..', 'mock', 'contents');

describe('Assets module', () => {
  let constructorParam: ModuleConstructorParam & CtConstructorParam;

  beforeEach(() => {
    constructorParam = {
      moduleName: 'assets',
      ctSchema: [] as any,
      gfSchema: {} as any,
      config: Object.assign(config, {
        basePath: mockContentsPath,
        flags: {} as any,
      }),
    };
    Sinon.stub(require('@contentstack/cli-utilities'), 'log').value(mockLogger);
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('constructor and validateModules', () => {
    it('should set moduleName, folderPath and fileName when module is in config', () => {
      const instance = new Assets(constructorParam);
      expect(instance.moduleName).to.eql('assets');
      expect(instance.fileName).to.eql('assets.json');
      expect(instance.folderPath).to.include('assets');
    });

    it('should default moduleName to assets when module not in config', () => {
      const instance = new Assets({
        ...constructorParam,
        moduleName: 'invalid' as any,
      });
      expect(instance.moduleName).to.eql('assets');
    });
  });

  describe('run()', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should return empty result and print NOT_VALID_PATH when path does not exist', async () => {
        const instance = new Assets({
          ...constructorParam,
          config: { ...constructorParam.config, basePath: resolve(__dirname, '..', 'mock', 'nonexistent') },
        });
        const result = await instance.run(false);
        expect(result).to.eql({});
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should return [] when returnFixSchema true and path does not exist', async () => {
        const instance = new Assets({
          ...constructorParam,
          config: { ...constructorParam.config, basePath: resolve(__dirname, '..', 'mock', 'nonexistent') },
        });
        const result = await instance.run(true);
        expect(result).to.eql([]);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(Assets.prototype, 'prerequisiteData', Sinon.stub().resolves())
      .stub(Assets.prototype, 'lookForReference', Sinon.stub().resolves())
      .it('should return missingEnvLocales and call completeProgress when path exists', async () => {
        const instance = new Assets(constructorParam);
        (instance as any).missingEnvLocales = { uid1: [{ publish_locale: 'en', publish_environment: 'e1' }] };
        const completeSpy = Sinon.spy(Assets.prototype as any, 'completeProgress');
        const result = await instance.run(false);
        expect(result).to.have.property('uid1');
        expect(completeSpy.calledWith(true)).to.be.true;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(Assets.prototype, 'prerequisiteData', Sinon.stub().resolves())
      .stub(Assets.prototype, 'lookForReference', Sinon.stub().resolves())
      .it('should create progress and updateStatus when totalCount provided', async () => {
        const progressStub = { updateStatus: Sinon.stub() };
        const createProgressStub = Sinon.stub(Assets.prototype as any, 'createSimpleProgress').returns(progressStub as any);
        const instance = new Assets(constructorParam);
        await instance.run(false, 5);
        expect(createProgressStub.calledWith('assets', 5)).to.be.true;
        expect(progressStub.updateStatus.calledWith('Validating asset references...')).to.be.true;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(Assets.prototype, 'prerequisiteData', Sinon.stub().resolves())
      .stub(Assets.prototype, 'lookForReference', Sinon.stub().resolves())
      .it('should return schema (empty array) when returnFixSchema is true', async () => {
        const instance = new Assets(constructorParam);
        const result = await instance.run(true);
        expect(result).to.eql([]);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(Assets.prototype, 'prerequisiteData', Sinon.stub().resolves())
      .stub(Assets.prototype, 'lookForReference', Sinon.stub().callsFake(function (this: Assets) {
        (this as any).missingEnvLocales['someUid'] = [];
      }))
      .it('should cleanup empty missingEnvLocales entries', async () => {
        const instance = new Assets(constructorParam);
        const result = await instance.run(false);
        expect(result).to.not.have.property('someUid');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(Assets.prototype, 'prerequisiteData', Sinon.stub().resolves())
      .stub(Assets.prototype, 'lookForReference', Sinon.stub().rejects(new Error('lookForReference failed')))
      .it('should call completeProgress(false) and rethrow on error', async () => {
        const instance = new Assets(constructorParam);
        const completeSpy = Sinon.spy(instance as any, 'completeProgress');
        try {
          await instance.run(false);
        } catch (e: any) {
          expect(completeSpy.calledWith(false, 'lookForReference failed')).to.be.true;
          expect(e.message).to.eql('lookForReference failed');
        }
      });
  });

  describe('prerequisiteData()', () => {
    it('should load locales and environments when all files present', async () => {
      const instance = new Assets(constructorParam);
      await instance.prerequisiteData();
      expect(instance.locales).to.be.an('array');
      expect(instance.locales).to.include('en-us');
      expect(instance.environments).to.be.an('array');
      expect(instance.environments).to.include('env1');
      expect(instance.environments).to.include('env2');
    });

    it('should map locales to .code', async () => {
      const instance = new Assets(constructorParam);
      await instance.prerequisiteData();
      expect(instance.locales.every((l: string) => typeof l === 'string')).to.be.true;
      expect(instance.locales).to.include('en-us');
    });

    fancy
      .stdout({ print: false })
      .stub(fs, 'existsSync', Sinon.stub().callThrough().withArgs(Sinon.match(/master-locale\.json/)).returns(false))
      .it('should have locales from locales.json only when no master-locale', async () => {
        const instance = new Assets(constructorParam);
        await instance.prerequisiteData();
        Sinon.restore();
        expect(instance.locales).to.be.an('array');
      });

    fancy
      .stdout({ print: false })
      .stub(fs, 'existsSync', Sinon.stub().callThrough().withArgs(Sinon.match(/environments\.json/)).returns(false))
      .it('should have empty environments when environments file missing', async () => {
        const instance = new Assets(constructorParam);
        await instance.prerequisiteData();
        Sinon.restore();
        expect(instance.environments).to.eql([]);
      });
  });

  describe('writeFixContent()', () => {
    it('should not call writeFileSync when fix is false', async () => {
      const instance = new Assets({ ...constructorParam, fix: false });
      const writeStub = Sinon.stub(fs, 'writeFileSync');
      await instance.writeFixContent('/some/path', { a: {} } as any);
      expect(writeStub.called).to.be.false;
      writeStub.restore();
    });

    fancy
      .stdout({ print: false })
      .stub(cliux, 'confirm', Sinon.stub().resolves(true))
      .it('should write file when fix true and user confirms', async () => {
        const instance = new Assets({ ...constructorParam, fix: true });
        const writeStub = Sinon.stub(fs, 'writeFileSync');
        await instance.writeFixContent('/tmp/out.json', { uid1: { title: 'A' } } as any);
        expect(writeStub.calledOnce).to.be.true;
        expect(writeStub.firstCall.args[0]).to.eql('/tmp/out.json');
        expect(JSON.parse(String(writeStub.firstCall.args[1]))).to.deep.include({ uid1: { title: 'A' } });
        writeStub.restore();
        Sinon.restore();
      });

    fancy
      .stdout({ print: false })
      .stub(cliux, 'confirm', Sinon.stub().resolves(false))
      .it('should not write when fix true and user declines', async () => {
        const instance = new Assets({
          ...constructorParam,
          fix: true,
          config: { ...constructorParam.config, flags: { yes: false } as any },
        });
        const writeStub = Sinon.stub(fs, 'writeFileSync');
        await instance.writeFixContent('/tmp/out.json', {});
        expect(writeStub.called).to.be.false;
        writeStub.restore();
        Sinon.restore();
      });

    fancy
      .stdout({ print: false })
      .it('should write without confirm when flags.yes is true', async () => {
        const instance = new Assets({
          ...constructorParam,
          fix: true,
          config: { ...constructorParam.config, flags: { yes: true } as any },
        });
        const writeStub = Sinon.stub(fs, 'writeFileSync');
        const confirmSpy = Sinon.spy(cliux, 'confirm');
        await instance.writeFixContent('/tmp/out.json', { x: {} } as any);
        expect(writeStub.calledOnce).to.be.true;
        expect(confirmSpy.called).to.be.false;
        writeStub.restore();
        Sinon.restore();
      });

    fancy
      .stdout({ print: false })
      .it('should skip confirm when flags.copy-dir is true', async () => {
        const instance = new Assets({
          ...constructorParam,
          fix: true,
          config: { ...constructorParam.config, flags: { 'copy-dir': true } as any },
        });
        const writeStub = Sinon.stub(fs, 'writeFileSync');
        const confirmSpy = Sinon.spy(cliux, 'confirm');
        await instance.writeFixContent('/tmp/out.json', { x: {} } as any);
        expect(writeStub.calledOnce).to.be.true;
        expect(confirmSpy.called).to.be.false;
        writeStub.restore();
        Sinon.restore();
      });

    fancy
      .stdout({ print: false })
      .it('should skip confirm when external-config.skipConfirm is true', async () => {
        const instance = new Assets({
          ...constructorParam,
          fix: true,
          config: {
            ...constructorParam.config,
            flags: { 'external-config': { skipConfirm: true } } as any,
          },
        });
        const writeStub = Sinon.stub(fs, 'writeFileSync');
        const confirmSpy = Sinon.spy(cliux, 'confirm');
        await instance.writeFixContent('/tmp/out.json', { x: {} } as any);
        expect(writeStub.calledOnce).to.be.true;
        expect(confirmSpy.called).to.be.false;
        writeStub.restore();
        Sinon.restore();
      });
  });

  describe('lookForReference()', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should process assets and populate missingEnvLocales for invalid publish_details', async () => {
        const instance = new Assets(constructorParam);
        await instance.prerequisiteData();
        await instance.lookForReference();
        const missing = (instance as any).missingEnvLocales;
        expect(missing).to.have.property('asset_uid_invalid');
        expect(missing.asset_uid_invalid).to.have.lengthOf(1);
        expect(missing.asset_uid_two_invalid).to.have.lengthOf(2);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should call progressManager.tick when progress manager exists', async () => {
        const instance = new Assets(constructorParam);
        await instance.prerequisiteData();
        const tickStub = Sinon.stub();
        (instance as any).progressManager = { tick: tickStub };
        await instance.lookForReference();
        expect(tickStub.callCount).to.be.greaterThan(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should call writeFixContent when fix is true and asset has invalid pd', async () => {
        const instance = new Assets({ ...constructorParam, fix: true });
        await instance.prerequisiteData();
        const writeFixSpy = Sinon.stub(Assets.prototype, 'writeFixContent').resolves();
        await instance.lookForReference();
        expect(writeFixSpy.called).to.be.true;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should print ASSET_NOT_EXIST when publish_details is not an array', async () => {
        const assetsPath = resolve(mockContentsPath, 'assets');
        const chunkPath = resolve(assetsPath, 'chunk0-assets.json');
        const original = fs.readFileSync(chunkPath, 'utf8');
        const badChunk = {
          asset_bad_pd: {
            uid: 'asset_bad_pd',
            publish_details: 'not-array',
          },
        };
        fs.writeFileSync(chunkPath, JSON.stringify(badChunk));
        try {
          const instance = new Assets(constructorParam);
          await instance.prerequisiteData();
          const printStub = Sinon.stub(cliux, 'print');
          await instance.lookForReference();
          expect(printStub.called).to.be.true;
          const assertMsg = $t(auditMsg.ASSET_NOT_EXIST, { uid: 'asset_bad_pd' });
          expect(printStub.calledWith(assertMsg, { color: 'red' })).to.be.true;
          Sinon.restore();
        } finally {
          fs.writeFileSync(chunkPath, typeof original === 'string' ? original : String(original));
        }
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('when fix true and multiple assets in chunk, confirm is called only once', async () => {
        const instance = new Assets({ ...constructorParam, fix: true });
        await instance.prerequisiteData();
        const confirmStub = Sinon.stub(cliux, 'confirm').resolves(true);
        const writeStub = Sinon.stub(fs, 'writeFileSync');
        await instance.lookForReference();
        expect(confirmStub.callCount).to.equal(1);
        confirmStub.restore();
        writeStub.restore();
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('calls writeFixContent once per chunk file when fix is true (not per asset)', async () => {
        const instance = new Assets({ ...constructorParam, fix: true });
        await instance.prerequisiteData();
        const writeFixSpy = Sinon.stub(Assets.prototype, 'writeFixContent').resolves();
        await instance.lookForReference();
        expect(writeFixSpy.callCount).to.equal(1);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should log scan success message exactly once per asset', async () => {
        const infoSpy = Sinon.spy();
        Sinon.stub(require('@contentstack/cli-utilities'), 'log').value({
          ...mockLogger,
          info: infoSpy,
        });
        const instance = new Assets(constructorParam);
        await instance.prerequisiteData();
        await instance.lookForReference();
        const successMsgCalls = infoSpy.getCalls().filter(
          (call: Sinon.SinonSpyCall) =>
            typeof call.args[0] === 'string' && call.args[0].includes("Successfully completed the scanning of Asset with UID"),
        );
        const expectedAssetUids = ['asset_uid_1', 'asset_uid_invalid', 'asset_uid_two_invalid'];
        expect(successMsgCalls).to.have.lengthOf(expectedAssetUids.length);
        expectedAssetUids.forEach((uid) => {
          const forUid = successMsgCalls.filter((c: Sinon.SinonSpyCall) => c.args[0].includes(uid));
          expect(forUid).to.have.lengthOf(1, `expected exactly one success log for asset ${uid}`);
        });
      });
  });

  describe('AM cross-stack publish details', () => {
    const amContentsPath = resolve(__dirname, '..', 'mock', 'am-contents');

    const amParam = (overrides: Record<string, any> = {}) => ({
      ...constructorParam,
      ...overrides,
      config: { ...constructorParam.config, basePath: amContentsPath, flags: {} as any, ...(overrides.config || {}) },
    });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should not report publish details owned by other stacks', async () => {
        const instance = new Assets(amParam());
        await instance.prerequisiteData();
        await instance.lookForReference();
        const missing = (instance as any).missingEnvLocales;
        expect(Object.keys(missing)).to.have.members([
          'am_asset_mixed',
          'am_asset_bad_locale',
          'am_asset_bad_both',
          'am_asset_legacy_pd',
        ]);
        expect(missing).to.not.have.property('am_asset_cross_only');
        expect(missing).to.not.have.property('am_asset_clean');
        expect(missing.am_asset_mixed).to.have.lengthOf(1);
        expect(missing.am_asset_mixed[0]).to.include({
          asset_uid: 'am_asset_mixed',
          publish_locale: 'en-us',
          publish_environment: 'env_own_missing',
          space_id: 'space_one',
        });
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should keep other stacks publish details and only strip own-stack invalid ones on fix', async () => {
        const instance = new Assets(amParam({ fix: true, config: { flags: { yes: true } as any } }));
        await instance.prerequisiteData();
        const writeStub = Sinon.stub(fs, 'writeFileSync');
        await instance.lookForReference();

        // space_clean has nothing to fix, so only space_one's chunk is written
        expect(writeStub.callCount).to.equal(1);
        expect(writeStub.firstCall.args[0]).to.include('space_one');

        const written = JSON.parse(writeStub.firstCall.args[1] as string);
        expect(written.am_asset_cross_only.publish_details).to.have.lengthOf(2);
        expect(written.am_asset_mixed.publish_details.map((pd: any) => pd.environment)).to.eql([
          'env_own_dev',
          'env_other_dev',
        ]);
        expect(written.am_asset_bad_locale.publish_details).to.have.lengthOf(0);
        expect(written.am_asset_bad_both.publish_details).to.have.lengthOf(0);
        expect(written.am_asset_legacy_pd.publish_details.map((pd: any) => pd.environment)).to.eql(['env_own_dev']);
        writeStub.restore();
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should not write or ask for confirmation when a chunk has nothing to fix', async () => {
        const instance = new Assets(amParam({ fix: true }));
        await instance.prerequisiteData();
        (instance as any).resolvedBasePaths = [
          { path: resolve(amContentsPath, 'spaces', 'space_clean', 'assets'), spaceId: 'space_clean' },
        ];
        const confirmStub = Sinon.stub(cliux, 'confirm').resolves(true);
        const writeStub = Sinon.stub(fs, 'writeFileSync');
        await instance.lookForReference();
        expect(writeStub.called).to.be.false;
        expect(confirmStub.called).to.be.false;
        confirmStub.restore();
        writeStub.restore();
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should name the missing environment, locale or both in the warning', async () => {
        const instance = new Assets(amParam());
        await instance.prerequisiteData();
        const printStub = Sinon.stub(cliux, 'print');
        await instance.lookForReference();

        const printed = printStub.getCalls().map((call: Sinon.SinonSpyCall) => call.args[0]);
        expect(printed).to.include(
          $t(auditMsg.SCAN_ASSET_ENV_MISSING, {
            uid: 'am_asset_mixed',
            locale: 'en-us',
            environment: 'env_own_missing',
          }),
        );
        expect(printed).to.include(
          $t(auditMsg.SCAN_ASSET_LOCALE_MISSING, {
            uid: 'am_asset_bad_locale',
            locale: 'de-de',
            environment: 'env_own_prod',
          }),
        );
        expect(printed).to.include(
          $t(auditMsg.SCAN_ASSET_ENV_AND_LOCALE_MISSING, {
            uid: 'am_asset_bad_both',
            locale: 'de-de',
            environment: 'env_own_missing',
          }),
        );
        printStub.restore();
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should skip api_key tagged publish details and warn once when source stack is unknown', async () => {
        const warnStub = Sinon.stub(mockLogger, 'warn');
        const instance = new Assets(amParam());
        await instance.prerequisiteData();
        (instance as any).sourceStackApiKey = null;
        await instance.lookForReference();

        const missing = (instance as any).missingEnvLocales;
        // Only the legacy publish detail (no api_key) stays auditable
        expect(Object.keys(missing)).to.eql(['am_asset_legacy_pd']);
        expect(warnStub.callCount).to.equal(1);
        expect(warnStub.firstCall.args[0]).to.include('Source stack API key not found');
        warnStub.restore();
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should resolve the source stack api key from stack/stack.json, null when absent', async () => {
        const amInstance = new Assets(amParam());
        expect((amInstance as any).resolveSourceStackApiKey()).to.eql('blt_own_stack');

        const legacyInstance = new Assets(constructorParam);
        expect((legacyInstance as any).resolveSourceStackApiKey()).to.be.null;
      });
  });

  describe('integration-style run with real FsUtility', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should return missingEnvLocales shape from full run with mocked progress', async () => {
        const instance = new Assets(constructorParam);
        const result = await instance.run(false, 5);
        expect(result).to.be.an('object');
        expect(result).to.have.property('asset_uid_invalid');
        expect(result).to.have.property('asset_uid_two_invalid');
        expect((result as any).asset_uid_invalid).to.have.lengthOf(1);
        expect((result as any).asset_uid_two_invalid).to.have.lengthOf(2);
      });
  });
});
