# Phase 2 — Audit

**Goal:** `csdx migrate:audit` validates a convert output bundle via native `csdx cm:stacks:audit`.

**Delivers:** Named audit step — no custom audit logic.

---

## Scope

### In scope

- oclif command wrapping `csdx cm:stacks:audit`
- `src/lib/csdx-spawn.ts` — shared spawn helper
- `src/lib/bundle.ts` — `assertBundleDir()` pre-flight
- Pass-through flags: `--data-dir`, `--report-path`, `--modules`, `--csv`
- Document native `csdx cm:stacks:audit:fix` remediation loop

### Out of scope

- `migrate:audit:fix` wrapper
- Parsing audit report JSON inside the plugin
- Contentful-specific audit rules

---

## Command interface

```bash
csdx migrate:audit \
  --data-dir ./contentstack-import/bundle \
  [--report-path ./audit-reports] \
  [--modules content-types,entries,assets] \
  [--csv]
```

| Flag | Short | Required | Maps to native |
|------|-------|----------|----------------|
| `--data-dir` | `-d` | yes* | `--data-dir` |
| `--report-path` | — | no | `--report-path` |
| `--modules` | — | no | `--modules` |
| `--csv` | — | no | `--csv` |

*Interactive mode prompts for `--data-dir`.

**Requires:** `csdx auth:login`

---

## Implementation

### `src/lib/bundle.ts`

```typescript
export function assertBundleDir(bundleDir: string): void {
  const required = ['content_types', 'locales', 'export-info.json'];
  for (const entry of required) {
    if (!fs.existsSync(path.join(bundleDir, entry))) {
      throw new Error(
        `Invalid bundle at ${bundleDir}: missing ${entry}. Run migrate:convert first.`
      );
    }
  }
}
```

### `src/lib/csdx-spawn.ts`

```typescript
export async function spawnCsdx(args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('csdx', args, { stdio: 'inherit' });
    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('csdx not found. Install: npm i -g @contentstack/cli'));
      } else reject(err);
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}
```

### `src/commands/migrate/audit.ts`

```typescript
async run() {
  const { flags } = await this.parse(MigrateAudit);
  const dataDir = flags['data-dir'] ?? await promptDataDir();
  assertBundleDir(dataDir);

  const args = ['cm:stacks:audit', '--data-dir', dataDir];
  if (flags['report-path']) args.push('--report-path', flags['report-path']);
  if (flags.modules) args.push('--modules', flags.modules);
  if (flags.csv) args.push('--csv');

  this.log(`Running: csdx ${args.join(' ')}`);
  const code = await spawnCsdx(args);
  if (code !== 0) this.error(`Audit failed (exit ${code})`, { exit: code });
  this.log('✓ Audit complete');
}
```

Audit does **not** use legacy adapters — same command regardless of source CMS.

---

## Remediation loop (document in README)

```bash
csdx migrate:audit -d ./contentstack-import/bundle --report-path ./audit-reports
csdx cm:stacks:audit:fix -d ./contentstack-import/bundle --report-path ./audit-fix
csdx migrate:audit -d ./contentstack-import/bundle --report-path ./audit-verify
```

---

## Acceptance criteria

- [ ] Spawns native audit with correct args
- [ ] Invalid bundle path fails fast
- [ ] Exit code matches native csdx
- [ ] Works on Phase 1 bundle output
- [ ] `--report-path` writes reports

---

## Manual test script

```bash
csdx auth:login
csdx migrate:audit -d ./contentstack-import/bundle --report-path ./audit-reports

# Should match native behavior:
csdx cm:stacks:audit -d ./contentstack-import/bundle --report-path ./audit-native
```

---

## Tests

`test/lib/csdx-spawn.test.ts` — mock spawn, verify args array.

`test/lib/bundle.test.ts` — assertBundleDir throws on missing dirs.
