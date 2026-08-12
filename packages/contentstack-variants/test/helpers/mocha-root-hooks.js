/**
 * @contentstack/cli-utilities uses lazy-loaded Chalk 5; preload before tests that hit cliux.
 */
const cliUtils = require('@contentstack/cli-utilities');
const loadChalk = cliUtils.loadChalk;

exports.mochaHooks = {
  beforeAll() {
    this.timeout(30_000);
    if (typeof loadChalk === 'function') return loadChalk();
  },
};
