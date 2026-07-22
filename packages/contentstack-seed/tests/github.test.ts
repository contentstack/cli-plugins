jest.mock('mkdirp');
// Avoid loading the real (ESM-heavy) cli-utilities; the client's httpClient is
// swapped for a fake below, so HttpClient.create() only needs to not throw.
jest.mock('@contentstack/cli-utilities', () => ({
  HttpClient: { create: jest.fn(() => ({ get: jest.fn(), options: jest.fn(), resetConfig: jest.fn() })) },
}));

import GitHubClient from '../src/seed/github/client';
const mkdirp = require('mkdirp');

const owner = 'owner';
const repo = 'repo';
const pattern = 'stack-';
const url = 'http://www.google.com';

// The client talks to GitHub through an injected HttpClient (cli-utilities).
// We build a real client then swap its private httpClient for this fake.
let httpClientMock: { get: jest.Mock; options: jest.Mock; resetConfig: jest.Mock };

function makeClient(): GitHubClient {
  const client = new GitHubClient(owner, pattern);
  (client as any).httpClient = httpClientMock;
  return client;
}

describe('GitHub', () => {
  beforeEach(() => {
    httpClientMock = {
      get: jest.fn(),
      options: jest.fn(),
      resetConfig: jest.fn(),
    };
    httpClientMock.options.mockReturnValue(httpClientMock);
  });

  test('should test parsePath', () => {
    expect(GitHubClient.parsePath('')).toStrictEqual({ repo: '', username: '' });
    expect(GitHubClient.parsePath('owner')).toStrictEqual({ repo: '', username: 'owner' });
    expect(GitHubClient.parsePath('owner/repo')).toStrictEqual({ repo: 'repo', username: 'owner' });
  });

  test('should set GitHub repository', () => {
    const client = new GitHubClient(owner, pattern);
    expect(client.gitHubRepoUrl).toBe(`https://api.github.com/repos/${owner}`);
  });

  test('should test getAllRepos', async () => {
    const client = makeClient();
    const repos = [{ name: 'ignored' }, { name: 'ignored' }];
    httpClientMock.get.mockResolvedValue({ data: { items: repos } });

    const result = await client.getAllRepos(100);

    expect(httpClientMock.get).toHaveBeenCalledWith(`${client.gitHubUserUrl}&per_page=100`);
    expect(result).toStrictEqual(repos);
  });

  test('should check GitHub folder existence', async () => {
    const client = makeClient();
    const headMock = jest
      .spyOn(client, 'makeHeadApiCall')
      .mockResolvedValueOnce({ statusCode: 200 })
      .mockResolvedValueOnce({ statusCode: 404 });

    const doesExist = await client.checkIfRepoExists(repo);
    const doesNotExist = await client.checkIfRepoExists(repo);

    expect(doesExist).toBe(true);
    expect(doesNotExist).toBe(false);
    expect(headMock).toHaveBeenCalledWith(repo);
  });

  test('should get latest tarball url', async () => {
    const client = makeClient();
    httpClientMock.get.mockResolvedValue({ data: { tarball_url: url } });

    const response = await client.getLatestTarballUrl(repo);

    expect(httpClientMock.get).toHaveBeenCalledWith(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
    expect(response).toBe(url);
  });

  test('should get latest', async () => {
    const destination = '/var/tmp';

    const client = makeClient();
    const getLatestTarballUrlMock = jest.spyOn(client, 'getLatestTarballUrl').mockResolvedValue(url);
    const streamReleaseMock = jest.spyOn(client, 'streamRelease').mockResolvedValue({} as any);
    const extractMock = jest.spyOn(client, 'extract').mockResolvedValue();

    await client.getLatest(repo, destination);

    expect(getLatestTarballUrlMock).toHaveBeenCalledWith(repo);
    expect(streamReleaseMock).toHaveBeenCalledWith(url);
    expect(extractMock).toHaveBeenCalled();
    expect(mkdirp).toHaveBeenCalledWith(destination);
  });

  test('should test error condition', async () => {
    const client = makeClient();
    httpClientMock.get.mockRejectedValue({ response: { status: 500, data: { error_message: 'error occurred' } } });

    await expect(client.getAllRepos(100)).rejects.toThrow('error occurred');
  });
});
