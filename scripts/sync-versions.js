#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Fetch latest versions from npm
function getLatestVersion(packageName, tag = 'latest') {
  try {
    const version = execSync(`npm view ${packageName}@${tag} version`, {
      encoding: 'utf8'
    }).trim();
    return version;
  } catch (error) {
    console.error(`Failed to fetch ${packageName}@${tag}:`, error.message);
    return null;
  }
}

// Update package.json files
function updateDependencies(tag = 'latest') {
  const packagesDir = path.join(__dirname, '..', 'packages');
  const packages = fs.readdirSync(packagesDir);

  const corePackages = [
    '@contentstack/cli-utilities',
    '@contentstack/cli-command',
    '@contentstack/cli-auth',
    '@contentstack/cli-config'
  ];

  let totalUpdates = 0;

  packages.forEach(pkg => {
    const pkgPath = path.join(packagesDir, pkg, 'package.json');
    if (!fs.existsSync(pkgPath)) return;

    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    let updated = false;

    ['dependencies', 'devDependencies'].forEach(depType => {
      if (!pkgJson[depType]) return;

      Object.keys(pkgJson[depType]).forEach(dep => {
        if (corePackages.includes(dep)) {
          const version = getLatestVersion(dep, tag);
          if (version) {
            const currentVersion = pkgJson[depType][dep];
            const newVersion = `^${version}`;
            
            if (currentVersion !== newVersion) {
              pkgJson[depType][dep] = newVersion;
              console.log(`✓ Updated ${dep} in ${pkg}: ${currentVersion} → ${newVersion}`);
              updated = true;
              totalUpdates++;
            }
          }
        }
      });
    });

    if (updated) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2) + '\n');
    }
  });

  return totalUpdates;
}

// Main execution
const tag = process.argv[2] || 'latest';

console.log(`\n📦 Syncing core package dependencies to @${tag} versions...\n`);

const updates = updateDependencies(tag);

if (updates > 0) {
  console.log(`\n✅ Successfully updated ${updates} dependency version(s)`);
  console.log(`\n⚠️  Remember to run: pnpm install\n`);
} else {
  console.log(`\n✅ All dependencies are already up to date with @${tag} versions\n`);
}
