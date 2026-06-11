/* eslint-disable no-console */
/* eslint-disable new-cap */
/* eslint-disable camelcase */
const path = require('path');
const { existsSync } = require('fs');
const chalk = require('chalk');
const { cliux, FsUtility } = require('@contentstack/cli-utilities');
const { getQueue } = require('../util/queue');
const { performBulkPublish, publishAsset, initializeLogger } = require('../consumer/publish');
const retryFailedLogs = require('../util/retryfailed');
const { validateFile } = require('../util/fs');
const { isEmpty } = require('../util');
const { fetchBulkPublishLimit } = require('../util/common-utility');
const { generateBulkPublishStatusUrl } = require('../util/generate-bulk-publish-url');
const { resolveInQueueAssets, fetchScanStatusBatch, ASSET_SCAN_STATUS } = require('../util/asset-scan');

const queue = getQueue();
let logFileName;
let bulkPublishSet = [];
let pendingAssetsForRetry = [];
let scanSummary = { clean: 0, quarantined: 0, inQueue: 0, noStatus: 0 };
let filePath;

/* eslint-disable no-param-reassign */

function printScanSummary({ clean, noStatus, inQueue, quarantined }) {
  const total = clean + noStatus + inQueue + quarantined;
  if (total === 0) return;
  console.log(chalk.bold(`\nAsset scan summary (${total} total):`));
  console.log(chalk.green(`  ✓ Clean (publishing):          ${clean}`));
  if (noStatus > 0) console.log(chalk.green(`  ✓ No scan status (publishing): ${noStatus}`));
  if (inQueue > 0) console.log(chalk.yellow(`  ⧖ In queue (retrying):        ${inQueue}`));
  if (quarantined > 0) console.log(chalk.red(`  ✗ Quarantined (skipped):      ${quarantined}`));
}

