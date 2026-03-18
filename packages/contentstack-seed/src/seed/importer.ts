import * as fs from 'fs';
import * as process from 'process';
import * as path from 'path';
import ImportCommand from '@contentstack/cli-cm-import';
import { pathValidator, sanitizePath } from '@contentstack/cli-utilities';

const STACK_FOLDER = 'stack';

export interface ImporterOptions {
  master_locale: string;
  api_key: string;
  tmpPath: string;
  cmaHost: string;
  cdaHost: string;
  isAuthenticated: boolean;
  alias?: string;
}

export async function run(options: ImporterOptions) {
  const tmpPathResolved = path.resolve(sanitizePath(options.tmpPath));
  const stackPath = path.join(tmpPathResolved, STACK_FOLDER);

  // Support both structures: repo with stack/ folder (per docs) or content at root
  const importPath = fs.existsSync(stackPath)
    ? pathValidator(stackPath)
    : pathValidator(tmpPathResolved);

  const args = options.alias
    ? ['-k', options.api_key, '-d', importPath, '--alias', options.alias!]
    : ['-k', options.api_key, '-d', importPath];

  process.chdir(options.tmpPath);
  await ImportCommand.run(args.concat('--skip-audit'));
}
