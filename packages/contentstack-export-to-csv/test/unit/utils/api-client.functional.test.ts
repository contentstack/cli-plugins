import { expect } from 'chai';
import sinon from 'sinon';
import * as cliUtilities from '@contentstack/cli-utilities';
import * as errorHandler from '../../../src/utils/error-handler';
import { messages } from '../../../src/messages';
import {
  getOrganizations,
  getOrganizationsWhereUserIsAdmin,
  getOrgUsers,
  getOrgRoles,
  getStacks,
  getContentTypeCount,
  getContentTypes,
  getLanguages,
  getEntriesCount,
  getEntries,
  getEnvironments,
  getAllTeams,
  exportOrgTeams,
  getRoleData,
  taxonomySDKHandler,
  getAllTaxonomies,
  getAllTermsOfTaxonomy,
  getTaxonomy,
  createImportableCSV,
} from '../../../src/utils/api-client';
import { createStackClient } from './api-client.fixtures';

describe('api-client functional', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(errorHandler, 'wait').resolves();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('organizations', () => {
    it('getOrganizations uses single org fetch when oauthOrgUid is set', async () => {
      sandbox.stub(cliUtilities.configHandler, 'get').callsFake((k: string) => (k === 'oauthOrgUid' ? 'o-1' : undefined));
      const client = {
        organization: (uid: string) => ({
          fetch: () => Promise.resolve({ name: 'OAuth Org', uid }),
        }),
      } as any;
      const map = await getOrganizations(client);
      expect(map['OAuth Org']).to.equal('o-1');
    });

    it('getOrganizations maps fetchAll when under limit', async () => {
      sandbox.stub(cliUtilities.configHandler, 'get').returns(undefined);
      const client = {
        organization: () => ({
          fetchAll: () => Promise.resolve({ items: [{ name: 'Solo', uid: 'u1' }] }),
        }),
      } as any;
      const map = await getOrganizations(client);
      expect(map).to.deep.equal({ Solo: 'u1' });
    });

    it('getOrganizations paginates when page is full', async () => {
      sandbox.stub(cliUtilities.configHandler, 'get').returns(undefined);
      const full = Array.from({ length: 100 }, (_, i) => ({ name: `Org${i}`, uid: `id${i}` }));
      let calls = 0;
      const client = {
        organization: () => ({
          fetchAll: () => {
            calls++;
            if (calls === 1) return Promise.resolve({ items: full });
            return Promise.resolve({ items: [{ name: 'Zed', uid: 'z' }] });
          },
        }),
      } as any;
      const map = await getOrganizations(client);
      expect(map.Zed).to.equal('z');
      expect(Object.keys(map).length).to.be.greaterThan(100);
    });

    it('getOrganizationsWhereUserIsAdmin uses oauth org fetch', async () => {
      sandbox.stub(cliUtilities.configHandler, 'get').callsFake((k: string) => (k === 'oauthOrgUid' ? 'ox' : undefined));
      const client = {
        organization: (uid: string) => ({
          fetch: () => Promise.resolve({ name: 'Owned', uid }),
        }),
      } as any;
      const map = await getOrganizationsWhereUserIsAdmin(client);
      expect(map.Owned).to.equal('ox');
    });

    it('getOrganizationsWhereUserIsAdmin filters getUser orgs by admin role', async () => {
      sandbox.stub(cliUtilities.configHandler, 'get').returns(undefined);
      const client = {
        getUser: () =>
          Promise.resolve({
            organizations: [
              { name: 'NoAdmin', uid: '1', org_roles: [{ admin: false }] },
              { name: 'YesAdmin', uid: '2', org_roles: [{ admin: true }] },
            ],
          }),
      } as any;
      const map = await getOrganizationsWhereUserIsAdmin(client);
      expect(map).to.deep.equal({ YesAdmin: '2' });
    });

    it('getOrganizationsWhereUserIsAdmin includes org when is_owner', async () => {
      sandbox.stub(cliUtilities.configHandler, 'get').returns(undefined);
      const client = {
        getUser: () =>
          Promise.resolve({
            organizations: [{ name: 'OwnerCo', uid: '9', is_owner: true }],
          }),
      } as any;
      const map = await getOrganizationsWhereUserIsAdmin(client);
      expect(map.OwnerCo).to.equal('9');
    });
  });

  describe('getOrgUsers / getOrgRoles', () => {
    it('getOrgUsers resolves invitations for org owner', async () => {
      const invitations = { items: [{ email: 'a@b.com' }] };
      const client = {
        getUser: () =>
          Promise.resolve({
            organizations: [{ uid: 'org-1', is_owner: true }],
          }),
        organization: () => ({
          getInvitations: () => Promise.resolve(invitations),
        }),
      } as any;
      const res = await getOrgUsers(client, 'org-1');
      expect(res).to.equal(invitations);
    });

    it('getOrgUsers rejects when org uid missing', async () => {
      const client = {
        getUser: () => Promise.resolve({ organizations: [{ uid: 'other' }] }),
      } as any;
      try {
        await getOrgUsers(client, 'missing');
        expect.fail('expected reject');
      } catch (e: any) {
        expect(String(e.message)).to.include('Org UID not found');
      }
    });

    it('getOrgUsers resolves paginated invitations for non-owner admin org', async () => {
      const getInvitations = sandbox.stub();
      getInvitations.onFirstCall().resolves({ items: [{ email: 'a@b.com' }] });
      getInvitations.onSecondCall().resolves({ items: [] });
      const client = {
        getUser: () =>
          Promise.resolve({
            organizations: [{ uid: 'org-1', is_owner: false, org_roles: [{ admin: true }] }],
          }),
        organization: () => ({
          getInvitations,
        }),
      } as any;
      const res = await getOrgUsers(client, 'org-1');
      expect(res.items).to.have.lengthOf(1);
      expect(getInvitations.calledTwice).to.equal(true);
    });

    it('getOrgUsers returns empty list when paginated invitations call fails', async () => {
      const client = {
        getUser: () =>
          Promise.resolve({
            organizations: [{ uid: 'org-1', is_owner: false, org_roles: [{ admin: true }] }],
          }),
        organization: () => ({
          getInvitations: () => Promise.reject(new Error('network')),
        }),
      } as any;
      const res = await getOrgUsers(client, 'org-1');
      expect(res.items).to.deep.equal([]);
    });

    it('getOrgRoles resolves roles for owner', async () => {
      const roles = { items: [{ uid: 'r1' }] };
      const client = {
        getUser: () =>
          Promise.resolve({
            organizations: [{ uid: 'org-1', is_owner: true }],
          }),
        organization: () => ({
          roles: () => Promise.resolve(roles),
        }),
      } as any;
      const res = await getOrgRoles(client, 'org-1');
      expect(res).to.equal(roles);
    });

    it('getOrgRoles rejects when not admin', async () => {
      const client = {
        getUser: () =>
          Promise.resolve({
            organizations: [{ uid: 'org-1', is_owner: false, org_roles: [{ admin: false }] }],
          }),
      } as any;
      try {
        await getOrgRoles(client, 'org-1');
        expect.fail('expected reject');
      } catch (e: any) {
        expect(String(e.message)).to.include(messages.ERROR_ADMIN_ACCESS_DENIED);
      }
    });

    it('getOrgRoles resolves roles for non-owner admin org', async () => {
      const roles = { items: [{ uid: 'r-admin' }] };
      const client = {
        getUser: () =>
          Promise.resolve({
            organizations: [{ uid: 'org-1', is_owner: false, org_roles: [{ admin: true }] }],
          }),
        organization: () => ({
          roles: () => Promise.resolve(roles),
        }),
      } as any;
      const res = await getOrgRoles(client, 'org-1');
      expect(res).to.equal(roles);
    });
  });

  describe('stacks, content types, languages, entries, environments', () => {
    it('getStacks maps stack names to api keys', async () => {
      const client = {
        stack: () => ({
          query: () => ({
            find: () => Promise.resolve({ items: [{ name: 'Main', api_key: 'key-1' }] }),
          }),
        }),
      } as any;
      const map = await getStacks(client, 'org-uid');
      expect(map).to.deep.equal({ Main: 'key-1' });
    });

    it('getStacks rejects when stack query fails', async () => {
      const client = {
        stack: () => ({
          query: () => ({
            find: () => Promise.reject(new Error('stack query failed')),
          }),
        }),
      } as any;
      try {
        await getStacks(client, 'org-uid');
        expect.fail('expected reject');
      } catch (e: any) {
        expect(e.message).to.equal('stack query failed');
      }
    });

    it('getContentTypeCount and getContentTypes', async () => {
      const stack = createStackClient({
        contentTypeCount: { content_types: 7 },
        contentTypesFind: { items: [{ title: 'Page', uid: 'page' }] },
      });
      const n = await getContentTypeCount(stack);
      expect(n).to.equal(7);
      const ct = await getContentTypes(stack, 0);
      expect(ct.Page).to.equal('page');
    });

    it('getLanguages maps locale names to codes', async () => {
      const stack = createStackClient({
        localesFind: { items: [{ name: 'French', code: 'fr-fr' }] },
      });
      const langs = await getLanguages(stack);
      expect(langs.French).to.equal('fr-fr');
    });

    it('getEntriesCount and getEntries', async () => {
      const stack = createStackClient({
        entriesCount: { entries: 42 },
        entriesFind: { items: [{ uid: 'e1' }] },
      });
      const c = await getEntriesCount(stack, 'blog', 'en-us');
      expect(c).to.equal(42);
      const entries = await getEntries(stack, 'blog', 'en-us', 0, 10);
      expect(entries.items).to.deep.equal([{ uid: 'e1' }]);
    });

    it('getEnvironments maps uid to name', async () => {
      const stack = createStackClient({
        envFind: { items: [{ uid: 'e1', name: 'Prod' }] },
      });
      const env = await getEnvironments(stack);
      expect(env.e1).to.equal('Prod');
    });
  });

  describe('teams and roles', () => {
    it('getAllTeams returns fetchAll payload', async () => {
      const payload = { items: [{ uid: 't1' }], count: 1 } as any;
      const client = {
        organization: () => ({
          teams: () => ({
            fetchAll: () => Promise.resolve(payload),
          }),
        }),
      } as any;
      const res = await getAllTeams(client, { uid: 'org', name: 'O' });
      expect(res).to.equal(payload);
    });

    it('getAllTeams calls handleErrorMsg on failure', async () => {
      const h = sandbox.stub(errorHandler, 'handleErrorMsg');
      const client = {
        organization: () => ({
          teams: () => ({
            fetchAll: () => Promise.reject(new Error('fail')),
          }),
        }),
      } as any;
      await getAllTeams(client, { uid: 'org', name: 'O' });
      expect(h.calledOnce).to.equal(true);
    });

    it('exportOrgTeams aggregates pages and cleans teams', async () => {
      const org = { uid: 'org1', name: 'Acme Org' };
      let calls = 0;
      const client = {
        organization: (uid: string) => {
          expect(uid).to.equal('org1');
          return {
            teams: () => ({
              fetchAll: () => {
                calls++;
                if (calls === 1) {
                  return Promise.resolve({
                    items: [
                      {
                        uid: 't1',
                        name: 'Team1',
                        organizationRole: 'mem',
                        users: [{ id: 1 }],
                        description: 'd',
                      },
                    ],
                    count: 1,
                  });
                }
                return Promise.resolve({ items: [], count: 1 });
              },
            }),
            roles: () =>
              Promise.resolve({
                items: [
                  { name: 'member', uid: 'mem' },
                  { name: 'admin', uid: 'adm' },
                ],
              }),
          };
        },
      } as any;
      const cleaned = await exportOrgTeams(client, org);
      expect(cleaned).to.have.lengthOf(1);
      expect(cleaned[0].uid).to.equal('t1');
      expect(cleaned[0].organizationRole).to.equal('member');
    });

    it('getRoleData returns items or empty on error', async () => {
      const okClient = {
        stack: () => ({
          role: () => ({
            fetchAll: () => Promise.resolve({ items: [{ uid: 'r', name: 'Editor' }] }),
          }),
        }),
      } as any;
      const ok = await getRoleData(okClient, 'key');
      expect(ok.items).to.have.lengthOf(1);

      const badClient = {
        stack: () => ({
          role: () => ({
            fetchAll: () => Promise.reject(new Error('nope')),
          }),
        }),
      } as any;
      const empty = await getRoleData(badClient, 'key');
      expect(empty.items).to.deep.equal([]);
    });
  });

  describe('taxonomySDKHandler and helpers', () => {
    const basePayload = {
      stackAPIClient: createStackClient({
        taxonomyFind: { items: [{ uid: 'tax1' }], count: 1 },
        taxonomyFetch: { uid: 'tax1', name: 'Taxonomy' },
        termsFind: { items: [{ uid: 'term1' }], count: 1 },
        taxonomyExport: 'a,b\n1,2',
      }),
      taxonomyUID: 'tax1',
      limit: 10,
      locale: 'en',
      branch: 'main',
      include_fallback: false,
      fallback_locale: undefined,
    } as any;

    it('taxonomies type returns find result', async () => {
      const res = await taxonomySDKHandler({ ...basePayload, type: 'taxonomies' });
      expect((res as any).items).to.have.lengthOf(1);
    });

    it('taxonomy type returns fetch result', async () => {
      const res = await taxonomySDKHandler({ ...basePayload, type: 'taxonomy' });
      expect((res as any).uid).to.equal('tax1');
    });

    it('terms type returns terms find', async () => {
      const res = await taxonomySDKHandler({ ...basePayload, type: 'terms' });
      expect((res as any).items[0].uid).to.equal('term1');
    });

    it('export-taxonomies returns csv string', async () => {
      const res = await taxonomySDKHandler({ ...basePayload, type: 'export-taxonomies', format: 'csv' });
      expect(res).to.include('a,b');
    });

    it('default type calls handleTaxonomyErrorMsg', async () => {
      const stub = sandbox.stub(errorHandler, 'handleTaxonomyErrorMsg');
      await taxonomySDKHandler({ ...basePayload, type: 'invalid' as any });
      expect(stub.calledOnce).to.equal(true);
    });

    it('getAllTaxonomies aggregates pages', async () => {
      const stack = createStackClient({
        taxonomyFind: {
          items: [{ uid: 'a' }, { uid: 'b' }],
          count: 3,
        },
      });
      const payload = { ...basePayload, stackAPIClient: stack, limit: 2, type: 'taxonomies' };
      const list = await getAllTaxonomies(payload);
      expect(list.map((t) => t.uid)).to.deep.equal(['a', 'b', 'a', 'b']);
    });

    it('getAllTermsOfTaxonomy aggregates', async () => {
      const stack = createStackClient({
        termsFind: { items: [{ uid: 't1' }], count: 2 },
      });
      const payload = { ...basePayload, stackAPIClient: stack, limit: 1, type: 'terms' };
      const terms = await getAllTermsOfTaxonomy(payload);
      expect(terms.length).to.be.greaterThan(0);
    });

    it('getTaxonomy delegates to handler', async () => {
      const tax = await getTaxonomy({ ...basePayload, type: 'taxonomy' });
      expect(tax.uid).to.equal('tax1');
    });

    it('createImportableCSV parses export csv', async () => {
      const stack = createStackClient({
        taxonomyExport: 'col1,col2\nv1,v2',
      });
      const payload = { ...basePayload, stackAPIClient: stack, limit: 10 } as any;
      const out = await createImportableCSV(payload, [{ uid: 'tax1' } as any]);
      expect(out.headers.length).to.be.greaterThan(0);
      expect(out.taxonomiesData.length).to.be.greaterThan(0);
    });
  });
});
