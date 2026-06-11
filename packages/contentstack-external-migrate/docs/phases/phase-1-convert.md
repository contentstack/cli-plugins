# Phase 1 — Convert

**Goal:** `csdx migrate:convert` transforms a Contentful export JSON into a Contentstack import bundle.

**Delivers:** Core migration value — fully offline, no Contentstack credentials.

---

## Scope

### In scope

- Port conversion engine from `references/import-contentful-cli-main`
- Contentful adapter: `src/adapters/contentful/convert.ts`
- Service layer: `src/services/contentful/**`
- `csdx migrate:convert` with flags + interactive prompts
- Vitest tests against fixtures

### Out of scope

- Export (Phase 4)
- Audit / import (Phases 2–3)
- `--stack` inline push from reference
- csdx auth on convert (reference had it; we drop it)

---

## Command interface

```bash
csdx migrate:convert \
  --legacy contentful \
  --input ./export.json \
  --output ./contentstack-import \
  [--master-locale en-US] \
  [--affix prj_] \
  [--verbose]
```

| Flag | Short | Required | Default | Description |
|------|-------|----------|---------|-------------|
| `--legacy` | — | yes | — | `contentful` (only option in this phase) |
| `--input` | `-i` | yes* | — | Contentful export JSON path |
| `--output` | `-o` | no | `./contentstack-import` | Parent dir; bundle at `<output>/bundle` |
| `--master-locale` | `-m` | no | prompt | Destination master locale |
| `--affix` | `-a` | no | `""` | Content-type UID prefix |
| `--verbose` | `-v` | no | off | Underlying logs |

*Omit `--input` for interactive mode.

---

## Implementation steps

### 1. Port reference files

See [architecture port map](../architecture.md#reference-port-map). Copy into `src/services/contentful/` and `src/adapters/contentful/`.

Build step copies JSON assets:

```bash
# scripts/copy-assets.js — mirror reference script, target lib/services/contentful/assets/
```

### 2. Refactor `CLI_OUT_DIR`

Before porting `constants.ts`, introduce runtime config:

```typescript
// src/services/contentful/config.ts
export interface ContentfulMigrateConfig {
  outputDir: string;
  verbose: boolean;
}

let activeConfig: ContentfulMigrateConfig | null = null;

export function initContentfulMigrateConfig(cfg: ContentfulMigrateConfig): void {
  activeConfig = cfg;
}

export function getOutputDir(): string {
  if (!activeConfig) throw new Error('Contentful migrate config not initialized');
  return activeConfig.outputDir;
}
```

Replace `process.env.CLI_OUT_DIR` reads in `constants.ts` with `getOutputDir()`.

### 3. Contentful adapter

Read [implementation-principles.md](../implementation-principles.md) first — port logic from reference `runContentful()`, not the Commander/auth/import shell.

`src/adapters/contentful/convert.ts` — extract orchestration from reference `src/commands/contentful.ts`:

| Reference stage | Keep? |
|-----------------|-------|
| auth | **Remove** |
| validate | Keep → `validator.ts` |
| extract | Keep → migration-contentful libs |
| transform | Keep → contentful.service + content-type-creator |
| push (`runCsdxImport`) | **Remove** |
| staging cleanup | Keep |

Export:

```typescript
export async function convertContentfulExport(opts: ConvertOptions): Promise<ConvertResult>;
```

Register in `src/adapters/contentful/index.ts`:

```typescript
export const contentfulAdapter: LegacyAdapter = {
  legacy: 'contentful',
  export: exportContentful,      // stub until Phase 4
  convert: convertContentfulExport,
};
```

### 4. oclif command

`src/commands/migrate/convert.ts`:

```typescript
async run() {
  const { flags } = await this.parse(MigrateConvert);
  const adapter = getAdapter(flags.legacy);
  const input = flags.input ?? await promptInput();
  const result = await adapter.convert({
    input,
    outputDir: flags.output,
    masterLocale: flags['master-locale'],
    affix: flags.affix,
    verbose: flags.verbose,
  });
  logStages(result);
  this.log(`✓ Bundle ready: ${result.bundleDir}`);
}
```

### 5. Progress output

`src/lib/log.ts`:

```
validate   ✓  export.json
extract    ✓  2 locales · 16 types
transform  ✓  1204 entries · 16 types  →  contentstack-import/bundle
```

### 6. Tests

`test/adapters/contentful/convert.test.ts`:

```typescript
import { convertContentfulExport } from '../../../src/adapters/contentful/convert';

it('writes mapper.json and content_types/', async () => {
  const tmp = await mkdtemp();
  const result = await convertContentfulExport({
    input: FIXTURE_SMALL,
    outputDir: tmp,
    masterLocale: 'en-US',
  });
  expect(fs.existsSync(path.join(result.bundleDir, 'mapper.json'))).toBe(true);
});
```

Fixtures:

- Fast: `test/fixtures/contentful-export.json` (copy from reference)
- Integration: `../references/contentful-export-nty6h2uki8mm-master-2026-06-02T15-32-37.json`

---

## Key behaviors to preserve

- Clear `<output>/bundle` before write (no stale UUID chunks)
- `enforceLocaleFallbacks()` — master = `""`, others = master code
- Clean up `contentfulMigrationData/` staging dir after success
- Write `mapper.json` into bundle root

---

## Acceptance criteria

- [ ] `csdx migrate:convert -l contentful -i <export.json>` creates `<output>/bundle/`
- [ ] Bundle has `content_types/`, `entries/`, `locales/`, `mapper.json`, `export-info.json`
- [ ] No `csdx auth:login` required
- [ ] Vitest passes
- [ ] Interactive mode prompts for missing flags

---

## Manual test script

```bash
csdx migrate:convert \
  --legacy contentful \
  --input ../references/contentful-export-nty6h2uki8mm-master-2026-06-02T15-32-37.json \
  --output ./contentstack-import \
  --master-locale en-US \
  --verbose

ls contentstack-import/bundle/
cat contentstack-import/bundle/mapper.json | head -40

# Verify native audit accepts the bundle (no wrapper needed yet)
csdx auth:login
csdx cm:stacks:audit --data-dir ./contentstack-import/bundle
```

---

## Known reference quirks

1. Hardcoded `region: 'NA'` in content-type-maker — acceptable for v1
2. Typo `createRefrence` — keep when porting to avoid missed calls
3. CJS `require` for migration-contentful — OK in v1; ESM later
