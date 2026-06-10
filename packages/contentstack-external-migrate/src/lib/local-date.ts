/**
 * Local-timezone date stamp (YYYY-MM-DD) for default stack names.
 *
 * `new Date().toISOString()` is UTC — so a late-night run in a +UTC offset (e.g.
 * 01:05 IST) would name the stack with the PREVIOUS calendar day, which reads as
 * a stale/duplicate stack. Use the machine's local date instead.
 */
export function localDateStamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
