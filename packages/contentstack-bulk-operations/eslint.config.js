'use strict';

const path = require('path');
const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

module.exports = [
  {
    ignores: ['lib/**', 'node_modules/**', 'test/**', '*.js'],
  },
  ...compat.config({
    env: {
      node: true,
      es2021: true,
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
      project: path.join(__dirname, 'tsconfig.json'),
      sourceType: 'module',
    },
    plugins: ['@typescript-eslint', 'prettier'],
    extends: [
      'plugin:@typescript-eslint/recommended',
      'plugin:@typescript-eslint/recommended-requiring-type-checking',
      'prettier',
    ],
    ignorePatterns: ['lib/**/*', 'test/**/*', 'node_modules/**/*', '*.js'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'none',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      '@typescript-eslint/no-redeclare': 'off',
      eqeqeq: ['error', 'smart'],
      'id-match': 'error',
      'no-eval': 'error',
      'no-var': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      'prefer-const': 'error',
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  }),
];
