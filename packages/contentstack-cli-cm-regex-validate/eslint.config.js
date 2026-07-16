import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  {
    ignores: ['lib/**/*', 'test/**/*', 'bin/*'],
  },
  {
    files: ['src/**/*.ts'],
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
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended[1].rules,
      '@typescript-eslint/no-require-imports': 'off',
      'camelcase': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'never'],
      '@typescript-eslint/ban-ts-comment': 'off',
      'object-curly-spacing': ['error', 'never'],
    },
  },
];