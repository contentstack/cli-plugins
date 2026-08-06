import { expect } from 'chai';
import sinon from 'sinon';
import axios from 'axios';
import { configHandler, authHandler } from '@contentstack/cli-utilities';
import { scheduleEntryAction } from '../../src/lib/create-stack';

describe('scheduleEntryAction', () => {
  const API_KEY = 'blt-test-api-key';
  const ENTRY_OPTS = {
    contentTypeUid: 'blog',
    entryUid: 'entry123',
    action: 'publish' as const,
    environment: 'development',
    locale: 'en-us',
    scheduledAt: '2026-08-01T10:00:00.000Z',
  };

  let postStub: sinon.SinonStub;

  beforeEach(() => {
    postStub = sinon.stub(axios, 'post').resolves({ data: {} } as any);
    sinon.stub(configHandler, 'get').callsFake((key: string) => {
      if (key === 'authorisationType') return 'BASIC';
      if (key === 'authtoken') return 'test-authtoken';
      if (key === 'region') return 'NA';
      return undefined;
    });
    sinon.stub(authHandler, 'checkExpiryAndRefresh').resolves(undefined);
  });

  afterEach(() => sinon.restore());

  it('sends api_version: 3.2 header on entry publish', async () => {
    await scheduleEntryAction(API_KEY, ENTRY_OPTS);

    expect(postStub.calledOnce).to.be.true;
    const [url, , { headers }] = postStub.firstCall.args;
    expect(url).to.contain('/v3/content_types/blog/entries/entry123/publish');
    expect(headers).to.include({ api_version: '3.2' });
  });

  it('sends api_version: 3.2 header on entry unpublish', async () => {
    await scheduleEntryAction(API_KEY, { ...ENTRY_OPTS, action: 'unpublish' });

    const [url, , { headers }] = postStub.firstCall.args;
    expect(url).to.contain('/v3/content_types/blog/entries/entry123/unpublish');
    expect(headers).to.include({ api_version: '3.2' });
  });

  it('sends api_version: 3.2 header on asset publish (sys_assets)', async () => {
    await scheduleEntryAction(API_KEY, {
      ...ENTRY_OPTS,
      contentTypeUid: 'sys_assets',
      entryUid: 'asset456',
    });

    const [url, , { headers }] = postStub.firstCall.args;
    expect(url).to.contain('/v3/assets/asset456/publish');
    expect(headers).to.include({ api_version: '3.2' });
  });

  it('sends api_version: 3.2 header on asset unpublish (sys_assets)', async () => {
    await scheduleEntryAction(API_KEY, {
      ...ENTRY_OPTS,
      contentTypeUid: 'sys_assets',
      entryUid: 'asset456',
      action: 'unpublish',
    });

    const [url, , { headers }] = postStub.firstCall.args;
    expect(url).to.contain('/v3/assets/asset456/unpublish');
    expect(headers).to.include({ api_version: '3.2' });
  });

  it('includes branch in headers alongside api_version when branch option is provided', async () => {
    await scheduleEntryAction(API_KEY, { ...ENTRY_OPTS, branch: 'feature-branch' });

    const [, , { headers }] = postStub.firstCall.args;
    expect(headers).to.include({ api_version: '3.2', branch: 'feature-branch' });
  });

  it('omits branch from headers when no branch option is given', async () => {
    await scheduleEntryAction(API_KEY, ENTRY_OPTS);

    const [, , { headers }] = postStub.firstCall.args;
    expect(headers).to.not.have.property('branch');
  });
});