async function getAssets(stack, folder, bulkPublish, environments, locale, apiVersion, bulkPublishLimit, skip = 0) {
  return new Promise((resolve, reject) => {
    let queryParams = {
      folder: folder,
      skip: skip,
      include_count: true,
      include_folders: true,
      include_publish_details: true,
      include_asset_scan_status: true,
    };
    stack
      .asset()
      .query(queryParams)
      .find()
      .then(async (assetResponse) => {
        if (assetResponse && assetResponse.items.length > 0) {
          skip += assetResponse.items.length;
          let assets = assetResponse.items;

          for (let index = 0; index < assets.length; index++) {
            if (assets[index].is_dir === true) {
              await getAssets(
                stack,
                assets[index].uid,
                bulkPublish,
                environments,
                locale,
                apiVersion,
                bulkPublishLimit,
                0,
              );
              continue;
            }

            const scanStatus = assets[index]._asset_scan_status;

            // Quarantined assets are skipped permanently
            if (scanStatus === ASSET_SCAN_STATUS.QUARANTINE) {
              scanSummary.quarantined++;
              console.log(chalk.yellow(`Skipped (quarantined): Asset UID '${assets[index].uid}'`));
              continue;
            }

            // In-queue assets are deferred for retry after all pages are processed
            if (scanStatus === ASSET_SCAN_STATUS.IN_QUEUE) {
              scanSummary.inQueue++;
              pendingAssetsForRetry.push({
                uid: assets[index].uid,
                locale,
                publish_details: assets[index].publish_details || [],
                environments,
              });
              continue;
            }

            // Ready (clean) or no scan status — enqueue for publish
            if (scanStatus === ASSET_SCAN_STATUS.READY) {
              scanSummary.clean++;
            } else {
              scanSummary.noStatus++;
            }

            if (bulkPublish) {
              if (bulkPublishSet.length < bulkPublishLimit) {
                bulkPublishSet.push({
                  uid: assets[index].uid,
                  locale,
                  publish_details: assets[index].publish_details || [],
                });
              }
              if (bulkPublishSet.length === bulkPublishLimit) {
                await queue.Enqueue({
                  assets: bulkPublishSet,
                  Type: 'asset',
                  environments: environments,
                  locale,
                  stack: stack,
                  apiVersion,
                });
                bulkPublishSet = [];
              }
            } else {
              await queue.Enqueue({
                assetUid: assets[index].uid,
                publish_details: assets[index].publish_details || [],
                environments: environments,
                Type: 'asset',
                locale,
                stack: stack,
              });
            }
          }

          // Flush any partial bulk batch at the end of the page.
          // Done outside the for-loop so it fires correctly even when some assets
          // were skipped (quarantined/in-queue) and the last non-skipped asset is
          // not at the final array index.
          if (bulkPublish && bulkPublishSet.length > 0) {
            await queue.Enqueue({
              assets: bulkPublishSet,
              Type: 'asset',
              environments: environments,
              locale,
              stack: stack,
              apiVersion,
            });
            bulkPublishSet = [];
          }

          if (skip === assetResponse.count) {
            return resolve(true);
          }
          await getAssets(stack, folder, bulkPublish, environments, locale, apiVersion, bulkPublishLimit, skip);
          return resolve();
        } else {
          resolve();
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
}

/**
 * After all pages/locales are scanned, retry any assets that were in-queue.
 * Takes pendingItems explicitly — does not read from module-level state.
 * Uses incremental backoff (see asset-scan.js SCAN_RETRY config).
 */
async function processPendingAssets(pendingItems, stack, bulkPublish, environments, apiVersion, bulkPublishLimit) {
  if (pendingItems.length === 0) return;

  // Deduplicate UIDs across locales — scan status is per-asset, not per-locale.
  // Resolving once avoids redundant retry loops for multi-locale runs.
  const allUids = [...new Set(pendingItems.map((a) => a.uid))];
  const resolvedUids = await resolveInQueueAssets(stack, allUids);

  if (resolvedUids.length === 0) {
    console.log(chalk.yellow('No in-queue assets resolved after retries.'));
    return;
  }

  const resolvedSet = new Set(resolvedUids);

  // Group resolved items by locale for correct enqueue context
  const byLocale = {};
  for (const item of pendingItems) {
    if (!resolvedSet.has(item.uid)) continue;
    if (!byLocale[item.locale]) byLocale[item.locale] = [];
    byLocale[item.locale].push(item);
  }

  for (const locale of Object.keys(byLocale)) {
    const resolvedItems = byLocale[locale];

    if (bulkPublish) {
      let batchSet = [];
      for (const item of resolvedItems) {
        batchSet.push({ uid: item.uid, locale, publish_details: item.publish_details });
        if (batchSet.length === bulkPublishLimit) {
          await queue.Enqueue({
            assets: batchSet,
            Type: 'asset',
            environments,
            locale,
            stack,
            apiVersion,
          });
          batchSet = [];
        }
      }
      if (batchSet.length > 0) {
        await queue.Enqueue({
          assets: batchSet,
          Type: 'asset',
          environments,
          locale,
          stack,
          apiVersion,
        });
      }
    } else {
      for (const item of resolvedItems) {
        await queue.Enqueue({
          assetUid: item.uid,
          publish_details: item.publish_details,
          environments,
          Type: 'asset',
          locale,
          stack,
        });
      }
    }
  }
}

/**
 * Publish assets from an import backup directory (post-import flow).
 *
 * Unlike getAssets (live folder scan), this drives publishing from the backup:
 * each imported asset is published ONLY to the environments/locales it was
 * published to in the source stack (from its publish_details), remapped to the
 * target stack. Scan-status gating is applied to the target asset UIDs.
 *
 * Mirrors the publish_details/env-name resolution of contentstack-import's
 * assets `publish()` (the bulk publish API resolves environment NAMES against
 * the target stack, and import preserves env names, so source name == target
 * name), and adds the clean/quarantined/in-queue scan gating that import skips.
 *
 * Source of truth split:
 *  - publish_details + environments come from the BACKUP (post-import flow): an
 *    asset's target environments are its source publish_details, gated by the
 *    environment uid-mapping (only environments actually imported into the target
 *    are publishable) — avoids doomed publish calls to envs never created there.
 *  - scan status comes from the LIVE target API (it is a runtime property of the
 *    freshly-imported assets and cannot exist in the backup).
 *
 * Streaming: asset chunks are processed and released one at a time and scan-gated
 * per chunk, so memory does not scale with total asset count. The only structures
 * retained across chunks are bounded (partial publish batches + the in-queue
 * subset). The single in-memory floor is the asset uid-mapping file itself (same
 * as import's publish()); for very large stacks raise Node's --max-old-space-size.
 */
async function getAssetsFromBackup(stack, dataDir, bulkPublish, apiVersion, bulkPublishLimit) {
  const assetsPath = path.join(dataDir, 'assets');
  const assetsIndexPath = path.join(assetsPath, 'assets.json');
  const assetUidMapperPath = path.join(dataDir, 'mapper', 'assets', 'uid-mapping.json');
  const envUidMapperPath = path.join(dataDir, 'mapper', 'environments', 'uid-mapping.json');
  const environmentsPath = path.join(dataDir, 'environments', 'environments.json');

  // Fail fast with actionable errors when the backup is incomplete.
  if (!existsSync(assetsPath) || !existsSync(assetsIndexPath)) {
    throw new Error(`No assets found in backup. Expected '${assetsIndexPath}'. Check the --data-dir path.`);
  }
  if (!existsSync(assetUidMapperPath)) {
    throw new Error(
      `Asset UID mapping not found at '${assetUidMapperPath}'. Run import against this data dir before publishing.`,
    );
  }
  if (!existsSync(environmentsPath)) {
    throw new Error(`Environments not found at '${environmentsPath}'. Cannot resolve target environments.`);
  }

  const fsUtil = new FsUtility({ basePath: assetsPath, indexFileName: 'assets.json' });
  const assetUidMap = fsUtil.readFile(assetUidMapperPath, true) || {};
  // environments.json: { [sourceEnvUid]: { name, ... } } — source env definitions.
  const environments = fsUtil.readFile(environmentsPath, true) || {};
  // uid-mapping.json: { [sourceEnvUid]: targetEnvUid } — only environments actually
  // imported into the target. Used as the "is publishable" gate. Optional: older
  // backups (or runs with no imported environments) may not have it.
  const envUidMapping = existsSync(envUidMapperPath) ? fsUtil.readFile(envUidMapperPath, true) || {} : null;
  if (!envUidMapping) {
    console.log(
      chalk.yellow(
        `Environment UID mapping not found at '${envUidMapperPath}'. Falling back to environment names from ` +
          `environments.json — ensure the target stack has environments with matching names.`,
      ),
    );
  }
  const isEnvImported = (sourceEnvUid) =>
    !envUidMapping || Object.prototype.hasOwnProperty.call(envUidMapping, sourceEnvUid);

  // Resolve an asset's deduped, env-gated target (envName, locale) pairs from its
  // publish_details. Env name comes from the backup; only environments actually
  // imported into the target (per the env uid-mapping) are publishable.
  const resolvePairs = (asset) => {
    const seen = new Set();
    const pairs = [];
    for (const pd of asset.publish_details) {
      const env = environments[pd.environment];
      if (!env || !env.name) continue; // env not in the data dir — cannot resolve a name
      if (!isEnvImported(pd.environment)) continue; // env not imported into target — skip
      const key = `${env.name}||${pd.locale}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ envName: env.name, locale: pd.locale });
    }
    return pairs;
  };

  // Bounded cross-chunk state only — nothing scales with total asset count:
  //  - `buffers`: partial publish batches, capped at envCount x localeCount x bulkPublishLimit.
  //  - `pending`: the in-queue (scanning) subset awaiting retry.
  // The full asset universe is never held in memory; chunks are processed and
  // released one at a time (same streaming shape as contentstack-import's publish()).
  const buffers = new Map(); // "envName||locale" -> { envName, locale, uids: [] }
  const pending = []; // { targetUid, pairs } for assets whose scan is still in queue
  let skippedNoUidMapping = 0; // source asset was not imported (no asset uid mapping)
  let skippedNoMappableEnv = 0; // asset has publish details, but none of its envs were imported
  let publishableAssets = 0; // assets enqueued for publish (across all env/locale pairs)

  const enqueueBatch = async (envName, locale, uids) => {
    if (uids.length === 0) return;
    if (bulkPublish) {
      const assets = uids.map((uid) => ({ uid, locale }));
      await queue.Enqueue({ assets, Type: 'asset', environments: [envName], locale, stack, apiVersion });
    } else {
      for (const uid of uids) {
        await queue.Enqueue({ assetUid: uid, environments: [envName], Type: 'asset', locale, stack });
      }
    }
  };

  // Add a publishable asset to its (env, locale) buffers, flushing any that fill up.
  // Grouping by the exact pair keeps the bulk API from publishing an asset to a
  // combo it was not published to in source.
  const bufferAsset = async (targetUid, pairs) => {
    publishableAssets++;
    for (const { envName, locale } of pairs) {
      const key = `${envName}||${locale}`;
      let buf = buffers.get(key);
      if (!buf) {
        buf = { envName, locale, uids: [] };
        buffers.set(key, buf);
      }
      buf.uids.push(targetUid);
      if (buf.uids.length >= bulkPublishLimit) {
        await enqueueBatch(envName, locale, buf.uids);
        buf.uids = [];
      }
    }
  };

  const indexer = fsUtil.indexFileContent;

  // NOTE: one readChunkFiles.next() call per index entry — the iteration count must
  // equal the number of chunk files (same contract as contentstack-import's publish()).
  for (const _index in indexer) {
    const chunk = await fsUtil.readChunkFiles.next();
    const assetsArr = Object.values(chunk || {});

    // Resolve this chunk's assets to publish targets (bounded by chunk size).
    const resolved = [];
    for (const asset of assetsArr) {
      if (!asset || !Array.isArray(asset.publish_details) || asset.publish_details.length === 0) {
        continue;
      }
      const targetUid = assetUidMap[asset.uid];
      if (!targetUid) {
        skippedNoUidMapping++;
        continue;
      }
      const pairs = resolvePairs(asset);
      if (pairs.length === 0) {
        skippedNoMappableEnv++;
        continue;
      }
      resolved.push({ targetUid, pairs });
    }
    if (resolved.length === 0) continue;

    // Scan status is a target-stack property of the freshly-imported assets, so it
    // is fetched live (one batched read per chunk) — it is not in the backup.
    const statusMap = await fetchScanStatusBatch(
      stack,
      resolved.map((r) => r.targetUid),
    );

    for (const { targetUid, pairs } of resolved) {
      const status = statusMap.get(targetUid);
      if (status === ASSET_SCAN_STATUS.QUARANTINE) {
        scanSummary.quarantined++;
        console.log(chalk.yellow(`Skipped (quarantined): Asset UID '${targetUid}'`));
      } else if (status === ASSET_SCAN_STATUS.IN_QUEUE) {
        scanSummary.inQueue++;
        pending.push({ targetUid, pairs });
      } else {
        if (status === ASSET_SCAN_STATUS.READY) scanSummary.clean++;
        else scanSummary.noStatus++;
        await bufferAsset(targetUid, pairs);
      }
    }
  }

  // Resolve in-queue assets once (incremental backoff); publish those that turn clean.
  if (pending.length > 0) {
    const resolvedUids = await resolveInQueueAssets(
      stack,
      pending.map((p) => p.targetUid),
    );
    const resolvedSet = new Set(resolvedUids);
    for (const { targetUid, pairs } of pending) {
      if (resolvedSet.has(targetUid)) await bufferAsset(targetUid, pairs);
    }
  }

  // Flush remaining partial (env, locale) batches.
  for (const { envName, locale, uids } of buffers.values()) {
    await enqueueBatch(envName, locale, uids);
  }

  if (skippedNoUidMapping > 0) {
    console.log(chalk.yellow(`Skipped ${skippedNoUidMapping} asset(s): no UID mapping (not imported into target).`));
  }
  if (skippedNoMappableEnv > 0) {
    console.log(
      chalk.yellow(
        `Skipped ${skippedNoMappableEnv} asset(s): none of their published environments were imported into the target.`,
      ),
    );
  }
  if (publishableAssets === 0) {
    console.log(chalk.yellow('No publishable assets found in backup (no mapped assets with publishable environments).'));
  }
}

function setConfig(conf, bp) {
  if (bp) {
    queue.consumer = performBulkPublish;
    logFileName = 'bulk-publish-assets';
  } else {
    queue.consumer = publishAsset;
    logFileName = 'publish-assets';
  }
  config = conf;
  queue.config = conf;
  filePath = initializeLogger(logFileName);
  pendingAssetsForRetry = [];
  scanSummary = { clean: 0, quarantined: 0, inQueue: 0, noStatus: 0 };
}

async function start({ retryFailed, bulkPublish, environments, folderUid, locales, apiVersion, dataDir }, stack, config) {
  process.on('beforeExit', async () => {
    const isErrorLogEmpty = await isEmpty(`${filePath}.error`);
    const isSuccessLogEmpty = await isEmpty(`${filePath}.success`);
    if (!isErrorLogEmpty) {
      console.log(`The error log for this session is stored at ${filePath}.error`);
    } else if (!isSuccessLogEmpty) {
      console.log(`The success log for this session is stored at ${filePath}.success`);
    }

    // Generate and display the bulk publish status link
    if (bulkPublish && stack && config) {
      const statusUrl = generateBulkPublishStatusUrl(stack, config);
      if (statusUrl) {
        process.stdout.write('\n');
        process.stdout.write('\x1b[37mHere is the link to check the bulk publish status: \x1b[0m');
        process.stdout.write('\x1b[34m' + statusUrl + '\x1b[0m');
        process.stdout.write('\n');
      }
    }

    process.exit(0);
  });

  if (retryFailed) {
    console.log(chalk.yellow('Note: --retry-failed replays from log and skips asset scan status checks.'));
    if (!validateFile(retryFailed, ['publish-assets', 'bulk-publish-assets'])) {
      return false;
    }

    bulkPublish = retryFailed.match(new RegExp('bulk')) ? true : false;
    setConfig(config, bulkPublish);

    if (bulkPublish) {
      await retryFailedLogs(retryFailed, queue, 'bulk');
    } else {
      await retryFailedLogs(retryFailed, { assetQueue: queue }, 'publish');
    }
  } else if (dataDir) {
    // Post-import flow: publish each imported asset only to its original
    // environments/locales (from backup publish_details), scan-gated.
    setConfig(config, bulkPublish);
    const bulkPublishLimit = fetchBulkPublishLimit(stack?.org_uid);
    await getAssetsFromBackup(stack, dataDir, bulkPublish, apiVersion, bulkPublishLimit);
    printScanSummary(scanSummary);
  } else if (folderUid) {
    setConfig(config, bulkPublish);
    const bulkPublishLimit = fetchBulkPublishLimit(stack?.org_uid);
    for (const locale of locales) {
      await getAssets(stack, folderUid, bulkPublish, environments, locale, apiVersion, bulkPublishLimit);
    }

    printScanSummary(scanSummary);

    // Resolve in-queue assets with incremental retry; pass pendingAssetsForRetry explicitly
    if (pendingAssetsForRetry.length > 0) {
      await processPendingAssets(pendingAssetsForRetry, stack, bulkPublish, environments, apiVersion, bulkPublishLimit);
      pendingAssetsForRetry = [];
    }
  }
}

module.exports = {
  getAssets,
  getAssetsFromBackup,
  setConfig,
  start,
  processPendingAssets,
};
