/* eslint-disable no-console */
/* eslint-disable new-cap */
/* eslint-disable camelcase */
const chalk = require('chalk');
const { cliux } = require('@contentstack/cli-utilities');
const { getQueue } = require('../util/queue');
const { performBulkPublish, publishAsset, initializeLogger } = require('../consumer/publish');
const retryFailedLogs = require('../util/retryfailed');
const { validateFile } = require('../util/fs');
const { isEmpty } = require('../util');
const { fetchBulkPublishLimit } = require('../util/common-utility');
const { generateBulkPublishStatusUrl } = require('../util/generate-bulk-publish-url');
const { resolveInQueueAssets, ASSET_SCAN_STATUS } = require('../util/asset-scan');

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

async function start({ retryFailed, bulkPublish, environments, folderUid, locales, apiVersion }, stack, config) {
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
  setConfig,
  start,
  processPendingAssets,
};
