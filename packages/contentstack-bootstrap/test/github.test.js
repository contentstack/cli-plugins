const { expect } = require('chai');
const GitHubClient = require('../lib/bootstrap/github/client').default;

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
});
