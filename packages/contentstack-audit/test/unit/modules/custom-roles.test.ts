import { join, resolve } from 'path';
import { expect } from 'chai';
import cloneDeep from 'lodash/cloneDeep';
import fancy from 'fancy-test';
import Sinon from 'sinon';
import fs from 'fs';
import { cliux } from '@contentstack/cli-utilities';
import config from '../../../src/config';
import { CustomRoles } from '../../../src/modules';
import { CtConstructorParam, ModuleConstructorParam } from '../../../src/types';
import { mockLogger } from '../mock-logger';

describe('Custom roles module', () => {
  let constructorParam: ModuleConstructorParam & Pick<CtConstructorParam, 'ctSchema'>;

  beforeEach(() => {
    constructorParam = {
      moduleName: 'custom-roles',
      config: Object.assign(config, { basePath: resolve(__dirname, '..', 'mock', 'contents'), flags: {} }),
      ctSchema: cloneDeep(require('../mock/contents/content_types/schema.json')),
    };
    
    // Mock the logger for all tests
    Sinon.stub(require('@contentstack/cli-utilities'), 'log').value(mockLogger);
  });

  describe('validateModules', () => {
    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns custom-roles when module not in config', () => {
      const cr = new CustomRoles(constructorParam);
      const result = (cr as any).validateModules('invalid-module', config.moduleConfig);
      expect(result).to.equal('custom-roles');
    });
  });

  describe('run method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should have missingFieldsInCustomRoles length equals to 2', async () => {
        const customRoleInstance = new CustomRoles({
          ...constructorParam,
          config: { ...constructorParam.config, branch: 'test' },
        });
        await customRoleInstance.run();
        expect(customRoleInstance.missingFieldsInCustomRoles).to.have.lengthOf(2);
        expect(JSON.stringify(customRoleInstance.missingFieldsInCustomRoles)).includes('"branches":["main"]');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('creates progress when totalCount > 0', async () => {
        const cr = new CustomRoles({ ...constructorParam, config: { ...constructorParam.config, branch: 'test' } });
        (cr as any).createSimpleProgress = Sinon.stub().callsFake(function (this: any) {
          const progress = { updateStatus: Sinon.stub(), tick: Sinon.stub(), complete: Sinon.stub() };
          this.progressManager = progress;
          return progress;
        });
        await cr.run(5);
        expect((cr as any).createSimpleProgress.calledWith('custom-roles', 5)).to.be.true;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('skips branch validation when config.branch is not set', async () => {
        const cr = new CustomRoles({
          ...constructorParam,
          config: { ...constructorParam.config, branch: undefined },
        });
        await cr.run();
        expect(cr.missingFieldsInCustomRoles).to.be.an('array');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('does not create progressManager when totalCount is 0 or undefined', async () => {
        const cr = new CustomRoles({ ...constructorParam, config: { ...constructorParam.config, branch: 'main' } });
        await cr.run();
        expect((cr as any).progressManager).to.be.null;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('hits no-fix branch when fix false and no issues', async () => {
        const cr = new CustomRoles({
          ...constructorParam,
          config: { ...constructorParam.config, branch: 'main' },
          fix: false,
        });
        await cr.run();
        expect(cr.missingFieldsInCustomRoles).to.be.an('array');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('hits has no branch issues when role has no branch rules', async () => {
        Sinon.stub(fs, 'existsSync').callsFake((p: fs.PathLike) => String(p).includes('custom-roles'));
        Sinon.stub(fs, 'readFileSync').callsFake(() =>
          JSON.stringify({
            noBranchRule: {
              uid: 'noBranchRule',
              name: 'No Branch Rule',
              rules: [{ module: 'environment', environments: [] }],
            },
          })
        );
        const cr = new CustomRoles({
          ...constructorParam,
          config: { ...constructorParam.config, branch: 'test' },
        });
        await cr.run();
        expect(cr.missingFieldsInCustomRoles.some((r: any) => r.uid === 'noBranchRule')).to.be.false;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('logs no fixes needed when fix disabled or no issues', async () => {
        const cr = new CustomRoles({
          ...constructorParam,
          config: { ...constructorParam.config, branch: 'main' },
          fix: false,
        });
        await cr.run();
        expect(cr.missingFieldsInCustomRoles).to.be.an('array');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(CustomRoles.prototype, 'fixCustomRoleSchema', async () => {})
      .it('should call fixCustomRoleSchema', async () => {
        const customRoleInstance = new CustomRoles({
          ...constructorParam,
          config: { ...constructorParam.config, branch: 'test' },
          fix: true,
        });
        const logSpy = Sinon.spy(customRoleInstance, 'fixCustomRoleSchema');
        await customRoleInstance.run();
        expect(logSpy.callCount).to.be.equals(1);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('returns {} when folder path does not exist', async () => {
        const cr = new CustomRoles({
          ...constructorParam,
          config: { ...constructorParam.config, basePath: resolve(__dirname, '..', 'mock', 'invalid_path') },
        });
        const result = await cr.run();
        expect(result).to.eql({});
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(CustomRoles.prototype, 'writeFixContent', async () => {})
      .it('should call writeFixContent', async () => {
        const customRoleInstance = new CustomRoles({
          ...constructorParam,
          config: { ...constructorParam.config, branch: 'test' },
          fix: true,
        });
        const logSpy = Sinon.spy(customRoleInstance, 'writeFixContent');
        await customRoleInstance.run();
        expect(logSpy.callCount).to.be.equals(1);
      });
  });

  describe('fixCustomRoleSchema', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(CustomRoles.prototype, 'writeFixContent', async () => {})
      .stub(fs, 'existsSync', () => true)
      .stub(fs, 'readFileSync', () => JSON.stringify({ uid1: { uid: 'uid1', name: 'R1', rules: [{ module: 'branch', branches: ['main'] }] } }))
      .it('skips fix for each role when config.branch is not set', async () => {
        const cr = new CustomRoles({
          ...constructorParam,
          fix: true,
          config: { ...constructorParam.config, branch: undefined },
        });
        cr.customRolePath = join(cr.folderPath, cr.fileName);
        cr.customRoleSchema = [{ uid: 'uid1', name: 'R1', rules: [{ module: 'branch', branches: ['main'] }] }] as any;
        await cr.fixCustomRoleSchema();
        expect(cr.customRoleSchema.length).to.equal(1);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'existsSync', () => false)
      .it('loads empty schema when custom role path does not exist', async () => {
        const cr = new CustomRoles({
          ...constructorParam,
          fix: true,
          config: { ...constructorParam.config, branch: 'test' },
        });
        cr.customRolePath = join(cr.folderPath, cr.fileName);
        cr.customRoleSchema = [{ uid: 'u1', name: 'R1', rules: [] }] as any;
        const writeSpy = Sinon.stub(CustomRoles.prototype, 'writeFixContent').resolves();
        await cr.fixCustomRoleSchema();
        expect(writeSpy.callCount).to.equal(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'existsSync', () => true)
      .stub(fs, 'readFileSync', () => JSON.stringify({}))
      .it('returns early when no custom roles to fix', async () => {
        const cr = new CustomRoles({
          ...constructorParam,
          fix: true,
          config: { ...constructorParam.config, branch: 'test' },
        });
        cr.customRolePath = join(cr.folderPath, cr.fileName);
        cr.customRoleSchema = [];
        const writeSpy = Sinon.stub(CustomRoles.prototype, 'writeFixContent').resolves();
        await cr.fixCustomRoleSchema();
        expect(writeSpy.callCount).to.equal(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'existsSync', () => true)
      .stub(fs, 'readFileSync', () =>
        JSON.stringify({
          uid1: {
            uid: 'uid1',
            name: 'R1',
            rules: [{ module: 'branch', branches: ['main', 'test'] }],
          },
        })
      )
      .stub(cliux, 'confirm', async () => true)
      .it('keeps config branch and removes others in branch rules', async () => {
        const cr = new CustomRoles({
          ...constructorParam,
          fix: true,
          config: { ...constructorParam.config, branch: 'test' },
        });
        cr.customRolePath = join(cr.folderPath, cr.fileName);
        cr.customRoleSchema = [
          { uid: 'uid1', name: 'R1', rules: [{ module: 'branch', branches: ['main', 'test'] }] },
        ] as any;
        const writeFixStub = Sinon.stub(CustomRoles.prototype, 'writeFixContent').callsFake(async (schema: Record<string, any>) => {
          const rule = schema?.uid1?.rules?.find((r: any) => r.module === 'branch');
          expect(rule).to.exist;
          expect(rule.branches).to.eql(['test']);
        });
        await cr.fixCustomRoleSchema();
        expect(writeFixStub.called).to.be.true;
      });
  });

  describe('writeFixContent', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'writeFileSync', Sinon.stub())
      .it('writes file when fix is true and skipConfirm (copy-dir)', async () => {
        const cr = new CustomRoles({
          ...constructorParam,
          fix: true,
          config: { ...constructorParam.config, branch: 'test', flags: { 'copy-dir': true } },
        });
        await cr.writeFixContent({ uid123: {} } as any);
        expect((fs.writeFileSync as Sinon.SinonStub).called).to.be.true;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'writeFileSync', Sinon.stub())
      .stub(cliux, 'confirm', async () => true)
      .it('writes file when fix is true and user confirms', async () => {
        const cr = new CustomRoles({
          ...constructorParam,
          fix: true,
          config: { ...constructorParam.config, branch: 'test', flags: {} },
        });
        await cr.writeFixContent({ uid123: {} } as any);
        expect((fs.writeFileSync as Sinon.SinonStub).called).to.be.true;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'writeFileSync', Sinon.stub())
      .stub(cliux, 'confirm', async () => false)
      .it('does not write file when user declines confirmation', async () => {
        const cr = new CustomRoles({
          ...constructorParam,
          fix: true,
          config: { ...constructorParam.config, branch: 'test', flags: {} },
        });
        await cr.writeFixContent({ uid123: {} } as any);
        expect((fs.writeFileSync as Sinon.SinonStub).called).to.be.false;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('skips write when not in fix mode', async () => {
        const cr = new CustomRoles({
          ...constructorParam,
          fix: false,
          config: { ...constructorParam.config, branch: 'test', flags: {} },
        });
        const writeSpy = Sinon.stub(fs, 'writeFileSync');
        await cr.writeFixContent({ uid123: {} } as any);
        expect(writeSpy.called).to.be.false;
      });
  });

  afterEach(() => {
    Sinon.restore(); // Clears Sinon spies/stubs/mocks
  });
});
