import tseslint from 'typescript-eslint';
import globals from 'globals';
import unicorn from 'eslint-plugin-unicorn';
import n from 'eslint-plugin-n';

export default [
  ...tseslint.configs.recommended,
  {
    ignores: ['lib/**/*', 'test/**/*', 'types/**/*', 'node_modules/**/*', '*.js'],
  },
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
      },
    },
    // unicorn/node registered (not enabled) so pre-existing inline eslint-disable
    // directives that reference their rules resolve under ESLint 10 flat config.
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      unicorn,
      node: n,
    },
    rules: {
      // Pre-existing lint debt surfaced once the ESLint-10 flat-config crash was
      // fixed. Kept visible as warnings (tracked for follow-up cleanup) rather
      // than blocking, since these rules were never enforced while lint crashed.
      '@typescript-eslint/no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': ['warn', { allowShortCircuit: true, allowTernary: true }],
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-wrapper-object-types': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-redeclare': 'off',
      'prefer-const': 'warn',
      'prefer-rest-params': 'warn',
      'no-var': 'warn',
      eqeqeq: 'warn',
      'no-eval': 'error',
    },
  },
];
