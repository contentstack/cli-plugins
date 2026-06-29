# Phase 3 — Import

**Goal:** `csdx migrate:import` imports a bundle into a Contentstack stack via native `csdx cm:stacks:import`.

**Delivers:** Final deterministic step — explicitly separate from convert (reference bundled these with `--stack`).

---

## Scope

### In scope

- oclif wrapper around `csdx cm:stacks:import`
- Reuse `csdx-spawn.ts` and `assertBundleDir()` from Phase 2
- Flags: `--stack-api-key`, `--data-dir`, `--yes`, `--skip-audit`, `--module`, `--branch`
- Live stdout streaming (long-running)

### Out of scope

- Inline import during convert
- Stack creation
- Delivery token retrieval

---

## Command interface

```bash
csdx migrate:import \
  --stack-api-key bltXXXXXXXX \
  --data-dir ./contentstack-import/bundle \
  [--yes] \
  [--skip-audit] \
  [--module entries] \
  [--branch main]
```

| Flag | Short | Required | Maps to native |
|------|-------|----------|----------------|
| `--stack-api-key` | `-k` | yes* | `--stack-api-key` |
| `--data-dir` | `-d` | yes* | `--data-dir` |
| `--yes` | `-y` | no | `--yes` |
| `--skip-audit` | — | no | `--skip-audit` |
| `--module` | — | no | `--module` |
| `--branch` | — | no | `--branch` |

**Requires:** `csdx auth:login` + empty destination stack (recommended)

---

## Implementation

Port spawn args from reference `runCsdxImport()`:

```typescript
// src/commands/migrate/import.ts
async run() {
  const { flags } = await this.parse(MigrateImport);
  const dataDir = flags['data-dir'] ?? await promptDataDir();
  const stackKey = flags['stack-api-key'] ?? await promptStackKey();
  assertBundleDir(dataDir);

  const args = [
    'cm:stacks:import',
    '--stack-api-key', stackKey,
    '--data-dir', dataDir,
  ];

  // Default --yes for non-interactive CI/expert use (matches reference)
  if (flags.yes !== false) args.push('--yes');
  if (flags['skip-audit']) args.push('--skip-audit');
  if (flags.module) args.push('--module', flags.module);
  if (flags.branch) args.push('--branch', flags.branch);

  this.log('─── csdx cm:stacks:import ──────────────────────────────');
  const code = await spawnCsdx(args);
  this.log('────────────────────────────────────────────────────────');
  if (code !== 0) this.error(`Import failed (exit ${code})`, { exit: code });
  this.log(`✓ Import complete — ${stackKey}`);
}
```

Import does **not** use legacy adapters.

---

## Recommended workflow

```
convert → migrate:audit (review) → migrate:import
```

Native import runs audit-fix by default. Use `--skip-audit` only if you already audited and fixed manually.

---

## Acceptance criteria

- [ ] Import succeeds against empty dev stack
- [ ] Streams native csdx output
- [ ] `--skip-audit`, `--module`, `--branch` forwarded
- [ ] Fails fast on missing bundle
- [ ] Convert has no `--stack` flag

---

## Manual test script

```bash
csdx auth:login

csdx migrate:convert \
  -l contentful \
  -i ../references/contentful-export-nty6h2uki8mm-master-2026-06-02T15-32-37.json \
  -o ./contentstack-import -m en-US

csdx migrate:audit -d ./contentstack-import/bundle --report-path ./audit-reports

csdx migrate:import \
  -k YOUR_STACK_API_KEY \
  -d ./contentstack-import/bundle \
  -y
```

Verify in Contentstack UI: content types, entries, assets present.

---

## Comparison with reference CLI

| Reference | Our plugin |
|-----------|------------|
| `migrate file.json` | `migrate:convert -i file.json` |
| `migrate file.json --stack KEY` | `migrate:import -k KEY -d bundle` |
| Auth required for convert | Auth only for audit/import |
