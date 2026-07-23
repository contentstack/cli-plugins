import { expect } from 'chai';
import { buildStacksAuditArgs } from '../../../src/commands/migrate/audit';

describe('buildStacksAuditArgs', () => {
  it('maps required data-dir to native audit', () => {
    expect(buildStacksAuditArgs('./bundle', {})).to.deep.equal([
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
    ).to.deep.equal([
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
    expect(args).to.not.include('--csv');
  });
});
