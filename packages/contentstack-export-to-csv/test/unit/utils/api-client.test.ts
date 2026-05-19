import { expect } from 'chai';
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
  getAllTaxonomies,
  getAllTermsOfTaxonomy,
  getTaxonomy,
  createImportableCSV,
} from '../../../src/utils/api-client';

describe('api-client', () => {
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
      expect(getRoleData).to.be.a('function');
      expect(getAllTaxonomies).to.be.a('function');
      expect(getAllTermsOfTaxonomy).to.be.a('function');
      expect(getTaxonomy).to.be.a('function');
      expect(createImportableCSV).to.be.a('function');
    });
  });

  // Note: Functional tests use mocked SDK chains; keep in a dedicated file when re-adding coverage.
});
