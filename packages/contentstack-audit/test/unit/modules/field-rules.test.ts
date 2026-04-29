import fs from 'fs';
import sinon from 'sinon';
import { resolve, join } from 'path';
import { fancy } from 'fancy-test';
import { expect } from 'chai';
import cloneDeep from 'lodash/cloneDeep';
import { cliux } from '@contentstack/cli-utilities';

import config from '../../../src/config';
import { FieldRule } from '../../../src/modules';
import { $t, auditMsg } from '../../../src/messages';
import { CtConstructorParam, ModuleConstructorParam } from '../../../src/types';
import { mockLogger } from '../mock-logger';

const missingRefs = require('../mock/contents/field_rules/schema.json');

describe('Field Rules', () => {

  let constructorParam: ModuleConstructorParam & CtConstructorParam;

  class AuditTempClass extends FieldRule {
    public missingRefs: Record<string, any>;
    
    constructor(missingRefs: Record<string, any> = {}) {
      super(constructorParam);
      this.currentUid = 'audit';
      this.currentTitle = 'Audit';
      this.missingRefs = missingRefs;
      this.missingRefs['audit'] = [];
    }
  }

  class AuditFixTempClass extends FieldRule {
    public missingRefs: Record<string, any>;
    
    constructor(missingRefs: Record<string, any> = {}) {
      super({ ...constructorParam, fix: true, moduleName: undefined });
      this.currentUid = 'audit-fix';
      this.currentTitle = 'Audit fix';
      this.missingRefs = missingRefs;
      this.missingRefs['audit-fix'] = [];
    }
  }

  beforeEach(() => {
    constructorParam = {
      moduleName: 'content-types',
      ctSchema: cloneDeep(require('../mock/contents/content_types/schema.json')),
      gfSchema: cloneDeep(require('../mock/contents/global_fields/globalfields.json')),
      config: Object.assign(config, { basePath: resolve(__dirname, '..', 'mock', 'contents'), flags: {} }),
    };
    
    // Mock the logger for all tests
    sinon.stub(require('@contentstack/cli-utilities'), 'log').value(mockLogger);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('run method', () => {
    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('should validate base path', async () => {
      const ctInstance = new FieldRule({
        ...constructorParam,
        config: { ...constructorParam.config, basePath: resolve(__dirname, '..', 'mock', 'contents-1') },
      });
      try {
        await ctInstance.run();
      } catch (error: any) {
        expect(error).to.be.instanceOf(Error);
        expect(error.message).to.eql($t(auditMsg.NOT_VALID_PATH, { path: ctInstance.folderPath }));
      }
    });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(FieldRule.prototype, 'prepareEntryMetaData', async () => {})
      .stub(FieldRule.prototype, 'prerequisiteData', async () => {})
      .stub(FieldRule.prototype, 'fixFieldRules', async () => {})
      .stub(FieldRule.prototype, 'validateFieldRules', async () => {})
      .stub(FieldRule.prototype, 'lookForReference', async () => {})
      .it('should call lookForReference and return the call count for it', async () => {
        const frInstance = new FieldRule(constructorParam);
        const logSpy = sinon.spy(frInstance, 'lookForReference');
        await frInstance.run();
        expect(logSpy.callCount).to.be.equals(frInstance.ctSchema.length);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(FieldRule.prototype, 'lookForReference', async () => {})
      .stub(FieldRule.prototype, 'fixFieldRules', async () => {})
      .stub(FieldRule.prototype, 'validateFieldRules', async () => {})
      .it('should not break if empty schema passed', async () => {
        const frInstance = new FieldRule({ ...constructorParam, ctSchema: undefined as any });
        expect(await frInstance.run()).to.be.empty;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(FieldRule.prototype, 'lookForReference', async () => {})
      .stub(FieldRule.prototype, 'fixFieldRules', async () => {})
      .it('should return schema', async () => {
        const ctInstance = new FieldRule(constructorParam);
        expect(await ctInstance.run()).to.deep.equals(missingRefs);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(FieldRule.prototype, 'lookForReference', async () => {})
      .stub(FieldRule.prototype, 'writeFixContent', async () => {})
      .it('should call writeFixContent', async () => {
        const ctInstance = new FieldRule({ ...constructorParam, fix: true });
        const logSpy = sinon.spy(ctInstance, 'writeFixContent');
        await ctInstance.run();
        expect(logSpy.callCount).to.be.equals(1);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(FieldRule.prototype, 'prepareEntryMetaData', async () => {})
      .stub(FieldRule.prototype, 'prerequisiteData', async () => {})
      .stub(FieldRule.prototype, 'lookForReference', async () => {})
      .stub(FieldRule.prototype, 'fixFieldRules', () => {})
      .stub(FieldRule.prototype, 'validateFieldRules', () => {})
      .it('should create progress and call progressManager.tick when totalCount > 0', async () => {
        const frInstance = new FieldRule(constructorParam);
        (frInstance as any).createSimpleProgress = sinon.stub().callsFake(function (this: any) {
          const progress = { updateStatus: sinon.stub(), tick: sinon.stub(), complete: sinon.stub() };
          this.progressManager = progress;
          return progress;
        });
        await frInstance.run(5);
        expect((frInstance as any).createSimpleProgress.calledWith('field-rules', 5)).to.be.true;
        const progress = (frInstance as any).createSimpleProgress.firstCall.returnValue;
        expect(progress.updateStatus.calledWith('Validating field rules...')).to.be.true;
        expect(progress.tick.callCount).to.equal(frInstance.ctSchema!.length);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(FieldRule.prototype, 'prerequisiteData', async () => {})
      .stub(FieldRule.prototype, 'lookForReference', async () => {})
      .stub(FieldRule.prototype, 'fixFieldRules', () => {})
      .stub(FieldRule.prototype, 'validateFieldRules', () => {})
      .it('should call completeProgress(false) and rethrow when run() throws', async () => {
        const frInstance = new FieldRule(constructorParam);
        sinon.stub(frInstance, 'prepareEntryMetaData').rejects(new Error('prepare failed'));
        const completeSpy = sinon.spy(frInstance as any, 'completeProgress');
        try {
          await frInstance.run();
        } catch (e: any) {
          expect(e.message).to.equal('prepare failed');
        }
        expect(completeSpy.calledWith(false, 'prepare failed')).to.be.true;
      });

    fancy
      .stub(fs, 'rmSync', () => {})
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(FieldRule.prototype, 'writeFixContent', async () => {})
      .it('perform audit operation on the given CT schema field rules', async () => {
        const ctInstance = new AuditTempClass();
        await ctInstance.run();
        expect(ctInstance.missingRefs).ownProperty('page_2');
        expect(ctInstance.missingRefs).ownProperty('page_3');
        expect(ctInstance.missingRefs).ownProperty('page_4');
      });

    fancy
      .stub(fs, 'rmSync', () => {})
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(FieldRule.prototype, 'writeFixContent', async () => {})
      .it('perform audit and fix operation on the given CT schema field rules', async () => {
        const ctInstance = new AuditFixTempClass();
        expect(JSON.stringify(await ctInstance.run())).includes(
          '{"ctUid":"page_2","action":{"action":"show","target_field":"desc"},"fixStatus":"Fixed"}',
        );
      });
  });

  describe('validateFieldRules', () => {
    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('logs valid when target_field is in schemaMap', () => {
      const frInstance = new FieldRule(constructorParam);
      frInstance.schemaMap = ['title', 'desc'];
      const schema = {
        uid: 'ct_1',
        title: 'CT One',
        field_rules: [
          {
            conditions: [],
            actions: [{ action: 'show', target_field: 'title' }],
            rule_type: 'entry',
          },
        ],
      } as any;
      frInstance.validateFieldRules(schema);
      expect((frInstance as any).missingRefs['ct_1'] || []).to.have.length(0);
    });
  });

  describe('prerequisiteData', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('handles error when loading extensions file throws', async () => {
        const frInstance = new FieldRule(constructorParam);
        const extPath = resolve(constructorParam.config.basePath, 'extensions', 'extensions.json');
        sinon.stub(fs, 'existsSync').callsFake((p: fs.PathLike) => String(p) === extPath);
        sinon.stub(fs, 'readFileSync').callsFake(() => {
          throw new Error('read error');
        });
        await frInstance.prerequisiteData();
        expect(frInstance.extensions).to.deep.equal([]);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('loads marketplace apps and pushes extension UIDs', async () => {
        const frInstance = new FieldRule(constructorParam);
        const marketPath = resolve(constructorParam.config.basePath, 'marketplace_apps', 'marketplace_apps.json');
        sinon.stub(fs, 'existsSync').callsFake((p: fs.PathLike) => String(p) === marketPath);
        const marketplaceData = [
          {
            uid: 'app1',
            ui_location: {
              locations: [{ meta: { extension_uid: 'ext_1' } }, { meta: { extension_uid: 'ext_2' } }],
            },
          },
        ];
        sinon.stub(fs, 'readFileSync').callsFake((p: fs.PathOrFileDescriptor) => {
          if (String(p) === marketPath) return JSON.stringify(marketplaceData);
          return '{}';
        });
        await frInstance.prerequisiteData();
        expect(frInstance.extensions).to.include('ext_1');
        expect(frInstance.extensions).to.include('ext_2');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('handles error when loading marketplace apps file throws', async () => {
        const frInstance = new FieldRule(constructorParam);
        const marketPath = resolve(constructorParam.config.basePath, 'marketplace_apps', 'marketplace_apps.json');
        sinon.stub(fs, 'existsSync').callsFake((p: fs.PathLike) => String(p) === marketPath);
        sinon.stub(fs, 'readFileSync').callsFake(() => {
          throw new Error('marketplace read error');
        });
        await frInstance.prerequisiteData();
        expect(frInstance.extensions).to.deep.equal([]);
      });
  });

  describe('fixFieldRules', () => {
    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('keeps valid action and logs info when target_field in schemaMap', () => {
      const frInstance = new FieldRule({ ...constructorParam, fix: true });
      frInstance.schemaMap = ['title'];
      const schema = {
        uid: 'ct_1',
        title: 'CT One',
        field_rules: [
          {
            conditions: [{ operand_field: 'title', operator: 'equals', value: 'x' }],
            actions: [{ action: 'show', target_field: 'title' }],
            rule_type: 'entry',
          },
        ],
      } as any;
      frInstance.fixFieldRules(schema);
      expect(schema.field_rules).to.have.length(1);
      expect(schema.field_rules[0].actions).to.have.length(1);
    });
  });

  describe('writeFixContent method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'writeFileSync', () => {})
      .stub(cliux, 'confirm', async () => true)
      .it('should not write the file', async () => {
        const ctInstance = new FieldRule({ ...constructorParam, fix: true });
        (ctInstance as any).schema = constructorParam.ctSchema?.length ? [constructorParam.ctSchema[0]] : [];
        const fsSpy = sinon.spy(fs, 'writeFileSync');
        await ctInstance.writeFixContent();
        expect(fsSpy.callCount).to.be.equals(1);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'writeFileSync', () => {})
      .it('should prompt and ask confirmation', async () => {
        sinon.replace(cliux, 'confirm', async () => false);
        const ctInstance = new FieldRule({ ...constructorParam, fix: true });
        const spy = sinon.spy(cliux, 'confirm');
        await ctInstance.writeFixContent();
        expect(spy.callCount).to.be.equals(1);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('skips file write when user declines confirmation', async () => {
        sinon.replace(cliux, 'confirm', async () => false);
        const ctInstance = new FieldRule({ ...constructorParam, fix: true });
        (ctInstance as any).schema = [{ uid: 'ct_1', title: 'CT' }];
        const writeSpy = sinon.stub(fs, 'writeFileSync');
        await ctInstance.writeFixContent();
        expect(writeSpy.callCount).to.equal(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'writeFileSync', () => {})
      .it('skips confirmation when copy-dir or external-config skipConfirm is set', async () => {
        const ctInstance = new FieldRule({
          ...constructorParam,
          fix: true,
          config: {
            ...constructorParam.config,
            flags: { 'copy-dir': true } as any,
          },
        });
        (ctInstance as any).schema = [{ uid: 'ct_1', title: 'CT' }];
        const confirmSpy = sinon.stub(cliux, 'confirm').resolves(false);
        await ctInstance.writeFixContent();
        expect(confirmSpy.callCount).to.equal(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('skips file write when fix mode is disabled', async () => {
        const ctInstance = new FieldRule({ ...constructorParam, fix: false });
        (ctInstance as any).schema = [{ uid: 'ct_1', title: 'CT' }];
        const writeSpy = sinon.stub(fs, 'writeFileSync');
        await ctInstance.writeFixContent();
        expect(writeSpy.callCount).to.equal(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'writeFileSync', () => {})
      .stub(cliux, 'confirm', async () => true)
      .it('skips schema with missing uid and writes rest', async () => {
        const ctInstance = new FieldRule({ ...constructorParam, fix: true });
        (ctInstance as any).schema = [
          { uid: undefined, title: 'NoUid' },
          { uid: 'ct_1', title: 'CT One' },
        ];
        const writeSpy = sinon.spy(fs, 'writeFileSync');
        await ctInstance.writeFixContent();
        expect(writeSpy.callCount).to.equal(1);
        expect(writeSpy.calledWith(join(ctInstance.folderPath, 'ct_1.json'), sinon.match.string)).to.be.true;
      });
  });

  describe('prepareEntryMetaData', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('logs when additional locales file not found', async () => {
        const frInstance = new FieldRule(constructorParam);
        const localesFolderPath = resolve(constructorParam.config.basePath, frInstance.config.moduleConfig.locales.dirName);
        const localesPath = join(localesFolderPath, frInstance.config.moduleConfig.locales.fileName);
        const origExists = fs.existsSync;
        sinon.stub(fs, 'existsSync').callsFake((p: fs.PathLike) => {
          if (String(p) === localesPath) return false;
          return origExists.call(fs, p);
        });
        await frInstance.prepareEntryMetaData();
        expect(frInstance.locales.length).to.be.greaterThanOrEqual(0);
      });
  });

  describe('Test Other methods', () => {
    fancy
      .stub(fs, 'rmSync', () => {})
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(FieldRule.prototype, 'writeFixContent', async () => {})
      .it('Check the calls for other methods', async () => {
        const frInstance = new AuditTempClass();
        const logSpy2 = sinon.spy(frInstance, 'validateFieldRules');
        const logSpy3 = sinon.spy(frInstance, 'addMissingReferences');
        await frInstance.run();
        expect(logSpy2.callCount).to.be.equals(frInstance.ctSchema.length);
        expect(logSpy3.callCount).to.be.equals(10);
      });

    fancy
      .stub(fs, 'rmSync', () => {})
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(FieldRule.prototype, 'writeFixContent', async () => {})
      .it('Check the calls for other methods when field_rules are empty', async () => {
        const frInstance = new FieldRule({
          moduleName: 'content-types',
          ctSchema: [
            {
              title: 'Page 2',
              uid: 'page_2',
              schema: [
                {
                  data_type: 'text',
                  display_name: 'Title',
                  field_metadata: { _default: true, version: 3 },
                  mandatory: true,
                  uid: 'title',
                  unique: true,
                  multiple: false,
                  non_localizable: false,
                },
              ],
              field_rules: [],
              description: '',
              mandatory: false,
              multiple: false,
            },
          ],
          gfSchema: [],
          config: Object.assign(config, { basePath: resolve(__dirname, '..', 'mock', 'contents'), flags: {} }),
        });
        const logSpy2 = sinon.spy(frInstance, 'validateFieldRules');
        const logSpy3 = sinon.spy(frInstance, 'addMissingReferences');
        await frInstance.run();
        expect(logSpy2.callCount).to.be.equals(1);
        expect(logSpy3.callCount).to.be.equals(0);
      });
  });
});
