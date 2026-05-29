const path = require('path');
const sinon = require('sinon');
const fs = require('fs');

process.env.TS_NODE_PROJECT = path.resolve('test/tsconfig.json');

// Prevent tests from writing actual files by mocking fs operations
const originalMkdirSync = fs.mkdirSync;
const originalWriteFileSync = fs.writeFileSync;

const isTestMode = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('mocha'));

if (isTestMode) {
  fs.mkdirSync = function(...args) {
    const targetPath = args[0];
    if (targetPath && (
      targetPath.includes('node_modules') ||
      targetPath.startsWith('/tmp') ||
      targetPath.startsWith('/var')
    )) {
      return originalMkdirSync.apply(this, args);
    }
    return undefined;
  };

  fs.writeFileSync = function(...args) {
    const targetPath = args[0];
    if (targetPath && (
      targetPath.includes('node_modules') ||
      targetPath.startsWith('/tmp') ||
      targetPath.includes('coverage') ||
      targetPath.includes('.nyc_output') ||
      targetPath.includes('report.json')
    )) {
      return originalWriteFileSync.apply(this, args);
    }
    return undefined;
  };
}

// Clean up any test artifacts on exit
process.on('exit', () => {
  // Restore original fs functions
  fs.mkdirSync = originalMkdirSync;
  fs.writeFileSync = originalWriteFileSync;
});
