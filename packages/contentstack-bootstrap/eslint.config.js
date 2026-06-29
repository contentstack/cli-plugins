import tseslint from 'typescript-eslint';
import globals from 'globals';
import mocha from 'eslint-plugin-mocha';

export default [
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      parser: tseslint.parser,
      globals: {
        ...globals.node,
        ...globals.mocha,
      },
    },

    plugins: {
      '@typescript-eslint': tseslint.plugin,
      mocha: mocha,
    },

    rules: {
      'unicorn/no-abusive-eslint-disable': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/ban-ts-ignore': 'off',
      indent: 'off',
      'object-curly-spacing': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
      'mocha/no-async-describe': 'off',
      'mocha/no-identical-title': 'off',
      'mocha/no-mocha-arrows': 'off',
      'mocha/no-setup-in-describe': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      'prefer-const': 'error',
      'no-fallthrough': 'error',
      'no-prototype-builtins': 'off',
    },
  },

  {
    files: ['*.d.ts'],

    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];