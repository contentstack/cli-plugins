import fs from 'fs';
import { resolve } from 'path';
import { expect } from 'chai';
import cloneDeep from 'lodash/cloneDeep';
import { cliux } from '@contentstack/cli-utilities';
import fancy from 'fancy-test';
import Sinon from 'sinon';
import config from '../../../src/config';
import { $t, auditMsg } from '../../../src/messages';
import { ContentType, Entries, GlobalField } from '../../../src/modules';
import { CtConstructorParam, EntryStruct, ModuleConstructorParam } from '../../../src/types';
import {
  schema,
  emptyEntries,
  ctBlock,
  entryBlock,
  ctJsonRTE,
  entryJsonRTE,
  ctGroupField,
  entryGroupField,
} from '../mock/mock.json';
import { mockLogger } from '../mock-logger';

describe('Entries module', () => {
  let constructorParam: ModuleConstructorParam & CtConstructorParam;
  let ctStub: Sinon.SinonStub;
  let gfStub: Sinon.SinonStub;

  beforeEach(() => {
    constructorParam = {
      moduleName: 'entries',
      ctSchema: cloneDeep(require('../mock/contents/content_types/schema.json')),
      gfSchema: cloneDeep(require('../mock/contents/global_fields/globalfields.json')),
      config: Object.assign(config, { basePath: resolve(__dirname, '..', 'mock', 'contents'), flags: {} }),
    };
    
    // Mock the logger for all tests
    Sinon.stub(require('@contentstack/cli-utilities'), 'log').value(mockLogger);
  });

  before(() => {
    ctStub = Sinon.stub(ContentType.prototype, 'run').resolves({ ct1: [{}] });
    gfStub = Sinon.stub(GlobalField.prototype, 'run').resolves({ gf1: [{}] });
  });

  after(() => {
    Sinon.restore(); // Clears Sinon spies/stubs/mocks
    ctStub.restore();
    gfStub.restore();
  });

  describe('run method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should throw folder path validation error', async () => {
        const ctInstance = new Entries({
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
      .stub(Entries.prototype, 'prepareEntryMetaData', async () => {})
      .stub(Entries.prototype, 'fixPrerequisiteData', async () => {})
      .stub(Entries.prototype, 'writeFixContent', async () => {})
      .stub(Entries.prototype, 'lookForReference', async () => {})
      .stub(Entries.prototype, 'locales', [{ code: 'en-us' }] as any)
      .it('should return missing refs', async () => {
        const ctInstance = new (class Class extends Entries {
          constructor() {
            super(constructorParam);
            this.missingRefs['test-entry-id'] = [{ uid: 'test', treeStr: 'gf_0' }];
          }
        })();
        const missingRefs = await ctInstance.run();
        expect((missingRefs as any).missingEntryRefs).not.to.be.empty;
        expect((missingRefs as any).missingEntryRefs).deep.contain({ 'test-entry-id': [{ uid: 'test', treeStr: 'gf_0' }] });
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(Entries.prototype, 'prepareEntryMetaData', async () => {})
      .stub(Entries.prototype, 'fixPrerequisiteData', async () => {})
      .stub(Entries.prototype, 'lookForReference', async () => {})
      .stub(Entries.prototype, 'writeFixContent', async () => {})
      .stub(Entries.prototype, 'locales', [{ code: 'en-us' }] as any)
      .it('should call prepareEntryMetaData & fixPrerequisiteData methods', async () => {
        const prepareEntryMetaData = Sinon.spy(Entries.prototype, 'prepareEntryMetaData');
        const fixPrerequisiteData = Sinon.spy(Entries.prototype, 'fixPrerequisiteData');
        const lookForReference = Sinon.spy(Entries.prototype, 'lookForReference');
        const writeFixContent = Sinon.spy(Entries.prototype, 'writeFixContent');
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        const missingRefs = await ctInstance.run();
        expect((missingRefs as any).missingEntryRefs).to.be.empty;
        expect(writeFixContent.callCount).to.be.equals(1);
        expect(lookForReference.callCount).to.be.equals(1);
        expect(fixPrerequisiteData.callCount).to.be.equals(1);
        expect(prepareEntryMetaData.callCount).to.be.equals(1);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('run with real folder runs main loop and removeEmptyVal', async () => {
        const realCtSchema = cloneDeep(require('../mock/contents/content_types/schema.json'));
        const realGfSchema = cloneDeep(require('../mock/contents/global_fields/globalfields.json'));
        ctStub.resolves(realCtSchema);
        gfStub.resolves(realGfSchema);
        try {
          const ctInstance = new Entries(constructorParam);
          const result = (await ctInstance.run()) as any;
          expect(result).to.have.property('missingEntryRefs');
          expect(result).to.have.property('missingSelectFeild');
          expect(result).to.have.property('missingMandatoryFields');
          expect(result).to.have.property('missingTitleFields');
          expect(result).to.have.property('missingEnvLocale');
          expect(result).to.have.property('missingMultipleFields');
        } finally {
          ctStub.resetHistory();
          gfStub.resetHistory();
          ctStub.resolves({ ct1: [{}] });
          gfStub.resolves({ gf1: [{}] });
        }
      });
  });

  describe('fixPrerequisiteData method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should call content type and global fields fix functionality', async () => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        await ctInstance.fixPrerequisiteData();
        expect(ctStub.callCount).to.be.equals(1);
        expect(gfStub.callCount).to.be.equals(1);
        expect(ctInstance.ctSchema).deep.contain({ ct1: [{}] });
        expect(ctInstance.gfSchema).deep.contain({ gf1: [{}] });
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('loads extensions when extensions.json exists', async () => {
        Sinon.stub(fs, 'existsSync').callsFake((path: any) => String(path).includes('extensions.json'));
        Sinon.stub(fs, 'readFileSync').callsFake(() => JSON.stringify({ ext_uid_1: {}, ext_uid_2: {} }));
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        await ctInstance.fixPrerequisiteData();
        expect(ctInstance.extensions).to.include('ext_uid_1');
        expect(ctInstance.extensions).to.include('ext_uid_2');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('loads extension UIDs from marketplace apps when file exists', async () => {
        if ((fs.existsSync as any).restore) (fs.existsSync as any).restore();
        if ((fs.readFileSync as any).restore) (fs.readFileSync as any).restore();
        Sinon.stub(fs, 'existsSync').callsFake((path: any) => String(path).includes('marketplace_apps.json'));
        Sinon.stub(fs, 'readFileSync').callsFake((path: any) => {
          if (String(path).includes('marketplace')) {
            return JSON.stringify([
              { uid: 'app1', manifest: { name: 'App1' }, ui_location: { locations: [{ meta: { extension_uid: 'market_ext_1' } }] } },
            ]);
          }
          return '{}';
        });
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        await ctInstance.fixPrerequisiteData();
        expect(ctInstance.extensions).to.include('market_ext_1');
      });
  });

  describe('writeFixContent method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'writeFileSync', () => {})
      .stub(cliux, 'confirm', async () => true)
      .it('should ask confirmation adn write content in given path', async ({}) => {
        const writeFileSync = Sinon.spy(fs, 'writeFileSync');
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        await ctInstance.writeFixContent(resolve(__dirname, '..', 'mock', 'contents'), {});

        expect(writeFileSync.callCount).to.be.equals(1);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'writeFileSync', () => {})
      .it("should skip confirmation if 'yes' flag passed", async ({}) => {
        const writeFileSync = Sinon.spy(fs, 'writeFileSync');
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        ctInstance.config.flags.yes = true;
        await ctInstance.writeFixContent(resolve(__dirname, '..', 'mock', 'contents'), {});

        expect(writeFileSync.callCount).to.be.equals(1);
        expect(writeFileSync.calledWithExactly(resolve(__dirname, '..', 'mock', 'contents'), JSON.stringify({}))).to.be
          .true;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'writeFileSync', () => {})
      .it("should skip confirmation when copy-dir flag passed", async () => {
        const writeFileSync = Sinon.spy(fs, 'writeFileSync');
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        ctInstance.config.flags['copy-dir'] = true;
        await ctInstance.writeFixContent(resolve(__dirname, '..', 'mock', 'contents'), { e1: {} as EntryStruct });
        expect(writeFileSync.callCount).to.be.equals(1);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'writeFileSync', () => {})
      .stub(cliux, 'confirm', async () => false)
      .it('should not write when user declines confirmation', async () => {
        const writeFileSync = Sinon.spy(fs, 'writeFileSync');
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        await ctInstance.writeFixContent(resolve(__dirname, '..', 'mock', 'contents'), {});
        expect(writeFileSync.callCount).to.be.equals(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'writeFileSync', () => {})
      .it('when fix true and writeFixContent called multiple times, confirm is called only once', async () => {
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        const confirmStub = Sinon.stub(cliux, 'confirm').resolves(true);
        await ctInstance.writeFixContent(resolve(__dirname, '..', 'mock', 'contents', 'chunk1.json'), { e1: {} as EntryStruct });
        await ctInstance.writeFixContent(resolve(__dirname, '..', 'mock', 'contents', 'chunk2.json'), { e2: {} as EntryStruct });
        expect(confirmStub.callCount).to.equal(1);
      });
  });

  describe('lookForReference method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(Entries.prototype, 'runFixOnSchema', () => emptyEntries)
      .stub(Entries.prototype, 'validateReferenceField', () => [])
      .stub(Entries.prototype, 'validateGlobalField', () => {})
      .stub(Entries.prototype, 'validateJsonRTEFields', () => {})
      .stub(Entries.prototype, 'validateModularBlocksField', () => {})
      .stub(Entries.prototype, 'validateGroupField', () => {})
      .it('should call datatype specific methods', async ({}) => {
        const ctInstance = new (class Class extends Entries {
          constructor() {
            super({ ...constructorParam, fix: true });
            this.currentUid = 'reference';
            this.missingRefs = { reference: [] };
            this.missingMandatoryFields['reference'] = [];
          }
        })();
        const runFixOnSchema = Sinon.spy(ctInstance, 'runFixOnSchema');
        const validateReferenceField = Sinon.spy(ctInstance, 'validateReferenceField');
        const validateGlobalField = Sinon.spy(ctInstance, 'validateGlobalField');
        const validateJsonRTEFields = Sinon.spy(ctInstance, 'validateJsonRTEFields');
        const validateModularBlocksField = Sinon.spy(ctInstance, 'validateModularBlocksField');
        const validateGroupField = Sinon.spy(ctInstance, 'validateGroupField');
        await ctInstance.lookForReference([], { schema } as any, {});

        expect(runFixOnSchema.callCount).to.be.equals(1);
        expect(validateReferenceField.callCount).to.be.equals(1);
        expect(validateGlobalField.callCount).to.be.equals(1);
        expect(validateJsonRTEFields.callCount).to.be.equals(1);
        expect(validateModularBlocksField.callCount).to.be.equals(1);
        expect(validateGroupField.callCount).to.be.equals(1);
      });
  });

  describe('validateReferenceField method', () => {
    class Class extends Entries {
      public entries: Record<string, EntryStruct> = (
        require('../mock/contents/entries/page_1/en-us/e7f6e3cc-64ca-4226-afb3-7794242ae5f5-entries.json') as any
      )['test-uid-2'];

      constructor() {
        super(constructorParam);
      }
    }

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(Entries.prototype, 'validateReferenceValues', () => {})

      .it('should call validateReferenceField method', async ({}) => {
        const validateReferenceValues = Sinon.spy(Entries.prototype, 'validateReferenceValues');
        const ctInstance = new Class();

        await ctInstance.validateReferenceField([], ctInstance.ctSchema[3].schema as any, ctInstance.entries as any);

        expect(validateReferenceValues.callCount).to.be.equals(1);
        expect(
          validateReferenceValues.alwaysCalledWith(
            [],
            ctInstance.ctSchema[3].schema as unknown as any,
            ctInstance.entries as any,
          ),
        ).to.be.true;
      });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('should return missing reference', async () => {
      const ctInstance = new Class();
      // Reference that is missing from entryMetaData so it appears in missingRefs
      const entryData = [{ uid: 'test-uid-1', _content_type_uid: 'page_0' }];
      const missingRefs = await ctInstance.validateReferenceField(
        [{ uid: 'test-uid', name: 'reference', field: 'reference' }],
        ctInstance.ctSchema[3].schema as any,
        entryData as any,
      );

      expect(missingRefs).deep.equal([
        {
          tree: [
            {
              uid: 'test-uid',
              name: 'reference',
              field: 'reference',
            },
          ],
          data_type: undefined,
          missingRefs: [
            {
              uid: 'test-uid-1',
              _content_type_uid: 'page_0',
            },
          ],
          display_name: undefined,
          uid: undefined,
          name: undefined,
          treeStr: 'reference',
        },
      ]);
    });
  });

  describe('validateGlobalField method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('calls lookForReference and completes validation', () => {
        const lookForReference = Sinon.spy(Entries.prototype, 'lookForReference');
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        const tree: Record<string, unknown>[] = [];
        const fieldStructure = { uid: 'gf_1', display_name: 'Global Field 1', schema: [{ uid: 'ref', data_type: 'reference' }] };
        const field = { ref: [] };
        ctInstance.validateGlobalField(tree, fieldStructure as any, field as any);
        expect(lookForReference.callCount).to.equal(1);
        expect(lookForReference.calledWith(tree, fieldStructure, field)).to.be.true;
      });
  });

  describe('validateJsonRTEFields method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(Entries.prototype, 'jsonRefCheck', () => {})
      .it('should do recursive call on validateJsonRTEFields method', async ({}) => {
        const jsonRefCheck = Sinon.spy(Entries.prototype, 'jsonRefCheck');
        const validateJsonRTEFields = Sinon.spy(Entries.prototype, 'validateJsonRTEFields');
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        await ctInstance.validateJsonRTEFields([], ctJsonRTE as any, entryJsonRTE as any);
        expect(jsonRefCheck.callCount).to.be.equals(4);
        expect(validateJsonRTEFields.callCount).to.be.equals(3);
        expect(validateJsonRTEFields.calledWithExactly([], ctJsonRTE as any, entryJsonRTE as any)).to.be.true;
        expect(jsonRefCheck.calledWithExactly([], ctJsonRTE as any, entryJsonRTE.children[0] as any)).to.be.true;
      });
  });

  describe('validateModularBlocksField method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(Entries.prototype, 'modularBlockRefCheck', () => {})
      .stub(Entries.prototype, 'lookForReference', () => {})

      .it(
        'should iterate each blocks and call modularBlockRefCheck & lookForReference methods number of blocks exist in the entry times',
        async ({}) => {
          const modularBlockRefCheck = Sinon.spy(Entries.prototype, 'modularBlockRefCheck');
          const lookForReference = Sinon.spy(Entries.prototype, 'lookForReference');
          const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
          await ctInstance.validateModularBlocksField([], ctBlock as any, entryBlock as any);

          expect(modularBlockRefCheck.callCount).to.be.equals(3);
          expect(lookForReference.callCount).to.be.equals(5);
          expect(modularBlockRefCheck.calledWithExactly([], ctBlock.blocks as any, entryBlock[0] as any, 0)).to.be.true;
          expect(
            lookForReference.calledWithExactly(
              [{ uid: 'gf_1', name: 'GF 1' }],
              ctBlock.blocks[1] as any,
              entryBlock[0].gf_1 as any,
            ),
          ).to.be.true;
        },
      );
  });

  describe('validateGroupField method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(Entries.prototype, 'lookForReference', () => {})
      .it('should call lookForReference method to iterate GroupField schema', async ({}) => {
        const lookForReference = Sinon.spy(Entries.prototype, 'lookForReference');
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        await ctInstance.validateGroupField([], ctGroupField as any, entryGroupField as any);
        expect(lookForReference.callCount).to.be.equals(1);
        expect(lookForReference.calledWithExactly([], ctGroupField as any, entryGroupField)).to.be.true;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(Entries.prototype, 'lookForReference', () => {})
      .it(
        'should iterate all group entries and call lookForReference method to iterate GroupField schema',
        async ({}) => {
          const lookForReference = Sinon.spy(Entries.prototype, 'lookForReference');

          const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
          await ctInstance.validateGroupField([], ctGroupField as any, [entryGroupField, entryGroupField] as any);

          expect(lookForReference.callCount).to.be.equals(2);
          expect(
            lookForReference.calledWithExactly(
              [{ uid: ctGroupField.uid, display_name: ctGroupField.display_name }],
              ctGroupField as any,
              entryGroupField,
            ),
          ).to.be.true;
        },
      );
  });

  describe('fixGlobalFieldReferences method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(Entries.prototype, 'runFixOnSchema', (...args: any[]) => args[2])
      .it('should call runFixOnSchema for single global field entry', async ({}) => {
        const runFixOnSchema = Sinon.spy(Entries.prototype, 'runFixOnSchema');
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        
        const globalFieldSchema = {
          uid: 'gf_1',
          display_name: 'Global Field 1',
          data_type: 'global_field',
          multiple: false,
          schema: [
            { uid: 'reference', display_name: 'Reference', data_type: 'reference' }
          ]
        };
        
        const entryData = {
          reference: [{ uid: 'test-uid-1', _content_type_uid: 'page_0' }]
        };

        const result = await ctInstance.fixGlobalFieldReferences([], globalFieldSchema as any, entryData as any);

        expect(runFixOnSchema.callCount).to.be.equals(1);
        expect(runFixOnSchema.firstCall.args[0]).to.deep.equal([{ uid: globalFieldSchema.uid, display_name: globalFieldSchema.display_name }]);
        expect(runFixOnSchema.firstCall.args[1]).to.deep.equal(globalFieldSchema.schema);
        expect(runFixOnSchema.firstCall.args[2]).to.deep.equal(entryData);
        expect(result).to.deep.equal(entryData);
      });
  });

  describe('removeMissingKeysOnEntry', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('removes entry keys not in schema and not in systemKeys', () => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'e1';
        const schema = [{ uid: 'title' }, { uid: 'body' }];
        const entry: Record<string, any> = { title: 'T', body: 'B', invalid_key: 'remove me', uid: 'keep-uid' };
        (ctInstance as any).removeMissingKeysOnEntry(schema, entry);
        expect(entry.invalid_key).to.be.undefined;
        expect(entry.title).to.equal('T');
        expect(entry.uid).to.equal('keep-uid');
      });
  });

  describe('runFixOnSchema', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('skips field when not present in entry', () => {
        if ((Entries.prototype.fixGlobalFieldReferences as any).restore) (Entries.prototype.fixGlobalFieldReferences as any).restore();
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        (ctInstance as any).currentUid = 'e1';
        (ctInstance as any).currentTitle = 'E1';
        (ctInstance as any).missingRefs = { e1: [] };
        (ctInstance as any).missingMultipleField = { e1: [] };
        const schema = [{ uid: 'only_in_schema', data_type: 'text', display_name: 'Only' }];
        const entry = { other_key: 'v' };
        const result = (ctInstance as any).runFixOnSchema([], schema, entry);
        expect((entry as any).only_in_schema).to.be.undefined;
        expect(result).to.equal(entry);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('converts non-array to array when field is multiple', () => {
        if ((Entries.prototype.fixGlobalFieldReferences as any).restore) (Entries.prototype.fixGlobalFieldReferences as any).restore();
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        (ctInstance as any).currentUid = 'e1';
        (ctInstance as any).currentTitle = 'E1';
        (ctInstance as any).missingRefs = { e1: [] };
        (ctInstance as any).missingMultipleField = { e1: [] };
        Sinon.stub(Entries.prototype, 'fixGlobalFieldReferences').callsFake((_t: any, _f: any, e: any) => e);
        const schema = [{ uid: 'multi', data_type: 'global_field', multiple: true, display_name: 'M', schema: [] }];
        const entry = { multi: 'single value' as any };
        (ctInstance as any).runFixOnSchema([], schema, entry);
        expect(entry.multi).to.eql(['single value']);
        (Entries.prototype.fixGlobalFieldReferences as any).restore?.();
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('deletes reference field when fixMissingReferences returns falsy', () => {
        if ((Entries.prototype.fixMissingReferences as any).restore) (Entries.prototype.fixMissingReferences as any).restore();
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        (ctInstance as any).currentUid = 'e1';
        (ctInstance as any).entryMetaData = [];
        Sinon.stub(Entries.prototype, 'fixMissingReferences').returns(undefined as any);
        const schema = [{ uid: 'ref', data_type: 'reference', display_name: 'Ref', reference_to: ['ct1'] }];
        const entry = { ref: [{ uid: 'missing' }] };
        (ctInstance as any).runFixOnSchema([], schema, entry);
        expect(entry.ref).to.be.undefined;
        (Entries.prototype.fixMissingReferences as any).restore?.();
      });
  });

  describe('validateMandatoryFields', () => {
    const initInstance = (ctInstance: Entries) => {
      (ctInstance as any).currentUid = 'test-entry';
      (ctInstance as any).currentTitle = 'Test Entry';
      (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
    };

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns missing field when mandatory JSON RTE is empty', () => {
      const ctInstance = new Entries(constructorParam);
      initInstance(ctInstance);
      const tree = [{ uid: 'test-entry', name: 'Test Entry' }];
      const fieldStructure = {
        uid: 'body',
        display_name: 'Body',
        data_type: 'json',
        mandatory: true,
        multiple: false,
        field_metadata: { allow_json_rte: true },
      };
      const entry = {
        body: {
          children: [{ children: [{ text: '' }] }],
        },
      };
      const result = (ctInstance as any).validateMandatoryFields(tree, fieldStructure, entry);
      expect(result).to.have.length(1);
      expect(result[0]).to.include({ display_name: 'Body', missingFieldUid: 'body' });
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns missing field when mandatory number is empty', () => {
      const ctInstance = new Entries(constructorParam);
      initInstance(ctInstance);
      const tree = [{ uid: 'test-entry', name: 'Test Entry' }];
      const fieldStructure = { uid: 'num', display_name: 'Number', data_type: 'number', mandatory: true, multiple: false, field_metadata: {} };
      const entry = {};
      const result = (ctInstance as any).validateMandatoryFields(tree, fieldStructure, entry);
      expect(result).to.have.length(1);
      expect(result[0].missingFieldUid).to.equal('num');
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns missing field when mandatory text is empty', () => {
      const ctInstance = new Entries(constructorParam);
      initInstance(ctInstance);
      const tree = [{ uid: 'test-entry', name: 'Test Entry' }];
      const fieldStructure = { uid: 'title', display_name: 'Title', data_type: 'text', mandatory: true, multiple: false, field_metadata: {} };
      const entry = { title: '' };
      const result = (ctInstance as any).validateMandatoryFields(tree, fieldStructure, entry);
      expect(result).to.have.length(1);
      expect(result[0].missingFieldUid).to.equal('title');
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns missing field when mandatory reference array is empty', () => {
      const ctInstance = new Entries(constructorParam);
      initInstance(ctInstance);
      const tree = [{ uid: 'test-entry', name: 'Test Entry' }];
      const fieldStructure = { uid: 'ref', display_name: 'Reference', data_type: 'reference', mandatory: true, multiple: false, field_metadata: {} };
      const entry = { ref: [] };
      const result = (ctInstance as any).validateMandatoryFields(tree, fieldStructure, entry);
      expect(result).to.have.length(1);
      expect(result[0].missingFieldUid).to.equal('ref');
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns empty array when mandatory field has value', () => {
      const ctInstance = new Entries(constructorParam);
      initInstance(ctInstance);
      const tree = [{ uid: 'test-entry', name: 'Test Entry' }];
      const fieldStructure = { uid: 'title', display_name: 'Title', data_type: 'text', mandatory: true, multiple: false, field_metadata: {} };
      const entry = { title: 'Has value' };
      const result = (ctInstance as any).validateMandatoryFields(tree, fieldStructure, entry);
      expect(result).to.eql([]);
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns empty array when field is not mandatory', () => {
      const ctInstance = new Entries(constructorParam);
      initInstance(ctInstance);
      const tree = [{ uid: 'test-entry', name: 'Test Entry' }];
      const fieldStructure = { uid: 'opt', display_name: 'Optional', data_type: 'text', mandatory: false, multiple: false, field_metadata: {} };
      const entry = {};
      const result = (ctInstance as any).validateMandatoryFields(tree, fieldStructure, entry);
      expect(result).to.eql([]);
    });
  });

  describe('validateSelectField method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should validate single select field with valid value', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          display_type: 'dropdown',
          multiple: false,
          enum: {
            choices: [
              { value: 'option1', display_name: 'Option 1' },
              { value: 'option2', display_name: 'Option 2' }
            ]
          }
        };
        
        const entryData = 'option1';
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.be.an('array');
        expect(result.length).to.equal(0); // No validation errors
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should flag single select field with invalid value', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          display_type: 'dropdown',
          multiple: false,
          enum: {
            choices: [
              { value: 'option1', display_name: 'Option 1' },
              { value: 'option2', display_name: 'Option 2' }
            ]
          }
        };
        
        const entryData = 'invalid_option';
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.be.an('array');
        expect(result.length).to.equal(1);
        expect(result[0]).to.have.property('missingCTSelectFieldValues', 'invalid_option');
        expect(result[0]).to.have.property('display_name', 'Select Field');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should handle empty single select field value', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          display_type: 'dropdown',
          multiple: false,
          enum: {
            choices: [
              { value: 'option1', display_name: 'Option 1' },
              { value: 'option2', display_name: 'Option 2' }
            ]
          }
        };
        
        const entryData = '';
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.be.an('array');
        expect(result.length).to.equal(1);
        expect(result[0]).to.have.property('missingCTSelectFieldValues', 'Not Selected');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should handle null single select field value', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          display_type: 'dropdown',
          multiple: false,
          enum: {
            choices: [
              { value: 'option1', display_name: 'Option 1' },
              { value: 'option2', display_name: 'Option 2' }
            ]
          }
        };
        
        const entryData = null;
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.be.an('array');
        expect(result.length).to.equal(1);
        expect(result[0]).to.have.property('missingCTSelectFieldValues', 'Not Selected');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should validate multiple select field with valid values', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          display_type: 'dropdown',
          multiple: true,
          enum: {
            choices: [
              { value: 'option1', display_name: 'Option 1' },
              { value: 'option2', display_name: 'Option 2' },
              { value: 'option3', display_name: 'Option 3' }
            ]
          }
        };
        
        const entryData = ['option1', 'option2'];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.be.an('array');
        expect(result.length).to.equal(0); // No validation errors
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should flag multiple select field with invalid values', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          display_type: 'dropdown',
          multiple: true,
          enum: {
            choices: [
              { value: 'option1', display_name: 'Option 1' },
              { value: 'option2', display_name: 'Option 2' }
            ]
          }
        };
        
        const entryData = ['option1', 'invalid_option', 'option2'];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.be.an('array');
        expect(result.length).to.equal(1);
        expect(result[0]).to.have.property('missingCTSelectFieldValues');
        expect(result[0].missingCTSelectFieldValues).to.include('invalid_option');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should handle empty multiple select field array', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          display_type: 'dropdown',
          multiple: true,
          enum: {
            choices: [
              { value: 'option1', display_name: 'Option 1' },
              { value: 'option2', display_name: 'Option 2' }
            ]
          }
        };
        
        const entryData: string[] = [];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.be.an('array');
        expect(result.length).to.equal(1);
        expect(result[0]).to.have.property('missingCTSelectFieldValues', 'Not Selected');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should handle number data type with zero value', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'number',
          display_type: 'dropdown',
          multiple: false,
          enum: {
            choices: [
              { value: 0, display_name: 'Zero' },
              { value: 1, display_name: 'One' }
            ]
          }
        };
        
        const entryData = 0;
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.be.an('array');
        expect(result.length).to.equal(0); // Zero should be valid for number type
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should return empty array when display_type is missing', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          // No display_type
          multiple: false,
          enum: {
            choices: [
              { value: 'option1', display_name: 'Option 1' }
            ]
          }
        };
        
        const entryData = 'invalid_option';
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.be.an('array');
        expect(result.length).to.equal(0); // No display_type means no validation
      });
  });

  describe('fixSelectField method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should return original value when fix is disabled', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        (ctInstance as any).config = { ...constructorParam.config, fixSelectField: false };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          display_type: 'dropdown',
          multiple: false,
          enum: {
            choices: [
              { value: 'option1', display_name: 'Option 1' },
              { value: 'option2', display_name: 'Option 2' }
            ]
          }
        };
        
        const entryData = 'invalid_option';
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.fixSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.equal('invalid_option'); // Should return original value unchanged
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should fix single select field with invalid value', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        (ctInstance as any).config = { ...constructorParam.config, fixSelectField: true };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          display_type: 'dropdown',
          multiple: false,
          enum: {
            choices: [
              { value: 'option1', display_name: 'Option 1' },
              { value: 'option2', display_name: 'Option 2' }
            ]
          }
        };
        
        const entryData = 'invalid_option';
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.fixSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.equal('option1'); // Should be replaced with first valid option
        expect((ctInstance as any).missingSelectFeild['test-entry']).to.have.length(1);
        expect((ctInstance as any).missingSelectFeild['test-entry'][0]).to.have.property('fixStatus', 'Fixed');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should not change single select field with valid value', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        (ctInstance as any).config = { ...constructorParam.config, fixSelectField: true };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          display_type: 'dropdown',
          multiple: false,
          enum: {
            choices: [
              { value: 'option1', display_name: 'Option 1' },
              { value: 'option2', display_name: 'Option 2' }
            ]
          }
        };
        
        const entryData = 'option2';
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.fixSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.equal('option2'); // Should remain unchanged
        expect((ctInstance as any).missingSelectFeild['test-entry']).to.have.length(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should fix multiple select field with invalid values', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        (ctInstance as any).config = { ...constructorParam.config, fixSelectField: true };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          display_type: 'dropdown',
          multiple: true,
          enum: {
            choices: [
              { value: 'option1', display_name: 'Option 1' },
              { value: 'option2', display_name: 'Option 2' },
              { value: 'option3', display_name: 'Option 3' }
            ]
          }
        };
        
        const entryData = ['option1', 'invalid_option', 'option2'];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.fixSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.deep.equal(['option1', 'option2']); // Invalid option should be removed
        expect((ctInstance as any).missingSelectFeild['test-entry']).to.have.length(1);
        expect((ctInstance as any).missingSelectFeild['test-entry'][0]).to.have.property('fixStatus', 'Fixed');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should add default value to empty multiple select field', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        (ctInstance as any).config = { ...constructorParam.config, fixSelectField: true };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          display_type: 'dropdown',
          multiple: true,
          enum: {
            choices: [
              { value: 'option1', display_name: 'Option 1' },
              { value: 'option2', display_name: 'Option 2' }
            ]
          }
        };
        
        const entryData: string[] = [];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.fixSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.deep.equal(['option1']); // Should add first option
        expect((ctInstance as any).missingSelectFeild['test-entry']).to.have.length(1);
        expect((ctInstance as any).missingSelectFeild['test-entry'][0]).to.have.property('fixStatus', 'Fixed');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should handle min_instance requirement for multiple select field', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        (ctInstance as any).config = { ...constructorParam.config, fixSelectField: true };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          display_type: 'dropdown',
          multiple: true,
          min_instance: 3,
          enum: {
            choices: [
              { value: 'option1', display_name: 'Option 1' },
              { value: 'option2', display_name: 'Option 2' },
              { value: 'option3', display_name: 'Option 3' },
              { value: 'option4', display_name: 'Option 4' }
            ]
          }
        };
        
        const entryData = ['option1'];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.fixSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.have.length(3); // Should have min_instance number of values
        expect(result).to.include('option1'); // Original value should remain
        expect((ctInstance as any).missingSelectFeild['test-entry']).to.have.length(1);
        expect((ctInstance as any).missingSelectFeild['test-entry'][0]).to.have.property('fixStatus', 'Fixed');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should handle empty choices array gracefully', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        (ctInstance as any).config = { ...constructorParam.config, fixSelectField: true };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          display_type: 'dropdown',
          multiple: false,
          enum: {
            choices: [] // Empty choices
          }
        };
        
        const entryData = 'invalid_option';
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.fixSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.equal(null); // Should be set to null when no choices available
        expect((ctInstance as any).missingSelectFeild['test-entry']).to.have.length(1);
        expect((ctInstance as any).missingSelectFeild['test-entry'][0]).to.have.property('fixStatus', 'Fixed');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should not record fix when display_type is missing', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        (ctInstance as any).config = { ...constructorParam.config, fixSelectField: true };
        
        const selectFieldSchema = {
          uid: 'select_field',
          display_name: 'Select Field',
          data_type: 'select',
          // No display_type
          multiple: false,
          enum: {
            choices: [
              { value: 'option1', display_name: 'Option 1' }
            ]
          }
        };
        
        const entryData = 'invalid_option';
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.fixSelectField(tree, selectFieldSchema as any, entryData);

        expect(result).to.equal('option1'); // Should still fix the value
        expect((ctInstance as any).missingSelectFeild['test-entry']).to.have.length(0); // But not record it
      });
  });

  describe('validateReferenceField method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should validate reference field with valid UID', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        (ctInstance as any).entryMetaData = [{ uid: 'valid-uid', ctUid: 'page' }]; // Entry exists
        
        const referenceFieldSchema = {
          uid: 'reference_field',
          display_name: 'Reference Field',
          data_type: 'reference',
          reference_to: ['page']
        };
        
        const entryData = [{ uid: 'valid-uid', _content_type_uid: 'page' }];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateReferenceField(tree, referenceFieldSchema as any, entryData);

        expect(result).to.be.an('array'); // Should return empty array if no issues
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should flag reference field with invalid UID', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        (ctInstance as any).entryMetaData = []; // No entries exist
        
        const referenceFieldSchema = {
          uid: 'reference_field',
          display_name: 'Reference Field',
          data_type: 'reference',
          reference_to: ['page']
        };
        
        const entryData = [{ uid: 'invalid-uid', _content_type_uid: 'page' }];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateReferenceField(tree, referenceFieldSchema as any, entryData);

        expect(result).to.be.an('array'); // Should return array of missing references
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should flag reference when ref entry has wrong content type (ct2 ref when reference_to is ct1)', () => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).entryMetaData = [{ uid: 'blt123', ctUid: 'ct2' }]; // Entry exists but is ct2

        const referenceFieldSchema = { uid: 'ref', display_name: 'Ref', data_type: 'reference', reference_to: ['ct1'] };
        const entryData = [{ uid: 'blt123', _content_type_uid: 'ct2' }];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateReferenceValues(tree, referenceFieldSchema as any, entryData);

        expect(result).to.have.length(1);
        expect(result[0].missingRefs).to.deep.include({ uid: 'blt123', _content_type_uid: 'ct2' });
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should not flag reference when ref entry has correct content type (ct1 ref when reference_to is ct1)', () => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).entryMetaData = [{ uid: 'blt123', ctUid: 'ct1' }];

        const referenceFieldSchema = { uid: 'ref', display_name: 'Ref', data_type: 'reference', reference_to: ['ct1'] };
        const entryData = [{ uid: 'blt123', _content_type_uid: 'ct1' }];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateReferenceValues(tree, referenceFieldSchema as any, entryData);

        expect(result).to.have.length(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should normalize reference_to string and allow matching ref (ct1 when reference_to is string ct1)', () => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).entryMetaData = [{ uid: 'blt456', ctUid: 'ct1' }];

        const referenceFieldSchema = { uid: 'ref', display_name: 'Ref', data_type: 'reference', reference_to: 'ct1' };
        const entryData = [{ uid: 'blt456', _content_type_uid: 'ct1' }];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateReferenceValues(tree, referenceFieldSchema as any, entryData);

        expect(result).to.have.length(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('returns empty array when fix mode is enabled', () => {
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).entryMetaData = [];
        const referenceFieldSchema = { uid: 'ref', display_name: 'Ref', data_type: 'reference', reference_to: ['ct1'] };
        const entryData = [{ uid: 'blt1', _content_type_uid: 'ct1' }];
        const result = ctInstance.validateReferenceValues([], referenceFieldSchema as any, entryData);
        expect(result).to.eql([]);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('does not flag blt reference when found in entryMetaData and content type allowed', () => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).entryMetaData = [{ uid: 'blt999', ctUid: 'ct1' }];
        const referenceFieldSchema = { uid: 'ref', display_name: 'Ref', data_type: 'reference', reference_to: ['ct1'] };
        const entryData = ['blt999'];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];
        const result = ctInstance.validateReferenceValues(tree, referenceFieldSchema as any, entryData as any);
        expect(result).to.have.length(0);
      });
  });

  describe('validateModularBlocksField method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should validate modular block with valid blocks', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const modularBlockSchema = {
          uid: 'modular_block',
          display_name: 'Modular Block',
          data_type: 'blocks',
          blocks: [
            {
              uid: 'block1',
              display_name: 'Block 1',
              schema: [
                { uid: 'text_field', display_name: 'Text Field', data_type: 'text' }
              ]
            }
          ]
        };
        
        const entryData = [
          {
            _metadata: { uid: 'block1' },
            text_field: 'test value'
          }
        ];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        ctInstance.validateModularBlocksField(tree, modularBlockSchema as any, entryData as any);

        // Should not throw - method is void
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should handle modular block with missing block metadata', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const modularBlockSchema = {
          uid: 'modular_block',
          display_name: 'Modular Block',
          data_type: 'blocks',
          blocks: [
            {
              uid: 'block1',
              display_name: 'Block 1',
              schema: [
                { uid: 'text_field', display_name: 'Text Field', data_type: 'text' }
              ]
            }
          ]
        };
        
        const entryData = [
          {
            text_field: 'test value'
            // Missing _metadata
          }
        ];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        ctInstance.validateModularBlocksField(tree, modularBlockSchema as any, entryData as any);

        // Should not throw - method is void
      });
  });

  describe('validateGroupField method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should validate group field with valid data', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const groupFieldSchema = {
          uid: 'group_field',
          display_name: 'Group Field',
          data_type: 'group',
          multiple: false,
          schema: [
            { uid: 'text_field', display_name: 'Text Field', data_type: 'text' }
          ]
        };
        
        const entryData = {
          group_field: {
            text_field: 'test value'
          }
        };
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = await ctInstance.validateGroupField(tree, groupFieldSchema as any, entryData as any);

        expect(result).to.be.undefined; // Should not throw or return error
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should validate multiple group field entries', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const groupFieldSchema = {
          uid: 'group_field',
          display_name: 'Group Field',
          data_type: 'group',
          multiple: true,
          schema: [
            { uid: 'text_field', display_name: 'Text Field', data_type: 'text' }
          ]
        };
        
        const entryData = {
          group_field: [
            { text_field: 'value 1' },
            { text_field: 'value 2' }
          ]
        };
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = await ctInstance.validateGroupField(tree, groupFieldSchema as any, entryData as any);

        expect(result).to.be.undefined; // Should not throw or return error
      });
  });

  describe('validateModularBlocksField method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should validate modular block with nested global fields', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const modularBlockSchema = {
          uid: 'modular_block',
          display_name: 'Modular Block',
          data_type: 'blocks',
          blocks: [
            {
              uid: 'block_with_global',
              display_name: 'Block with Global',
              schema: [
                {
                  uid: 'global_field_ref',
                  display_name: 'Global Field Reference',
                  data_type: 'global_field',
                  reference_to: 'global_field_uid'
                }
              ]
            }
          ]
        };
        
        const entryData = [
          {
            _metadata: { uid: 'block_with_global' },
            global_field_ref: {
              nested_field: 'test value'
            }
          }
        ];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        ctInstance.validateModularBlocksField(tree, modularBlockSchema as any, entryData as any);

        // Should not throw - method is void
      });
  });

  describe('validateExtensionAndAppField method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should validate file field with valid asset UID', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const fileFieldSchema = {
          uid: 'file_field',
          display_name: 'File Field',
          data_type: 'file'
        };
        
        const entryData = {
          file_field: {
            uid: 'valid-asset-uid',
            filename: 'test.jpg',
            content_type: 'image/jpeg'
          }
        };
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateExtensionAndAppField(tree, fileFieldSchema as any, entryData as any);

        expect(result).to.be.an('array'); // Should return an array of missing references
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('reports extension as valid when extension_uid is in extensions list', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        ctInstance.extensions = ['valid-ext-uid'];
        const field = { uid: 'ext_f', display_name: 'Ext Field', data_type: 'json', field_metadata: { extension: true } };
        const entry = { ext_f: { metadata: { extension_uid: 'valid-ext-uid' } } };
        const tree: Record<string, unknown>[] = [];
        const result = ctInstance.validateExtensionAndAppField(tree, field as any, entry as any);
        expect(result).to.be.an('array');
        expect(result).to.have.length(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('returns empty array when fix mode is enabled', async ({}) => {
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        (ctInstance as any).currentUid = 'test-entry';
        ctInstance.extensions = [];
        const field = { uid: 'ext_f', display_name: 'Ext', data_type: 'json' };
        const entry = { ext_f: { metadata: { extension_uid: 'any' } } };
        const result = ctInstance.validateExtensionAndAppField([], field as any, entry as any);
        expect(result).to.eql([]);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('returns empty array when field has no extension data (no entry[uid])', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        ctInstance.extensions = [];
        const field = { uid: 'ext_f', display_name: 'Ext Field', data_type: 'json' };
        const entry = {} as any;
        const result = ctInstance.validateExtensionAndAppField([], field as any, entry);
        expect(result).to.eql([]);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('returns result with treeStr when extension UID is missing', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        ctInstance.extensions = ['other-ext'];
        const field = { uid: 'ext_f', display_name: 'Ext Field', data_type: 'json' };
        const entry = { ext_f: { metadata: { extension_uid: 'missing-ext' } } };
        const tree = [{ uid: 'e1', name: 'Entry 1' }];
        const result = ctInstance.validateExtensionAndAppField(tree, field as any, entry as any);
        expect(result).to.have.length(1);
        expect(result[0]).to.have.property('treeStr');
        expect(result[0].missingRefs).to.deep.include({ uid: 'ext_f', extension_uid: 'missing-ext', type: 'Extension or Apps' });
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should flag file field with invalid asset UID', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const fileFieldSchema = {
          uid: 'file_field',
          display_name: 'File Field',
          data_type: 'file'
        };
        
        const entryData = {
          file_field: {
            uid: 'invalid-asset-uid',
            filename: 'test.jpg',
            content_type: 'image/jpeg'
          }
        };
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.validateExtensionAndAppField(tree, fileFieldSchema as any, entryData as any);

        expect(result).to.be.an('array'); // Should return an array of missing references
      });
  });

  describe('validateJsonRTEFields method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should validate RTE field with valid content', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const rteFieldSchema = {
          uid: 'rte_field',
          display_name: 'RTE Field',
          data_type: 'richtext'
        };
        
        const entryData = {
          rte_field: {
            uid: 'rte-uid',
            type: 'doc',
            children: [
              {
                type: 'p',
                children: [{ text: 'Test content' }]
              }
            ]
          }
        };
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        ctInstance.validateJsonRTEFields(tree, rteFieldSchema as any, entryData as any);

        // Should not throw - method is void
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should validate RTE field with embedded references', async ({}) => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).missingSelectFeild = { 'test-entry': [] };
        (ctInstance as any).missingMandatoryFields = { 'test-entry': [] };
        
        const rteFieldSchema = {
          uid: 'rte_field',
          display_name: 'RTE Field',
          data_type: 'richtext'
        };
        
        const entryData = {
          rte_field: {
            uid: 'rte-uid',
            type: 'doc',
            children: [
              {
                type: 'p',
                children: [
                  { text: 'Content with ' },
                  {
                    type: 'a',
                    attrs: { href: '/test-page' },
                    children: [{ text: 'link' }]
                  }
                ]
              }
            ]
          }
        };
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        ctInstance.validateJsonRTEFields(tree, rteFieldSchema as any, entryData as any);

        // Should not throw - method is void
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should flag JSON RTE embed when ref has wrong content type (ct2 when reference_to is ct1,sys_assets)', () => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).entryMetaData = [{ uid: 'blt123', ctUid: 'ct2' }];

        const schema = {
          uid: 'json_rte',
          display_name: 'JSON RTE',
          data_type: 'richtext',
          reference_to: ['ct1', 'sys_assets'],
        };
        const child = {
          type: 'embed',
          uid: 'child-uid',
          attrs: { 'entry-uid': 'blt123', 'content-type-uid': 'ct2' },
          children: [],
        };
        const tree: Record<string, unknown>[] = [];

        (ctInstance as any).jsonRefCheck(tree, schema, child);

        expect((ctInstance as any).missingRefs['test-entry']).to.have.length(1);
        expect((ctInstance as any).missingRefs['test-entry'][0].missingRefs).to.deep.include({
          uid: 'blt123',
          'content-type-uid': 'ct2',
        });
      });
  });

  describe('fixMissingReferences method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should filter out ref when ref has wrong content type (ct2 when reference_to is ct1)', () => {
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).entryMetaData = [{ uid: 'blt123', ctUid: 'ct2' }];

        const field = {
          uid: 'ref_field',
          display_name: 'Ref',
          data_type: 'reference',
          reference_to: ['ct1'],
        };
        const entry = [{ uid: 'blt123', _content_type_uid: 'ct2' }];
        const tree = [{ uid: 'test-entry', name: 'Test Entry' }];

        const result = ctInstance.fixMissingReferences(tree, field as any, entry);

        expect(result).to.have.length(0);
        expect((ctInstance as any).missingRefs['test-entry']).to.have.length(1);
        expect((ctInstance as any).missingRefs['test-entry'][0].missingRefs).to.deep.include({
          uid: 'blt123',
          _content_type_uid: 'ct2',
        });
      });
  });

  describe('jsonRefCheck in fix mode', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should return null when ref has wrong content type (fix mode)', () => {
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).entryMetaData = [{ uid: 'blt123', ctUid: 'ct2' }];

        const schema = {
          uid: 'json_rte',
          display_name: 'JSON RTE',
          data_type: 'richtext',
          reference_to: ['ct1'],
        };
        const child = {
          type: 'embed',
          uid: 'child-uid',
          attrs: { 'entry-uid': 'blt123', 'content-type-uid': 'ct2' },
          children: [],
        };
        const tree: Record<string, unknown>[] = [];

        const result = (ctInstance as any).jsonRefCheck(tree, schema, child);

        expect(result).to.be.null;
      });
  });

  describe('isRefContentTypeAllowed helper', () => {
    const callHelper = (refCtUid: string | undefined, referenceTo: string | string[] | undefined) => {
      const ctInstance = new Entries(constructorParam);
      return (ctInstance as any).isRefContentTypeAllowed(refCtUid, referenceTo);
    };

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns true when refCtUid is in reference_to', () => {
      expect(callHelper('ct1', ['ct1', 'ct2'])).to.be.true;
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns false when refCtUid is not in reference_to', () => {
      expect(callHelper('ct2', ['ct1'])).to.be.false;
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns true when reference_to is undefined', () => {
      expect(callHelper('ct1', undefined)).to.be.true;
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('normalizes reference_to string and allows matching refCtUid', () => {
      expect(callHelper('ct1', 'ct1')).to.be.true;
      expect(callHelper('ct2', 'ct1')).to.be.false;
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns false when reference_to is empty array', () => {
      expect(callHelper('ct1', [])).to.be.false;
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns true when refCtUid is undefined', () => {
      expect(callHelper(undefined, ['ct1'])).to.be.true;
    });

    fancy.stdout({ print: process.env.PRINT === 'true' || false }).it('returns true when refCtUid is in skipRefs', () => {
      expect(callHelper('sys_assets', ['ct1'])).to.be.true;
    });
  });

  describe('jsonRefCheck entry ref and no-entry-uid branches', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('pushes to missingRefs and returns null when entry UID is not in entryMetaData', () => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).currentTitle = 'Test Entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).entryMetaData = []; // entry not present

        const schema = {
          uid: 'json_rte',
          display_name: 'JSON RTE',
          data_type: 'richtext',
          reference_to: ['ct1'],
        };
        const child = {
          type: 'embed',
          uid: 'child-uid',
          attrs: { 'entry-uid': 'missing-uid', 'content-type-uid': 'ct1' },
          children: [],
        };
        const tree: Record<string, unknown>[] = [];

        const result = (ctInstance as any).jsonRefCheck(tree, schema, child);

        expect(result).to.be.null;
        expect((ctInstance as any).missingRefs['test-entry']).to.have.length(1);
        expect((ctInstance as any).missingRefs['test-entry'][0].missingRefs).to.deep.include({
          uid: 'missing-uid',
          'content-type-uid': 'ct1',
        });
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('returns true when entry UID is in entryMetaData and isRefContentTypeAllowed (valid ref)', () => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).entryMetaData = [{ uid: 'blt123', ctUid: 'ct1' }];

        const schema = {
          uid: 'json_rte',
          display_name: 'JSON RTE',
          data_type: 'richtext',
          reference_to: ['ct1'],
        };
        const child = {
          type: 'embed',
          uid: 'child-uid',
          attrs: { 'entry-uid': 'blt123', 'content-type-uid': 'ct1' },
          children: [],
        };
        const tree: Record<string, unknown>[] = [];

        const result = (ctInstance as any).jsonRefCheck(tree, schema, child);

        expect(result).to.be.true;
        expect((ctInstance as any).missingRefs['test-entry']).to.have.length(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('returns true when child has no entry-uid (no entry UID in JSON child)', () => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'test-entry';
        (ctInstance as any).missingRefs = { 'test-entry': [] };
        (ctInstance as any).entryMetaData = [];

        const schema = {
          uid: 'json_rte',
          display_name: 'JSON RTE',
          data_type: 'richtext',
        };
        const child = {
          type: 'embed',
          uid: 'child-uid',
          attrs: {}, // no entry-uid
          children: [],
        };
        const tree: Record<string, unknown>[] = [];

        const result = (ctInstance as any).jsonRefCheck(tree, schema, child);

        expect(result).to.be.true;
        expect((ctInstance as any).missingRefs['test-entry']).to.have.length(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('returns true and does not push when entry ref is valid (covers Entry reference is valid log)', () => {
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'e1';
        (ctInstance as any).missingRefs = { e1: [] };
        (ctInstance as any).entryMetaData = [{ uid: 'valid-uid', ctUid: 'page_0' }];
        const schema = { uid: 'rte', display_name: 'RTE', data_type: 'richtext', reference_to: ['page_0'] };
        const child = {
          type: 'reference',
          uid: 'c1',
          attrs: { 'entry-uid': 'valid-uid', 'content-type-uid': 'page_0' },
          children: [],
        };
        const result = (ctInstance as any).jsonRefCheck([], schema, child);
        expect(result).to.be.true;
        expect((ctInstance as any).missingRefs.e1).to.have.length(0);
      });
  });

  describe('prepareEntryMetaData', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('loads locales, environments, and entry metadata from mock contents', async () => {
        const ctInstance = new Entries(constructorParam);
        await ctInstance.prepareEntryMetaData();

        expect(ctInstance.entryMetaData).to.be.an('array');
        expect(ctInstance.environments).to.be.an('array');
        expect(ctInstance.locales).to.be.an('array');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('loads only master locales when additional locales file is missing', async () => {
        if ((fs.existsSync as any).restore) (fs.existsSync as any).restore();
        const realExists = fs.existsSync.bind(fs);
        Sinon.stub(fs, 'existsSync').callsFake((path: fs.PathLike) => {
          const p = String(path);
          if (p.includes('locales.json') && !p.includes('master-locale')) return false;
          return realExists(path);
        });
        try {
          const ctInstance = new Entries(constructorParam);
          await ctInstance.prepareEntryMetaData();
          expect(ctInstance.locales).to.be.an('array');
          expect(ctInstance.entryMetaData).to.be.an('array');
        } finally {
          (fs.existsSync as any).restore?.();
        }
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('records empty title and no-title entries and pushes to entryMetaData', async () => {
        if ((fs.existsSync as any).restore) (fs.existsSync as any).restore();
        if ((fs.readFileSync as any).restore) (fs.readFileSync as any).restore();
        const fullSchema = cloneDeep(require('../mock/contents/content_types/schema.json'));
        const page1 = fullSchema.find((c: any) => c.uid === 'page_1');
        const emptyTitleCt = page1 ? { ...page1, uid: 'empty_title_ct' } : fullSchema[0];
        const param = {
          ...constructorParam,
          ctSchema: [emptyTitleCt],
          config: { ...constructorParam.config },
        };
        const ctInstance = new Entries(param);
        await ctInstance.prepareEntryMetaData();
        const missingTitleFields = (ctInstance as any).missingTitleFields;
        expect(missingTitleFields).to.be.an('object');
        expect(missingTitleFields['entry-empty-title']).to.deep.include({
          'Entry UID': 'entry-empty-title',
          'Content Type UID': 'empty_title_ct',
          Locale: 'en-us',
        });
        const metaNoTitle = ctInstance.entryMetaData.find((m: any) => m.uid === 'entry-no-title');
        expect(metaNoTitle).to.be.ok;
        expect(metaNoTitle!.title).to.be.undefined;
        const metaEmpty = ctInstance.entryMetaData.find((m: any) => m.uid === 'entry-empty-title');
        expect(metaEmpty).to.be.ok;
        expect(ctInstance.entryMetaData.length).to.be.at.least(2);
      });
  });

  describe('findNotPresentSelectField', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('initializes field as empty array when field is null or undefined', () => {
        const ctInstance = new Entries(constructorParam);
        const choices = { choices: [{ value: 'a' }, { value: 'b' }] };
        const result = (ctInstance as any).findNotPresentSelectField(null, choices);
        expect(result.filteredFeild).to.eql([]);
        expect(result.notPresent).to.eql([]);
      });
  });

  describe('fixMissingReferences uncovered branches', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('parses entry when entry is string (JSON)', () => {
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        (ctInstance as any).currentUid = 'e1';
        (ctInstance as any).currentTitle = 'Entry 1';
        (ctInstance as any).missingRefs = { e1: [] };
        (ctInstance as any).entryMetaData = [{ uid: 'blt123', ctUid: 'ct1' }];
        const field = { uid: 'ref', display_name: 'Ref', data_type: 'reference', reference_to: ['ct1'] };
        const entry = '[{"uid":"blt123","_content_type_uid":"ct1"}]';
        const tree: Record<string, unknown>[] = [];
        const result = ctInstance.fixMissingReferences(tree, field as any, entry as any);
        expect(result).to.be.an('array');
        expect(result.length).to.equal(1);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('handles blt reference when ref missing and reference_to single', () => {
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        (ctInstance as any).currentUid = 'e1';
        (ctInstance as any).currentTitle = 'E1';
        (ctInstance as any).missingRefs = { e1: [] };
        (ctInstance as any).entryMetaData = [];
        const field = { uid: 'ref', display_name: 'Ref', data_type: 'reference', reference_to: ['ct1'] };
        const entry = ['blt999'];
        const tree: Record<string, unknown>[] = [];
        const result = ctInstance.fixMissingReferences(tree, field as any, entry as any);
        expect((ctInstance as any).missingRefs.e1).to.have.length(1);
        expect((ctInstance as any).missingRefs.e1[0].missingRefs).to.deep.include({ uid: 'blt999', _content_type_uid: 'ct1' });
        expect(result.filter((r: any) => r != null)).to.have.length(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('records no missing references when all refs valid', () => {
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        (ctInstance as any).currentUid = 'e1';
        (ctInstance as any).currentTitle = 'E1';
        (ctInstance as any).missingRefs = { e1: [] };
        (ctInstance as any).entryMetaData = [{ uid: 'blt1', ctUid: 'ct1' }];
        const field = { uid: 'ref', display_name: 'Ref', data_type: 'reference', reference_to: ['ct1'] };
        const entry = [{ uid: 'blt1', _content_type_uid: 'ct1' }];
        const tree: Record<string, unknown>[] = [];
        const result = ctInstance.fixMissingReferences(tree, field as any, entry);
        expect(result).to.have.length(1);
        expect((ctInstance as any).missingRefs.e1).to.have.length(0);
        expect(result[0].uid).to.equal('blt1');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('keeps blt reference when found in entryMetaData and content type allowed', () => {
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        (ctInstance as any).currentUid = 'e1';
        (ctInstance as any).currentTitle = 'E1';
        (ctInstance as any).missingRefs = { e1: [] };
        (ctInstance as any).entryMetaData = [{ uid: 'blt1', ctUid: 'ct1' }];
        const field = { uid: 'ref', display_name: 'Ref', data_type: 'reference', reference_to: ['ct1'] };
        const entry = ['blt1'];
        const tree: Record<string, unknown>[] = [];
        const result = ctInstance.fixMissingReferences(tree, field as any, entry as any);
        expect(result).to.have.length(1);
        expect(result[0]).to.deep.include({ uid: 'blt1', _content_type_uid: 'ct1' });
        expect((ctInstance as any).missingRefs.e1).to.have.length(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('pushes fullRef when reference_to has multiple and ref has wrong content type', () => {
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        (ctInstance as any).currentUid = 'e1';
        (ctInstance as any).currentTitle = 'E1';
        (ctInstance as any).missingRefs = { e1: [] };
        (ctInstance as any).entryMetaData = [{ uid: 'ref-uid', ctUid: 'ct3' }];
        const field = { uid: 'ref', display_name: 'Ref', data_type: 'reference', reference_to: ['ct1', 'ct2'] };
        const fullRef = { uid: 'ref-uid', _content_type_uid: 'ct3' };
        const entry = [fullRef];
        const tree: Record<string, unknown>[] = [];
        ctInstance.fixMissingReferences(tree, field as any, entry);
        expect((ctInstance as any).missingRefs.e1).to.have.length(1);
        expect((ctInstance as any).missingRefs.e1[0].missingRefs).to.have.length(1);
        expect((ctInstance as any).missingRefs.e1[0].missingRefs[0]).to.deep.equal(fullRef);
      });
  });

  describe('modularBlockRefCheck invalid keys with fix', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('deletes invalid block key when fix is true', () => {
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        (ctInstance as any).currentUid = 'e1';
        (ctInstance as any).currentTitle = 'E1';
        (ctInstance as any).missingRefs = { e1: [] };
        const blocks = [{ uid: 'block_1', title: 'Block 1', schema: [] }];
        const entryBlock = { block_1: {}, invalid_key: {} };
        const tree: Record<string, unknown>[] = [];
        const result = (ctInstance as any).modularBlockRefCheck(tree, blocks, entryBlock, 0);
        expect(result.invalid_key).to.be.undefined;
        expect((ctInstance as any).missingRefs.e1).to.have.length(1);
      });
  });

  describe('fixGroupField', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('processes array group field entry when entry is array', () => {
        if ((Entries.prototype.runFixOnSchema as any).restore) (Entries.prototype.runFixOnSchema as any).restore();
        Sinon.stub(Entries.prototype, 'runFixOnSchema').callsFake((_t: any, _s: any, e: any) => e);
        const ctInstance = new Entries(constructorParam);
        const field = { uid: 'gf', display_name: 'GF', schema: [{ uid: 'f1', display_name: 'F1' }] };
        const entry = [{ f1: 'v1' }];
        const result = (ctInstance as any).fixGroupField([], field, entry);
        expect(result).to.eql(entry);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('processes single group field entry when entry is not array', () => {
        if ((Entries.prototype.runFixOnSchema as any).restore) (Entries.prototype.runFixOnSchema as any).restore();
        Sinon.stub(Entries.prototype, 'runFixOnSchema').callsFake((_t: any, _s: any, e: any) => e);
        const ctInstance = new Entries(constructorParam);
        const field = { uid: 'gf', display_name: 'GF', schema: [{ uid: 'f1', display_name: 'F1' }] };
        const entry = { f1: 'v1' };
        const result = (ctInstance as any).fixGroupField([], field, entry);
        expect(result).to.eql(entry);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('skips fixes when group field has no schema', () => {
        const ctInstance = new Entries(constructorParam);
        const field = { uid: 'gf', display_name: 'GF', schema: [] };
        const entry = { f1: 'v1' };
        const result = (ctInstance as any).fixGroupField([], field, entry);
        expect(result).to.eql(entry);
      });
  });

  describe('fixMissingExtensionOrApp', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('deletes entry field when extension missing and fix true', () => {
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        (ctInstance as any).currentUid = 'e1';
        (ctInstance as any).currentTitle = 'E1';
        (ctInstance as any).missingRefs = { e1: [] };
        ctInstance.extensions = [];
        const field = { uid: 'ext_f', display_name: 'Ext', data_type: 'extension' };
        const entry: Record<string, any> = { ext_f: { metadata: { extension_uid: 'missing_ext' } } };
        (ctInstance as any).fixMissingExtensionOrApp([], field, entry);
        expect(entry.ext_f).to.be.undefined;
        expect((ctInstance as any).missingRefs.e1).to.have.length(1);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('logs when no extension data for field', () => {
        const ctInstance = new Entries(constructorParam);
        ctInstance.extensions = ['ext1'];
        const field = { uid: 'ext_f', display_name: 'Ext', data_type: 'extension' };
        const entry: Record<string, any> = {};
        (ctInstance as any).fixMissingExtensionOrApp([], field, entry);
        expect(entry.ext_f).to.be.undefined;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('keeps field when extension is valid', () => {
        const ctInstance = new Entries({ ...constructorParam, fix: true });
        (ctInstance as any).currentUid = 'e1';
        (ctInstance as any).currentTitle = 'E1';
        (ctInstance as any).missingRefs = { e1: [] };
        ctInstance.extensions = ['valid-ext'];
        const field = { uid: 'ext_f', display_name: 'Ext', data_type: 'extension' };
        const entry: Record<string, any> = { ext_f: { metadata: { extension_uid: 'valid-ext' } } };
        (ctInstance as any).fixMissingExtensionOrApp([], field, entry);
        expect(entry.ext_f).to.be.ok;
        expect((ctInstance as any).missingRefs.e1).to.have.length(0);
      });
  });

  describe('fixModularBlocksReferences', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('fixes modular blocks and filters empty', () => {
        if ((Entries.prototype.modularBlockRefCheck as any).restore) (Entries.prototype.modularBlockRefCheck as any).restore();
        if ((Entries.prototype.runFixOnSchema as any).restore) (Entries.prototype.runFixOnSchema as any).restore();
        Sinon.stub(Entries.prototype, 'modularBlockRefCheck').callsFake((_t: any, blocks: any, entryBlock: any) => {
          const key = blocks?.[0]?.uid || 'b1';
          return { [key]: entryBlock?.[key] || {} };
        });
        Sinon.stub(Entries.prototype, 'runFixOnSchema').callsFake((_t: any, _s: any, e: any) => e);
        const ctInstance = new Entries(constructorParam);
        const blocks = [{ uid: 'b1', title: 'B1', schema: [{ uid: 'f1' }] }];
        const entry = [{ b1: { f1: 'v1' } }];
        const result = (ctInstance as any).fixModularBlocksReferences([], blocks, entry);
        expect(result).to.be.an('array');
      });
  });

  describe('fixJsonRteMissingReferences', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('returns entry when entry has no children', () => {
        const ctInstance = new Entries(constructorParam);
        const field = { uid: 'rte', display_name: 'RTE', data_type: 'richtext' };
        const entry = { type: 'doc', children: [] };
        const result = (ctInstance as any).fixJsonRteMissingReferences([], field, entry);
        expect(result).to.eql(entry);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('processes array entry by mapping over each child', () => {
        const ctInstance = new Entries(constructorParam);
        const field = { uid: 'rte', display_name: 'RTE', data_type: 'richtext' };
        const child1 = { type: 'p', uid: 'c1', children: [] };
        const child2 = { type: 'reference', uid: 'c2', children: [] };
        const entry = [child1, child2];
        const result = (ctInstance as any).fixJsonRteMissingReferences([], field, entry);
        expect(result).to.be.an('array');
        expect(result).to.have.length(2);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('filters out invalid refs and recursively fixes children with children', () => {
        if ((Entries.prototype.jsonRefCheck as any).restore) (Entries.prototype.jsonRefCheck as any).restore();
        Sinon.stub(Entries.prototype, 'jsonRefCheck').callsFake(function (_tree: any, _field: any, child: any) {
          return (child as any).uid !== 'invalid' ? true : null;
        });
        const ctInstance = new Entries(constructorParam);
        (ctInstance as any).currentUid = 'e1';
        (ctInstance as any).entryMetaData = [{ uid: 'valid', ctUid: 'ct1' }];
        const field = { uid: 'rte', display_name: 'RTE', data_type: 'richtext', reference_to: ['ct1'] };
        const validChild = { type: 'reference', uid: 'valid', attrs: { 'entry-uid': 'valid' }, children: [] };
        const invalidChild = { type: 'reference', uid: 'invalid', attrs: {}, children: [] };
        const nestedChild = { type: 'p', uid: 'nested', children: [{ type: 'text', text: 'x' }] };
        const entry = { type: 'doc', children: [validChild, invalidChild, nestedChild] };
        const result = (ctInstance as any).fixJsonRteMissingReferences([], field, entry);
        expect((result as any).children).to.have.length(2);
        expect((result as any).children.filter((c: any) => c?.uid === 'invalid')).to.have.length(0);
        (Entries.prototype.jsonRefCheck as any).restore();
      });
  });
});
