import { describe, expect, it } from 'vitest';
import { buildStacksAuditArgs } from '../../../src/commands/migrate/audit';

describe('buildStacksAuditArgs', () => {
  it('maps required data-dir to native audit', () => {
    expect(buildStacksAuditArgs('./bundle', {})).toEqual([
      'cm:stacks:audit',
      '--data-dir',
      './bundle',
    ]);
  });

  it('passes optional report-path, modules, and csv', () => {
    expect(
      buildStacksAuditArgs('/data/bundle', {
        'report-path': './audit-reports',
        modules: 'content-types,entries',
        csv: true,
      }),
    ).toEqual([
      'cm:stacks:audit',
      '--data-dir',
      '/data/bundle',
      '--report-path',
      './audit-reports',
      '--modules',
      'content-types,entries',
      '--csv',
    ]);
  });

  it('omits csv when false', () => {
    const args = buildStacksAuditArgs('./bundle', { csv: false });
    expect(args).not.toContain('--csv');
  });
});
