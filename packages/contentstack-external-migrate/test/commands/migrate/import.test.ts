import { expect } from 'chai';
import { buildStacksImportArgs } from '../../../src/commands/migrate/import';

describe('buildStacksImportArgs', () => {
  it('maps stack key and data-dir to native import', () => {
    expect(buildStacksImportArgs('bltKEY', './bundle', {})).to.deep.equal([
      'cm:stacks:import',
      '--stack-api-key',
      'bltKEY',
      '--data-dir',
      './bundle',
      '--yes',
    ]);
  });

  it('omits --yes when yes is false', () => {
    const args = buildStacksImportArgs('bltKEY', './bundle', { yes: false });
    expect(args).to.not.include('--yes');
  });

  it('forwards skip-audit, module, and branch', () => {
    expect(
      buildStacksImportArgs('bltKEY', '/data/bundle', {
        'skip-audit': true,
        module: 'entries',
        branch: 'main',
      }),
    ).to.deep.equal([
      'cm:stacks:import',
      '--stack-api-key',
      'bltKEY',
      '--data-dir',
      '/data/bundle',
      '--yes',
      '--skip-audit',
      '--module',
      'entries',
      '--branch',
      'main',
    ]);
  });
});
