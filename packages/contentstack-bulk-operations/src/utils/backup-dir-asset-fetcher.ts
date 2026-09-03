import * as fs from 'fs';
import * as path from 'path';
import { chunkArray } from './helpers';
import { BATCH_CONSTANTS } from './constants';

export interface BackupDirScanStats {
  /** Number of assets eligible for publish (have publish_details + mapped UID). */
  eligible: number;
  /** Total AssetPublishData items that will be created (eligible × locale expansions). */
  totalItems: number;
  skipped: number;
  unmapped: number;
  /** Union across the backup, for the dashboard and confirmation prompt. Never a payload value. */
  environments: string[];
  /** Union across the backup. Display only, same as `environments`. */
  locales: string[];
  /** Reusable in pass 2 — already loaded during pass 1, avoids a second disk read. */
  assetUidMapper: Record<string, string>;
  /** Reusable in pass 2 — already loaded during pass 1, avoids a second disk read. */
  assetsIndex: Record<string, string>;
  /** Environment UID -> name. Reusable in pass 2 to build per-asset publish_details. */
  environmentsMap: Record<string, string>;
  /** Exact batch count, counted per (locale, environment set) target the same way pass 2 batches. */
  totalBatches: number;
}

/**
 * The (locale -> environment names) one backup asset should publish to: per locale, exactly the
 * environments that asset had in that locale.
 *
 * Shared by both passes so pass 1's count and pass 2's batching cannot drift.
 */
export function assetPublishTargets(asset: any, environmentsMap: Record<string, string>): Map<string, string[]> {
  const byLocale = new Map<string, Set<string>>();

  for (const pd of asset.publish_details ?? []) {
    const locale = pd.locale as string;
    if (!locale) continue;

    const envName = (environmentsMap[pd.environment] || pd.environment) as string;
    if (!envName) continue;

    let envs = byLocale.get(locale);
    if (!envs) {
      envs = new Set<string>();
      byLocale.set(locale, envs);
    }
    envs.add(envName);
  }

  const targets = new Map<string, string[]>();
  for (const [locale, envs] of byLocale) {
    if (envs.size > 0) targets.set(locale, [...envs].sort());
  }

  return targets;
}

/**
 * Key identifying one publish target: a single locale and a single environment set.
 * Same shape TargetBatcher buckets on, so pass 1's count matches pass 2's batching.
 */
export function targetCountKey(locale: string, environments: string[]): string {
  return JSON.stringify([locale, environments]);
}

/**
 * Pass 1: count-only scan of the backup directory.
 * Reads chunk files one at a time, counts eligible/skipped/unmapped, and
 * discovers environments and locales — without building any AssetPublishData objects.
 * Memory footprint: uid mapper + env map + one chunk at a time.
 *
 * Returns assetUidMapper and assetsIndex so pass 2 (streamAndPublish) can reuse them
 * without re-reading the same files from disk.
 */
export async function scanBackupDirStats(backupDir: string, logger?: any): Promise<BackupDirScanStats> {
  const assetsIndexPath = path.join(backupDir, 'assets', 'assets.json');
  const environmentsPath = path.join(backupDir, 'environments', 'environments.json');
  const assetUidMapperPath = path.join(backupDir, 'mapper', 'assets', 'uid-mapping.json');

  if (!fs.existsSync(assetsIndexPath)) {
    throw new Error(
      `Asset index not found: ${assetsIndexPath}. Ensure --backup-dir points to the import backup directory.`
    );
  }

  let assetUidMapper: Record<string, string> = {};
  if (fs.existsSync(assetUidMapperPath)) {
    assetUidMapper = JSON.parse(fs.readFileSync(assetUidMapperPath, 'utf-8'));
  } else {
    logger?.warn(
      `Asset UID mapper not found: ${assetUidMapperPath}. Ensure --backup-dir points to the import backup directory.`
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
  /** Items per (locale, environment set) — mirrors how pass 2 buckets them, giving an exact batch count. */
  const itemsPerTarget = new Map<string, number>();

  for (const chunkFilename of Object.values(assetsIndex)) {
    const chunkPath = path.join(backupDir, 'assets', chunkFilename);
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

      // Same targets pass 2 batches on, so the counts stay exact.
      const targets = assetPublishTargets(asset, environmentsMap);

      for (const [locale, environments] of targets) {
        allLocales.add(locale);
        for (const env of environments) allEnvs.add(env);

        // An environment set past the API cap becomes several single-locale batches — count each.
        for (const envChunk of chunkArray(environments, BATCH_CONSTANTS.maxEnvironments)) {
          const key = targetCountKey(locale, envChunk);
          itemsPerTarget.set(key, (itemsPerTarget.get(key) || 0) + 1);
          totalItems++;
        }
      }
    }
    // chunkData falls out of scope here — GC reclaims it
  }

  const totalBatches = [...itemsPerTarget.values()].reduce(
    (sum, count) => sum + Math.ceil(count / BATCH_CONSTANTS.maxItems),
    0
  );

  return {
    eligible,
    totalItems,
    skipped,
    unmapped,
    environments: [...allEnvs],
    locales: [...allLocales],
    assetUidMapper,
    assetsIndex,
    environmentsMap,
    totalBatches,
  };
}
