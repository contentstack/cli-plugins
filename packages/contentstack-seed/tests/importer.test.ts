// Mock the external command + utils so their real (ESM-heavy) modules never load.
jest.mock('@contentstack/cli-cm-import', () => ({
  __esModule: true,
  default: { run: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@contentstack/cli-utilities', () => ({
  pathValidator: (p: string) => p,
  sanitizePath: (p: string) => p,
}));
// process.chdir is a getter-only, non-configurable property on modern Node, so it
// can't be spied/reassigned; mock the imported `process` module instead.
jest.mock('process', () => ({ chdir: jest.fn() }));

import * as process from 'process';
import ImportCommand from '@contentstack/cli-cm-import';
import * as importer from '../src/seed/importer';

const tmpPath = '/var/tmp';

describe('importer', () => {
  test('should chdir into the temp path and run the import command', async () => {
    await importer.run({
      api_key: 'my_key',
      cdaHost: '',
      cmaHost: '',
      master_locale: 'en-us',
      tmpPath,
      isAuthenticated: false,
    });

    expect(process.chdir).toHaveBeenCalledWith(tmpPath);
    expect((ImportCommand as any).run).toHaveBeenCalledWith(
      expect.arrayContaining(['-k', 'my_key', '--skip-audit']),
    );
  });
});
