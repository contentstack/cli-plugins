import { spawn, spawnSync, type SpawnSyncReturns } from 'child_process';

export interface ContentfulCliInvocation {
  /** Executable: `contentful` or `npx` */
  command: string;
  /** Prefix args before the Contentful subcommand (e.g. `['-y', 'contentful-cli']`) */
  prefixArgs: string[];
}

type SpawnSyncFn = typeof spawnSync;

/** Returns true when `contentful` is on PATH and responds to --version. */
export function isGlobalContentfulCliAvailable(
  sync: SpawnSyncFn = spawnSync,
): boolean {
  try {
    const check: SpawnSyncReturns<string> = sync('contentful', ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return check.status === 0;
  } catch {
    return false;
  }
}

/**
 * Prefer a globally installed Contentful CLI; fall back to npx so export works
 * without a global install.
 */
export function resolveContentfulCli(sync: SpawnSyncFn = spawnSync): ContentfulCliInvocation {
  if (isGlobalContentfulCliAvailable(sync)) {
    return { command: 'contentful', prefixArgs: [] };
  }

  return { command: 'npx', prefixArgs: ['-y', 'contentful-cli'] };
}

const SENSITIVE_CONTENTFUL_FLAGS = new Set(['--management-token', '--mt']);

/** Strip secret values from argv before logging. */
export function redactContentfulCliArgs(subcommandArgs: string[]): string[] {
  const redacted: string[] = [];
  for (let i = 0; i < subcommandArgs.length; i++) {
    const arg = subcommandArgs[i];
    if (SENSITIVE_CONTENTFUL_FLAGS.has(arg) && i + 1 < subcommandArgs.length) {
      redacted.push(arg, '***');
      i += 1;
    } else {
      redacted.push(arg);
    }
  }
  return redacted;
}

/** Human-readable invocation for logs (never includes secrets). */
export function formatContentfulCliInvocation(subcommandArgs: string[]): string {
  const { command, prefixArgs } = resolveContentfulCli();
  return [command, ...prefixArgs, ...redactContentfulCliArgs(subcommandArgs)].join(' ');
}

/**
 * Run `contentful space export` (or other subcommands) via global CLI or npx.
 */
export async function spawnContentfulCli(
  subcommandArgs: string[],
  options?: { cwd?: string },
): Promise<number> {
  const { command, prefixArgs } = resolveContentfulCli();
  const args = [...prefixArgs, ...subcommandArgs];

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: options?.cwd,
    });
    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new Error(
            'Could not run Contentful CLI. Install globally: npm i -g contentful-cli — or ensure npx is available.',
          ),
        );
      } else {
        reject(err);
      }
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}
