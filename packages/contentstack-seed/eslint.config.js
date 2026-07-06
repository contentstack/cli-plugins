import oclif from 'eslint-config-oclif';
import oclifTypescript from 'eslint-config-oclif-typescript';

export default [
  oclif,
  oclifTypescript,
  {
    rules: {
      'unicorn/no-abusive-eslint-disable': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/ban-ts-ignore': 'off',
    },
  },
];