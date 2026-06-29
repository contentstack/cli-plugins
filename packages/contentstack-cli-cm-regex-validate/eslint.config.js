import tseslint from 'typescript-eslint';
import globals from 'globals';
import oclif from 'eslint-config-oclif';

export default [
  ...tseslint.configs.recommended,

  oclif,

  {
    ignores: [
      'lib/**/*',
    ],
  },

  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
      },
    },

    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },

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
  },
];
