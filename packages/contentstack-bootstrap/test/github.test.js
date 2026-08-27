const { expect } = require('chai');
const sinon = require('sinon');
const { Readable } = require('stream');
const { HttpClient } = require('@contentstack/cli-utilities');
const GitHubClient = require('../lib/bootstrap/github/client').default;
const GithubError = require('../lib/bootstrap/github/github-error').default;

describe('Github Client', function () {
  it('Parse github url', () => {
    expect(GitHubClient.parsePath('contentstack/contentstack-nextjs-react-universal-demo')).to.deep.equal({
      user: 'contentstack',
      name: 'contentstack-nextjs-react-universal-demo',
    });
  });

  it('Git Tarball url creation', () => {
    const repo = GitHubClient.parsePath('contentstack/contentstack-nextjs-react-universal-demo');
    const gClient = new GitHubClient(repo);
    expect(gClient.gitTarBallUrl).to.be.equal(
      'https://api.github.com/repos/contentstack/contentstack-nextjs-react-universal-demo/tarball/cli-use',
    );
  });

  describe('streamRelease', function () {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should throw GithubError with status 404 when the branch does not exist', async () => {
      const notFoundStream = new Readable({ read() {} });
      notFoundStream.push(Buffer.from('404: Not Found'));
      notFoundStream.push(null);

      const httpStub = { get: sandbox.stub().resolves({ status: 404, data: notFoundStream }), options: sandbox.stub().returnsThis() };
      sandbox.stub(HttpClient, 'create').returns(httpStub);

      const client = new GitHubClient(GitHubClient.parsePath('contentstack/kickstart-next'));

      try {
        await client.streamRelease(client.gitTarBallUrl);
        throw new Error('Expected GithubError to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(GithubError);
        expect(err.status).to.equal(404);
      }
    });

    it('should throw GithubError with status 500 on server error', async () => {
      const errStream = new Readable({ read() {} });
      errStream.push(Buffer.from('Internal Server Error'));
      errStream.push(null);

      const httpStub = { get: sandbox.stub().resolves({ status: 500, data: errStream }), options: sandbox.stub().returnsThis() };
      sandbox.stub(HttpClient, 'create').returns(httpStub);

      const client = new GitHubClient(GitHubClient.parsePath('contentstack/kickstart-next'));

      try {
        await client.streamRelease(client.gitTarBallUrl);
        throw new Error('Expected GithubError to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(GithubError);
        expect(err.status).to.equal(500);
      }
    });

    it('should throw GithubError with status 302 on unexpected redirect', async () => {
      const redirectStream = new Readable({ read() {} });
      redirectStream.push(null);

      const httpStub = { get: sandbox.stub().resolves({ status: 302, data: redirectStream }), options: sandbox.stub().returnsThis() };
      sandbox.stub(HttpClient, 'create').returns(httpStub);

      const client = new GitHubClient(GitHubClient.parsePath('contentstack/kickstart-next'));

      try {
        await client.streamRelease(client.gitTarBallUrl);
        throw new Error('Expected GithubError to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(GithubError);
        expect(err.status).to.equal(302);
      }
    });

    it('should return the response stream when status is 200', async () => {
      const mockStream = new Readable({ read() {} });
      const httpStub = { get: sandbox.stub().resolves({ status: 200, data: mockStream }), options: sandbox.stub().returnsThis() };
      sandbox.stub(HttpClient, 'create').returns(httpStub);

      const client = new GitHubClient(GitHubClient.parsePath('contentstack/kickstart-next'));
      const result = await client.streamRelease(client.gitTarBallUrl);

      expect(result).to.equal(mockStream);
    });

    it('should pass Authorization header for private repos', async () => {
      const mockStream = new Readable({ read() {} });
      const httpStub = { get: sandbox.stub().resolves({ status: 200, data: mockStream }), options: sandbox.stub().returnsThis() };
      sandbox.stub(HttpClient, 'create').returns(httpStub);

      const client = new GitHubClient(GitHubClient.parsePath('contentstack/private-repo'), true, 'my-token');
      await client.streamRelease(client.gitTarBallUrl);

      const callOptions = httpStub.options.firstCall.args[0];
      expect(callOptions.headers).to.deep.equal({ Authorization: 'token my-token' });
    });

    it('should throw GithubError immediately for private repos with no access token', async () => {
      const client = new GitHubClient(GitHubClient.parsePath('contentstack/private-repo'), true, undefined);

      try {
        await client.streamRelease(client.gitTarBallUrl);
        throw new Error('Expected GithubError to be thrown');
      } catch (err) {
        expect(err).to.be.instanceOf(GithubError);
        expect(err.status).to.equal(1);
      }
    });
  });

  describe('extract', function () {
    it('should reject (not crash the process) when the stream contains invalid gzip data', async () => {
      const client = new GitHubClient(GitHubClient.parsePath('contentstack/kickstart-next'));

      const badStream = new Readable({ read() {} });
      badStream.push(Buffer.from('404: Not Found'));
      badStream.push(null);

      try {
        await client.extract('/tmp', badStream);
        throw new Error('Expected extraction error to be thrown');
      } catch (err) {
        expect(err.code).to.equal('Z_DATA_ERROR');
      }
    });
  });
});
