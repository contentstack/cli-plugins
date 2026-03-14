import fs from 'fs';
import sinon from 'sinon';
import { resolve } from 'path';
import { fancy } from 'fancy-test';
import { expect } from 'chai';
import cloneDeep from 'lodash/cloneDeep';
import { cliux } from '@contentstack/cli-utilities';

import config from '../../../src/config';
import { ContentType } from '../../../src/modules';
import { $t, auditMsg } from '../../../src/messages';
import {
  ContentTypeStruct,
  CtConstructorParam,
  GlobalFieldDataType,
  GroupFieldDataType,
  ModularBlockType,
  ModuleConstructorParam,
  ReferenceFieldDataType,
} from '../../../src/types';
import { mockLogger } from '../mock-logger';


describe('Content types', () => {
  type CtType = ContentTypeStruct | GlobalFieldDataType | ModularBlockType | GroupFieldDataType;

  let constructorParam: ModuleConstructorParam & CtConstructorParam;

  class AuditTempClass extends ContentType {
    public missingRefs: Record<string, any>;
    
    constructor(missingRefs: Record<string, any> = {}) {
      super(constructorParam);
      this.currentUid = 'audit';
      this.currentTitle = 'Audit';
      this.missingRefs = missingRefs;
      this.missingRefs['audit'] = [];
    }
  }

  class AuditFixTempClass extends ContentType {
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
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should validate base path', async () => {
      const ctInstance = new ContentType({
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
      .stub(ContentType.prototype, 'lookForReference', async () => {})
      .it('should call lookForReference', async () => {
        const ctInstance = new ContentType(constructorParam);
        const logSpy = sinon.spy(ctInstance, 'lookForReference');
        await ctInstance.run();
        expect(logSpy.callCount).to.be.equals(ctInstance.ctSchema.length);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ContentType.prototype, 'lookForReference', async () => {})
      .it('should not break if empty schema passed', async () => {
        const ctInstance = new ContentType({ ...constructorParam, ctSchema: undefined as any });
        expect(await ctInstance.run(true)).to.be.undefined;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ContentType.prototype, 'lookForReference', async () => {})
      .it('should return schema', async () => {
        const ctInstance = new ContentType(constructorParam);
        expect(await ctInstance.run(true)).to.deep.equals(ctInstance.ctSchema);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ContentType.prototype, 'lookForReference', async () => {})
      .stub(ContentType.prototype, 'writeFixContent', async () => {})
      .it('should call writeFixContent', async () => {
        const ctInstance = new ContentType({ ...constructorParam, fix: true });
        const logSpy = sinon.spy(ctInstance, 'writeFixContent');
        await ctInstance.run();
        expect(logSpy.callCount).to.be.equals(1);
      });

    fancy
      .stub(fs, 'rmSync', () => {})
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ContentType.prototype, 'writeFixContent', async () => {})
      .it('perform audit operation on the given CT schema', async () => {
        const ctInstance = new AuditFixTempClass();

        await ctInstance.run();

        expect(ctInstance.missingRefs).ownProperty('page_1');
        expect(JSON.stringify(ctInstance.missingRefs)).includes('"missingRefs":["page_0"]');
      });

    fancy
      .stub(fs, 'rmSync', () => {})
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ContentType.prototype, 'writeFixContent', async () => {})
      .it('perform audit and fix operation on the given CT schema', async () => {
        const ctInstance = new AuditFixTempClass();

        expect(JSON.stringify(await ctInstance.run(true))).includes(
          '"display_name":"Reference","reference_to":["page_4","page_3","page_2","page_1"]',
        );
      });
  });

  describe('writeFixContent method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'writeFileSync', () => {})
      .stub(cliux, 'confirm', async () => true)
      .it('should not write the file', async () => {
        const ctInstance = new ContentType({ ...constructorParam, fix: true });
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
        const ctInstance = new ContentType({ ...constructorParam, fix: true });
        const spy = sinon.spy(cliux, 'confirm');
        await ctInstance.writeFixContent();
        expect(spy.callCount).to.be.equals(1);
      });
  });

  describe('lookForReference method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ContentType.prototype, 'validateReferenceField', () => [])
      .stub(ContentType.prototype, 'validateGlobalField', () => {})
      .stub(ContentType.prototype, 'validateJsonRTEFields', () => [])
      .stub(ContentType.prototype, 'validateGroupField', () => [])
      .stub(ContentType.prototype, 'validateModularBlocksField', () => [])
      .it('should call all CT type audit methods', async () => {
        const ctInstance = new (class TempClass extends ContentType {
          constructor() {
            super(constructorParam);
            this.currentUid = 'test';
            this.missingRefs['test'] = [];
          }
        })();
        const validateReferenceFieldSpy = sinon.spy(ctInstance, 'validateReferenceField');
        const validateGlobalFieldSpy = sinon.spy(ctInstance, 'validateGlobalField');
        const validateJsonRTEFieldsSpy = sinon.spy(ctInstance, 'validateJsonRTEFields');
        const validateModularBlocksFieldSpy = sinon.spy(ctInstance, 'validateModularBlocksField');
        const validateGroupFieldSpy = sinon.spy(ctInstance, 'validateGroupField');

        // NOTE dummy CT schema
        const schema = [
          { data_type: 'reference', uid: 'ref', display_name: 'Ref' },
          { data_type: 'global_field' },
          { data_type: 'json', field_metadata: { allow_json_rte: true } },
          { data_type: 'blocks' },
          { data_type: 'group' },
        ];
        await ctInstance.lookForReference([], { schema } as unknown as CtType);

        expect(validateReferenceFieldSpy.callCount).to.be.equals(1);
        expect(validateGlobalFieldSpy.callCount).to.be.equals(1);
        expect(validateJsonRTEFieldsSpy.callCount).to.be.equals(1);
        expect(validateModularBlocksFieldSpy.callCount).to.be.equals(1);
        expect(validateGroupFieldSpy.callCount).to.be.equals(1);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ContentType.prototype, 'runFixOnSchema', () => [])
      .it('skips json extension field when not in fix types', async () => {
        const ctInstance = new (class TempClass extends ContentType {
          constructor() {
            super({
              ...constructorParam,
              config: { ...constructorParam.config, 'fix-fields': ['reference'], flags: {} } as any,
            });
            this.currentUid = 'test';
            (this as any).missingRefs['test'] = [];
          }
        })();
        sinon.stub(ContentType.prototype, 'validateReferenceField').returns([]);
        sinon.stub(ContentType.prototype, 'validateGlobalField').resolves();
        sinon.stub(ContentType.prototype, 'validateJsonRTEFields').returns([]);
        sinon.stub(ContentType.prototype, 'validateGroupField').resolves();
        sinon.stub(ContentType.prototype, 'validateModularBlocksField').resolves();
        const schema = [
          { data_type: 'json', uid: 'j1', display_name: 'Json', field_metadata: { extension: true } },
        ];
        await ctInstance.lookForReference([], { schema } as unknown as CtType);
        expect((ctInstance as any).missingRefs['test']).to.have.lengthOf(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('skips json RTE field when not in fix types', async () => {
        const ctInstance = new (class TempClass extends ContentType {
          constructor() {
            super({
              ...constructorParam,
              config: { ...constructorParam.config, 'fix-fields': ['reference'], flags: {} } as any,
            });
            this.currentUid = 'test';
            (this as any).missingRefs['test'] = [];
          }
        })();
        sinon.stub(ContentType.prototype, 'validateReferenceField').returns([]);
        sinon.stub(ContentType.prototype, 'validateGlobalField').resolves();
        sinon.stub(ContentType.prototype, 'validateJsonRTEFields').returns([]);
        sinon.stub(ContentType.prototype, 'validateGroupField').resolves();
        sinon.stub(ContentType.prototype, 'validateModularBlocksField').resolves();
        const schema = [
          { data_type: 'json', uid: 'j1', display_name: 'RTE', field_metadata: { allow_json_rte: true } },
        ];
        await ctInstance.lookForReference([], { schema } as unknown as CtType);
        expect((ctInstance as any).missingRefs['test']).to.have.lengthOf(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ContentType.prototype, 'runFixOnSchema', () => [])
      .it('should call runFixOnSchema method', async () => {
        const ctInstance = new ContentType({ ...constructorParam, fix: true });
        const validateReferenceFieldSpy = sinon.spy(ctInstance, 'runFixOnSchema');
        await ctInstance.lookForReference([], { schema: [] } as unknown as CtType);

        expect(validateReferenceFieldSpy.callCount).to.be.equals(1);
      });
  });

  describe('validateExtensionAndAppField method', () => {
    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns [] in fix mode', () => {
      const ctInstance = new ContentType({ ...constructorParam, fix: true });
      (ctInstance as any).currentUid = 'test';
      (ctInstance as any).currentTitle = 'Test';
      const field = {
        uid: 'ext_f',
        extension_uid: 'ext_123',
        display_name: 'Ext Field',
        data_type: 'json',
      } as any;
      const result = ctInstance.validateExtensionAndAppField([], field);
      expect(result).to.deep.equal([]);
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns [] when extension found in loaded extensions', () => {
      const ctInstance = new ContentType(constructorParam);
      (ctInstance as any).currentUid = 'test';
      (ctInstance as any).currentTitle = 'Test';
      (ctInstance as any).extensions = ['ext_123'];
      const field = {
        uid: 'ext_f',
        extension_uid: 'ext_123',
        display_name: 'Ext Field',
        data_type: 'json',
      } as any;
      const result = ctInstance.validateExtensionAndAppField([{ uid: 'ext_f', name: 'Ext Field' }], field);
      expect(result).to.deep.equal([]);
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns issue when extension not in loaded extensions', () => {
      const ctInstance = new ContentType(constructorParam);
      (ctInstance as any).currentUid = 'test';
      (ctInstance as any).currentTitle = 'Test';
      (ctInstance as any).extensions = [];
      const field = {
        uid: 'ext_f',
        extension_uid: 'missing_ext',
        display_name: 'Ext Field',
        data_type: 'json',
      } as any;
      const result = ctInstance.validateExtensionAndAppField([{ uid: 'ext_f', name: 'Ext Field' }], field);
      expect(result).to.have.lengthOf(1);
      expect(result[0].missingRefs).to.deep.include({ uid: 'ext_f', extension_uid: 'missing_ext', type: 'Extension or Apps' });
    });
  });

  describe('validateReferenceToValues method', () => {
    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns empty when single reference exists in ctSchema', () => {
      const ctInstance = new ContentType(constructorParam);
      (ctInstance as any).currentUid = 'test';
      (ctInstance as any).currentTitle = 'Test';
      const field = { uid: 'ref_f', reference_to: 'page_1', display_name: 'Ref', data_type: 'reference' } as any;
      const result = ctInstance.validateReferenceToValues([], field);
      expect(result).to.have.lengthOf(0);
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('skips ref in skipRefs in array path', () => {
      const ctInstance = new ContentType(constructorParam);
      (ctInstance as any).currentUid = 'test';
      (ctInstance as any).currentTitle = 'Test';
      const field = { uid: 'ref_f', reference_to: ['page_1', 'sys_assets'], display_name: 'Ref', data_type: 'reference' } as any;
      const result = ctInstance.validateReferenceToValues([], field);
      expect(result).to.have.lengthOf(0);
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns empty when array references all exist in ctSchema', () => {
      const ctInstance = new ContentType(constructorParam);
      (ctInstance as any).currentUid = 'test';
      (ctInstance as any).currentTitle = 'Test';
      const field = { uid: 'ref_f', reference_to: ['page_1', 'page_2'], display_name: 'Ref', data_type: 'reference' } as any;
      const result = ctInstance.validateReferenceToValues([], field);
      expect(result).to.have.lengthOf(0);
    });
  });

  describe('validateReferenceField method', () => {
    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('should return missing reference', async () => {
      const ctInstance = new ContentType(constructorParam);
      const [, , , page1Ct] = ctInstance.ctSchema as CtType[];
      const [, , , , refField] = page1Ct.schema ?? [];

      expect(
        JSON.stringify(
          await ctInstance.validateReferenceField(
            [{ uid: refField.uid, name: refField.display_name }],
            refField as ReferenceFieldDataType,
          ),
        ),
      ).includes('"missingRefs":["page_0"]');
    });
  });

  describe('validateGlobalField method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ContentType.prototype, 'runFixOnSchema', () => {})
      .it('should call lookForReference method', async () => {
        const ctInstance = new AuditTempClass();

        const lookForReferenceSpy = sinon.spy(ctInstance, 'lookForReference');
        const [, , , page1Ct] = ctInstance.ctSchema as CtType[];
        const [, gf] = page1Ct.schema as [unknown, GlobalFieldDataType];
        await ctInstance.validateGlobalField([{ uid: gf.uid, name: gf.display_name }], gf);

        expect(lookForReferenceSpy.called).to.be.true;
        expect(JSON.stringify(ctInstance.missingRefs)).to.be.include('"missingRefs":["page_0"]');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ContentType.prototype, 'runFixOnSchema', () => {})
      .it('should identify missing schema on global field', async () => {
        const ctInstance = new AuditTempClass();
        const field = {
          data_type: 'global_field',
          display_name: 'Global',
          reference_to: 'gf_0',
          uid: 'global_field',
        } as GlobalFieldDataType;

        await ctInstance.validateGlobalField([{ uid: field.uid, name: field.display_name }], field);

        const expected = {
          audit: [
            {
              name: 'Audit',
              ct_uid: 'audit',
              data_type: field.data_type,
              display_name: field.display_name,
              missingRefs: 'Empty schema found',
              tree: [{ uid: field.uid, name: field.display_name }],
              treeStr: [{ uid: field.uid, name: field.display_name }].map(({ name }) => name).join(' ➜ '),
            },
          ],
        };
        const actual = ctInstance.missingRefs;
        expect(actual).to.deep.equals(expected);
      });
  });

  describe('fixMissingExtensionOrApp method', () => {
    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns field when extension found in loaded extensions', () => {
      const ctInstance = new ContentType({ ...constructorParam, fix: true });
      (ctInstance as any).currentUid = 'test';
      (ctInstance as any).currentTitle = 'Test';
      (ctInstance as any).missingRefs['test'] = [];
      (ctInstance as any).extensions = ['ext_123'];
      const field = {
        uid: 'ext_f',
        extension_uid: 'ext_123',
        display_name: 'Ext Field',
        data_type: 'json',
      } as any;
      const result = ctInstance.fixMissingExtensionOrApp([], field);
      expect(result).to.equal(field);
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns null and pushes to missingRefs when extension missing and fix mode', () => {
      const ctInstance = new ContentType({ ...constructorParam, fix: true });
      (ctInstance as any).currentUid = 'test';
      (ctInstance as any).currentTitle = 'Test';
      (ctInstance as any).missingRefs['test'] = [];
      (ctInstance as any).extensions = [];
      const field = {
        uid: 'ext_f',
        extension_uid: 'missing_ext',
        display_name: 'Ext Field',
        data_type: 'json',
      } as any;
      const result = ctInstance.fixMissingExtensionOrApp([{ uid: 'ext_f', name: 'Ext' }], field);
      expect(result).to.be.null;
      expect((ctInstance as any).missingRefs['test']).to.have.lengthOf(1);
      expect((ctInstance as any).missingRefs['test'][0].fixStatus).to.equal('Fixed');
    });
  });

  describe('runFixOnSchema method', () => {
    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('filters out field with empty schema when in schema-fields-data-type', () => {
      const ctInstance = new ContentType({ ...constructorParam, fix: true });
      (ctInstance as any).currentUid = 'test';
      (ctInstance as any).missingRefs['test'] = [];
      const schema = [
        { data_type: 'blocks', uid: 'b1', display_name: 'Blocks', schema: [], blocks: [] },
        { data_type: 'text', uid: 't1', display_name: 'Title' },
      ] as any;
      const result = ctInstance.runFixOnSchema([], schema);
      expect(result.some((f: any) => f?.uid === 't1')).to.be.true;
      expect(result.filter((f: any) => f?.uid === 'b1')).to.have.lengthOf(0);
    });
  });

  describe('fixModularBlocksReferences method', () => {
    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns false for block with no schema in content-types', () => {
      const ctInstance = new ContentType({ ...constructorParam, fix: true });
      (ctInstance as any).currentUid = 'test';
      (ctInstance as any).missingRefs['test'] = [];
      const blocks = [
        { uid: 'blk1', title: 'Block1', reference_to: 'gf_0', schema: undefined },
      ] as any;
      const result = ctInstance.fixModularBlocksReferences([], blocks);
      expect(result).to.have.lengthOf(0);
      expect((ctInstance as any).missingRefs['test']).to.have.lengthOf(1);
    });
  });

  describe('fixMissingReferences method', () => {
    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('skips reference in skipRefs (single reference)', () => {
      const ctInstance = new ContentType({ ...constructorParam, fix: true });
      (ctInstance as any).currentUid = 'test';
      (ctInstance as any).missingRefs['test'] = [];
      const field = {
        uid: 'ref_f',
        reference_to: 'sys_assets',
        display_name: 'Ref',
        data_type: 'reference',
        field_metadata: {},
      } as any;
      const result = ctInstance.fixMissingReferences([], field);
      expect(result).to.equal(field);
      expect(field.reference_to).to.deep.equal(['sys_assets']);
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('keeps single reference when it exists in ctSchema (branch: found)', () => {
      const ctInstance = new ContentType({ ...constructorParam, fix: true });
      (ctInstance as any).currentUid = 'test';
      (ctInstance as any).missingRefs['test'] = [];
      const field = {
        uid: 'ref_f',
        reference_to: 'page_1',
        display_name: 'Ref',
        data_type: 'reference',
        field_metadata: {},
      } as any;
      const result = ctInstance.fixMissingReferences([], field);
      expect(result).to.equal(field);
      expect(field.reference_to).to.deep.equal(['page_1']);
      expect((ctInstance as any).missingRefs['test']).to.have.lengthOf(0);
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('removes missing refs from array and pushes to missingRefs when fix mode', () => {
      const ctInstance = new ContentType({ ...constructorParam, fix: true });
      (ctInstance as any).currentUid = 'test';
      (ctInstance as any).missingRefs['test'] = [];
      const field = {
        uid: 'ref_f',
        reference_to: ['page_1', 'nonexistent_ct'],
        display_name: 'Ref',
        data_type: 'reference',
        field_metadata: {},
      } as any;
      const result = ctInstance.fixMissingReferences([], field);
      expect(result).to.equal(field);
      expect(field.reference_to).to.deep.equal(['page_1']);
      expect((ctInstance as any).missingRefs['test']).to.have.lengthOf(1);
      expect((ctInstance as any).missingRefs['test'][0].fixStatus).to.equal('Fixed');
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('skips references in skipRefs when processing array', () => {
      const ctInstance = new ContentType({ ...constructorParam, fix: true });
      (ctInstance as any).currentUid = 'test';
      (ctInstance as any).missingRefs['test'] = [];
      const field = {
        uid: 'ref_f',
        reference_to: ['page_1', 'sys_assets', 'page_2'],
        display_name: 'Ref',
        data_type: 'reference',
        field_metadata: {},
      } as any;
      ctInstance.fixMissingReferences([], field);
      expect(field.reference_to).to.include('page_1');
      expect(field.reference_to).to.include('page_2');
      expect(field.reference_to).to.include('sys_assets');
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('keeps refs when all references exist in ctSchema (array path)', () => {
      const ctInstance = new ContentType({ ...constructorParam, fix: true });
      (ctInstance as any).currentUid = 'test';
      (ctInstance as any).missingRefs['test'] = [];
      const field = {
        uid: 'ref_f',
        reference_to: ['page_1', 'page_2'],
        display_name: 'Ref',
        data_type: 'reference',
        field_metadata: {},
      } as any;
      const result = ctInstance.fixMissingReferences([], field);
      expect(result).to.equal(field);
      expect(field.reference_to).to.deep.equal(['page_1', 'page_2']);
      expect((ctInstance as any).missingRefs['test']).to.have.lengthOf(0);
    });
  });

  describe('fixGlobalFieldReferences method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'rmSync', () => {})
      .stub(ContentType.prototype, 'runFixOnSchema', () => {})
      .stub(ContentType.prototype, 'lookForReference', () => {})
      .it('should identify missing global-field schema and attach with content-type schema', async () => {
        // Mock/Stub
        const ctInstance = new AuditFixTempClass();
        const field = {
          data_type: 'global_field',
          display_name: 'Global',
          reference_to: 'gf_1',
          uid: 'global_field',
        } as GlobalFieldDataType;

        // Execution
        const fixField = await ctInstance.fixGlobalFieldReferences([], field);

        // Assertion
        const actual = ctInstance.missingRefs;
        expect(actual).to.deep.equals({'audit-fix': []});
        expect(fixField?.schema).is.undefined;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('pushes missingRefs when global-fields module and referred GF has no schema', () => {
        const ctInstance = new ContentType({
          ...constructorParam,
          moduleName: 'global-fields',
          gfSchema: [{ uid: 'ref_gf', title: 'Ref GF', schema: undefined }] as any,
          ctSchema: [],
        });
        (ctInstance as any).currentUid = 'test';
        (ctInstance as any).currentTitle = 'Test';
        (ctInstance as any).missingRefs['test'] = [];
        const field = {
          data_type: 'global_field',
          display_name: 'Global',
          reference_to: 'ref_gf',
          uid: 'global_field',
          schema: undefined,
        } as any;
        const result = ctInstance.fixGlobalFieldReferences([], field);
        expect(result).to.equal(field);
        expect((ctInstance as any).missingRefs['test']).to.have.lengthOf(1);
        expect((ctInstance as any).missingRefs['test'][0].missingRefs).to.equal('Referred Global Field Does not exist');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('pushes Empty schema found when content-types module and GF has no schema', () => {
        const ctInstance = new ContentType({
          ...constructorParam,
          moduleName: 'content-types',
          fix: true,
        });
        (ctInstance as any).currentUid = 'test';
        (ctInstance as any).currentTitle = 'Test';
        (ctInstance as any).missingRefs['test'] = [];
        (ctInstance as any).gfSchema = [{ uid: 'gf_empty', title: 'GF', schema: undefined }] as any;
        const field = {
          data_type: 'global_field',
          display_name: 'Global',
          reference_to: 'gf_empty',
          uid: 'global_field',
          schema: undefined,
        } as any;
        const result = ctInstance.fixGlobalFieldReferences([], field);
        expect(result).to.equal(field);
        expect((ctInstance as any).missingRefs['test']).to.have.lengthOf(1);
        expect((ctInstance as any).missingRefs['test'][0].missingRefs).to.equal('Empty schema found');
        // NOTE: TO DO
        // expect(actual).to.deep.equals(expected);
        // expect(fixField?.schema).is.not.empty;
        // expect(fixField?.schema.length).to.be.equal(2);
        //  const expected = {
        //   'audit-fix': [
        //     {
        //       name: 'Audit fix',
        //       ct_uid: 'audit-fix',
        //       fixStatus: 'Fixed',
        //       data_type: field.data_type,
        //       display_name: field.display_name,
        //       missingRefs: 'Empty schema found',
        //       tree: [{ uid: field.uid, name: field.display_name, data_type: field.data_type }],
        //       treeStr: [{ uid: field.uid, name: field.display_name, data_type: field.data_type }]
        //         .map(({ name }) => name)
        //         .join(' ➜ '),
        //     },
        //   ],
        // };
      });
  });
});
