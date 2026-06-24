import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  ...tseslint.configs.recommended,
  {
    ignores: [
      'lib/**/*',
      'test/**/*',
      'dist/**/*',
    ],
  },
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'none',
        },
      ],
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      quotes: 'off',
      semi: 'off',
      '@typescript-eslint/no-redeclare': 'off',
      eqeqeq: ['error', 'smart'],
      'id-match': 'error',
      'no-eval': 'error',
      'no-var': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'prefer-const': 'error',
    },
  },
];
