import { log } from '@contentstack/cli-utilities';

export const DEFAULT_RETRIES = 3;
export const DEFAULT_RETRY_BASE_DELAY_MS = 500;
/** Hard ceiling on any single backoff — caps both exponential growth and a server-supplied Retry-After. */
export const MAX_RETRY_BACKOFF_MS = 30_000;

export type RetryOptions = {
  /** Max retry attempts after the initial try (default 3). */
  retries?: number;
  /** Base backoff in ms; actual delay is baseDelayMs * 2^attempt + jitter (default 500). */
  baseDelayMs?: number;
  context?: Record<string, unknown>;
  /** Short label for retry log lines (e.g. "GET /api/fields"). */
  label?: string;
};

/**
 * Error that marks an operation as worth retrying (transient network failure, 429, or 5xx).
 * Anything that is NOT a RetryableHttpError is treated as terminal by {@link withRetry}.
 */
export class RetryableHttpError extends Error {
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(message: string, status?: number, retryAfterMs?: number) {
    super(message);
    this.name = 'RetryableHttpError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Transient HTTP statuses worth retrying. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Parse a Retry-After header (delta-seconds or HTTP date) into milliseconds, or undefined. */
export function parseRetryAfterMs(headerValue: string | null | undefined): number | undefined {
  if (!headerValue) return undefined;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}

function sleep(ms: number): Promise<void> {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((resolve) => setTimeout(resolve, ms <= 0 ? 0 : ms));
}

/**
 * Run `fn`, retrying only when it throws a {@link RetryableHttpError}. Uses exponential backoff
 * (`baseDelayMs * 2^attempt`) plus jitter, or the error's `retryAfterMs` when present. Terminal
 * errors (anything that isn't a RetryableHttpError) propagate immediately, as does the last
 * RetryableHttpError once attempts are exhausted.
 *
 * Wrap sites are responsible for classifying: throw RetryableHttpError for network errors / 429 /
 * 5xx, and throw a plain error for non-retryable failures (e.g. 4xx). Only idempotent reads should
 * be wrapped — never non-idempotent writes (uploads/creates), which could double-apply.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const baseDelayMs = opts.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof RetryableHttpError) || attempt >= retries) throw error;
      const jitter = Math.floor(Math.random() * baseDelayMs);
      const backoff = baseDelayMs * 2 ** attempt + jitter;
      // Clamp so a hostile/broken server's Retry-After (or runaway exponential) can't stall the export.
      const delay = Math.min(error.retryAfterMs ?? backoff, MAX_RETRY_BACKOFF_MS);
      attempt += 1;
      log.debug(
        `Retry ${attempt}/${retries} in ${delay}ms${opts.label ? ` (${opts.label})` : ''}: ${error.message}`,
        opts.context,
      );
      await sleep(delay);
    }
  }
}
