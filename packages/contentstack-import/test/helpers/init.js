// Minimal test helper for unit tests
const { createRequire } = require('node:module');
const requireNode = createRequire(__filename);
// Same node:fs object @contentstack/cli-utilities uses; tests stub this so readContentTypeSchemas sees stubs
globalThis.__CONTENTSTACK_TEST_FS__ = requireNode('node:fs');

module.exports = {
  // Basic test utilities can be added here
};
