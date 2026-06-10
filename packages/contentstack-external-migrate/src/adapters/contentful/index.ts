import type { LegacyAdapter } from '../types';
import { convertContentfulExport } from './convert';
import { exportContentful } from './export';

export const contentfulAdapter: LegacyAdapter = {
  legacy: 'contentful',
  export: exportContentful,
  convert: convertContentfulExport,
};
