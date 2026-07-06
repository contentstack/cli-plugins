import tseslint from 'typescript-eslint';
import globals from 'globals';
import oclif from 'eslint-config-oclif-typescript';

export default [
  ...tseslint.configs.recommended,

  oclif,

  {
    ignores: [
      'lib/**/*',
      'test/**/*',
      'types/**/*',
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
      '@typescript-eslint/quotes': [
        'error',
        'single',
        {
          avoidEscape: true,
          allowTemplateLiterals: true,
        },
      ],
      semi: 'off',
      '@typescript-eslint/type-annotation-spacing': 'error',
      '@typescript-eslint/no-redeclare': 'off',
      eqeqeq: ['error', 'smart'],
      'id-match': 'error',
      'no-eval': 'error',
      'no-var': 'error',
      quotes: 'off',
      indent: 'off',
      camelcase: 'off',
      'comma-dangle': 'off',
      'arrow-parens': 'off',
      'operator-linebreak': 'off',
      'object-curly-spacing': 'off',
      'node/no-missing-import': 'off',
      'padding-line-between-statements': 'off',
      '@typescript-eslint/ban-ts-ignore': 'off',
      'unicorn/no-abusive-eslint-disable': 'off',
      'unicorn/consistent-function-scoping': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
    },
  },
];