import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';

/**
 * Minimal CLI replacement for the API's customLogger. Same signature so the
 * copied contentful.service.ts works unchanged. Writes to ./logs/cli.log and
 * mirrors errors to stderr when CLI_VERBOSE=1.
 */
export default async function customLogger(
  projectId: string | undefined,
  destinationStackId: string | undefined,
  level: 'info' | 'error' | 'warn' | 'debug',
  payload: any
): Promise<void> {
  const logDir = path.resolve(process.cwd(), 'logs');
  try {
    await mkdirp(logDir);
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      projectId,
      destinationStackId,
      ...payload,
    });
    await fs.promises.appendFile(path.join(logDir, 'cli.log'), line + '\n');
  } catch {
    // logging must never throw
  }
  if (level === 'error' && process.env.CLI_VERBOSE === '1') {
    console.error('[error]', payload?.message ?? payload);
  }
}
