module.exports = {
  roots: ['<rootDir>'],
  testMatch: [
    '**/test/**/*.+(ts|tsx)',
    '**/tests/**/*.+(ts|tsx)',
    '**/?(*.)+(spec|test).+(ts|tsx)',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '(node_modules/.pnpm/uuid@[^/]+/node_modules/uuid|node_modules/uuid)/.+\\.js$': [
      'babel-jest',
      {presets: [['@babel/preset-env', {modules: 'commonjs'}]]},
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!(.pnpm/uuid@[^/]+/node_modules/)?uuid/)'],
  verbose: true,
  collectCoverage: true,
}
