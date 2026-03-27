import fs from 'fs';
import { join, resolve } from 'path';
import { fancy } from 'fancy-test';
import { expect } from 'chai';
import cloneDeep from 'lodash/cloneDeep';
import { ux, cliux } from '@contentstack/cli-utilities';
import sinon from 'sinon';

import config from '../../../src/config';
import { Workflows } from '../../../src/modules';
import { $t, auditMsg } from '../../../src/messages';
import { values } from 'lodash';
import { mockLogger } from '../mock-logger';

describe('Workflows', () => {
  beforeEach(() => {
    // Mock the logger for all tests
    sinon.stub(require('@contentstack/cli-utilities'), 'log').value(mockLogger);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('validateModules', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('returns default workflows when moduleName not in moduleConfig', () => {
        const wf = new Workflows({
          moduleName: 'workflows' as any,
          ctSchema: [],
          config: Object.assign(config, { basePath: resolve(__dirname, '..', 'mock', 'contents'), flags: {} }),
        });
        const result = (wf as any).validateModules('invalid-module' as any, config.moduleConfig);
        expect(result).to.equal('workflows');
      });
  });

  describe('run method with invalid path for workflows', () => {
    const wf = new Workflows({
      moduleName: 'workflows',
      ctSchema: cloneDeep(require('./../mock/contents/workflows/ctSchema.json')),
      config: Object.assign(config, { basePath: resolve(__dirname, '..', 'mock', 'workflows'), flags: {} }),
    });
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ux, 'confirm', async () => true)
      .it('Should Validate the base path for workflows', async () => {
        try {
          await wf.run();
        } catch (error: any) {
          expect(error).to.be.instanceOf(Error);
          expect(error.message).to.eql($t(auditMsg.NOT_VALID_PATH, { path: wf.folderPath }));
        }
      });
  });
  describe('run method with valid path for workflows and ctSchema', () => {
    const wf = new Workflows({
      moduleName: 'workflows',
      ctSchema: cloneDeep(require('./../mock/contents/workflows/ctSchema.json')),
      config: Object.assign(config, {
        basePath: resolve(`./test/unit/mock/contents/`),
        flags: {},
      }),
    });
    fancy
      .stdout({ print: process.env.PRINT === 'true' || true })
      .stub(ux, 'confirm', async () => true)
      .it(
        'should expect missingRefs equal to workflow which has missing refs, missingCts equal to missing Cts',
        async () => {
          wf.config.branch = 'development';
          const missingRefs = await wf.run();
          expect(wf.workflowSchema).eql(values(JSON.parse(fs.readFileSync(wf.workflowPath, 'utf8'))));
          expect(missingRefs).eql([
            {
              name: 'wf1',
              uid: 'wf1',
              org_uid: 'org1',
              api_key: 'apiKey',
              content_types: ['ct45', 'ct14'],
              enabled: false,
              deleted_at: false,
            },
            {
              name: 'wf3',
              uid: 'wf3',
              org_uid: 'org1',
              api_key: 'apiKey',
              content_types: ['ct6'],
              enabled: false,
              deleted_at: false,
            },
            {
              api_key: 'apiKey',
              branches: ['main', 'stage'],
              content_types: [],
              deleted_at: false,
              enabled: false,
              name: 'wf5',
              org_uid: 'org1',
              uid: 'wf5',
            },
          ]);
          expect(wf.missingCts).eql(new Set(['ct45', 'ct14', 'ct6']));
        },
      );
  });

  describe('run method with totalCount', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('creates progress when totalCount is provided', async () => {
        const wf = new Workflows({
          moduleName: 'workflows',
          ctSchema: cloneDeep(require('../mock/contents/workflows/ctSchema.json')),
          config: Object.assign(config, {
            basePath: resolve(__dirname, '..', 'mock', 'contents'),
            flags: {},
          }),
        });
        const createProgress = sinon.spy(wf as any, 'createSimpleProgress');
        await wf.run(5);
        expect(createProgress.calledWith('workflows', 5)).to.be.true;
      });
  });

  describe('run method with no branch config', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('runs and hits no branch configuration path', async () => {
        const wf = new Workflows({
          moduleName: 'workflows',
          ctSchema: cloneDeep(require('../mock/contents/workflows/ctSchema.json')),
          config: Object.assign(config, {
            basePath: resolve(__dirname, '..', 'mock', 'contents'),
            flags: {},
            branch: undefined,
          }),
        });
        const result = await wf.run();
        expect(result).to.be.an('array');
      });
  });

  describe('run method throws', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('completeProgress false and rethrows when run throws', async () => {
        const wf = new Workflows({
          moduleName: 'workflows',
          ctSchema: cloneDeep(require('../mock/contents/workflows/ctSchema.json')),
          config: Object.assign(config, {
            basePath: resolve(__dirname, '..', 'mock', 'contents'),
            flags: {},
          }),
        });
        sinon.stub(fs, 'readFileSync').throws(new Error('read failed'));
        const completeProgress = sinon.spy(wf as any, 'completeProgress');
        try {
          await wf.run();
        } catch (e: any) {
          expect(completeProgress.calledWith(false, 'read failed')).to.be.true;
          expect(e.message).to.equal('read failed');
        } finally {
          (fs.readFileSync as any).restore?.();
        }
      });
  });

  describe('run method with audit fix for workflows with valid path and empty ctSchema', () => {
    const wf = new Workflows({
      moduleName: 'workflows',
      ctSchema: cloneDeep(require('./../mock/contents/workflows/ctSchema.json')),
      config: Object.assign(config, {
        basePath: resolve(`./test/unit/mock/contents/`),
        flags: {},
      }),
      fix: true,
    });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || true })
      .stub(wf, 'log', async () => {})
      .stub(ux, 'confirm', async () => true)
      .stub(wf, 'WriteFileSync', () => {})
      .stub(wf, 'writeFixContent', () => {})
      .it('the run function should run and flow should go till fixWorkflowSchema', async () => {
        wf.config.branch = 'development';
        const fixedReference = await wf.run();
        expect(fixedReference).eql([
          {
            name: 'wf1',
            uid: 'wf1',
            org_uid: 'org1',
            api_key: 'apiKey',
            content_types: ['ct45', 'ct14'],
            enabled: false,
            deleted_at: false,
            fixStatus: 'Fixed',
          },
          {
            name: 'wf3',
            uid: 'wf3',
            org_uid: 'org1',
            api_key: 'apiKey',
            content_types: ['ct6'],
            enabled: false,
            deleted_at: false,
            fixStatus: 'Fixed',
          },
          {
            api_key: 'apiKey',
            branches: ['main', 'stage'],
            content_types: [],
            deleted_at: false,
            enabled: false,
            fixStatus: 'Fixed',
            name: 'wf5',
            org_uid: 'org1',
            uid: 'wf5',
          },
        ]);
      });
  });

  describe('fixWorkflowSchema', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(cliux, 'confirm', async () => true)
      .it('hits no branch configuration when config.branch is missing', async () => {
        const wf = new Workflows({
          moduleName: 'workflows',
          ctSchema: cloneDeep(require('../mock/contents/workflows/ctSchema.json')),
          config: Object.assign(config, {
            basePath: resolve(__dirname, '..', 'mock', 'contents'),
            flags: {},
            branch: undefined,
          }),
          fix: true,
        });
        wf.workflowPath = join(resolve(__dirname, '..', 'mock', 'contents'), 'workflows', 'workflows.json');
        wf.workflowSchema = values(JSON.parse(fs.readFileSync(wf.workflowPath, 'utf8')));
        wf.missingCts = new Set(['ct45', 'ct14']);
        const writeStub = sinon.stub(wf, 'writeFixContent').resolves();
        await (wf as any).fixWorkflowSchema();
        expect(writeStub.called).to.be.true;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(cliux, 'confirm', async () => true)
      .it('deletes workflow when no valid content types and user confirms', async () => {
        const wf = new Workflows({
          moduleName: 'workflows',
          ctSchema: [],
          config: Object.assign(config, {
            basePath: resolve(__dirname, '..', 'mock', 'contents'),
            flags: {},
          }),
          fix: true,
        });
        wf.workflowSchema = [{ uid: 'orphan', name: 'Orphan', content_types: ['ct-missing'], branches: [] } as any];
        wf.missingCts = new Set(['ct-missing']);
        sinon.stub(fs, 'existsSync').returns(true);
        sinon.stub(fs, 'readFileSync').returns(JSON.stringify({ orphan: { uid: 'orphan', name: 'Orphan', content_types: ['ct-missing'] } }));
        const writeStub = sinon.stub(wf, 'writeFixContent').resolves();
        await (wf as any).fixWorkflowSchema();
        expect(writeStub.called).to.be.true;
        const writeArg = writeStub.firstCall.args[0];
        expect(writeArg.orphan).to.be.undefined;
        (fs.existsSync as any).restore?.();
        (fs.readFileSync as any).restore?.();
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(cliux, 'confirm', async () => true)
      .it('fixWorkflowSchema asks for confirmation once when multiple workflows would be deleted', async () => {
        const wf = new Workflows({
          moduleName: 'workflows',
          ctSchema: [],
          config: Object.assign(config, {
            basePath: resolve(__dirname, '..', 'mock', 'contents'),
            flags: {},
          }),
          fix: true,
        });
        wf.workflowSchema = [
          { uid: 'orphan1', name: 'Orphan 1', content_types: ['ct-missing'], branches: [] } as any,
          { uid: 'orphan2', name: 'Orphan 2', content_types: ['ct-missing'], branches: [] } as any,
        ];
        wf.missingCts = new Set(['ct-missing']);
        sinon.stub(fs, 'existsSync').returns(true);
        sinon.stub(fs, 'readFileSync').returns(
          JSON.stringify({
            orphan1: { uid: 'orphan1', name: 'Orphan 1', content_types: ['ct-missing'] },
            orphan2: { uid: 'orphan2', name: 'Orphan 2', content_types: ['ct-missing'] },
          }),
        );
        const confirmStub = sinon.stub(cliux, 'confirm').resolves(true);
        sinon.stub(wf, 'writeFixContent').resolves();
        await (wf as any).fixWorkflowSchema();
        expect(confirmStub.callCount).to.equal(1);
        (fs.existsSync as any).restore?.();
        (fs.readFileSync as any).restore?.();
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(cliux, 'confirm', async () => false)
      .it('keeps workflow when no valid content types and user declines', async () => {
        const wf = new Workflows({
          moduleName: 'workflows',
          ctSchema: [],
          config: Object.assign(config, { basePath: resolve(__dirname, '..', 'mock', 'contents'), flags: {} }),
          fix: true,
        });
        wf.workflowSchema = [{ uid: 'keep', name: 'Keep', content_types: ['ct-missing'], branches: [] } as any];
        wf.missingCts = new Set(['ct-missing']);
        sinon.stub(fs, 'existsSync').returns(true);
        sinon.stub(fs, 'readFileSync').returns(JSON.stringify({ keep: { uid: 'keep', name: 'Keep', content_types: ['ct-missing'] } }));
        const writeStub = sinon.stub(wf, 'writeFixContent').resolves();
        await (wf as any).fixWorkflowSchema();
        expect(writeStub.called).to.be.true;
        expect(writeStub.firstCall.args[0].keep).to.be.ok;
        (fs.existsSync as any).restore?.();
        (fs.readFileSync as any).restore?.();
      });
  });

  describe('writeFixContent', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(cliux, 'confirm', async () => true)
      .it('writes file when fix true and user confirms', async () => {
        const wf = new Workflows({
          moduleName: 'workflows',
          ctSchema: [],
          config: Object.assign(config, {
            basePath: resolve(__dirname, '..', 'mock', 'contents'),
            flags: {},
          }),
          fix: true,
        });
        const writeStub = sinon.stub(fs, 'writeFileSync');
        await (wf as any).writeFixContent({ wf1: {} });
        expect(writeStub.called).to.be.true;
        writeStub.restore();
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('skips write when fix is false', async () => {
        const wf = new Workflows({
          moduleName: 'workflows',
          ctSchema: [],
          config: Object.assign(config, {
            basePath: resolve(__dirname, '..', 'mock', 'contents'),
            flags: {},
          }),
          fix: false,
        });
        const writeStub = sinon.stub(fs, 'writeFileSync');
        await (wf as any).writeFixContent({ wf1: {} });
        expect(writeStub.called).to.be.false;
        writeStub.restore();
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('writes when fix true and copy-dir flag set', async () => {
        const wf = new Workflows({
          moduleName: 'workflows',
          ctSchema: [],
          config: Object.assign(config, {
            basePath: resolve(__dirname, '..', 'mock', 'contents'),
            flags: { 'copy-dir': true },
          }),
          fix: true,
        });
        const writeStub = sinon.stub(fs, 'writeFileSync');
        await (wf as any).writeFixContent({ wf1: {} });
        expect(writeStub.called).to.be.true;
        writeStub.restore();
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('writeFixContent does not prompt when preConfirmed is true', async () => {
        const wf = new Workflows({
          moduleName: 'workflows',
          ctSchema: [],
          config: Object.assign(config, {
            basePath: resolve(__dirname, '..', 'mock', 'contents'),
            flags: {},
          }),
          fix: true,
        });
        const writeStub = sinon.stub(fs, 'writeFileSync');
        const confirmStub = sinon.stub(cliux, 'confirm');
        await (wf as any).writeFixContent({ wf1: {} }, true);
        expect(writeStub.called).to.be.true;
        expect(confirmStub.called).to.be.false;
        writeStub.restore();
      });
  });
});
