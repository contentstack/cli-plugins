import { EventEmitter } from 'events';
import { describe, expect, it } from 'vitest';
import type { CsdxSpawnFn } from '../../src/lib/csdx-spawn';
import { spawnCsdx } from '../../src/lib/csdx-spawn';

function mockSpawn(exitCode: number): { fn: CsdxSpawnFn; capturedArgs: string[] } {
  const capturedArgs: string[] = [];
  const fn: CsdxSpawnFn = (command, args) => {
    expect(command).toBe('csdx');
    capturedArgs.splice(0, capturedArgs.length, ...args);
    const child = new EventEmitter() as ReturnType<CsdxSpawnFn>;
    process.nextTick(() => child.emit('exit', exitCode));
    return child;
  };
  return { fn, capturedArgs };
}

describe('spawnCsdx', () => {
  it('invokes csdx with the given args and returns exit code', async () => {
    const { fn, capturedArgs } = mockSpawn(0);
    const auditArgs = ['cm:stacks:audit', '--data-dir', '/tmp/bundle'];
    const code = await spawnCsdx(auditArgs, fn);
    expect(code).toBe(0);
    expect(capturedArgs).toEqual(auditArgs);
  });

  it('returns non-zero exit code from child', async () => {
    const { fn } = mockSpawn(2);
    const code = await spawnCsdx(['cm:stacks:audit'], fn);
    expect(code).toBe(2);
  });
});
