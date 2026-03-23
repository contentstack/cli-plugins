const path = require('path')
const { createRequire } = require('node:module')
const requireNode = createRequire(__filename)
process.env.TS_NODE_PROJECT = path.resolve('test/tsconfig.json')
process.env.NODE_ENV = 'development'

global.oclif = global.oclif || {}
global.oclif.columns = 80

// Same node:fs singleton @contentstack/cli-utilities uses for readContentTypeSchemas
globalThis.__CONTENTSTACK_TEST_FS__ = requireNode('node:fs')

// Minimal test helper for unit tests
module.exports = {
  // Basic test utilities can be added here
}
