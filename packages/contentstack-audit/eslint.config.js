import oclif from 'eslint-config-oclif';
import oclifTypescript from 'eslint-config-oclif-typescript';

export default [
  oclif,
  oclifTypescript,
  {
    ignores: [
      'dist/**/*',
    ],
  },
];
