import { expect } from 'chai';
import * as path from 'path';
import { createRequire } from 'module';
import sinon from 'sinon';
import { Command as CsCommand } from '@contentstack/cli-command';
import * as cliUtilities from '@contentstack/cli-utilities';
import ExportToCsv from '../../../src/commands/cm/export-to-csv';
import { messages } from '../../../src/messages';

const nodeRequire = createRequire(path.join(__dirname, 'export-to-csv.test.ts'));
const cliUtilsPath = nodeRequire.resolve('@contentstack/cli-utilities');
const exportCmdPath = nodeRequire.resolve('../../../src/commands/cm/export-to-csv');

function getCliUtilsCacheEntry(): NodeModule {
  return nodeRequire.cache[cliUtilsPath] as NodeModule;
}

function patchCliUtilities(partial: Record<string, unknown>): () => void {
  const entry = getCliUtilsCacheEntry();
  const baseline = entry.exports as typeof cliUtilities;
  const fake = Object.assign({}, baseline, partial) as typeof cliUtilities;
  entry.exports = fake as any;
  delete nodeRequire.cache[exportCmdPath];
  return () => {
    entry.exports = baseline as any;
    delete nodeRequire.cache[exportCmdPath];
  };
}

function loadExportCommand(): typeof ExportToCsv {
  return nodeRequire(exportCmdPath).default;
}

function reloadUtilsAndCommand(): void {
  delete nodeRequire.cache[exportCmdPath];
}

function baseFlags(over: Record<string, unknown> = {}) {
  return {
    action: undefined as string | undefined,
    alias: undefined as string | undefined,
    org: undefined,
    'org-name': undefined,
    'stack-name': undefined,
    'stack-api-key': undefined,
    locale: undefined,
    'content-type': undefined,
    branch: undefined,
    'team-uid': undefined,
    'taxonomy-uid': undefined,
    'include-fallback': false,
    'fallback-locale': undefined,
    delimiter: ',',
    ...over,
  };
}

const minimalConfig = { bin: 'csdx', root: process.cwd() } as any;

