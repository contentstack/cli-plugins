jest.mock('../../src/seed/importer', () => ({
  run: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@contentstack/cli-utilities', () => ({
  cliux: {
    print: jest.fn(),
    loader: jest.fn(),
    error: jest.fn(),
  },
  HttpClient: {
    create: jest.fn(() => ({
      get: jest.fn(),
      options: jest.fn().mockReturnThis(),
      resetConfig: jest.fn(),
    })),
  },
  managementSDKClient: jest.fn(),
  configHandler: {
    get: jest.fn(),
  },
  ContentstackClient: jest.fn(),
  pathValidator: jest.fn((p: string) => p),
  sanitizePath: jest.fn((p: string) => p),
}));

import ContentModelSeeder from '../../src/seed/index';
import GitHubClient from '../../src/seed/github/client';
import * as interactive from '../../src/seed/interactive';
import { OFFICIAL_SEED_STACKS } from '../../src/seed/seed-stacks';

describe('ContentModelSeeder', () => {
  const baseOptions = {
    parent: null,
    cdaHost: 'https://cdn.contentstack.io',
    cmaHost: 'https://api.contentstack.io',
    gitHubPath: undefined as string | undefined,
    orgUid: undefined as string | undefined,
    stackUid: 'stack-api-key' as string | undefined,
    stackName: undefined as string | undefined,
    fetchLimit: undefined as string | undefined,
    skipStackConfirmation: true,
    isAuthenticated: true,
    managementToken: 'management-token',
    alias: undefined as string | undefined,
    master_locale: 'en-us',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not define getAllRepos on GitHubClient', () => {
    expect((GitHubClient.prototype as unknown as { getAllRepos?: unknown }).getAllRepos).toBeUndefined();
  });

  describe('getInput when gitHubPath is incomplete', () => {
    it('calls inquireOfficialSeedStack with the official catalog', async () => {
      const inquireSpy = jest
        .spyOn(interactive, 'inquireOfficialSeedStack')
        .mockResolvedValue({ owner: 'contentstack', repo: 'stack-starter-app' });
      const makeGetSpy = jest.spyOn(GitHubClient.prototype, 'makeGetApiCall').mockResolvedValue({
        statusCode: 200,
        data: {},
      } as never);

      const seeder = new ContentModelSeeder({
        ...baseOptions,
        gitHubPath: undefined,
        stackUid: 'stack-api-key',
        managementToken: 'management-token',
      });

      await seeder.getInput();

      expect(inquireSpy).toHaveBeenCalledTimes(1);
      expect(inquireSpy).toHaveBeenCalledWith(OFFICIAL_SEED_STACKS);
      expect(makeGetSpy).toHaveBeenCalledWith('stack-starter-app');
    });

    it('rebuilds GitHub client for selected owner after official stack selection', async () => {
      jest.spyOn(interactive, 'inquireOfficialSeedStack').mockResolvedValue({
        owner: 'contentstack',
        repo: 'kickstart-stack-seed',
      });
      jest.spyOn(GitHubClient.prototype, 'makeGetApiCall').mockResolvedValue({
        statusCode: 200,
        data: {},
      } as never);

      const seeder = new ContentModelSeeder({
        ...baseOptions,
        gitHubPath: 'otherorg',
        stackUid: 'stack-api-key',
        managementToken: 'management-token',
      });

      await seeder.getInput();

      expect((seeder as unknown as { ghUsername: string }).ghUsername).toBe('contentstack');
      expect((seeder as unknown as { ghRepo: string }).ghRepo).toBe('kickstart-stack-seed');
    });

    it('does not call makeGetApiCall when user exits from official stack prompt', async () => {
      jest.spyOn(interactive, 'inquireOfficialSeedStack').mockRejectedValue(new Error('Exit'));
      const makeGetSpy = jest.spyOn(GitHubClient.prototype, 'makeGetApiCall');

      const seeder = new ContentModelSeeder({
        ...baseOptions,
        gitHubPath: undefined,
        stackUid: 'stack-api-key',
        managementToken: 'management-token',
      });

      await expect(seeder.getInput()).rejects.toThrow('Exit');
      expect(makeGetSpy).not.toHaveBeenCalled();
    });
  });

  describe('getInput when full gitHubPath is set', () => {
    it('does not call inquireOfficialSeedStack', async () => {
      const inquireSpy = jest.spyOn(interactive, 'inquireOfficialSeedStack');
      jest.spyOn(GitHubClient.prototype, 'makeGetApiCall').mockResolvedValue({
        statusCode: 200,
        data: {},
      } as never);

      const seeder = new ContentModelSeeder({
        ...baseOptions,
        gitHubPath: 'acme/custom-seed',
        stackUid: 'stack-api-key',
        managementToken: 'management-token',
      });

      await seeder.getInput();

      expect(inquireSpy).not.toHaveBeenCalled();
    });
  });
});
