import tseslint from 'typescript-eslint';

export default [
  // Don't lint compiled output
  { ignores: ['lib/**'] },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // allow destructure-to-omit (rest siblings) and unused positional params in signatures
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true }],
      // allow `cond && sideEffect()` / ternary guard statements
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      'unicorn/prefer-module': 'off',
      'unicorn/no-abusive-eslint-disable': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      'node/no-missing-import': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-useless-escape': 'off',
    },
  },
];