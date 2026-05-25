// test/setup.js

const { Command } = require('@contentstack/cli-command');

// Set default region for tests to avoid "Region not configured" error
process.env.CSDX_REGION = 'NA';

// Set the default host for Command instances to avoid region configuration errors
// Note: cmaHost should return just the hostname without protocol (SDK adds https://)
const testApiHost = 'api.contentstack.io';

// Stub the Command class's cmaHost getter globally for all tests
// This prevents "Region not configured" errors during test execution
Object.defineProperty(Command.prototype, 'cmaHost', {
  get: function() {
    return testApiHost;
  },
  configurable: true
});

// Make unhandled promise rejections fail tests loudly
process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("UNHANDLED REJECTION in tests:", reason);
  // Non-zero exit so CI fails explicitly
  process.exitCode = 1;
});

// Make uncaught exceptions visible
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("UNCAUGHT EXCEPTION in tests:", err);
  process.exitCode = 1;
});

// Nock setup - enable net connections and configure mocks in individual test files
try {
  const nock = require("nock");
  // Explicitly reset nock settings to allow connections by default
  nock.enableNetConnect();
  // We'll set up specific nock mocks in test files as needed
} catch (e) {
  // Nock not available, skip
}
