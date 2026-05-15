import { FsUtility, log } from '@contentstack/cli-utilities';

export type ForEachChunkedJsonStoreOptions = {
  context?: Record<string, unknown>;
  /** Shown in log.debug: `Error reading <label> chunk: …` */
  chunkReadLogLabel: string;
  onOpenError: (err: unknown) => void;
  onEmptyIndexer: () => void;
};

export type ForEachChunkRecordsFromFsOptions = {
  context?: Record<string, unknown>;
  chunkReadLogLabel: string;
};

/**
 * Same FsUtility iteration as contentstack-import: construct store, optional empty-indexer exit, then
 * `for…in indexer` + `readChunkFiles.next().catch` + `Object.values(chunk)`.
 */
export async function forEachChunkedJsonStore<T>(
  basePath: string,
  indexFileName: string,
  options: ForEachChunkedJsonStoreOptions,
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
    { context: options.context, chunkReadLogLabel: options.chunkReadLogLabel },
    onChunk,
  );
}

/** Iterate chunks for an already-constructed FsUtility (e.g. assets identity / upload paths). */
export async function forEachChunkRecordsFromFs<T>(
  fs: FsUtility,
  options: ForEachChunkRecordsFromFsOptions,
  onChunk: (records: T[]) => void | Promise<void>,
): Promise<void> {
  const indexer = fs.indexFileContent;
  /* eslint-disable @typescript-eslint/no-unused-vars, guard-for-in */
  for (const _index in indexer) {
    const chunk = await fs.readChunkFiles.next().catch((err: unknown): null => {
      log.debug(`Error reading ${options.chunkReadLogLabel} chunk: ${err}`, options.context);
      return null;
    });
    if (!chunk || typeof chunk !== 'object') {
      continue;
    }
    const records = Object.values(chunk as Record<string, T>);
    await onChunk(records);
  }
}
