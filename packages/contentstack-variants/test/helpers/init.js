const path = require('path')
process.env.TS_NODE_PROJECT = path.resolve('test/tsconfig.json')
// run tests through ts-node's transpiler only; type-checking is a separate (tsc) concern
process.env.TS_NODE_TRANSPILE_ONLY = 'true'
process.env.NODE_ENV = 'development'

global.oclif = global.oclif || {}
global.oclif.columns = 80
