'use strict';

const path = require('path');
const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

module.exports = [
  ...compat.config({
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    plugins: ['@typescript-eslint'],
    extends: ['oclif', 'oclif-typescript'],
    rules: {
      'unicorn/prefer-module': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'unicorn/no-array-for-each': 'off',
      camelcase: 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'never'],
      'unicorn/import-style': 'off',
      'unicorn/prefer-node-protocol': 'off',
      'unicorn/consistent-function-scoping': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'object-curly-spacing': ['error', 'never'],
      'node/no-missing-import': 'off',
    },
  }),
];
