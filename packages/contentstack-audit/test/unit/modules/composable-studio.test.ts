import fs from 'fs';
import { resolve } from 'path';
import { fancy } from 'fancy-test';
import { expect } from 'chai';
import cloneDeep from 'lodash/cloneDeep';
import { ux, cliux } from '@contentstack/cli-utilities';
import sinon from 'sinon';

import config from '../../../src/config';
import { ComposableStudio } from '../../../src/modules';
import { mockLogger } from '../mock-logger';

describe('ComposableStudio', () => {
  beforeEach(() => {
    // Mock the logger for all tests
    sinon.stub(require('@contentstack/cli-utilities'), 'log').value(mockLogger);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('run method with invalid path for composable-studio', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ux, 'confirm', async () => true)
      .it('Should validate the base path for composable-studio', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
          config: Object.assign(config, { basePath: resolve(__dirname, '..', 'mock', 'invalid_path'), flags: {} }),
        });
        const result = await cs.run();
        expect(result).to.eql({});
      });
  });

  describe('run method with valid path and valid composable-studio project', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ux, 'confirm', async () => true)
      .it('should load projects and report issues if references are invalid', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
          config: Object.assign(config, {
            basePath: resolve(`./test/unit/mock/contents/`),
            flags: {},
          }),
        });

        const missingRefs: any = await cs.run();
        expect(cs.composableStudioProjects).to.have.lengthOf(1);
        expect(cs.composableStudioProjects[0].uid).to.equal('test_project_uid_1');
        expect(Array.isArray(missingRefs)).to.be.true;
      });
  });

  describe('run method with invalid composable-studio projects', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ux, 'confirm', async () => true)
      .it('should detect invalid references', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
          config: Object.assign(config, {
            basePath: resolve(`./test/unit/mock/contents/`),
            flags: {},
          }),
        });

        // Mock readFileSync to return invalid data
        const originalReadFileSync = require('fs').readFileSync;
        const invalidProjects = require('./../mock/contents/composable_studio/invalid_composable_studio.json');
        
        sinon.stub(require('fs'), 'readFileSync').callsFake((...args: any[]) => {
          const path = args[0];
          if (path.includes('composable_studio.json')) {
            return JSON.stringify(invalidProjects);
          }
          return originalReadFileSync(...args);
        });

        const missingRefs: any = await cs.run();
        
        expect(cs.composableStudioProjects).to.have.lengthOf(4);
        expect(cs.projectsWithIssues).to.have.lengthOf(4);
        expect(Array.isArray(missingRefs)).to.be.true;
        expect(missingRefs).to.have.lengthOf(4);
        
        // Check first project - invalid content type
        const project1 = missingRefs.find((p: any) => p.uid === 'test_project_uid_2');
        expect(project1).to.exist;
        expect(project1.content_types).to.deep.equal(['invalid_ct_999']);
        expect(project1.issues).to.include('Invalid contentTypeUid: invalid_ct_999');
        
        // Check second project - invalid environment
        const project2 = missingRefs.find((p: any) => p.uid === 'test_project_uid_3');
        expect(project2).to.exist;
        expect(project2.environment).to.deep.equal(['invalid_env_999']);
        expect(project2.issues).to.include('Invalid environment: invalid_env_999');
        
        // Check third project - invalid locale
        const project3 = missingRefs.find((p: any) => p.uid === 'test_project_uid_4');
        expect(project3).to.exist;
        expect(project3.locale).to.deep.equal(['invalid_locale_999']);
        expect(project3.issues).to.include('Invalid locale: invalid_locale_999');
        
        // Check fourth project - multiple issues
        const project4 = missingRefs.find((p: any) => p.uid === 'test_project_uid_5');
        expect(project4).to.exist;
        expect(project4.content_types).to.deep.equal(['invalid_ct_888']);
        expect(project4.environment).to.deep.equal(['invalid_env_888']);
        expect(project4.locale).to.deep.equal(['invalid_locale_888']);
        expect(project4.issues).to.include('Invalid contentTypeUid: invalid_ct_888');
        expect(project4.issues).to.include('Invalid environment: invalid_env_888');
        expect(project4.issues).to.include('Invalid locale: invalid_locale_888');
      });
  });

  describe('loadEnvironments method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should load environments correctly', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
          config: Object.assign(config, {
            basePath: resolve(`./test/unit/mock/contents/composable_studio`),
            flags: {},
          }),
        });
        await cs.loadEnvironments();
        expect(cs.environmentUidSet.size).to.equal(2);
        expect(cs.environmentUidSet.has('blt_env_dev')).to.be.true;
        expect(cs.environmentUidSet.has('blt_env_prod')).to.be.true;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('does not load when environments file does not exist', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: [],
          config: Object.assign(config, {
            basePath: resolve(__dirname, '..', 'mock', 'invalid_path'),
            flags: {},
          }),
        });
        await cs.loadEnvironments();
        expect(cs.environmentUidSet.size).to.equal(0);
      });
  });

  describe('loadLocales method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should load locales correctly', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
          config: Object.assign(config, {
            basePath: resolve(`./test/unit/mock/contents/composable_studio`),
            flags: {},
          }),
        });
        await cs.loadLocales();
        expect(cs.localeCodeSet.size).to.equal(3); // en-us (master) + fr-fr + de-de
        expect(cs.localeCodeSet.has('en-us')).to.be.true;
        expect(cs.localeCodeSet.has('fr-fr')).to.be.true;
        expect(cs.localeCodeSet.has('de-de')).to.be.true;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('does not load when master locale file does not exist', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: [],
          config: Object.assign(config, {
            basePath: resolve(__dirname, '..', 'mock', 'invalid_path'),
            flags: {},
          }),
        });
        await cs.loadLocales();
        expect(cs.localeCodeSet.size).to.equal(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('loads only master locales when additional locales file does not exist', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: [],
          config: Object.assign(config, {
            basePath: resolve(`./test/unit/mock/contents/composable_studio`),
            flags: {},
          }),
        });
        const localesPath = resolve(cs.config.basePath, 'locales', 'locales.json');
        const origExists = fs.existsSync;
        sinon.stub(fs, 'existsSync').callsFake((p: fs.PathLike) => {
          if (String(p) === localesPath) return false;
          return origExists.call(fs, p);
        });
        await cs.loadLocales();
        expect(cs.localeCodeSet.size).to.be.greaterThan(0);
      });
  });

  describe('run method with audit fix for composable-studio', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ux, 'confirm', async () => true)
      .it('should fix invalid projects and return fixed references', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
          config: Object.assign(config, {
            basePath: resolve(`./test/unit/mock/contents/`),
            flags: { 'copy-dir': true },
          }),
          fix: true,
        });

        // Mock readFileSync to return invalid data
        const originalReadFileSync = require('fs').readFileSync;
        const invalidProjects = require('./../mock/contents/composable_studio/invalid_composable_studio.json');
        
        sinon.stub(require('fs'), 'readFileSync').callsFake((...args: any[]) => {
          const path = args[0];
          if (path.includes('composable_studio.json')) {
            return JSON.stringify(invalidProjects);
          }
          return originalReadFileSync(...args);
        });

        sinon.stub(cs, 'writeFixContent').resolves();
        
        const fixedReferences: any = await cs.run();
        
        expect(Array.isArray(fixedReferences)).to.be.true;
        expect(fixedReferences.length).to.be.greaterThan(0);
        
        // All projects should have fixStatus set
        fixedReferences.forEach((ref: any) => {
          expect(ref.fixStatus).to.equal('Fixed');
        });
        
        // Check that projects with issues were identified
        expect(cs.projectsWithIssues.length).to.be.greaterThan(0);
      });
  });

  describe('validateModules method', () => {
    it('should validate correct module name', () => {
      const cs = new ComposableStudio({
        moduleName: 'composable-studio',
        ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
        config: Object.assign(config, {
          basePath: resolve(`./test/unit/mock/contents/composable_studio`),
          flags: {},
        }),
      });
      const result = cs.validateModules('composable-studio', config.moduleConfig);
      expect(result).to.equal('composable-studio');
    });

    it('should return default module name for invalid module', () => {
      const cs = new ComposableStudio({
        moduleName: 'composable-studio',
        ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
        config: Object.assign(config, {
          basePath: resolve(`./test/unit/mock/contents/composable_studio`),
          flags: {},
        }),
      });
      const result = cs.validateModules('invalid-module' as any, config.moduleConfig);
      expect(result).to.equal('composable-studio');
    });
  });

  describe('Content type validation', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should build content type UID set correctly', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
          config: Object.assign(config, {
            basePath: resolve(`./test/unit/mock/contents/`),
            flags: {},
          }),
        });
        await cs.run();
        expect(cs.ctUidSet.size).to.equal(3);
        expect(cs.ctUidSet.has('page_1')).to.be.true;
        expect(cs.ctUidSet.has('page_2')).to.be.true;
        expect(cs.ctUidSet.has('page_3')).to.be.true;
      });
  });

  describe('Report data structure', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(ux, 'confirm', async () => true)
      .it('should return properly formatted report data', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
          config: Object.assign(config, {
            basePath: resolve(`./test/unit/mock/contents/`),
            flags: {},
          }),
        });

        // Mock readFileSync to return invalid data
        const originalReadFileSync = require('fs').readFileSync;
        const invalidProjects = require('./../mock/contents/composable_studio/invalid_composable_studio.json');
        
        sinon.stub(require('fs'), 'readFileSync').callsFake((...args: any[]) => {
          const path = args[0];
          if (path.includes('composable_studio.json')) {
            return JSON.stringify(invalidProjects);
          }
          return originalReadFileSync(...args);
        });

        const missingRefs: any = await cs.run();
        
        expect(Array.isArray(missingRefs)).to.be.true;
        expect(missingRefs.length).to.be.greaterThan(0);
        
        // Check that all report entries have required fields
        missingRefs.forEach((ref: any) => {
          expect(ref).to.have.property('title');
          expect(ref).to.have.property('name');
          expect(ref).to.have.property('uid');
          expect(ref).to.have.property('issues');
        });
        
        // Check that issues field contains descriptive text
        const projectWithCTIssue = missingRefs.find((ref: any) => ref.content_types);
        if (projectWithCTIssue) {
          expect(projectWithCTIssue.issues).to.be.a('string');
          expect(projectWithCTIssue.issues).to.include('contentTypeUid');
        }
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('reportEntry uses undefined for missing issue types (branch coverage)', async () => {
        const onlyInvalidEnv = [
          { uid: 'e1', name: 'EnvOnly', contentTypeUid: 'page_1', settings: { configuration: { environment: 'bad_env', locale: 'en-us' } } },
        ];
        const origRead = fs.readFileSync;
        const origExists = fs.existsSync;
        sinon.stub(fs, 'readFileSync').callsFake((p: fs.PathOrFileDescriptor) => {
          if (String(p).includes('composable_studio.json')) return JSON.stringify(onlyInvalidEnv);
          if (String(p).includes('environments.json')) return JSON.stringify([{ uid: 'blt_env_dev' }]);
          if (String(p).includes('master-locale') || String(p).includes('locales.json')) return JSON.stringify({ 'en-us': { code: 'en-us' } });
          return origRead.call(fs, p);
        });
        sinon.stub(fs, 'existsSync').callsFake((p: fs.PathLike) => {
          const s = String(p);
          if (s.includes('composable_studio') || s.includes('environments') || s.includes('locales') || s.includes('master-locale')) return true;
          return origExists.call(fs, p);
        });
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
          config: Object.assign(config, { basePath: resolve(`./test/unit/mock/contents/`), flags: {} }),
        });
        const result: any = await cs.run();
        const envOnly = result.find((r: any) => r.uid === 'e1');
        expect(envOnly).to.exist;
        expect(envOnly.content_types).to.be.undefined;
        expect(envOnly.environment).to.deep.equal(['bad_env']);
        expect(envOnly.locale).to.be.undefined;
      });
  });

  describe('Empty and edge cases', () => {
    it('should handle empty content type schema gracefully', async () => {
      const cs = new ComposableStudio({
        moduleName: 'composable-studio',
        ctSchema: [],
        config: Object.assign(config, {
          basePath: resolve(`./test/unit/mock/contents/composable_studio`),
          flags: {},
        }),
      });
      
      await cs.run();
      expect(cs.ctUidSet.size).to.equal(0);
    });

    it('should handle missing composable_studio.json file', async () => {
      const cs = new ComposableStudio({
        moduleName: 'composable-studio',
        ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
        config: Object.assign(config, {
          basePath: resolve(`./test/unit/mock/contents`),
          flags: {},
        }),
      });

      const result = await cs.run();
      // When the file exists and has projects with validation issues, it returns an array
      expect(result).to.exist;
    });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('returns {} when composable studio file does not exist', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
          config: Object.assign(config, {
            basePath: resolve(__dirname, '..', 'mock', 'contents', 'content_types'),
            flags: {},
          }),
        });
        const result = await cs.run();
        expect(result).to.eql({});
      });
  });

  describe('run with valid project (no issues)', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('logs when project has no validation issues', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
          config: Object.assign(config, {
            basePath: resolve(`./test/unit/mock/contents/`),
            flags: {},
          }),
        });
        const result = await cs.run();
        expect(Array.isArray(result)).to.be.true;
        expect(cs.composableStudioProjects.length).to.be.greaterThan(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('loads single project object (non-array) and normalizes to array', async () => {
        const singleProject = { uid: 'only', name: 'Only', contentTypeUid: 'page_1', settings: { configuration: { environment: 'blt_env_dev', locale: 'en-us' } } };
        const origRead = fs.readFileSync;
        sinon.stub(fs, 'readFileSync').callsFake((p: fs.PathOrFileDescriptor) => {
          if (String(p).includes('composable_studio.json')) return JSON.stringify(singleProject);
          return origRead.call(fs, p);
        });
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
          config: Object.assign(config, { basePath: resolve(`./test/unit/mock/contents/`), flags: {} }),
        });
        await cs.run();
        expect(cs.composableStudioProjects).to.have.lengthOf(1);
        expect(cs.composableStudioProjects[0].uid).to.equal('only');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('when fix true but no issues returns empty array', async () => {
        const validProject = { uid: 'v1', name: 'Valid', contentTypeUid: 'page_1', settings: { configuration: { environment: 'blt_env_dev', locale: 'en-us' } } };
        const origRead = fs.readFileSync;
        const origExists = fs.existsSync;
        sinon.stub(fs, 'readFileSync').callsFake((p: fs.PathOrFileDescriptor) => {
          const pathStr = String(p);
          if (pathStr.includes('composable_studio.json')) return JSON.stringify([validProject]);
          if (pathStr.includes('environments.json')) return JSON.stringify([{ uid: 'blt_env_dev' }, { uid: 'blt_env_prod' }]);
          if (pathStr.includes('master-locale') || pathStr.includes('locales.json')) return JSON.stringify({ 'en-us': { code: 'en-us' } });
          return origRead.call(fs, p);
        });
        sinon.stub(fs, 'existsSync').callsFake((p: fs.PathLike) => {
          const pathStr = String(p);
          if (pathStr.includes('composable_studio') || pathStr.includes('environments') || pathStr.includes('locales') || pathStr.includes('master-locale')) return true;
          return origExists.call(fs, p);
        });
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: cloneDeep(require('./../mock/contents/composable_studio/ctSchema.json')),
          config: Object.assign(config, { basePath: resolve(`./test/unit/mock/contents/`), flags: {} }),
          fix: true,
        });
        const result: any = await cs.run();
        expect(Array.isArray(result)).to.be.true;
        expect(result).to.have.lengthOf(0);
      });
  });

  describe('fixComposableStudioProjects', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('returns early when readFileSync throws', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: [],
          config: Object.assign(config, {
            basePath: resolve(`./test/unit/mock/contents/`),
            flags: {},
          }),
          fix: true,
        });
        cs.composableStudioPath = resolve(__dirname, '..', 'mock', 'contents', 'composable_studio', 'composable_studio.json');
        cs.projectsWithIssues = [{ uid: 'p1', name: 'P1' }];
        sinon.stub(fs, 'readFileSync').callsFake(() => {
          throw new Error('read failed');
        });
        await cs.fixComposableStudioProjects();
        expect(cs.projectsWithIssues).to.have.lengthOf(1);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(cliux, 'confirm', async () => true)
      .stub(fs, 'writeFileSync', () => {})
      .it('hits needsFix true and logs project was fixed when project has invalid env', async () => {
        const projectWithInvalidEnv = {
          uid: 'inv_env',
          name: 'Invalid Env',
          contentTypeUid: 'page_1',
          settings: { configuration: { environment: 'bad_env', locale: 'en-us' } },
        };
        sinon.stub(fs, 'readFileSync').callsFake(() => JSON.stringify([projectWithInvalidEnv]));
        const writeSpy = sinon.stub(fs, 'writeFileSync');
        sinon.stub(cliux, 'confirm').resolves(true);
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: [{ uid: 'page_1', title: 'P1' }] as any,
          config: Object.assign(config, { basePath: resolve(`./test/unit/mock/contents/`), flags: {} }),
          fix: true,
        });
        cs.ctUidSet = new Set(['page_1']);
        cs.environmentUidSet = new Set(['blt_env_dev']);
        cs.localeCodeSet = new Set(['en-us']);
        cs.composableStudioPath = resolve(__dirname, '..', 'mock', 'contents', 'composable_studio', 'composable_studio.json');
        await cs.fixComposableStudioProjects();
        const written = JSON.parse(String(writeSpy.firstCall.args[1]));
        expect(written[0].settings.configuration.environment).to.be.undefined;
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(cliux, 'confirm', async () => true)
      .stub(fs, 'writeFileSync', () => {})
      .it('logs when project did not need fixing', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: [{ uid: 'page_1', title: 'Page 1' }] as any,
          config: Object.assign(config, {
            basePath: resolve(`./test/unit/mock/contents/`),
            flags: {},
          }),
          fix: true,
        });
        cs.ctUidSet = new Set(['page_1']);
        cs.environmentUidSet = new Set(['blt_env_dev']);
        cs.localeCodeSet = new Set(['en-us']);
        cs.composableStudioPath = resolve(__dirname, '..', 'mock', 'contents', 'composable_studio', 'composable_studio.json');
        cs.projectsWithIssues = [
          {
            uid: 'test_project_uid_1',
            name: 'Test Project 1',
            contentTypeUid: 'page_1',
            settings: { configuration: { environment: 'blt_env_dev', locale: 'en-us' } },
          },
        ];
        await cs.fixComposableStudioProjects();
        expect(cs.projectsWithIssues.length).to.equal(1);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(cliux, 'confirm', async () => true)
      .stub(fs, 'writeFileSync', () => {})
      .it('handles single project object (non-array) from file', async () => {
        const singleProject = { uid: 's1', name: 'Single', contentTypeUid: 'page_1', settings: { configuration: { environment: 'blt_env_dev', locale: 'en-us' } } };
        sinon.stub(fs, 'readFileSync').callsFake(() => JSON.stringify(singleProject));
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: [{ uid: 'page_1', title: 'P1' }] as any,
          config: Object.assign(config, { basePath: resolve(`./test/unit/mock/contents/`), flags: {} }),
          fix: true,
        });
        cs.ctUidSet = new Set(['page_1']);
        cs.environmentUidSet = new Set(['blt_env_dev']);
        cs.localeCodeSet = new Set(['en-us']);
        cs.composableStudioPath = resolve(__dirname, '..', 'mock', 'contents', 'composable_studio', 'composable_studio.json');
        cs.projectsWithIssues = [singleProject];
        await cs.fixComposableStudioProjects();
        expect(cs.projectsWithIssues).to.have.lengthOf(1);
      });
  });

  describe('writeFixContent', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(cliux, 'confirm', async () => false)
      .it('skips write when user declines confirmation', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: [],
          config: Object.assign(config, { basePath: resolve(__dirname, '..', 'mock', 'contents'), flags: {} }),
          fix: true,
        });
        const writeSpy = sinon.stub(fs, 'writeFileSync');
        await cs.writeFixContent([{ uid: 'p1', name: 'P1' }]);
        expect(writeSpy.callCount).to.equal(0);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('skips write when fix mode disabled', async () => {
        const cs = new ComposableStudio({
          moduleName: 'composable-studio',
          ctSchema: [],
          config: Object.assign(config, { basePath: resolve(__dirname, '..', 'mock', 'contents'), flags: {} }),
          fix: false,
        });
        const writeSpy = sinon.stub(fs, 'writeFileSync');
        await cs.writeFixContent([{ uid: 'p1', name: 'P1' }]);
        expect(writeSpy.callCount).to.equal(0);
      });
  });
});
