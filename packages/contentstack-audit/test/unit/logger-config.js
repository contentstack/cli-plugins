/**
 * Loaded by Mocha via --file before any test. Forces log config to non-debug
 * so the real Logger never enables the debug path and unit tests don't throw
 * when user has run: csdx config:set:log --level debug
 */
const cliUtils = require('@contentstack/cli-utilities');
const configHandler = cliUtils.configHandler;
const originalGet = configHandler.get.bind(configHandler);
configHandler.get = function (key) {
  if (key === 'log') return { level: 'info' };
  return originalGet(key);
};
