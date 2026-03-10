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
