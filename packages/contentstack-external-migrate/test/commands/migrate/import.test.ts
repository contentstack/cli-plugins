import { describe, expect, it } from 'vitest';
import { buildStacksImportArgs } from '../../../src/commands/migrate/import';

describe('buildStacksImportArgs', () => {
  it('maps stack key and data-dir to native import', () => {
    expect(buildStacksImportArgs('bltKEY', './bundle', {})).toEqual([
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
    expect(args).not.toContain('--yes');
  });

  it('forwards skip-audit, module, and branch', () => {
    expect(
      buildStacksImportArgs('bltKEY', '/data/bundle', {
        'skip-audit': true,
        module: 'entries',
        branch: 'main',
      }),
    ).toEqual([
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
