const { loadChalk } = require('@contentstack/cli-utilities');

/**
 * Ensure cli-utilities chalk singleton is ready before command execution.
 */
module.exports = async function loadChalkHook() {
  await loadChalk();
};