describe('cm:export-to-csv', () => {
  describe('command scaffolding', () => {
    it('should have the command file in place', () => {
      expect(ExportToCsv).to.exist;
      expect(ExportToCsv.description).to.be.a('string');
    });

    it('should have all expected flags defined', () => {
      const flagNames = Object.keys(ExportToCsv.flags);

      expect(flagNames).to.include('action');
      expect(flagNames).to.include('alias');
      expect(flagNames).to.include('org');
      expect(flagNames).to.include('stack-name');
      expect(flagNames).to.include('stack-api-key');
      expect(flagNames).to.include('org-name');
      expect(flagNames).to.include('locale');
      expect(flagNames).to.include('content-type');
      expect(flagNames).to.include('branch');
      expect(flagNames).to.include('team-uid');
      expect(flagNames).to.include('taxonomy-uid');
      expect(flagNames).to.include('include-fallback');
      expect(flagNames).to.include('fallback-locale');
      expect(flagNames).to.include('delimiter');
    });

    it('should have correct command description', () => {
      expect(ExportToCsv.description).to.include('Export');
      expect(ExportToCsv.description).to.include('csv');
    });

    it('should have examples defined', () => {
      expect(ExportToCsv.examples).to.be.an('array');
      expect(ExportToCsv.examples.length).to.be.greaterThan(0);
    });

    it('should have correct flag defaults', () => {
      const flags = ExportToCsv.flags;

      // include-fallback should default to false
      expect(flags['include-fallback'].default).to.equal(false);

      // delimiter should default to comma
      expect(flags['delimiter'].default).to.equal(',');
    });

    it('should have action flag with correct options', () => {
      const actionFlag = ExportToCsv.flags['action'] as { options?: string[] };
      expect(actionFlag.options).to.deep.equal(['entries', 'users', 'teams', 'taxonomies']);
    });
  });

  describe('command helpers', () => {
    let sandbox: sinon.SinonSandbox;
    let cmd: InstanceType<typeof ExportToCsv>;

    beforeEach(async () => {
      sandbox = sinon.createSandbox();
      cmd = new ExportToCsv([], minimalConfig);
      await cmd.init();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('snakeCase lowercases and replaces spaces with underscores', () => {
      expect(cmd.snakeCase('Foo Bar')).to.equal('foo_bar');
      expect(cmd.snakeCase('')).to.equal('');
    });

    it('getStackClient passes api_key and optional branch_uid', () => {
      const stackApi = sandbox.stub().returns({});
      const mgmt = { stack: stackApi } as any;
      cmd.getStackClient(mgmt, { name: 'n', apiKey: 'k1' } as any);
      expect(stackApi.firstCall.args[0]).to.deep.equal({ api_key: 'k1' });
      cmd.getStackClient(mgmt, { name: 'n', apiKey: 'k2', branch_uid: 'br' } as any);
      expect(stackApi.secondCall.args[0]).to.deep.equal({ api_key: 'k2', branch_uid: 'br' });
    });

    it('getStackClient includes management_token when stack has token', () => {
      const stackApi = sandbox.stub().returns({});
      const mgmt = { stack: stackApi } as any;
      cmd.getStackClient(mgmt, {
        name: 'n',
        apiKey: 'k',
        branch_uid: 'b',
        token: 'tok',
      } as any);
      expect(stackApi.firstCall.args[0]).to.deep.equal({
        api_key: 'k',
        branch_uid: 'b',
        management_token: 'tok',
      });
    });

    it('getStackBranches returns items from branch().query().find()', async () => {
      const find = sandbox.stub().resolves({ items: [{ uid: 'b1' }] });
      const stackClient = {
        branch: () => ({ query: () => ({ find }) }),
      } as any;
      const out = await cmd.getStackBranches(stackClient);
      expect(out).to.deep.equal([{ uid: 'b1' }]);
      expect(find.called).to.equal(true);
    });

    it('getStackBranches returns [] when items missing or on error', async () => {
      const findEmpty = sandbox.stub().resolves({});
      const c1 = { branch: () => ({ query: () => ({ find: findEmpty }) }) } as any;
      expect(await cmd.getStackBranches(c1)).to.deep.equal([]);
      const findRej = sandbox.stub().rejects(new Error('net'));
      const c2 = { branch: () => ({ query: () => ({ find: findRej }) }) } as any;
      expect(await cmd.getStackBranches(c2)).to.deep.equal([]);
    });
  });

  describe('exportUsers (direct)', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      sandbox.stub(cliUtilities.cliux, 'loader').returns(undefined);
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('runs org-flag path, fetches org users/roles, and writes CSV', async () => {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      const writeStub = sandbox.stub(csvMod, 'write').callsFake(() => undefined);
      const utilsPath = nodeRequire.resolve('../../../src/utils');
      delete nodeRequire.cache[utilsPath];
      delete nodeRequire.cache[exportCmdPath];
      const ExportCmd = nodeRequire(exportCmdPath).default;

      const getInvitations = sandbox.stub().resolves({ items: [] });
      const rolesStub = sandbox.stub().resolves({ items: [] });
      const organization = sandbox.stub().callsFake((uid: string) => {
        expect(uid).to.equal('org-uid-1');
        return { getInvitations, roles: rolesStub };
      });
      const getUser = sandbox.stub().resolves({
        organizations: [{ uid: 'org-uid-1', is_owner: true }],
      });
      const mgmtClient = { getUser, organization };

      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();

      await (cmd as any).exportUsers({
        managementAPIClient: mgmtClient,
        org: 'org-uid-1',
        orgName: 'My Test Org',
        action: 'users',
        delimiter: '|',
      });

      expect(cmd.commandContext.orgId).to.equal('org-uid-1');
      expect(getUser.callCount).to.be.greaterThan(0);
      expect(organization.firstCall.args[0]).to.equal('org-uid-1');
      expect(getInvitations.calledOnce).to.equal(true);
      expect(rolesStub.calledOnce).to.equal(true);
      expect(writeStub.calledOnce).to.equal(true);
      const writeArgs = writeStub.firstCall.args as [unknown, unknown[], string, string, string];
      expect(writeArgs[2]).to.equal('my-test-org_users_export.csv');
      expect(writeArgs[3]).to.equal('organization details');
      expect(writeArgs[4]).to.equal('|');
      expect(writeArgs[1]).to.deep.equal([]);
    });
  });

  describe('command private coverage', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      sandbox.stub(cliUtilities.cliux, 'loader').returns(undefined);
    });

    afterEach(() => {
      sandbox.restore();
    });

    function stubWriteAndReloadCommand(): typeof ExportToCsv {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      sandbox.stub(csvMod, 'write').callsFake(() => undefined);
      delete nodeRequire.cache[exportCmdPath];
      return nodeRequire(exportCmdPath).default;
    }

    it('exportUsers uses chooseOrganization when org flag is absent (439–440)', async () => {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      sandbox.stub(csvMod, 'write').callsFake(() => undefined);

      const interactivePath = nodeRequire.resolve('../../../src/utils/interactive');
      delete nodeRequire.cache[interactivePath];
      const interactiveMod = nodeRequire(interactivePath) as typeof import('../../../src/utils/interactive');
      const chooseOrg = sandbox.stub(interactiveMod, 'chooseOrganization').resolves({ name: 'Picked Org', uid: 'org-p' });

      const utilsPath = nodeRequire.resolve('../../../src/utils');
      delete nodeRequire.cache[utilsPath];
      delete nodeRequire.cache[exportCmdPath];
      const ExportCmd = nodeRequire(exportCmdPath).default;

      const getInvitations = sandbox.stub().resolves({ items: [] });
      const rolesStub = sandbox.stub().resolves({ items: [] });
      const orgApi = sandbox.stub().callsFake((uid: string) => {
        expect(uid).to.equal('org-p');
        return { getInvitations, roles: rolesStub };
      });
      const getUser = sandbox.stub().resolves({
        organizations: [{ uid: 'org-p', is_owner: true }],
      });
      const mgmtClient = { getUser, organization: orgApi };

      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();
      await (cmd as any).exportUsers({
        managementAPIClient: mgmtClient,
        org: undefined,
        orgName: undefined,
        action: 'users',
        delimiter: ',',
      });

      expect(chooseOrg.calledOnce).to.equal(true);
      expect(cmd.commandContext.orgId).to.equal('org-p');
    });

    it('exportTeamsData calls exportTeams when org is provided', async () => {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      sandbox.stub(csvMod, 'write').callsFake(() => undefined);

      const teamsPath = nodeRequire.resolve('../../../src/utils/teams-export');
      delete nodeRequire.cache[teamsPath];
      const teamsMod = nodeRequire(teamsPath) as typeof import('../../../src/utils/teams-export');
      const exportTeamsStub = sandbox.stub(teamsMod, 'exportTeams').resolves();

      const utilsPath = nodeRequire.resolve('../../../src/utils');
      delete nodeRequire.cache[utilsPath];
      delete nodeRequire.cache[exportCmdPath];
      const ExportCmd = nodeRequire(exportCmdPath).default;
      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();

      await (cmd as any).exportTeamsData({
        managementAPIClient: {} as any,
        org: 'org-t',
        orgName: 'Team Org',
        action: 'teams',
        teamUid: undefined,
        delimiter: ';',
      });

      expect(exportTeamsStub.calledOnce).to.equal(true);
      const call = exportTeamsStub.firstCall.args;
      expect(call[1]).to.deep.include({ uid: 'org-t', name: 'Team Org' });
      expect(call[3]).to.equal(';');
    });

    it('exportUsers catch invokes handleAndLogError and rethrows', async () => {
      const handleStub = sandbox.stub();
      const restoreCli = patchCliUtilities({ handleAndLogError: handleStub as any });
      try {
        const interactivePath = nodeRequire.resolve('../../../src/utils/interactive');
        delete nodeRequire.cache[interactivePath];
        const interactiveMod = nodeRequire(interactivePath) as typeof import('../../../src/utils/interactive');
        sandbox.stub(interactiveMod, 'chooseOrganization').rejects(new Error('org choose boom'));
        const utilsPath = nodeRequire.resolve('../../../src/utils');
        delete nodeRequire.cache[utilsPath];
        delete nodeRequire.cache[exportCmdPath];
        const ExportCmd = nodeRequire(exportCmdPath).default;

        const cmd = new ExportCmd([], minimalConfig);
        await cmd.init();
        try {
          await (cmd as any).exportUsers({
            managementAPIClient: {} as any,
            org: undefined,
            orgName: undefined,
            action: 'users',
            delimiter: ',',
          });
          expect.fail('expected throw');
        } catch (e: any) {
          expect(e.message).to.equal('org choose boom');
        }
        expect(handleStub.calledOnce).to.equal(true);
      } finally {
        restoreCli();
      }
    });

    it('exportTeamsData catch invokes handleAndLogError and rethrows', async () => {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      sandbox.stub(csvMod, 'write').callsFake(() => undefined);

      const teamsPath = nodeRequire.resolve('../../../src/utils/teams-export');
      delete nodeRequire.cache[teamsPath];
      const teamsMod = nodeRequire(teamsPath) as typeof import('../../../src/utils/teams-export');
      sandbox.stub(teamsMod, 'exportTeams').rejects(new Error('teams boom'));
      const handleStub = sandbox.stub();
      const restoreCli = patchCliUtilities({ handleAndLogError: handleStub as any });
      try {
        const utilsPath = nodeRequire.resolve('../../../src/utils');
        delete nodeRequire.cache[utilsPath];
        delete nodeRequire.cache[exportCmdPath];
        const ExportCmd = nodeRequire(exportCmdPath).default;
        const cmd = new ExportCmd([], minimalConfig);
        await cmd.init();

        try {
          await (cmd as any).exportTeamsData({
            managementAPIClient: {} as any,
            org: 'org-x',
            orgName: 'Org X',
            action: 'teams',
            teamUid: undefined,
            delimiter: ',',
          });
          expect.fail('expected throw');
        } catch (e: any) {
          expect(e.message).to.equal('teams boom');
        }
        expect(handleStub.calledOnce).to.equal(true);
      } finally {
        restoreCli();
      }
    });

    it('exportTaxonomiesData uses locale flag and calls createTaxonomyAndTermCsvFile', async () => {
      const ExportCmd = stubWriteAndReloadCommand();
      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();
      sandbox.stub(cmd, 'getStackDetails').resolves({ name: 'StackX', apiKey: 'key-x' } as any);
      const createStub = sandbox.stub(cmd, 'createTaxonomyAndTermCsvFile').resolves();

      await (cmd as any).exportTaxonomiesData({
        managementAPIClient: { stack: sandbox.stub().returns({}) } as any,
        stackAPIKey: 'key-x',
        org: 'org-1',
        locale: 'en-us',
        branchUid: 'br1',
        taxonomyUID: 'tax1',
        includeFallback: true,
        fallbackLocale: 'de-de',
        delimiter: '|',
      });

      expect(cmd.commandContext.apiKey).to.equal('key-x');
      expect(createStub.calledOnce).to.equal(true);
      const createArgs = createStub.firstCall.args as any[];
      expect(createArgs[3]).to.equal('tax1');
      expect(createArgs[4]).to.equal('|');
      expect(createArgs[5]).to.deep.include({
        locale: 'en-us',
        branch: 'br1',
        include_fallback: true,
        fallback_locale: 'de-de',
      });
    });

    it('exportTaxonomiesData uses getAliasDetails when managementTokenAlias is set', async () => {
      const ExportCmd = stubWriteAndReloadCommand();
      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();
      const aliasApi = { stack: sandbox.stub().returns({}) } as any;
      const aliasSpy = sandbox.stub(cmd, 'getAliasDetails').resolves({
        stackDetails: { name: 'TStack', apiKey: 'tk', token: 'mtok' } as any,
        apiClient: aliasApi,
      });
      const createStub = sandbox.stub(cmd, 'createTaxonomyAndTermCsvFile').resolves();

      await (cmd as any).exportTaxonomiesData({
        managementAPIClient: { stack: sandbox.stub().returns({}) } as any,
        managementTokenAlias: 'al1',
        stackName: 'NamedViaFlag',
        stackAPIKey: undefined,
        org: 'org-1',
        locale: 'fr',
        branchUid: undefined,
        taxonomyUID: 'taxz',
        includeFallback: false,
        fallbackLocale: undefined,
        delimiter: ',',
      });

      expect(aliasSpy.calledOnceWithExactly('al1', 'NamedViaFlag')).to.equal(true);
      expect(cmd.commandContext.apiKey).to.equal('tk');
      expect(createStub.calledOnce).to.equal(true);
      expect(createStub.firstCall.args[0]).to.deep.equal({});
    });

    it('exportTaxonomiesData calls chooseLanguage when locale is omitted', async () => {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      sandbox.stub(csvMod, 'write').callsFake(() => undefined);

      const interactivePath = nodeRequire.resolve('../../../src/utils/interactive');
      delete nodeRequire.cache[interactivePath];
      const interactiveMod = nodeRequire(interactivePath) as typeof import('../../../src/utils/interactive');
      sandbox.stub(interactiveMod, 'chooseLanguage').resolves({ code: 'it' } as any);
      delete nodeRequire.cache[nodeRequire.resolve('../../../src/utils')];
      delete nodeRequire.cache[exportCmdPath];
      const ExportCmd = nodeRequire(exportCmdPath).default;
      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();
      sandbox.stub(cmd, 'getStackDetails').resolves({ name: 'St', apiKey: 'k1' } as any);
      const createStub = sandbox.stub(cmd, 'createTaxonomyAndTermCsvFile').resolves();

      await (cmd as any).exportTaxonomiesData({
        managementAPIClient: { stack: sandbox.stub().returns({}) } as any,
        stackAPIKey: 'k1',
        org: 'org-1',
        locale: undefined,
        branchUid: undefined,
        taxonomyUID: undefined,
        includeFallback: false,
        fallbackLocale: undefined,
        delimiter: ';',
      });

      expect((interactiveMod.chooseLanguage as sinon.SinonStub).calledOnce).to.equal(true);
      const opts = createStub.firstCall.args[5] as Record<string, unknown>;
      expect(opts.locale).to.equal('it');
    });

    it('exportTaxonomiesData catch invokes handleAndLogError', async () => {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      sandbox.stub(csvMod, 'write').callsFake(() => undefined);
      const handleStub = sandbox.stub();
      const restoreCli = patchCliUtilities({ handleAndLogError: handleStub as any });
      try {
        delete nodeRequire.cache[exportCmdPath];
        const ExportCmd = nodeRequire(exportCmdPath).default;
        const cmd = new ExportCmd([], minimalConfig);
        await cmd.init();
        sandbox.stub(cmd, 'getStackDetails').resolves({ name: 'St', apiKey: 'k1' } as any);
        sandbox.stub(cmd, 'createTaxonomyAndTermCsvFile').rejects(new Error('tax fail'));

        try {
          await (cmd as any).exportTaxonomiesData({
            managementAPIClient: { stack: sandbox.stub().returns({}) } as any,
            stackAPIKey: 'k1',
            org: 'org-1',
            locale: 'en',
            branchUid: undefined,
            taxonomyUID: undefined,
            includeFallback: false,
            fallbackLocale: undefined,
            delimiter: ',',
          });
          expect.fail('expected throw');
        } catch (e: any) {
          expect(e.message).to.equal('tax fail');
        }
        expect(handleStub.calledOnce).to.equal(true);
      } finally {
        restoreCli();
      }
    });

    it('exportEntries returns early when stack has no content types', async () => {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      sandbox.stub(csvMod, 'write').callsFake(() => undefined);

      const apiClientPath = nodeRequire.resolve('../../../src/utils/api-client');
      const apiMod = nodeRequire(apiClientPath) as typeof import('../../../src/utils/api-client');
      sandbox.stub(apiMod, 'getContentTypeCount').resolves(0);
      sandbox.stub(apiMod, 'getEnvironments').resolves({} as any);
      sandbox.stub(apiMod, 'getContentTypes').resolves({});
      const utilsPath = nodeRequire.resolve('../../../src/utils');
      delete nodeRequire.cache[utilsPath];

      const printStub = sandbox.stub(cliUtilities.cliux, 'print');
      delete nodeRequire.cache[exportCmdPath];
      const ExportCmd = nodeRequire(exportCmdPath).default;
      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();
      sandbox.stub(cmd, 'getStackDetails').resolves({ name: 'S', apiKey: 'k1' } as any);
      sandbox.stub(cmd, 'checkAndUpdateBranchDetail').callsFake(async (_b, _s, sc) => sc);

      const stackClient = {} as any;
      const mgmt = { stack: sandbox.stub().returns(stackClient) } as any;

      await (cmd as any).exportEntries({
        managementAPIClient: mgmt,
        stackAPIKey: 'k1',
        org: 'org-1',
        locale: 'en-us',
        delimiter: ',',
      });

      const noCt = printStub.getCalls().some((c) => String(c.args[0]).includes('No content types found'));
      expect(noCt).to.equal(true);
    });

    it('exportEntries uses getAliasDetails when managementTokenAlias is set', async () => {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      sandbox.stub(csvMod, 'write').callsFake(() => undefined);

      const apiClientPath = nodeRequire.resolve('../../../src/utils/api-client');
      const apiMod = nodeRequire(apiClientPath) as typeof import('../../../src/utils/api-client');
      sandbox.stub(apiMod, 'getContentTypeCount').resolves(0);
      sandbox.stub(apiMod, 'getEnvironments').resolves({} as any);
      sandbox.stub(apiMod, 'getContentTypes').resolves({});
      delete nodeRequire.cache[nodeRequire.resolve('../../../src/utils')];
      delete nodeRequire.cache[exportCmdPath];
      const ExportCmd = nodeRequire(exportCmdPath).default;
      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();

      const aliasClient = { stack: sandbox.stub().returns({}) } as any;
      const aliasSpy = sandbox.stub(cmd, 'getAliasDetails').resolves({
        stackDetails: { name: 'Aliased', apiKey: 'ak-alias' } as any,
        apiClient: aliasClient,
      });
      sandbox.stub(cmd, 'checkAndUpdateBranchDetail').callsFake(async (_b, _s, sc) => sc);

      const printStub = sandbox.stub(cliUtilities.cliux, 'print');
      await (cmd as any).exportEntries({
        managementAPIClient: {} as any,
        managementTokenAlias: 'my-alias',
        stackAPIKey: undefined,
        org: undefined,
        locale: 'en',
        delimiter: ',',
      });

      expect(aliasSpy.calledOnceWithExactly('my-alias', undefined)).to.equal(true);
      expect(cmd.commandContext.apiKey).to.equal('ak-alias');
      const noCt = printStub.getCalls().some((c) => String(c.args[0]).includes('No content types found'));
      expect(noCt).to.equal(true);
    });

    it('exportEntries with content-type flag validates and writes when type exists', async () => {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      const writeStub = sandbox.stub(csvMod, 'write').callsFake(() => undefined);

      const dataTransformPath = nodeRequire.resolve('../../../src/utils/data-transform');
      const dtMod = nodeRequire(dataTransformPath) as typeof import('../../../src/utils/data-transform');
      sandbox.stub(dtMod, 'cleanEntries').returns([] as any);

      const apiClientPath = nodeRequire.resolve('../../../src/utils/api-client');
      const apiMod = nodeRequire(apiClientPath) as typeof import('../../../src/utils/api-client');
      sandbox.stub(apiMod, 'getContentTypeCount').resolves(3);
      sandbox.stub(apiMod, 'getEnvironments').resolves({} as any);
      sandbox.stub(apiMod, 'getContentTypes').resolves({});
      delete nodeRequire.cache[nodeRequire.resolve('../../../src/utils')];
      delete nodeRequire.cache[exportCmdPath];
      const ExportCmd = nodeRequire(exportCmdPath).default;

      const stackClient = {
        contentType: sandbox.stub().callsFake((uid?: string) => {
          if (uid === undefined) {
            return {
              query: () => ({
                find: () => Promise.resolve({ items: [{ uid: 'ct1' }] }),
              }),
            };
          }
          return {
            entry: () => ({
              query: () => ({
                count: () => Promise.resolve({ entries: 0 }),
                find: () => Promise.resolve({ items: [] }),
              }),
            }),
          };
        }),
        environment: () => ({
          query: () => ({
            find: () => Promise.resolve({ items: [] }),
          }),
        }),
      } as any;

      const mgmt = { stack: sandbox.stub().returns(stackClient) } as any;
      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();
      sandbox.stub(cmd, 'getStackDetails').resolves({ name: 'St', apiKey: 'k1' } as any);
      sandbox.stub(cmd, 'checkAndUpdateBranchDetail').callsFake(async (_b, _s, sc) => sc);

      await (cmd as any).exportEntries({
        managementAPIClient: mgmt,
        stackAPIKey: 'k1',
        org: 'org-1',
        locale: 'en-us',
        contentTypesFlag: 'ct1',
        delimiter: '|',
      });

      expect(writeStub.calledOnce).to.equal(true);
      const writeArgs = writeStub.firstCall.args as [unknown, unknown[], string, string, string];
      expect(writeArgs[2]).to.include('ct1');
      expect(writeArgs[2]).to.include('en-us');
      expect(writeArgs[4]).to.equal('|');
    });

    it('exportEntries with content-type flag throws when type is missing', async () => {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      sandbox.stub(csvMod, 'write').callsFake(() => undefined);

      const dataTransformPath = nodeRequire.resolve('../../../src/utils/data-transform');
      const dtMod = nodeRequire(dataTransformPath) as typeof import('../../../src/utils/data-transform');
      sandbox.stub(dtMod, 'cleanEntries').returns([] as any);

      const apiClientPath = nodeRequire.resolve('../../../src/utils/api-client');
      const apiMod = nodeRequire(apiClientPath) as typeof import('../../../src/utils/api-client');
      sandbox.stub(apiMod, 'getContentTypeCount').resolves(1);
      sandbox.stub(apiMod, 'getEnvironments').resolves({} as any);
      sandbox.stub(apiMod, 'getContentTypes').resolves({});
      delete nodeRequire.cache[nodeRequire.resolve('../../../src/utils')];
      delete nodeRequire.cache[exportCmdPath];
      const ExportCmd = nodeRequire(exportCmdPath).default;

      const stackClient = {
        contentType: sandbox.stub().callsFake((uid?: string) => {
          if (uid === undefined) {
            return {
              query: () => ({
                find: () => Promise.resolve({ items: [{ uid: 'other' }] }),
              }),
            };
          }
          return {
            entry: () => ({
              query: () => ({
                count: () => Promise.resolve({ entries: 0 }),
                find: () => Promise.resolve({ items: [] }),
              }),
            }),
          };
        }),
        environment: () => ({
          query: () => ({
            find: () => Promise.resolve({ items: [] }),
          }),
        }),
      } as any;

      const mgmt = { stack: sandbox.stub().returns(stackClient) } as any;
      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();
      sandbox.stub(cmd, 'getStackDetails').resolves({ name: 'St', apiKey: 'k1' } as any);
      sandbox.stub(cmd, 'checkAndUpdateBranchDetail').callsFake(async (_b, _s, sc) => sc);

      try {
        await (cmd as any).exportEntries({
          managementAPIClient: mgmt,
          stackAPIKey: 'k1',
          org: 'org-1',
          locale: 'en',
          contentTypesFlag: 'ct1',
          delimiter: ',',
        });
        expect.fail('expected rejection');
      } catch (e: any) {
        expect(String(e.message)).to.include('not found');
      }
    });

    it('exportEntries without content-type flag uses chooseInMemContentTypes, chooseLanguage, and writes', async () => {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      const writeStub = sandbox.stub(csvMod, 'write').callsFake(() => undefined);

      const dataTransformPath = nodeRequire.resolve('../../../src/utils/data-transform');
      const dtMod = nodeRequire(dataTransformPath) as typeof import('../../../src/utils/data-transform');
      sandbox.stub(dtMod, 'cleanEntries').returns([] as any);

      const apiClientPath = nodeRequire.resolve('../../../src/utils/api-client');
      const apiMod = nodeRequire(apiClientPath) as typeof import('../../../src/utils/api-client');
      sandbox.stub(apiMod, 'getContentTypeCount').resolves(1);
      sandbox.stub(apiMod, 'getEnvironments').resolves({} as any);
      sandbox.stub(apiMod, 'getContentTypes').resolves({ Lbl: 'ct1' } as any);

      const interactivePath = nodeRequire.resolve('../../../src/utils/interactive');
      delete nodeRequire.cache[interactivePath];
      const interactiveMod = nodeRequire(interactivePath) as typeof import('../../../src/utils/interactive');
      sandbox.stub(interactiveMod, 'chooseInMemContentTypes').resolves(['ct1'] as any);
      sandbox.stub(interactiveMod, 'chooseLanguage').resolves({ code: 'de' } as any);

      delete nodeRequire.cache[nodeRequire.resolve('../../../src/utils')];
      delete nodeRequire.cache[exportCmdPath];
      const ExportCmd = nodeRequire(exportCmdPath).default;

      const stackClient = {
        contentType: sandbox.stub().callsFake((uid?: string) => {
          if (uid === undefined) {
            return {
              query: () => ({
                find: () => Promise.resolve({ items: [{ uid: 'ct1' }] }),
              }),
            };
          }
          return {
            entry: () => ({
              query: () => ({
                count: () => Promise.resolve({ entries: 0 }),
                find: () => Promise.resolve({ items: [] }),
              }),
            }),
          };
        }),
        environment: () => ({
          query: () => ({
            find: () => Promise.resolve({ items: [] }),
          }),
        }),
      } as any;

      const mgmt = { stack: sandbox.stub().returns(stackClient) } as any;
      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();
      sandbox.stub(cmd, 'getStackDetails').resolves({ name: 'St', apiKey: 'k1' } as any);
      sandbox.stub(cmd, 'checkAndUpdateBranchDetail').callsFake(async (_b, _s, sc) => sc);

      await (cmd as any).exportEntries({
        managementAPIClient: mgmt,
        stackAPIKey: 'k1',
        org: 'org-1',
        locale: undefined,
        delimiter: ',',
      });

      expect((interactiveMod.chooseInMemContentTypes as sinon.SinonStub).calledOnce).to.equal(true);
      expect((interactiveMod.chooseLanguage as sinon.SinonStub).calledOnce).to.equal(true);
      expect(writeStub.calledOnce).to.equal(true);
      const fname = (writeStub.firstCall.args as any[])[2] as string;
      expect(fname).to.include('ct1');
      expect(fname).to.include('de');
    });

    it('exportEntries catch invokes handleAndLogError and rethrows', async () => {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      sandbox.stub(csvMod, 'write').callsFake(() => undefined);

      const apiClientPath = nodeRequire.resolve('../../../src/utils/api-client');
      const apiMod = nodeRequire(apiClientPath) as typeof import('../../../src/utils/api-client');
      sandbox.stub(apiMod, 'getContentTypeCount').resolves(0);
      sandbox.stub(apiMod, 'getEnvironments').resolves({} as any);
      sandbox.stub(apiMod, 'getContentTypes').resolves({});
      delete nodeRequire.cache[nodeRequire.resolve('../../../src/utils')];
      delete nodeRequire.cache[exportCmdPath];

      const handleStub = sandbox.stub();
      const restoreCli = patchCliUtilities({ handleAndLogError: handleStub as any });
      try {
        const ExportCmd = nodeRequire(exportCmdPath).default;
        const cmd = new ExportCmd([], minimalConfig);
        await cmd.init();

        sandbox.stub(cmd, 'getStackDetails').rejects(new Error('stack boom'));
        sandbox.stub(cmd, 'checkAndUpdateBranchDetail').callsFake(async (_b, _s, sc) => sc);

        try {
          await (cmd as any).exportEntries({
            managementAPIClient: { stack: sandbox.stub().returns({}) } as any,
            stackAPIKey: 'k',
            org: 'o',
            delimiter: ',',
          });
          expect.fail('expected throw');
        } catch (e: any) {
          expect(e.message).to.equal('stack boom');
        }
        expect(handleStub.calledOnce).to.equal(true);
      } finally {
        restoreCli();
      }
    });

    it('getStackDetails returns stack when org and stackAPIKey are provided', async () => {
      const restoreCli = patchCliUtilities({ isAuthenticated: () => true });
      try {
        const interactivePath = nodeRequire.resolve('../../../src/utils/interactive');
        delete nodeRequire.cache[interactivePath];
        const interactiveMod = nodeRequire(interactivePath) as typeof import('../../../src/utils/interactive');
        sandbox.stub(interactiveMod, 'chooseStack').resolves({ name: 'MyStack', apiKey: 'stack-key-99' } as any);
        const utilsPath = nodeRequire.resolve('../../../src/utils');
        delete nodeRequire.cache[utilsPath];
        delete nodeRequire.cache[exportCmdPath];
        const ExportCmd = nodeRequire(exportCmdPath).default;
        const cmd = new ExportCmd([], minimalConfig);
        await cmd.init();

        const out = await cmd.getStackDetails({} as any, 'stack-key-99', 'org-uid-z');

        expect(out).to.deep.equal({ name: 'MyStack', apiKey: 'stack-key-99' });
        expect((interactiveMod.chooseStack as sinon.SinonStub).calledWith({}, 'org-uid-z', 'stack-key-99')).to.equal(true);
      } finally {
        restoreCli();
      }
    });

    it('getStackDetails errors when user is not authenticated', async () => {
      const restoreCli = patchCliUtilities({ isAuthenticated: () => false });
      try {
        delete nodeRequire.cache[exportCmdPath];
        const ExportCmd = nodeRequire(exportCmdPath).default;
        const cmd = new ExportCmd([], minimalConfig);
        await cmd.init();
        const errStub = sandbox.stub(cmd, 'error' as any).throws(new Error('not-auth'));

        try {
          await cmd.getStackDetails({} as any, 'sk', 'org1');
          expect.fail('expected throw');
        } catch (e: any) {
          expect(e.message).to.equal('not-auth');
        }
        expect(errStub.calledOnce).to.equal(true);
      } finally {
        restoreCli();
      }
    });

    it('getStackDetails chooses org and stack when org and stack key are omitted', async () => {
      const restoreCli = patchCliUtilities({ isAuthenticated: () => true });
      try {
        const interactivePath = nodeRequire.resolve('../../../src/utils/interactive');
        delete nodeRequire.cache[interactivePath];
        const interactiveMod = nodeRequire(interactivePath) as typeof import('../../../src/utils/interactive');
        const chooseOrgStub = sandbox.stub(interactiveMod, 'chooseOrganization').resolves({ name: 'OrgA', uid: 'org-a' });
        const chooseStackStub = sandbox.stub(interactiveMod, 'chooseStack').resolves({ name: 'StackA', apiKey: 'ak-a' } as any);
        const utilsPath = nodeRequire.resolve('../../../src/utils');
        delete nodeRequire.cache[utilsPath];
        delete nodeRequire.cache[exportCmdPath];
        const ExportCmd = nodeRequire(exportCmdPath).default;
        const cmd = new ExportCmd([], minimalConfig);
        await cmd.init();

        const out = await cmd.getStackDetails({} as any, undefined, undefined);
        expect(out).to.deep.equal({ name: 'StackA', apiKey: 'ak-a' });
        expect(chooseOrgStub.calledOnce).to.equal(true);
        expect(chooseOrgStub.firstCall.args[0]).to.deep.equal({});
        expect(chooseStackStub.calledOnce).to.equal(true);
        expect(chooseStackStub.firstCall.args[0]).to.deep.equal({});
        expect(chooseStackStub.firstCall.args[1]).to.equal('org-a');
      } finally {
        restoreCli();
      }
    });

    it('getAliasDetails returns client and stack when token is valid', async () => {
      const entry = getCliUtilsCacheEntry();
      const baselineCli = entry.exports as typeof cliUtilities;
      const mgmtFromAlias = { stack: sandbox.stub() } as any;
      const restore = patchCliUtilities({
        configHandler: {
          ...baselineCli.configHandler,
          get: sandbox.stub().callsFake((key: string) => {
            if (key === 'tokens') return { tok1: { apiKey: 'ak1', token: 'secret' } };
            return baselineCli.configHandler.get(key);
          }),
        } as any,
        isManagementTokenValid: sandbox.stub().resolves({}) as any,
        managementSDKClient: sandbox.stub().resolves(mgmtFromAlias) as any,
      });
      delete nodeRequire.cache[exportCmdPath];
      const ExportCmd = nodeRequire(exportCmdPath).default;
      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();

      const out = await cmd.getAliasDetails('tok1', 'Named Stack');

      expect(out.stackDetails).to.deep.include({
        name: 'Named Stack',
        apiKey: 'ak1',
        token: 'secret',
      });
      expect(out.apiClient).to.equal(mgmtFromAlias);
      restore();
    });

    it('getAliasDetails throws token check message for failedToCheck', async () => {
      const entry = getCliUtilsCacheEntry();
      const baselineCli = entry.exports as typeof cliUtilities;
      const restore = patchCliUtilities({
        configHandler: {
          ...baselineCli.configHandler,
          get: sandbox.stub().callsFake((key: string) => {
            if (key === 'tokens') return { tok1: { apiKey: 'ak1', token: 'secret' } };
            return baselineCli.configHandler.get(key);
          }),
        } as any,
        isManagementTokenValid: sandbox.stub().resolves({ valid: 'failedToCheck', message: 'network down' }) as any,
      });
      try {
        delete nodeRequire.cache[exportCmdPath];
        const ExportCmd = nodeRequire(exportCmdPath).default;
        const cmd = new ExportCmd([], minimalConfig);
        await cmd.init();
        try {
          await cmd.getAliasDetails('tok1', undefined);
          expect.fail('expected rejection');
        } catch (e: any) {
          expect(String(e.message)).to.include('network down');
        }
      } finally {
        restore();
      }
    });

    it('getAliasDetails throws invalid token message for generic failure', async () => {
      const entry = getCliUtilsCacheEntry();
      const baselineCli = entry.exports as typeof cliUtilities;
      const restore = patchCliUtilities({
        configHandler: {
          ...baselineCli.configHandler,
          get: sandbox.stub().callsFake((key: string) => {
            if (key === 'tokens') return { tok1: { apiKey: 'ak1', token: 'secret' } };
            return baselineCli.configHandler.get(key);
          }),
        } as any,
        isManagementTokenValid: sandbox.stub().resolves({ valid: 'failed', message: 'bad token' }) as any,
      });
      try {
        delete nodeRequire.cache[exportCmdPath];
        const ExportCmd = nodeRequire(exportCmdPath).default;
        const cmd = new ExportCmd([], minimalConfig);
        await cmd.init();
        try {
          await cmd.getAliasDetails('tok1', undefined);
          expect.fail('expected rejection');
        } catch (e: any) {
          expect(String(e.message)).to.include('Management token or stack API key is invalid');
          expect(String(e.message)).to.include('bad token');
        }
      } finally {
        restore();
      }
    });

    it('getAliasDetails invokes this.error when alias is not in config', async () => {
      const entry = getCliUtilsCacheEntry();
      const baselineCli = entry.exports as typeof cliUtilities;
      const restore = patchCliUtilities({
        configHandler: {
          ...baselineCli.configHandler,
          get: sandbox.stub().callsFake((key: string) => {
            if (key === 'tokens') return {};
            return baselineCli.configHandler.get(key);
          }),
        } as any,
      });
      try {
        delete nodeRequire.cache[exportCmdPath];
        const ExportCmd = nodeRequire(exportCmdPath).default;
        const cmd = new ExportCmd([], minimalConfig);
        await cmd.init();
        const errorStub = sandbox.stub(cmd, 'error' as any).throws(new Error('alias-missing'));
        try {
          await cmd.getAliasDetails('unknown', undefined);
          expect.fail('expected rejection');
        } catch (e: any) {
          expect(e.message).to.equal('alias-missing');
        }
        expect(errorStub.calledOnce).to.equal(true);
      } finally {
        restore();
      }
    });

    it('getAliasDetails throws when alias is empty', async () => {
      delete nodeRequire.cache[exportCmdPath];
      const ExportCmd = nodeRequire(exportCmdPath).default;
      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();
      try {
        await cmd.getAliasDetails('' as any, undefined);
        expect.fail('expected rejection');
      } catch (e: any) {
        expect(e.message).to.equal('Management token alias is required.');
      }
    });

    it('checkAndUpdateBranchDetail validates branch when branchUid is set', async () => {
      const restore = patchCliUtilities({
        doesBranchExist: sandbox.stub().resolves({}) as any,
      });
      try {
        delete nodeRequire.cache[exportCmdPath];
        const ExportCmd = nodeRequire(exportCmdPath).default;
        const cmd = new ExportCmd([], minimalConfig);
        await cmd.init();

        const stack = { name: 'S', apiKey: 'k1' } as any;
        const stackClient = {} as any;
        const mgmt = { stack: sandbox.stub().returns({}) } as any;
        const out = await cmd.checkAndUpdateBranchDetail('branch-1', stack, stackClient, mgmt);

        expect(stack.branch_uid).to.equal('branch-1');
        expect(out).to.be.an('object');
      } finally {
        restore();
      }
    });

    it('checkAndUpdateBranchDetail handles doesBranchExist errorCode and exits', async () => {
      const handleStub = sandbox.stub();
      const restore = patchCliUtilities({
        doesBranchExist: sandbox.stub().resolves({ errorCode: '404', errorMessage: 'no branch' }) as any,
        handleAndLogError: handleStub as any,
      });
      try {
        delete nodeRequire.cache[exportCmdPath];
        const ExportCmd = nodeRequire(exportCmdPath).default;
        const cmd = new ExportCmd([], minimalConfig);
        await cmd.init();
        const exitStub = sandbox.stub(cmd, 'exit' as any).callsFake(() => undefined);

        const stack = { name: 'S', apiKey: 'k1' } as any;
        await cmd.checkAndUpdateBranchDetail('missing-branch', stack, {} as any, { stack: sandbox.stub().returns({}) } as any);

        expect(handleStub.calledOnce).to.equal(true);
        expect(exitStub.calledWith(1)).to.equal(true);
      } finally {
        restore();
      }
    });

    it('checkAndUpdateBranchDetail picks branch when none passed and branches exist', async () => {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      sandbox.stub(csvMod, 'write').callsFake(() => undefined);

      const interactivePath = nodeRequire.resolve('../../../src/utils/interactive');
      delete nodeRequire.cache[interactivePath];
      const interactiveMod = nodeRequire(interactivePath) as typeof import('../../../src/utils/interactive');
      sandbox.stub(interactiveMod, 'chooseBranch').resolves({ branch: 'picked-br' });
      const utilsPath = nodeRequire.resolve('../../../src/utils');
      delete nodeRequire.cache[utilsPath];
      delete nodeRequire.cache[exportCmdPath];
      const ExportCmd = nodeRequire(exportCmdPath).default;
      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();
      sandbox.stub(cmd, 'getStackBranches').resolves([{ uid: 'b1' }] as any);

      const stack = { name: 'S', apiKey: 'k1' } as any;
      const stackClient = {} as any;
      const mgmt = { stack: sandbox.stub().returns({}) } as any;
      const out = await cmd.checkAndUpdateBranchDetail(undefined, stack, stackClient, mgmt);

      expect(stack.branch_uid).to.equal('picked-br');
      expect(out).to.be.an('object');
    });

    it('checkAndUpdateBranchDetail avoids chooseBranch when stack has no branches', async () => {
      const interactivePath = nodeRequire.resolve('../../../src/utils/interactive');
      delete nodeRequire.cache[interactivePath];
      const interactiveMod = nodeRequire(interactivePath) as typeof import('../../../src/utils/interactive');
      const chooseBranchStub = sandbox.stub(interactiveMod, 'chooseBranch').resolves({ branch: 'never' });
      const utilsPath = nodeRequire.resolve('../../../src/utils');
      delete nodeRequire.cache[utilsPath];
      delete nodeRequire.cache[exportCmdPath];
      const ExportCmd = nodeRequire(exportCmdPath).default;
      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();
      sandbox.stub(cmd, 'getStackBranches').resolves([]);

      const stack = { name: 'S', apiKey: 'k1' } as any;
      const stackClient = { from: 'original' } as any;
      const mgmt = { stack: sandbox.stub().returns({ from: 'new' }) } as any;
      const out = await cmd.checkAndUpdateBranchDetail(undefined, stack, stackClient, mgmt);

      expect(chooseBranchStub.called).to.equal(false);
      expect(out).to.deep.equal({ from: 'new' });
    });

    it('createTaxonomyAndTermCsvFile returns early when no taxonomies', async () => {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      sandbox.stub(csvMod, 'write').callsFake(() => undefined);

      const apiClientPath = nodeRequire.resolve('../../../src/utils/api-client');
      const apiMod = nodeRequire(apiClientPath) as typeof import('../../../src/utils/api-client');
      sandbox.stub(apiMod, 'getAllTaxonomies').resolves([] as any);
      const utilsPath = nodeRequire.resolve('../../../src/utils');
      delete nodeRequire.cache[utilsPath];
      const printStub = sandbox.stub(cliUtilities.cliux, 'print');
      delete nodeRequire.cache[exportCmdPath];
      const ExportCmd = nodeRequire(exportCmdPath).default;
      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();

      await cmd.createTaxonomyAndTermCsvFile({} as any, undefined, { name: 'St', apiKey: 'k' } as any, undefined, ',');

      const yellow = printStub
        .getCalls()
        .some((c) => c.args[1]?.color === 'yellow' && String(c.args[0]).includes('No taxonomies found'));
      expect(yellow).to.equal(true);
    });

    it('createTaxonomyAndTermCsvFile uses getTaxonomy when taxonomy UID is set', async () => {
      const csvWriterPath = nodeRequire.resolve('../../../src/utils/csv-writer');
      const csvMod = nodeRequire(csvWriterPath) as typeof import('../../../src/utils/csv-writer');
      sandbox.stub(csvMod, 'write').callsFake(() => undefined);

      const apiClientPath = nodeRequire.resolve('../../../src/utils/api-client');
      const apiMod = nodeRequire(apiClientPath) as typeof import('../../../src/utils/api-client');
      const tax = { uid: 't1', name: 'Tax1' } as any;
      sandbox.stub(apiMod, 'getTaxonomy').resolves(tax);
      sandbox.stub(apiMod, 'createImportableCSV').resolves({ taxonomiesData: [{ x: 1 }], headers: ['x'] } as any);
      const utilsPath = nodeRequire.resolve('../../../src/utils');
      delete nodeRequire.cache[utilsPath];
      delete nodeRequire.cache[exportCmdPath];
      const ExportCmd = nodeRequire(exportCmdPath).default;
      const cmd = new ExportCmd([], minimalConfig);
      await cmd.init();

      await cmd.createTaxonomyAndTermCsvFile({} as any, 'SN', { name: 'St', apiKey: 'k' } as any, 't1', ',');

      expect((apiMod.getTaxonomy as sinon.SinonStub).calledOnce).to.equal(true);
    });
  });

  describe('run()', () => {
    let sandbox: sinon.SinonSandbox;
    let restoreCli: (() => void) | undefined;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      restoreCli?.();
      restoreCli = undefined;
      sandbox.restore();
    });

    async function createCmd(ExportCls: typeof ExportToCsv) {
      const cmd = new ExportCls([], minimalConfig);
      await cmd.init();
      return cmd;
    }

    it('8a: initializes client and does not export entries when not authenticated', async () => {
      const mgmt = sandbox.stub().resolves({});
      restoreCli = patchCliUtilities({
        managementSDKClient: mgmt as any,
        isAuthenticated: () => false,
      });
      reloadUtilsAndCommand();
      const Cmd = loadExportCommand();
      const entriesSpy = sandbox.stub(Cmd.prototype, 'exportEntries' as any).resolves();
      const exitStub = sandbox.stub(CsCommand.prototype, 'exit' as any).callsFake(() => undefined);
      const cmd = await createCmd(Cmd);
      sandbox.stub(cmd, 'parse' as any).resolves({ flags: baseFlags({ action: 'entries' }) });
      await cmd.run();
      expect(mgmt.calledOnce).to.equal(true);
      expect(entriesSpy.called).to.equal(false);
      exitStub.restore();
    });

    it('8b: skips startupQuestions when action is provided via flags', async () => {
      restoreCli = patchCliUtilities({
        managementSDKClient: sandbox.stub().resolves({}) as any,
        isAuthenticated: () => true,
      });
      reloadUtilsAndCommand();
      const utilsMod = nodeRequire('../../../src/utils') as typeof import('../../../src/utils');
      const sq = sandbox.stub(utilsMod, 'startupQuestions').resolves('Export entries to a .CSV file');
      const Cmd = loadExportCommand();
      sandbox.stub(Cmd.prototype, 'exportEntries' as any).resolves();
      const cmd = await createCmd(Cmd);
      sandbox.stub(cmd, 'parse' as any).resolves({ flags: baseFlags({ action: 'entries', alias: 'a' }) });
      await cmd.run();
      expect(sq.called).to.equal(false);
    });

    it('8c: dispatches entries branch', async () => {
      restoreCli = patchCliUtilities({
        managementSDKClient: sandbox.stub().resolves({}) as any,
        isAuthenticated: () => true,
      });
      reloadUtilsAndCommand();
      const Cmd = loadExportCommand();
      const stub = sandbox.stub(Cmd.prototype, 'exportEntries' as any).resolves();
      const cmd = await createCmd(Cmd);
      sandbox.stub(cmd, 'parse' as any).resolves({ flags: baseFlags({ action: 'entries', alias: 'a' }) });
      await cmd.run();
      expect(stub.calledOnce).to.equal(true);
    });

    it('8d: dispatches users branch', async () => {
      restoreCli = patchCliUtilities({
        managementSDKClient: sandbox.stub().resolves({}) as any,
        isAuthenticated: () => true,
      });
      reloadUtilsAndCommand();
      const Cmd = loadExportCommand();
      const stub = sandbox.stub(Cmd.prototype, 'exportUsers' as any).resolves();
      const cmd = await createCmd(Cmd);
      sandbox.stub(cmd, 'parse' as any).resolves({ flags: baseFlags({ action: 'users', alias: 'a' }) });
      await cmd.run();
      expect(stub.calledOnce).to.equal(true);
    });

    it('8e: dispatches teams branch', async () => {
      restoreCli = patchCliUtilities({
        managementSDKClient: sandbox.stub().resolves({}) as any,
        isAuthenticated: () => true,
      });
      reloadUtilsAndCommand();
      const Cmd = loadExportCommand();
      const stub = sandbox.stub(Cmd.prototype, 'exportTeamsData' as any).resolves();
      const cmd = await createCmd(Cmd);
      sandbox.stub(cmd, 'parse' as any).resolves({ flags: baseFlags({ action: 'teams', alias: 'a' }) });
      await cmd.run();
      expect(stub.calledOnce).to.equal(true);
    });

    it('8f: dispatches taxonomies branch', async () => {
      restoreCli = patchCliUtilities({
        managementSDKClient: sandbox.stub().resolves({}) as any,
        isAuthenticated: () => true,
      });
      reloadUtilsAndCommand();
      const Cmd = loadExportCommand();
      const stub = sandbox.stub(Cmd.prototype, 'exportTaxonomiesData' as any).resolves();
      const cmd = await createCmd(Cmd);
      sandbox.stub(cmd, 'parse' as any).resolves({ flags: baseFlags({ action: 'taxonomies', alias: 'a' }) });
      await cmd.run();
      expect(stub.calledOnce).to.equal(true);
    });

    it('8g: catch invokes handleAndLogError, ux stop, and exit', async () => {
      const handleStub = sandbox.stub();
      const stopStub = sandbox.stub();
      const entry = getCliUtilsCacheEntry();
      const baseline = entry.exports as typeof cliUtilities;
      restoreCli = patchCliUtilities({
        managementSDKClient: sandbox.stub().resolves({}) as any,
        isAuthenticated: () => true,
        handleAndLogError: handleStub as any,
        ux: { ...baseline.ux, action: { ...baseline.ux.action, stop: stopStub } } as any,
      });
      reloadUtilsAndCommand();
      const Cmd = loadExportCommand();
      const exitStub = sandbox.stub(Cmd.prototype, 'exit' as any).callsFake(() => undefined);
      sandbox.stub(Cmd.prototype, 'exportEntries' as any).rejects(new Error('boom'));
      const cmd = await createCmd(Cmd);
      sandbox.stub(cmd, 'parse' as any).resolves({ flags: baseFlags({ action: 'entries', alias: 'a' }) });
      await cmd.run();
      expect(handleStub.calledOnce).to.equal(true);
      expect(stopStub.calledWith('Export failed')).to.equal(true);
      expect(exitStub.calledWith(1)).to.equal(true);
    });

    it('8h: calls startupQuestions when action flag is omitted', async () => {
      restoreCli = patchCliUtilities({
        managementSDKClient: sandbox.stub().resolves({}) as any,
        isAuthenticated: () => true,
      });
      reloadUtilsAndCommand();
      const interactivePath = nodeRequire.resolve('../../../src/utils/interactive');
      delete nodeRequire.cache[interactivePath];
      const interactiveMod = nodeRequire(interactivePath) as typeof import('../../../src/utils/interactive');
      const sq = sandbox.stub(interactiveMod, 'startupQuestions').resolves(messages.ACTION_EXPORT_ENTRIES);
      const utilsPath = nodeRequire.resolve('../../../src/utils');
      delete nodeRequire.cache[utilsPath];
      delete nodeRequire.cache[exportCmdPath];
      const Cmd = nodeRequire(exportCmdPath).default;
      sandbox.stub(Cmd.prototype, 'exportEntries' as any).resolves();
      const cmd = await createCmd(Cmd);
      sandbox.stub(cmd, 'parse' as any).resolves({ flags: baseFlags({ alias: 'a' }) });
      await cmd.run();
      expect(sq.calledOnce).to.equal(true);
    });
  });
});
