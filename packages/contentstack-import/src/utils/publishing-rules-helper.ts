/**
 * Helpers for publishing rules import (API error shape, duplicate detection).
 */

export function parseErrorPayload(error: unknown): {
  errors?: Record<string, unknown>;
  error_message?: string;
} | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as { message?: string; errors?: Record<string, unknown> };
  if (e.errors) return e;
  if (e.message && typeof e.message === 'string') {
    try {
      return JSON.parse(e.message) as { errors?: Record<string, unknown>; error_message?: string };
    } catch {
      return null;
    }
  }
  return null;
}

export function isDuplicatePublishingRuleError(
  parsed: { errors?: Record<string, unknown>; error_message?: string } | null,
  raw: unknown,
): boolean {
  const errors = parsed?.errors ?? (raw as { errors?: Record<string, unknown> })?.errors;
  if (errors?.name || errors?.['publishing_rule.name'] || errors?.['publish_rule.name']) {
    return true;
  }
  const msg = parsed?.error_message;
  return typeof msg === 'string' && /already exists|duplicate/i.test(msg);
}
