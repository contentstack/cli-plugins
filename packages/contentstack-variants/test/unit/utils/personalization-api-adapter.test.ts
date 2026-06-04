import sinon from 'sinon';
import { expect } from 'chai';
import { HttpClient, authenticationHandler } from '@contentstack/cli-utilities';
import { PersonalizationAdapter } from '../../../src';

const makeAdapterConfig = (branchName?: string, includeCmaConfig = true) => ({
  config: { ...(branchName ? { branchName } : {}) },
  baseURL: 'https://personalize.na-api.contentstack.com',
  headers: { 'X-Project-Uid': 'TEST-PROJECT' },
  ...(includeCmaConfig ? {
    cmaConfig: {
      baseURL: 'https://api.contentstack.io/v3',
      headers: { api_key: 'TEST-API-KEY' },
    },
  } : {}),
});

describe('PersonalizationAdapter — branch header', () => {
  let headersspy: sinon.SinonSpy;

  beforeEach(() => {
    sinon.stub(authenticationHandler, 'getAuthDetails').resolves();
    sinon.stub(authenticationHandler, 'accessToken').get(() => '');
    sinon.stub(authenticationHandler, 'isOauthEnabled').get(() => false);
    headersspy = sinon.spy(HttpClient.prototype, 'headers');
  });

  afterEach(() => sinon.restore());

  it('sets branch header on CMA client when branchName and cmaConfig are both present', async () => {
    const adapter = new PersonalizationAdapter(makeAdapterConfig('feature-branch') as any);
    await adapter.init();
    const branchCalls = headersspy.args.filter((a: any[]) => a[0]?.branch !== undefined);
    expect(branchCalls).to.have.length(1);
    expect(branchCalls[0][0]).to.deep.equal({ branch: 'feature-branch' });
  });

  it('does NOT set branch header when branchName is absent', async () => {
    const adapter = new PersonalizationAdapter(makeAdapterConfig(undefined, true) as any);
    await adapter.init();
    const branchCalls = headersspy.args.filter((a: any[]) => a[0]?.branch !== undefined);
    expect(branchCalls).to.have.length(0);
  });

  it('does NOT set branch header when cmaConfig is absent', async () => {
    const adapter = new PersonalizationAdapter(makeAdapterConfig('main', false) as any);
    await adapter.init();
    const branchCalls = headersspy.args.filter((a: any[]) => a[0]?.branch !== undefined);
    expect(branchCalls).to.have.length(0);
  });

  it('sets branch header exactly once (only on CMA client, not personalize client)', async () => {
    const adapter = new PersonalizationAdapter(makeAdapterConfig('staging') as any);
    await adapter.init();
    const branchCalls = headersspy.args.filter((a: any[]) => a[0]?.branch !== undefined);
    expect(branchCalls).to.have.length(1);
    expect(branchCalls[0][0]).to.deep.equal({ branch: 'staging' });
  });

  it('uses the exact branchName value from config', async () => {
    const adapter = new PersonalizationAdapter(makeAdapterConfig('eu-branch-2025') as any);
    await adapter.init();
    const branchCalls = headersspy.args.filter((a: any[]) => a[0]?.branch !== undefined);
    expect(branchCalls[0][0].branch).to.equal('eu-branch-2025');
  });
});
