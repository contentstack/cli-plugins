/* eslint-disable no-console */
const chalk = require('chalk');

const ASSET_SCAN_STATUS = {
  READY: 'clean',
  QUARANTINE: 'quarantined',
  IN_QUEUE: 'pending',
};

const SCAN_RETRY = {
  MAX_RETRIES: 5,
  INITIAL_WAIT_MS: 5000,
  BACKOFF_FACTOR: 2,
};

function getIncrementalWaitMs(attempt) {
  return SCAN_RETRY.INITIAL_WAIT_MS * Math.pow(SCAN_RETRY.BACKOFF_FACTOR, attempt);
}

/**
 * Batch-fetch asset scan statuses for a list of UIDs.
 * Returns a Map<uid, scanStatus>. UIDs with no scan data map to undefined.
 * Throws on API error — callers must not silently treat failures as "ready".
 */
async function fetchScanStatusBatch(stack, uids) {
  const statusMap = new Map();
  if (!uids || uids.length === 0) return statusMap;

  const BATCH_SIZE = 100;
  for (let i = 0; i < uids.length; i += BATCH_SIZE) {
    const batch = uids.slice(i, i + BATCH_SIZE);
    const response = await stack
      .asset()
      .query({ uid: { $in: batch }, include_asset_scan_status: true, limit: BATCH_SIZE })
      .find();
    for (const asset of response.items || []) {
      statusMap.set(asset.uid, asset._asset_scan_status);
    }
  }

  return statusMap;
}

/**
 * Retry pending (in-queue) assets with incremental backoff until they become
 * clean or max retries is reached.
 *
 * Wait series: 5s, 10s, 20s, 40s, 80s (5 attempts total, max 155s).
 *
 * @param {object} stack - Management SDK stack instance
 * @param {string[]} pendingUids - UIDs currently in scan queue
 * @returns {string[]} UIDs that became clean and are safe to publish
 */
async function resolveInQueueAssets(stack, pendingUids) {
  if (!pendingUids || pendingUids.length === 0) return [];

  const totalWaitSec =
    Array.from({ length: SCAN_RETRY.MAX_RETRIES }, (_, i) => getIncrementalWaitMs(i)).reduce(
      (a, b) => a + b,
      0,
    ) / 1000;
  console.log(
    chalk.yellow(
      `Resolving ${pendingUids.length} in-queue asset(s). Max wait: ${totalWaitSec}s over ${SCAN_RETRY.MAX_RETRIES} retries.`,
    ),
  );

  let remaining = [...pendingUids];
  const resolvedUids = [];

  for (let attempt = 0; attempt < SCAN_RETRY.MAX_RETRIES && remaining.length > 0; attempt++) {
    const waitMs = getIncrementalWaitMs(attempt);
    console.log(
      chalk.yellow(
        `Asset scan: ${remaining.length} asset(s) in queue. Waiting ${waitMs / 1000}s before retry ${attempt + 1}/${
          SCAN_RETRY.MAX_RETRIES
        }...`,
      ),
    );

    await new Promise((resolve) => setTimeout(resolve, waitMs));

    const statusMap = await fetchScanStatusBatch(stack, remaining);
    const stillPending = [];

    for (const uid of remaining) {
      const status = statusMap.get(uid);
      if (status === ASSET_SCAN_STATUS.QUARANTINE) {
        console.log(chalk.red(`Skipped (quarantined after retry): Asset UID '${uid}'`));
      } else if (status === ASSET_SCAN_STATUS.IN_QUEUE) {
        stillPending.push(uid);
      } else {
        // clean or undefined (scanning disabled) — publishable
        resolvedUids.push(uid);
      }
    }

    remaining = stillPending;
  }

  if (remaining.length > 0) {
    console.warn(
      chalk.red(
        `Asset scan: ${remaining.length} asset(s) remained in queue after ${SCAN_RETRY.MAX_RETRIES} retries and will be skipped.`,
      ),
    );
    for (const uid of remaining) {
      console.warn(chalk.red(`Skipped (max retries exceeded): Asset UID '${uid}'`));
    }
  }

  return resolvedUids;
}

module.exports = {
  ASSET_SCAN_STATUS,
  SCAN_RETRY,
  getIncrementalWaitMs,
  fetchScanStatusBatch,
  resolveInQueueAssets,
};
