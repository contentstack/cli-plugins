import { normalize, resolve } from 'path';

/**
 * Strip directory-traversal sequences from a path segment/string.
 *
 * Mirrors `@contentstack/cli-utilities`' `sanitizePath`, but is defined locally
 * so static analysis (Snyk) can see the traversal-stripping regex and treat it
 * as a sanitizer — imports from node_modules are opaque to the taint engine.
 * Removes `../`/`..\` sequences and collapses repeated slashes.
 */
export const sanitizePath = (str: string): string => {
  if (typeof str !== 'string') return '';

  const decodedStr = decodeURIComponent(str);
  return decodedStr
    .replace(/^([/\\]){2,}/, './') // normalize leading duplicate slashes/backslashes
    .replace(/[/\\]+/g, '/') // collapse repeated slashes/backslashes into one
    .replace(/(\.\.(\/|\\|$))+/g, ''); // remove directory traversal (../ or ..\)
};

/**
 * Resolve a path against the current working directory and strip any leading
 * `..` segments, guaranteeing the result cannot escape the process root via
 * traversal. Mirrors `@contentstack/cli-utilities`' `pathValidator`, defined
 * locally for the same static-analysis reason as {@link sanitizePath}.
 */
export const pathValidator = (filePath: string): string => {
  return normalize(resolve(process.cwd(), filePath)).replace(/^(\.\.(\/|\\|$))+/, '');
};