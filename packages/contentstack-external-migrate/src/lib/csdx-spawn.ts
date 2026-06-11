import { spawn, type ChildProcess } from 'child_process';

export type CsdxSpawnFn = (
  command: string,
  args: string[],
  options: { stdio: 'inherit' },
) => ChildProcess;

/**
 * Run the globally installed Contentstack CLI. Audit/import wrappers use this
 * instead of reimplementing cm:stacks:*.
 */
export async function spawnCsdx(
  args: string[],
  spawnFn: CsdxSpawnFn = spawn,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawnFn('csdx', args, { stdio: 'inherit' });
    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('csdx not found. Install: npm i -g @contentstack/cli'));
      } else {
        reject(err);
      }
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}
