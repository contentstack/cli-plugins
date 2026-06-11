import chalk from 'chalk';

const PAD = 10;

const label = (s: string) => s.padEnd(PAD, ' ');

export function logStageOk(stage: string, detail = ''): void {
  process.stdout.write(`  ${label(stage)} ${chalk.green('✓')}  ${chalk.dim(detail)}\n`);
}

export function logStageFail(stage: string, detail = ''): void {
  process.stdout.write(`  ${label(stage)} ${chalk.red('✗')}  ${chalk.red(detail)}\n`);
}

export function done(elapsedMs: number): void {
  const s = (elapsedMs / 1000).toFixed(1);
  process.stdout.write(`\n  ${chalk.green('●')} ${chalk.bold(s + 's')}\n`);
}

export function header(): void {
  process.stdout.write('\n');
}

export function logSummary(result: {
  bundleDir: string;
  entryCount: number;
  contentTypeCount: number;
}): void {
  process.stdout.write('\n');
  process.stdout.write(
    `  Bundle: ${result.bundleDir} (${result.contentTypeCount} types, ${result.entryCount} entries)\n`,
  );
}
