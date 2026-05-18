import { expect } from 'chai';
import sinon from 'sinon';
import config from '../../../src/config';
import { messages } from '../../../src/messages';
import * as errorHandler from '../../../src/utils/error-handler';
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
  getAllTaxonomies,
  getAllTermsOfTaxonomy,
  getTaxonomy,
  createImportableCSV,
} from '../../../src/utils/api-client';
import type { ManagementClient, OrgUser } from '../../../src/types';

const ORG_UID = 'org-uid';

function makeUser(index: number): OrgUser {
  return {
    email: `user${index}@example.com`,
    user_uid: `uid-${index}`,
    invited_by: 'system',
    status: 'accepted',
    created_at: '2020-01-01T00:00:00.000Z',
    updated_at: '2020-01-01T00:00:00.000Z',
  };
}

function createPaginatedMockClient(
  organization: {
    is_owner?: boolean;
    org_roles?: Array<{ admin?: boolean }>;
  },
  pages: OrgUser[][],
): { client: ManagementClient; getInvitations: sinon.SinonStub; invitationParams: Array<Record<string, number>> } {
  const invitationParams: Array<Record<string, number>> = [];
  const getInvitations = sinon.stub().callsFake(async (params: Record<string, number>) => {
    invitationParams.push({ ...params });
    const callIndex = getInvitations.callCount - 1;
    const items = pages[callIndex] ?? [];
    return { items };
  });

  const organizationClient = { getInvitations };
  const organizationStub = sinon.stub().returns(organizationClient);

  const client = {
    getUser: sinon.stub().resolves({
      organizations: [
        {
          uid: ORG_UID,
          name: 'Test Org',
          ...organization,
        },
      ],
    }),
    organization: organizationStub,
  } as unknown as ManagementClient;

  return { client, getInvitations, invitationParams };
}

describe('api-client', () => {
  let waitStub: sinon.SinonStub;

  beforeEach(() => {
    waitStub = sinon.stub(errorHandler, 'wait').resolves();
  });

  afterEach(() => {
    waitStub.restore();
  });

  describe('module exports', () => {
    it('should export all expected functions', () => {
      expect(getOrganizations).to.be.a('function');
      expect(getOrganizationsWhereUserIsAdmin).to.be.a('function');
      expect(getOrgUsers).to.be.a('function');
      expect(getOrgRoles).to.be.a('function');
      expect(getStacks).to.be.a('function');
      expect(getContentTypeCount).to.be.a('function');
      expect(getContentTypes).to.be.a('function');
      expect(getLanguages).to.be.a('function');
      expect(getEntriesCount).to.be.a('function');
      expect(getEntries).to.be.a('function');
      expect(getEnvironments).to.be.a('function');
      expect(getAllTeams).to.be.a('function');
      expect(exportOrgTeams).to.be.a('function');
      expect(getAllTaxonomies).to.be.a('function');
      expect(getAllTermsOfTaxonomy).to.be.a('function');
      expect(getTaxonomy).to.be.a('function');
      expect(createImportableCSV).to.be.a('function');
    });
  });

  describe('getOrgUsers', () => {
    it('should paginate getInvitations for organization owners', async () => {
      const page1 = Array.from({ length: 10 }, (_, i) => makeUser(i));
      const page2 = Array.from({ length: 10 }, (_, i) => makeUser(i + 10));
      const page3 = Array.from({ length: 5 }, (_, i) => makeUser(i + 20));

      const { client, getInvitations, invitationParams } = createPaginatedMockClient(
        { is_owner: true },
        [page1, page2, page3, []],
      );

      const result = await getOrgUsers(client, ORG_UID);

      expect(result.items).to.have.lengthOf(25);
      expect(getInvitations.callCount).to.equal(4);
      expect(invitationParams[0]).to.deep.equal({ skip: 0, page: 1, limit: config.limit });
      expect(invitationParams[1]).to.deep.equal({ skip: config.limit, page: 2, limit: config.limit });
      expect(invitationParams[2]).to.deep.equal({
        skip: config.limit * 2,
        page: 3,
        limit: config.limit,
      });
    });

    it('should paginate getInvitations for organization admins', async () => {
      const page1 = Array.from({ length: 10 }, (_, i) => makeUser(i));
      const page2 = Array.from({ length: 10 }, (_, i) => makeUser(i + 10));
      const page3 = Array.from({ length: 5 }, (_, i) => makeUser(i + 20));

      const { client, getInvitations, invitationParams } = createPaginatedMockClient(
        { is_owner: false, org_roles: [{ admin: true }] },
        [page1, page2, page3, []],
      );

      const result = await getOrgUsers(client, ORG_UID);

      expect(result.items).to.have.lengthOf(25);
      expect(getInvitations.callCount).to.equal(4);
      expect(invitationParams[0]).to.deep.equal({ skip: 0, page: 1, limit: config.limit });
    });

    it('should reject when user is neither owner nor admin', async () => {
      const { client, getInvitations } = createPaginatedMockClient(
        { is_owner: false, org_roles: [{ admin: false }] },
        [[]],
      );

      try {
        await getOrgUsers(client, ORG_UID);
        expect.fail('Expected getOrgUsers to reject');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal(messages.ERROR_ADMIN_ACCESS_DENIED);
      }

      expect(getInvitations.called).to.equal(false);
    });
  });
});
