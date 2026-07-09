import { FsUtility, log } from '@contentstack/cli-utilities';

export type ForEachChunkedJsonStoreOptions<T = unknown> = {
  context?: Record<string, unknown>;
  /** Shown in log.debug: `Error reading <label> chunk: …` */
  chunkReadLogLabel: string;
  onOpenError: (err: unknown) => void;
  onEmptyIndexer: () => void;
  /**
   * Invoked when a chunk file cannot be read back from disk. Receives the records
   * recovered from `metadata.json` for that chunk (so callers can reconcile/log per
   * item by real identity) plus the underlying error. Without it, a failed chunk is
   * silently skipped (debug-logged) — dropping every record it held.
   */
  onChunkError?: (records: T[], err: unknown) => void | Promise<void>;
};

export type ForEachChunkRecordsFromFsOptions<T = unknown> = {
  context?: Record<string, unknown>;
  chunkReadLogLabel: string;
  onChunkError?: (records: T[], err: unknown) => void | Promise<void>;
};

/**
 * Same FsUtility iteration as contentstack-import: construct store, optional empty-indexer exit, then
 * `for…in indexer` + `readChunkFiles.next().catch` + `Object.values(chunk)`.
 */
export async function forEachChunkedJsonStore<T>(
  basePath: string,
  indexFileName: string,
  options: ForEachChunkedJsonStoreOptions<T>,
  onChunk: (records: T[]) => void | Promise<void>,
): Promise<void> {
  let fs: FsUtility;
  try {
    fs = new FsUtility({ basePath, indexFileName });
  } catch (err) {
    options.onOpenError(err);
    return;
  }

  const indexer = fs.indexFileContent;
  if (!indexer || Object.keys(indexer).length === 0) {
    options.onEmptyIndexer();
    return;
  }

  await forEachChunkRecordsFromFs(
    fs,
    { context: options.context, chunkReadLogLabel: options.chunkReadLogLabel, onChunkError: options.onChunkError },
    onChunk,
  );
}

/**
 * Recover a chunk's records from `metadata.json` when the chunk file itself can't be read.
 * Metadata layout is `{ "<chunkFileName>": Array<record> }`; returns [] on any failure so the
 * caller always gets an array.
 */
function recoverChunkRecordsFromMeta<T>(fs: FsUtility, chunkFileName: string | undefined): T[] {
  if (!chunkFileName) return [];
  try {
    const meta = fs.getPlainMeta() as Record<string, T[]>;
    const records = meta?.[chunkFileName];
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

/** Iterate chunks for an already-constructed FsUtility (e.g. assets identity / upload paths). */
export async function forEachChunkRecordsFromFs<T>(
  fs: FsUtility,
  options: ForEachChunkRecordsFromFsOptions<T>,
  onChunk: (records: T[]) => void | Promise<void>,
): Promise<void> {
  const indexer = fs.indexFileContent;
  /* eslint-disable guard-for-in */
  for (const index in indexer) {
    let readError: unknown = null;
    const chunk = await fs.readChunkFiles.next().catch((err: unknown): null => {
      log.debug(`Error reading ${options.chunkReadLogLabel} chunk: ${err}`, options.context);
      readError = err;
      return null;
    });
    if (!chunk || typeof chunk !== 'object') {
      // Chunk could not be read back. Recover its records from metadata so the caller
      // can reconcile/log each dropped item by real identity instead of silently losing them.
      if (readError !== null && options.onChunkError) {
        const recovered = recoverChunkRecordsFromMeta<T>(fs, indexer[index]);
        await options.onChunkError(recovered, readError);
      }
      continue;
    }
    const records = Object.values(chunk as Record<string, T>);
    await onChunk(records);
  }
}
