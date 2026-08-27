import { log } from '@contentstack/cli-utilities';

import messages, { $t } from '../messages';
import { OperationType } from '../interfaces';

/**
 * Per-operation flag matrix for the merged `cm:stacks:bulk-assets` command.
 *
 * publish/unpublish (CMS) and delete/move (CS Assets) share a single command but
 * use disjoint flag sets and auth models. oclif cannot express operation-conditional
 * flags statically, so this validates the RAW argv: several CMS flags carry defaults
 * (--branch, --publish-mode, --bulk-operation-file), which makes parsed flags unable
 * to distinguish "user passed it" from "default filled it".
 */

interface FlagSpec {
  /** Long flag name without leading dashes */
  name: string;
  /** Optional short char without leading dash */
  char?: string;
}

/** Flags only meaningful for CMS publish/unpublish operations. */
const CMS_ONLY_FLAGS: FlagSpec[] = [
  { name: 'stack-api-key', char: 'k' },
  { name: 'alias', char: 'a' },
  { name: 'environments' },
  { name: 'locales' },
  { name: 'source-env' },
  { name: 'source-alias' },
  { name: 'publish-mode' },
  { name: 'branch' },
  { name: 'config', char: 'c' },
  { name: 'retry-failed' },
  { name: 'retry-pending' },
  { name: 'revert' },
  { name: 'bulk-operation-file' },
  { name: 'folder-uid' },
];

/** Flags only meaningful for CS Assets delete/move operations. */
const CS_ASSETS_ONLY_FLAGS: FlagSpec[] = [
  { name: 'space-uid' },
  { name: 'org-uid' },
  { name: 'asset-uids-file' },
  { name: 'locale' },
  { name: 'target-folder-uid' },
  { name: 'workspace' },
];

/** Did-you-mean hints for the twin locale flags. */
const FLAG_HINTS: Record<string, Record<string, string>> = {
  locales: {
    [OperationType.DELETE]: ' Did you mean --locale?',
  },
  locale: {
    [OperationType.PUBLISH]: ' Did you mean --locales?',
    [OperationType.UNPUBLISH]: ' Did you mean --locales?',
  },
};

/**
 * Returns true when the given flag was explicitly passed on the command line.
 * Handles `--flag`, `--flag=value`, `--no-flag`, and short forms `-k` / `-k=value`.
 */
function isFlagInArgv(argv: string[], spec: FlagSpec): boolean {
  return argv.some((token) => {
    if (!token.startsWith('-')) return false;
    // Strip `=value` if present
    const bare = token.split('=')[0];
    if (bare === `--${spec.name}` || bare === `--no-${spec.name}`) return true;
    if (spec.char && bare === `-${spec.char}`) return true;
    return false;
  });
}

function isCsAssetsOperation(operation: string): boolean {
  return operation === OperationType.DELETE || operation === OperationType.MOVE;
}

/**
 * Sentinel operation context for the --retry-failed/--revert path, where no
 * --operation flag is given but CS Assets flags must still be rejected.
 */
export const RETRY_REVERT_CONTEXT = 'retry/revert';

/** Thrown by enforceOperationFlagMatrix so init() aborts without process.exit(). */
export class OperationFlagMatrixError extends Error {
  readonly violations: string[];

  constructor(violations: string[]) {
    super(violations.join('\n'));
    this.name = 'OperationFlagMatrixError';
    this.violations = violations;
  }
}

/**
 * Validates that no cross-operation flags were explicitly passed for the resolved
 * operation. Returns the list of violation messages (empty when valid).
 */
export function validateOperationFlagMatrix(operation: string, argv: string[]): string[] {
  const violations: string[] = [];

  const rejected = isCsAssetsOperation(operation) ? CMS_ONLY_FLAGS : CS_ASSETS_ONLY_FLAGS;

  for (const spec of rejected) {
    if (isFlagInArgv(argv, spec)) {
      if (operation === RETRY_REVERT_CONTEXT) {
        violations.push($t(messages.FLAG_NOT_ALLOWED_WITH_RETRY_REVERT, { flag: `--${spec.name}` }));
      } else {
        const hint = FLAG_HINTS[spec.name]?.[operation] ?? '';
        violations.push($t(messages.FLAG_NOT_ALLOWED_FOR_OPERATION, { flag: `--${spec.name}`, operation, hint }));
      }
    }
  }

  // move additionally rejects --locale (delete-only within the CS Assets pair)
  if (operation === OperationType.MOVE && isFlagInArgv(argv, { name: 'locale' })) {
    violations.push(messages.CS_ASSETS_LOCALE_NOT_ALLOWED_FOR_MOVE);
  }

  // Scan status only gates publish, so --retry-pending is meaningless for unpublish.
  // CMS_ONLY_FLAGS cannot express this: publish and unpublish share one rejected list.
  if (operation === OperationType.UNPUBLISH && isFlagInArgv(argv, { name: 'retry-pending' })) {
    violations.push($t(messages.FLAG_NOT_ALLOWED_FOR_OPERATION, { flag: '--retry-pending', operation, hint: '' }));
  }

  return violations;
}

/**
 * Runs the matrix validation. On violations: logs each one, sets a non-zero exit
 * code, and throws OperationFlagMatrixError to abort init(). Throwing (instead of
 * process.exit) lets oclif run its catch/finally hooks and keeps this testable.
 */
export function enforceOperationFlagMatrix(operation: string, argv: string[], loggerContext?: unknown): void {
  const violations = validateOperationFlagMatrix(operation, argv);
  if (violations.length > 0) {
    for (const violation of violations) {
      log.error(violation, loggerContext);
    }
    process.exitCode = 1;
    throw new OperationFlagMatrixError(violations);
  }
}

/**
 * Extracts the value of `--operation` from raw argv without a full oclif parse
 * (parse cannot run before init, and init needs the operation to pick a pipeline).
 * Returns undefined when the flag is absent.
 */
export function getOperationFromArgv(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--operation') {
      return argv[i + 1];
    }
    if (token.startsWith('--operation=')) {
      return token.slice('--operation='.length);
    }
  }
  return undefined;
}
