import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';

export const isEmpty = (val: unknown) =>
  val === undefined ||
  val === null ||
  (typeof val === 'object' && Object.keys(val as object).length === 0) ||
  (typeof val === 'string' && val.trim() === '');

export const getLogMessage = (
  methodName: string,
  message: string,
  user: object = {},
  error?: any
) => ({
  methodName,
  message,
  ...(user && { user }),
  ...(error && { error }),
});

export async function copyDirectory(srcDir: string, destDir: string): Promise<void> {
  await mkdirp(destDir);
  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dst = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(src, dst);
    } else {
      await fs.promises.copyFile(src, dst);
    }
  }
}

import localeNames from '../locale-names.json';

/**
 * In the CLI flow we don't talk to Contentstack — instead, ship a static
 * locale-code → human-name table (the same one Contentstack's /locales endpoint
 * returns). createLocale uses this to set each locale's `name` field, so
 * "de-de" becomes "German - Germany" instead of falling back to the default
 * "English - United States".
 */
export async function getAllLocales(): Promise<[any, Record<string, string>]> {
  return [null, localeNames as Record<string, string>];
}
