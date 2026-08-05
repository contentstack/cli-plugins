'use strict';

const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');

const {
  ASSET_SCAN_STATUS,
  SCAN_RETRY,
  getIncrementalWaitMs,
  fetchScanStatusBatch,
  resolveInQueueAssets,
} = require('../../../src/util/asset-scan');

// Minimal mock stack factory
function makeStack(items) {
  return {
    asset() {
      return {
        query() {
          return {
            find: async () => ({ items: items || [] }),
          };
        },
      };
    },
  };
}

// Stack that throws on query
function makeErrorStack(errorMsg) {
  return {
    asset() {
      return {
        query() {
          return {
            find: async () => {
              throw new Error(errorMsg);
            },
          };
        },
      };
    },
  };
}

describe('asset-scan utilities', () => {
  // ─── getIncrementalWaitMs ────────────────────────────────────────────────

  describe('getIncrementalWaitMs', () => {
    it('returns INITIAL_WAIT_MS for attempt 0', () => {
      expect(getIncrementalWaitMs(0)).to.equal(SCAN_RETRY.INITIAL_WAIT_MS);
    });

    it('doubles on each subsequent attempt', () => {
      const seq = [0, 1, 2, 3, 4].map(getIncrementalWaitMs);
      for (let i = 1; i < seq.length; i++) {
        expect(seq[i]).to.equal(seq[i - 1] * SCAN_RETRY.BACKOFF_FACTOR);
      }
    });

    it('produces the correct 5-attempt sequence', () => {
      const expected = [5000, 10000, 20000, 40000, 80000];
      expected.forEach((ms, attempt) => {
        expect(getIncrementalWaitMs(attempt)).to.equal(ms);
      });
    });
  });

  // ─── fetchScanStatusBatch ───────────────────────────────────────────────

  describe('fetchScanStatusBatch', () => {
    it('returns empty Map when called with empty uid array', async () => {
      const map = await fetchScanStatusBatch(makeStack([]), []);
      expect(map.size).to.equal(0);
    });

    it('maps UIDs to their scan statuses', async () => {
      const items = [
        { uid: 'a1', _asset_scan_status: 'clean' },
        { uid: 'a2', _asset_scan_status: 'quarantined' },
        { uid: 'a3', _asset_scan_status: 'pending' },
      ];
      const map = await fetchScanStatusBatch(makeStack(items), ['a1', 'a2', 'a3']);
      expect(map.get('a1')).to.equal(ASSET_SCAN_STATUS.READY);
      expect(map.get('a2')).to.equal(ASSET_SCAN_STATUS.QUARANTINE);
      expect(map.get('a3')).to.equal(ASSET_SCAN_STATUS.IN_QUEUE);
    });

    it('maps UIDs with no scan field to undefined', async () => {
      const items = [{ uid: 'a1' }];
      const map = await fetchScanStatusBatch(makeStack(items), ['a1']);
      expect(map.get('a1')).to.equal(undefined);
    });

    it('throws on API error (fail fast — do not silently treat as ready)', async () => {
      try {
        await fetchScanStatusBatch(makeErrorStack('Network error'), ['a1']);
        expect.fail('Expected fetchScanStatusBatch to throw');
      } catch (error) {
        expect(error.message).to.equal('Network error');
      }
    });
  });

  // ─── resolveInQueueAssets ───────────────────────────────────────────────

  describe('resolveInQueueAssets', () => {
    let originalSetTimeout;

    beforeEach(() => {
      // Replace setTimeout with an immediate resolver to avoid real waits
      originalSetTimeout = global.setTimeout;
      global.setTimeout = (fn) => fn();
    });

    afterEach(() => {
      global.setTimeout = originalSetTimeout;
    });

    it('returns empty array for empty input without calling stack', async () => {
      const result = await resolveInQueueAssets(makeStack([]), []);
      expect(result).to.deep.equal([]);
    });

    it('resolves UIDs that become clean on the first retry', async () => {
      const items = [{ uid: 'a1', _asset_scan_status: 'clean' }];
      const result = await resolveInQueueAssets(makeStack(items), ['a1']);
      expect(result).to.include('a1');
    });

    it('excludes UIDs that become quarantined during retry', async () => {
      const items = [{ uid: 'a1', _asset_scan_status: 'quarantined' }];
      const result = await resolveInQueueAssets(makeStack(items), ['a1']);
      expect(result).to.not.include('a1');
    });

    it('resolves UIDs with no scan status (scanning disabled)', async () => {
      const items = [{ uid: 'a1' }]; // no _asset_scan_status field
      const result = await resolveInQueueAssets(makeStack(items), ['a1']);
      expect(result).to.include('a1');
    });

    it('drops UIDs still pending after MAX_RETRIES', async () => {
      // Always returns pending status
      const items = [{ uid: 'a1', _asset_scan_status: 'pending' }];
      const result = await resolveInQueueAssets(makeStack(items), ['a1']);
      expect(result).to.deep.equal([]);
    });

    it('handles mixed outcomes: clean, quarantined, and pending exhausted', async () => {
      const items = [
        { uid: 'clean1', _asset_scan_status: 'clean' },
        { uid: 'quar1', _asset_scan_status: 'quarantined' },
        { uid: 'pend1', _asset_scan_status: 'pending' },
      ];
      const result = await resolveInQueueAssets(makeStack(items), ['clean1', 'quar1', 'pend1']);
      expect(result).to.include('clean1');
      expect(result).to.not.include('quar1');
      expect(result).to.not.include('pend1');
    });
  });
});
