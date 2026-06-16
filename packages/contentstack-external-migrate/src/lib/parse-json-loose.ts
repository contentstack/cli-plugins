/**
 * Tolerant JSON reader for Contentful exports.
 *
 * Strict `JSON.parse` first (clean files are untouched — no risk, no perf hit).
 * Only on failure do we strip the common breakage that real-world / hand-edited
 * exports carry, then retry:
 *   - a leading UTF-8 BOM
 *   - control characters (except tab/newline/carriage-return)
 *   - trailing commas before `}` or `]`
 *
 * Deliberately conservative: we do NOT apply the reference's mojibake
 * substitutions (e.g. replacing every `=`), which corrupt valid content.
 */
export function cleanJsonContent(raw: string): string {
  let s = raw;
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // strip BOM
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // strip control chars, keep \t \n \r
  s = s.replace(/,(\s*[}\]])/g, '$1'); // drop trailing commas
  return s;
}

export function parseJsonLoose(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(cleanJsonContent(raw));
  }
}
