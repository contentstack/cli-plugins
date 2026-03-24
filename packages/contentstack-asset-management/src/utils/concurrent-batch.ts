/**
 * Split an array into chunks of at most `size` elements.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return items.length ? [items] : [];
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Run async work in batches of at most `concurrency` parallel tasks at a time.
 * Uses Promise.allSettled per batch so one failure does not abort the batch.
 */
export async function runInBatches<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const limit = Math.max(1, concurrency);
  const batches = chunkArray(items, limit);
  let offset = 0;
  for (const batch of batches) {
    await Promise.allSettled(batch.map((item, j) => fn(item, offset + j)));
    offset += batch.length;
  }
}
