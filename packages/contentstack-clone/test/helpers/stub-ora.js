/**
 * Replace `ora` with a no-op spinner before any test file loads application code.
 * Real ora keeps timers / TTY animation and can leave the process hanging after tests
 * (e.g. "Fetching Branches") even when assertions pass.
 *
 * Must be listed first in `.mocharc.json` `require` so it runs before `ts-node/register`
 * and test imports.
 */
'use strict';

const oraPath = require.resolve('ora');
const originalOra = require(oraPath);

function createNoopSpinner() {
  const api = {
    start() {
      return api;
    },
    stop() {
      return api;
    },
    succeed() {
      return api;
    },
    fail() {
      return api;
    },
    clear() {
      return api;
    },
    text: '',
    isSpinning: false,
  };
  return api;
}

function noopOraFactory() {
  return createNoopSpinner();
}

if (typeof originalOra.promise === 'function') {
  noopOraFactory.promise = async function (action, options) {
    if (!action || typeof action.then !== 'function') {
      throw new TypeError('Parameter `action` must be a Promise');
    }
    try {
      await action;
      return createNoopSpinner();
    } catch {
      return createNoopSpinner();
    }
  };
}

require.cache[oraPath].exports = noopOraFactory;
