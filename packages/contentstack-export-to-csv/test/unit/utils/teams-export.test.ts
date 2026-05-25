import { expect } from 'chai';
import {
  exportTeams,
  getTeamsDetail,
  exportRoleMappings,
  mapRoleWithTeams,
} from '../../../src/utils/teams-export';

describe('teams-export', () => {
  describe('module exports', () => {
    it('should export all team export functions', () => {
      expect(exportTeams).to.be.a('function');
      expect(getTeamsDetail).to.be.a('function');
      expect(exportRoleMappings).to.be.a('function');
      expect(mapRoleWithTeams).to.be.a('function');
    });
  });

  // Note: Team export flows call the SDK and csv-writer; cover with integration tests or isolated mocks.
});
