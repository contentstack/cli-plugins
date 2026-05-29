const path = require('path')
process.env.TS_NODE_PROJECT = path.resolve('test/tsconfig.json')
process.env.NODE_ENV = 'development'

global.oclif = global.oclif || {}
global.oclif.columns = 80
global.commonMock = require(path.join(__dirname, '../unit/mock/common.mock.json'))

// Set a mock region so tests that call configHandler.get('region') or
// getDeveloperHubUrl() at module-load time don't throw in CI environments
const { configHandler } = require('@contentstack/cli-utilities')
if (!configHandler.get('region')) {
  configHandler.set('region', {
    name: 'NA',
    cma: 'https://api.contentstack.io',
    cda: 'https://cdn.contentstack.io',
  })
}