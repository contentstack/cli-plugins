const path = require('path');

process.env.TS_NODE_PROJECT = path.resolve('tsconfig.json');
process.env.TS_NODE_TRANSPILE_ONLY = 'true';
process.env.NODE_ENV = 'test';

global.oclif = global.oclif || {};
global.oclif.columns = 80;
