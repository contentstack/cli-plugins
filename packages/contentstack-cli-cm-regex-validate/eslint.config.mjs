import oclif from 'eslint-config-oclif'

export default [
  {
    ignores: ['lib/**', 'node_modules/**'],
  },
  ...oclif,
  {
    rules: {
      'unicorn/prefer-module': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'unicorn/no-array-for-each': 'off',
      'camelcase': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      'quotes': ['error', 'single', {avoidEscape: true}],
      'semi': ['error', 'never'],
      'unicorn/import-style': 'off',
      'unicorn/prefer-node-protocol': 'off',
      'unicorn/consistent-function-scoping': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'object-curly-spacing': ['error', 'never'],
      'node/no-missing-import': 'off',
    },
  },
]
