import * as fs from 'fs';
import * as path from 'path';

export interface DataDirScanStats {
  /** Number of assets eligible for publish (have publish_details + mapped UID). */
  eligible: number;
  /** Total AssetPublishData items that will be created (eligible × locale expansions). */
  totalItems: number;
  skipped: number;
  unmapped: number;
  environments: string[];
  locales: string[];
  /** Reusable in pass 2 — already loaded during pass 1, avoids a second disk read. */
  assetUidMapper: Record<string, string>;
  /** Reusable in pass 2 — already loaded during pass 1, avoids a second disk read. */
  assetsIndex: Record<string, string>;
}

/**
 * Pass 1: count-only scan of the data directory.
 * Reads chunk files one at a time, counts eligible/skipped/unmapped, and
 * discovers environments and locales — without building any AssetPublishData objects.
 * Memory footprint: uid mapper + env map + one chunk at a time.
 *
 * Returns assetUidMapper and assetsIndex so pass 2 (streamAndPublish) can reuse them
 * without re-reading the same files from disk.
 */
export async function scanDataDirStats(
  dataDir: string,
  overrideEnvs?: string[],
  overrideLocales?: string[],
  logger?: any
): Promise<DataDirScanStats> {
  const assetsIndexPath = path.join(dataDir, 'assets', 'assets.json');
  const environmentsPath = path.join(dataDir, 'environments', 'environments.json');
  const assetUidMapperPath = path.join(dataDir, 'mapper', 'assets', 'uid-mapping.json');

  if (!fs.existsSync(assetsIndexPath)) {
    throw new Error(
      `Asset index not found: ${assetsIndexPath}. Ensure --data-dir points to the import backup directory.`
    );
  }

  let assetUidMapper: Record<string, string> = {};
  if (fs.existsSync(assetUidMapperPath)) {
    assetUidMapper = JSON.parse(fs.readFileSync(assetUidMapperPath, 'utf-8'));
  } else {
    logger?.warn(
      `Asset UID mapper not found: ${assetUidMapperPath}. Ensure --data-dir points to the import backup directory.`
    );
  }

  const environmentsMap: Record<string, string> = {};
  if (fs.existsSync(environmentsPath)) {
    const envData: Record<string, any> = JSON.parse(fs.readFileSync(environmentsPath, 'utf-8'));
    for (const [uid, env] of Object.entries(envData)) {
      environmentsMap[uid] = (env as any).name || uid;
    }
  } else {
    logger?.warn(`Environments file not found: ${environmentsPath}`);
  }

  const assetsIndex: Record<string, string> = JSON.parse(fs.readFileSync(assetsIndexPath, 'utf-8'));

  let eligible = 0;
  let totalItems = 0;
  let skipped = 0;
  let unmapped = 0;
  const allEnvs = new Set<string>();
  const allLocales = new Set<string>();

  for (const chunkFilename of Object.values(assetsIndex)) {
    const chunkPath = path.join(dataDir, 'assets', chunkFilename);
    const chunkData: Record<string, any> = JSON.parse(fs.readFileSync(chunkPath, 'utf-8'));

    for (const asset of Object.values(chunkData)) {
      if (!asset.publish_details || asset.publish_details.length === 0) {
        skipped++;
        continue;
      }

      const targetUid = assetUidMapper[asset.uid as string];
      if (!targetUid) {
        unmapped++;
        continue;
      }

      eligible++;

      if (!overrideLocales?.length) {
        for (const pd of asset.publish_details) {
          if (pd.locale) allLocales.add(pd.locale as string);
        }
      }
      if (!overrideEnvs?.length) {
        for (const pd of asset.publish_details) {
          const envName = environmentsMap[pd.environment] || pd.environment;
          if (envName) allEnvs.add(envName as string);
        }
      }

      const localeCount = overrideLocales?.length
        ? overrideLocales.length
        : new Set<string>(asset.publish_details.map((pd: any) => pd.locale as string)).size;
      totalItems += localeCount;
    }
    // chunkData falls out of scope here — GC reclaims it
  }

  const environments = overrideEnvs?.length ? overrideEnvs : [...allEnvs];
  const locales = overrideLocales?.length ? overrideLocales : [...allLocales];

  return { eligible, totalItems, skipped, unmapped, environments, locales, assetUidMapper, assetsIndex };
}
