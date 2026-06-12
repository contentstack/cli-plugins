// Copies non-TS assets (JSON configs) from src/ into lib/ after `tsc` runs.

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const OUT = path.resolve(__dirname, '..', 'lib');

function walk(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p, fn);
    else fn(p);
  }
}

walk(SRC, (file) => {
  if (file.endsWith('.json')) {
    const rel = path.relative(SRC, file);
    const dst = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(file, dst);
  }
});

console.log('copy-assets: done');
