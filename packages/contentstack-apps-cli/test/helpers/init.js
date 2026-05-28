const path = require('path')
process.env.TS_NODE_PROJECT = path.resolve('test/tsconfig.json')
process.env.NODE_ENV = 'development'

global.oclif = global.oclif || {}
global.oclif.columns = 80
global.commonMock = require(path.join(__dirname, '../unit/mock/common.mock.json'))

const { configHandler } = require('@contentstack/cli-utilities')
if (!configHandler.get('region')) {
  configHandler.set('region', {
    name: 'NA',
    cma: 'https://api.contentstack.io',
    cda: 'https://cdn.contentstack.io',
  })
}