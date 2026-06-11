import readline from 'readline';
import chalk from 'chalk';

/**
 * Choose master locale from export. Skips prompt when prefilled (--master-locale).
 */
export async function pickMasterLocale(
  locales: string[],
  prefilled?: string,
): Promise<string> {
  if (locales.length === 0) {
    throw new Error('Source export has no locales — cannot continue.');
  }

  if (prefilled) {
    const match = locales.find((c) => c.toLowerCase() === prefilled.toLowerCase());
    if (!match) {
      throw new Error(
        `--master-locale "${prefilled}" not in source locales: ${locales.join(', ')}`,
      );
    }
    return match;
  }

  process.stdout.write('\n');
  process.stdout.write(`  ${chalk.yellow('⚠')}  ${chalk.bold('Master locale')}\n`);
  process.stdout.write(
    `     The master locale you pick ${chalk.bold('must match')} the destination stack's master locale\n`,
  );
  process.stdout.write(
    `       • master locale          → fallback: ${chalk.dim('(none)')}\n`,
  );
  process.stdout.write(
    `       • every other locale     → fallback: ${chalk.dim('master')}\n`,
  );
  process.stdout.write('\n');
  process.stdout.write(`     Available in export: ${chalk.cyan(locales.join(', '))}\n`);
  process.stdout.write('\n');

  const def = locales[0];
  const answer = await ask(`     Master locale [${chalk.cyan(def)}]: `);
  const picked = answer.trim() || def;
  const match = locales.find((c) => c.toLowerCase() === picked.toLowerCase());
  if (!match) {
    throw new Error(`"${picked}" not in source locales: ${locales.join(', ')}`);
  }
  process.stdout.write('\n');
  return match;
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
