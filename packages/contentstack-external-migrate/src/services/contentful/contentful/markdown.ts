/**
 * Contentful → Contentstack Markdown converter.
 *
 * Markdown migrates ~1:1: both platforms store the field as a plain Markdown
 * string (Contentful = a `markdown` editor on a Long Text field, Contentstack =
 * the dedicated Markdown field with `field_metadata.markdown: true`). So unlike
 * jsonRTE (a recursive node-tree parser), this is a small ordered pipeline of
 * string transforms that only normalise the platform-specific quirks.
 *
 * IMPORTANT: do NOT route Markdown through the RTE/HTML path — parsing a
 * Markdown string as HTML corrupts it (lists, emphasis, tables all break).
 */

type Transform = (md: string) => string;

/**
 * Contentful asset/image URLs are protocol-relative (`//images.ctfassets.net/…`).
 * Contentstack needs an absolute URL, so prefix the `https:` scheme. Covers both
 * inline `[text](//url)` / `![alt](//url)` and reference-style `[1]: //url` defs.
 */
const fixProtocolRelativeUrls: Transform = (md) =>
  md
    // inline links/images:  ](//host/...   and autolinks <//host/...>
    .replace(/(\]\(|<)(\/\/[^\s)>]+)/g, (_m, lead, url) => `${lead}https:${url}`)
    // reference-style link definitions:  [label]: //host/...
    .replace(/^(\s*\[[^\]]+\]:\s*)(\/\/\S+)/gm, (_m, lead, url) => `${lead}https:${url}`);

const TRANSFORMS: Transform[] = [fixProtocolRelativeUrls];

/**
 * Convert a Contentful Markdown field value into a Contentstack-ready Markdown
 * string. Non-string inputs are coerced safely rather than corrupted.
 */
export default function markdownConvert(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) {
    // "Multiple" markdown → join; each element converted independently.
    return value.map((v) => markdownConvert(v)).join('\n');
  }
  if (typeof value !== 'string') return String(value);
  return TRANSFORMS.reduce((md, t) => t(md), value);
}
