import { FsUtility, log } from '@contentstack/cli-utilities';

/**
 * Read all items from a chunked JSON store (index + chunk files) using FsUtility,
 * matching the pattern used in contentstack-import entry modules.
 */
export async function readChunkedJsonItems<T = Record<string, unknown>>(
  basePath: string,
  indexFileName: string,
  context?: Record<string, unknown>,
): Promise<T[]> {
  try {
    const fs = new FsUtility({ basePath, indexFileName });
    const indexer = fs.indexFileContent;
    const items: T[] = [];
    for (const _ in indexer) {
      const chunk = await fs.readChunkFiles.next().catch((err: unknown): null => {
        log.debug(`Error reading chunk: ${err}`, context);
        return null;
      });
      if (chunk) {
        items.push(...(Object.values(chunk as Record<string, T>)));
      }
    }
    return items;
  } catch (err) {
    log.debug(`readChunkedJsonItems failed for ${basePath}/${indexFileName}: ${err}`, context);
    return [];
  }
}
