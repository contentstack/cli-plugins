#!/usr/bin/env node

/**
 * This script prepares packages for publishing by converting workspace protocol
 * dependencies to actual version numbers from the local packages.
 * 
 * Usage: Run before publishing
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const packagesDir = path.join(__dirname, 'packages');
const packages = glob.sync('*/package.json', { cwd: packagesDir });

// First, collect all package versions
const packageVersions = {};
packages.forEach(pkgPath => {
  const fullPath = path.join(packagesDir, pkgPath);
  const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  packageVersions[pkg.name] = pkg.version;
});

console.log('Found packages:', Object.keys(packageVersions));

// Then, update workspace dependencies
packages.forEach(pkgPath => {
  const fullPath = path.join(packagesDir, pkgPath);
  const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  let modified = false;

  ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].forEach(depType => {
    if (!pkg[depType]) return;
    
    Object.keys(pkg[depType]).forEach(depName => {
      const depVersion = pkg[depType][depName];
      
      // Check if it's a workspace protocol
      if (depVersion.startsWith('workspace:')) {
        if (packageVersions[depName]) {
          // Replace with actual version using tilde range
          pkg[depType][depName] = `~${packageVersions[depName]}`;
          console.log(`  ${pkg.name}: ${depName} workspace:* -> ~${packageVersions[depName]}`);
          modified = true;
        } else {
          console.warn(`  Warning: ${pkg.name} depends on ${depName} but version not found`);
        }
      }
    });
  });

  if (modified) {
    fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`Updated: ${pkg.name}`);
  }
});

console.log('\nWorkspace dependencies resolved for publishing!');
console.log('Remember to restore them after publishing using: git restore packages/*/package.json');
