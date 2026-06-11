import { describe, expect, it } from 'vitest';
import type { SpawnSyncReturns } from 'child_process';
import {
  formatContentfulCliInvocation,
  isGlobalContentfulCliAvailable,
  redactContentfulCliArgs,
  resolveContentfulCli,
} from '../../src/lib/contentful-cli-spawn';

function mockSpawnSync(status: number): typeof import('child_process').spawnSync {
  return (() =>
    ({
      status,
      stdout: '',
      stderr: '',
      pid: 1,
      output: [],
      signal: null,
    }) as SpawnSyncReturns<string>) as typeof import('child_process').spawnSync;
}

describe('contentful CLI resolution', () => {
  it('uses global contentful when --version succeeds', () => {
    const sync = mockSpawnSync(0);
    expect(isGlobalContentfulCliAvailable(sync)).toBe(true);
    const inv = resolveContentfulCli(sync);
    expect(inv).toEqual({ command: 'contentful', prefixArgs: [] });
    expect([inv.command, ...inv.prefixArgs, 'space', 'export'].join(' ')).toBe(
      'contentful space export',
    );
  });

  it('falls back to npx contentful-cli when global is missing', () => {
    const sync = mockSpawnSync(1);
    expect(isGlobalContentfulCliAvailable(sync)).toBe(false);
    expect(resolveContentfulCli(sync)).toEqual({
      command: 'npx',
      prefixArgs: ['-y', 'contentful-cli'],
    });
    // formatContentfulCliInvocation uses live PATH; test resolved shape only
    const inv = resolveContentfulCli(sync);
    expect([inv.command, ...inv.prefixArgs, 'space', 'export'].join(' ')).toBe(
      'npx -y contentful-cli space export',
    );
  });
});

describe('redactContentfulCliArgs', () => {
  it('masks management token values in logged argv', () => {
    expect(
      redactContentfulCliArgs([
        'space',
        'export',
        '--management-token',
        'cfpats-secret',
      ]),
    ).toEqual(['space', 'export', '--management-token', '***']);
    expect(
      formatContentfulCliInvocation([
        'space',
        'export',
        '--management-token',
        'cfpats-secret',
      ]),
    ).not.toContain('cfpats-secret');
  });
});
