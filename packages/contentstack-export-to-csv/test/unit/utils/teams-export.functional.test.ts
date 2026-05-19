import { expect } from 'chai';
import sinon from 'sinon';
import * as cliUtilities from '@contentstack/cli-utilities';
import * as apiClient from '../../../src/utils/api-client';
import * as csvWriter from '../../../src/utils/csv-writer';

/** Other suites evict `interactive` from require.cache; always load the canonical instance before stubbing. */
function loadInteractiveFresh(): typeof import('../../../src/utils/interactive') {
  const id = require.resolve('../../../src/utils/interactive');
  delete require.cache[id];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(id) as typeof import('../../../src/utils/interactive');
}

function loadTeamsExport(): typeof import('../../../src/utils/teams-export') {
  const id = require.resolve('../../../src/utils/teams-export');
  delete require.cache[id];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(id) as typeof import('../../../src/utils/teams-export');
}

describe('teams-export functional', () => {
  let sandbox: sinon.SinonSandbox;
  const org = { name: 'Test Org', uid: 'org-1' };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(cliUtilities.cliux, 'loader').returns(undefined);
    sandbox.stub(cliUtilities.cliux, 'print');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('exportTeams returns early when no teams (7a)', async () => {
    sandbox.stub(apiClient, 'exportOrgTeams').resolves([] as any);
    const { exportTeams } = loadTeamsExport();
    await exportTeams({} as any, org, undefined, ',');
    const printStub = cliUtilities.cliux.print as sinon.SinonStub;
    const noTeamMsg = printStub.getCalls().some((c) => String(c.args[0]).includes('does not have any teams'));
    expect(noTeamMsg).to.equal(true);
  });

  it('exportTeams writes CSV and passes delimiter to write (7b)', async () => {
    const team = {
      uid: 't1',
      name: 'Team A',
      description: 'd',
      organizationRole: 'mem',
      Total_Members: 1,
      users: [],
      stackRoleMapping: [],
    };
    sandbox.stub(apiClient, 'exportOrgTeams').resolves([team] as any);
    const writeSpy = sandbox.stub(csvWriter, 'write');
    sandbox.stub(apiClient, 'getRoleData').resolves({ items: [] } as any);
    const interactiveMod = loadInteractiveFresh();
    sandbox.stub(interactiveMod, 'promptContinueExport').resolves(true);
    const { exportTeams } = loadTeamsExport();
    await exportTeams({} as any, org, undefined, '|');
    expect(writeSpy.called).to.equal(true);
    const delimiterArgs = writeSpy.getCalls().map((c) => c.args[4]);
    expect(delimiterArgs).to.include('|');
  });

  it('getTeamsDetail writes all teams when no teamUid (7c)', async () => {
    const writeSpy = sandbox.stub(csvWriter, 'write');
    const { getTeamsDetail } = loadTeamsExport();
    const teams = [
      { uid: 't1', name: 'A', users: [{ id: 1, active: true }] },
    ] as any[];
    await getTeamsDetail(teams, org, undefined, ',');
    expect(writeSpy.calledOnce).to.equal(true);
  });

  it('getTeamsDetail handles missing team uid (7c)', async () => {
    const { getTeamsDetail } = loadTeamsExport();
    const teams = [{ uid: 'other', name: 'A', users: [] }] as any[];
    await getTeamsDetail(teams, org, 'missing-uid', ',');
    expect((cliUtilities.cliux.print as sinon.SinonStub).called).to.equal(true);
  });

  it('getTeamsDetail writes matched team users when teamUid is set (7c team branch)', async () => {
    const writeSpy = sandbox.stub(csvWriter, 'write');
    const { getTeamsDetail } = loadTeamsExport();
    const teams = [
      {
        uid: 'target-team',
        name: 'Target Team',
        users: [
          { id: 1, email: 'u@x.com', active: true, orgInvitationStatus: 'pending' },
        ],
      },
    ] as any[];
    await getTeamsDetail(teams, org, 'target-team', ';');
    expect(writeSpy.calledOnce).to.equal(true);
    const call = writeSpy.firstCall.args;
    const rows = call[1] as any[];
    const fileName = call[2] as string;
    expect(fileName).to.include('target-team');
    expect(fileName).to.include('_User_Details_export.csv');
    expect(rows).to.have.lengthOf(1);
    expect(rows[0]['team-name']).to.equal('Target Team');
    expect(rows[0]['team-uid']).to.equal('target-team');
    expect(rows[0].active).to.equal(undefined);
    expect(rows[0].orgInvitationStatus).to.equal(undefined);
  });

  it('exportRoleMappings with teamUid hits stack-not-admin warning path (7f)', async () => {
    const teams = [
      {
        uid: 't1',
        name: 'T',
        stackRoleMapping: [{ stackApiKey: 'k1', roles: ['r1'] }],
      },
    ] as any[];
    sandbox.stub(apiClient, 'getRoleData').resolves({
      items: [
        {
          uid: 'r1',
          name: 'Role',
          stack: { api_key: 'wrong-key', name: 'S', uid: 'su' },
        },
      ],
    } as any);
    const interactiveMod = loadInteractiveFresh();
    sandbox.stub(interactiveMod, 'promptContinueExport').resolves(true);
    const writeSpy = sandbox.stub(csvWriter, 'write');
    const { exportRoleMappings } = loadTeamsExport();
    await exportRoleMappings({} as any, teams, 't1', ',');

    const printStub = cliUtilities.cliux.print as sinon.SinonStub;
    const warned = printStub.getCalls().some((c) => String(c.args[0]).includes('Admin access denied'));
    expect(warned).to.equal(true);
    expect(writeSpy.calledOnce).to.equal(true);
    const call = writeSpy.firstCall.args;
    const rows = call[1] as any[];
    expect(rows[0]['Stack Name']).to.equal('');
  });

  it('exportRoleMappings warns and exits when user declines (7d)', async () => {
    const teams = [
      {
        uid: 't1',
        name: 'T',
        stackRoleMapping: [{ stackApiKey: 'k1', roles: ['r1'] }],
      },
    ] as any[];
    sandbox.stub(apiClient, 'getRoleData').resolves({
      items: [
        {
          uid: 'r1',
          name: 'Role',
          stack: { api_key: 'wrong', name: 'S', uid: 'su' },
        },
      ],
    } as any);
    const interactiveMod = loadInteractiveFresh();
    sandbox.stub(interactiveMod, 'promptContinueExport').resolves(false);
    const exitStub = sandbox.stub(process, 'exit' as any);
    const { exportRoleMappings } = loadTeamsExport();
    await exportRoleMappings({} as any, teams, undefined, ',');
    expect(exitStub.calledWith(1)).to.equal(true);
    exitStub.restore();
  });

  it('exportRoleMappings walks all teams when teamUid is omitted (nested loops)', async () => {
    const teams = [
      {
        uid: 't1',
        name: 'T1',
        stackRoleMapping: [{ stackApiKey: 'k1', roles: ['r1'] }],
      },
      {
        uid: 't2',
        name: 'T2',
        stackRoleMapping: [{ stackApiKey: 'k2', roles: ['r2'] }],
      },
    ] as any[];
    const roleStub = sandbox.stub(apiClient, 'getRoleData');
    roleStub.onFirstCall().resolves({
      items: [{ uid: 'r1', name: 'Editor', stack: { api_key: 'k1', name: 'Stack1', uid: 's1' } }],
    } as any);
    roleStub.onSecondCall().resolves({
      items: [{ uid: 'r2', name: 'Author', stack: { api_key: 'wrong-k2', name: 'Stack2', uid: 's2' } }],
    } as any);
    const interactiveMod = loadInteractiveFresh();
    sandbox.stub(interactiveMod, 'promptContinueExport').resolves(true);
    const writeSpy = sandbox.stub(csvWriter, 'write');
    const { exportRoleMappings } = loadTeamsExport();
    await exportRoleMappings({} as any, teams, undefined, '|');

    expect(writeSpy.calledOnce).to.equal(true);
    const rows = writeSpy.firstCall.args[1] as any[];
    expect(rows).to.have.lengthOf(2);
    expect(rows[0]['Team Name']).to.equal('T1');
    expect(rows[1]['Team Name']).to.equal('T2');
  });

  it('mapRoleWithTeams maps role rows (7e)', async () => {
    sandbox.stub(apiClient, 'getRoleData').resolves({
      items: [
        {
          uid: 'r1',
          name: 'Editor',
          stack: { api_key: 'k1', name: 'Stack1', uid: 'suid' },
        },
      ],
    } as any);
    const { mapRoleWithTeams } = loadTeamsExport();
    const rows = await mapRoleWithTeams({} as any, { stackApiKey: 'k1', roles: ['r1'] } as any, 'TeamX', 'tx');
    expect(rows[0]['Team Name']).to.equal('TeamX');
    expect(rows[0]['Stack Name']).to.equal('Stack1');
    expect(rows[0]['Role Name']).to.equal('Editor');
  });
});
