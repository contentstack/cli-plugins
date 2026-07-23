import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scheduleEntryAction } from '../../src/lib/create-stack';

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));

vi.mock('axios', () => ({ default: { post: mockPost } }));

vi.mock('@contentstack/cli-utilities', () => ({
  configHandler: {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'authorisationType') return 'BASIC';
      if (key === 'authtoken') return 'test-authtoken';
      if (key === 'region') return 'NA';
      return undefined;
    }),
  },
  authHandler: {
    checkExpiryAndRefresh: vi.fn().mockResolvedValue(undefined),
  },
}));

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

  beforeEach(() => {
    mockPost.mockReset();
    mockPost.mockResolvedValue({ data: {} });
  });

  it('sends api_version: 3.2 header on entry publish', async () => {
    await scheduleEntryAction(API_KEY, ENTRY_OPTS);

    expect(mockPost).toHaveBeenCalledOnce();
    const [url, , { headers }] = mockPost.mock.calls[0];
    expect(url).toContain('/v3/content_types/blog/entries/entry123/publish');
    expect(headers).toMatchObject({ api_version: '3.2' });
  });

  it('sends api_version: 3.2 header on entry unpublish', async () => {
    await scheduleEntryAction(API_KEY, { ...ENTRY_OPTS, action: 'unpublish' });

    const [url, , { headers }] = mockPost.mock.calls[0];
    expect(url).toContain('/v3/content_types/blog/entries/entry123/unpublish');
    expect(headers).toMatchObject({ api_version: '3.2' });
  });

  it('sends api_version: 3.2 header on asset publish (sys_assets)', async () => {
    await scheduleEntryAction(API_KEY, {
      ...ENTRY_OPTS,
      contentTypeUid: 'sys_assets',
      entryUid: 'asset456',
    });

    const [url, , { headers }] = mockPost.mock.calls[0];
    expect(url).toContain('/v3/assets/asset456/publish');
    expect(headers).toMatchObject({ api_version: '3.2' });
  });

  it('sends api_version: 3.2 header on asset unpublish (sys_assets)', async () => {
    await scheduleEntryAction(API_KEY, {
      ...ENTRY_OPTS,
      contentTypeUid: 'sys_assets',
      entryUid: 'asset456',
      action: 'unpublish',
    });

    const [url, , { headers }] = mockPost.mock.calls[0];
    expect(url).toContain('/v3/assets/asset456/unpublish');
    expect(headers).toMatchObject({ api_version: '3.2' });
  });

  it('includes branch in headers alongside api_version when branch option is provided', async () => {
    await scheduleEntryAction(API_KEY, { ...ENTRY_OPTS, branch: 'feature-branch' });

    const [, , { headers }] = mockPost.mock.calls[0];
    expect(headers).toMatchObject({ api_version: '3.2', branch: 'feature-branch' });
  });

  it('omits branch from headers when no branch option is given', async () => {
    await scheduleEntryAction(API_KEY, ENTRY_OPTS);

    const [, , { headers }] = mockPost.mock.calls[0];
    expect(headers).not.toHaveProperty('branch');
  });
});
