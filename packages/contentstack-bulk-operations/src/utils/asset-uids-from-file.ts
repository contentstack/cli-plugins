import * as fs from 'node:fs';
import path from 'node:path';

import type { AmBulkDeleteItem } from '../interfaces';

export type LoadAssetUidsErrorKind = 'READ' | 'PARSE' | 'SCHEMA';

export class LoadAssetUidsError extends Error {
  constructor(
    message: string,
    public readonly kind: LoadAssetUidsErrorKind,
    public readonly filePath: string,
    options?: { cause?: unknown }
  ) {
    super(message);
    this.name = 'LoadAssetUidsError';
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

/** Outer `{ "uids": [...] }` checks only; returns raw `uids` array reference. */
function parseValidatedUidsArray(parsed: unknown, filePathForErrors: string): unknown[] {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new LoadAssetUidsError('Root JSON value must be a non-null object', 'SCHEMA', filePathForErrors);
  }

  const keys = Object.keys(parsed as Record<string, unknown>);
  if (keys.length !== 1 || keys[0] !== 'uids') {
    throw new LoadAssetUidsError('JSON object must contain only the property "uids"', 'SCHEMA', filePathForErrors);
  }

  const uids = (parsed as { uids: unknown }).uids;
  if (!Array.isArray(uids)) {
    throw new LoadAssetUidsError('Property "uids" must be an array', 'SCHEMA', filePathForErrors);
  }

  if (uids.length === 0) {
    throw new LoadAssetUidsError('Property "uids" must be a non-empty array', 'SCHEMA', filePathForErrors);
  }

  return uids;
}

function readResolvedAssetUidsJson(filePath: string): { resolved: string; parsed: unknown } {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  let text: string;
  try {
    text = fs.readFileSync(resolved, 'utf8');
  } catch (e: unknown) {
    throw new LoadAssetUidsError(e instanceof Error ? e.message : String(e), 'READ', resolved, { cause: e });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (e: unknown) {
    throw new LoadAssetUidsError(e instanceof Error ? e.message : String(e), 'PARSE', resolved, { cause: e });
  }

  return { resolved, parsed };
}

/**
 * Validates decoded JSON (`JSON.parse`) for `{ "uids": string[] }` — no trimming of UID strings (API-exact).
 * Exposed for unit tests; callers should pass the resolved filesystem path used in error reporting.
 */
export function validateAssetUidsParsedJson(parsed: unknown, filePathForErrors: string): string[] {
  const uids = parseValidatedUidsArray(parsed, filePathForErrors);
  const out = new Array<string>(uids.length);
  for (let i = 0; i < uids.length; i++) {
    const uid = uids[i];
    if (typeof uid !== 'string') {
      throw new LoadAssetUidsError(`uids[${i}] must be a string`, 'SCHEMA', filePathForErrors);
    }
    if (uid.length === 0) {
      throw new LoadAssetUidsError(`uids[${i}] must not be an empty string`, 'SCHEMA', filePathForErrors);
    }
    out[i] = uid;
  }
  return out;
}

/**
 * Validates `{ "uids": string[] }` and builds AM bulk-delete rows in one pass over `uids`.
 * `locale` must be the final non-empty value from the CLI (caller trims).
 */
export function validateAndBuildBulkDeleteItems(
  parsed: unknown,
  locale: string,
  filePathForErrors: string
): AmBulkDeleteItem[] {
  const uids = parseValidatedUidsArray(parsed, filePathForErrors);
  const items = new Array<AmBulkDeleteItem>(uids.length);
  for (let i = 0; i < uids.length; i++) {
    const uid = uids[i];
    if (typeof uid !== 'string') {
      throw new LoadAssetUidsError(`uids[${i}] must be a string`, 'SCHEMA', filePathForErrors);
    }
    if (uid.length === 0) {
      throw new LoadAssetUidsError(`uids[${i}] must not be an empty string`, 'SCHEMA', filePathForErrors);
    }
    items[i] = { uid, locale };
  }
  return items;
}

/**
 * Reads a UTF-8 JSON file whose root is exactly `{ "uids": string[] }` — see {@link validateAssetUidsParsedJson}.
 * Optimized for large lists: single read, single parse, one linear validation pass.
 */
export function loadAssetUidsFromFile(filePath: string): string[] {
  const { resolved, parsed } = readResolvedAssetUidsJson(filePath);
  return validateAssetUidsParsedJson(parsed, resolved);
}

/**
 * Reads asset UID file and returns `{ uid, locale }[]` for AM bulk delete (single pass over `uids` after parse).
 */
export function loadBulkDeleteItemsFromFile(filePath: string, locale: string): AmBulkDeleteItem[] {
  const { resolved, parsed } = readResolvedAssetUidsJson(filePath);
  return validateAndBuildBulkDeleteItems(parsed, locale, resolved);
}
