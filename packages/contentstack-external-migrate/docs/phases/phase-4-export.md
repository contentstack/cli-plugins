# Phase 4 — Export

**Goal:** `csdx migrate:export` exports content from a legacy CMS into a migration workspace.

**Delivers:** Step 1 of the full pipeline — Contentful first.

---

## Scope

### In scope

- Contentful adapter export: `src/adapters/contentful/export.ts`
- Management API or Contentful CLI export
- Flags: space ID, management token, asset download, drafts, archived
- Output: `export.json` in workspace

### Out of scope

- Sanity / Storyblok (future adapters — see [architecture](../architecture.md#future-adapters-not-in-initial-scope))
- Convert logic

---

## Command interface

```bash
csdx migrate:export \
  --legacy contentful \
  --space-id 10897132 \
  --management-token "$CONTENTFUL_MANAGEMENT_TOKEN" \
  --output ./migration-workspace \
  [--download-assets] \
  [--include-drafts] \
  [--include-archived] \
  [--verbose]
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--legacy` | yes | — | `contentful` |
| `--space-id` | yes* | — | Contentful space ID |
| `--management-token` | yes* | — | CMA token (prefer env var) |
| `--output` | no | `./migration-workspace` | Workspace root |
| `--download-assets` | no | off | Download asset binaries |
| `--include-drafts` | no | off | Include draft entries |
| `--include-archived` | no | off | Include archived entries |

*Interactive mode prompts. Prefer `CONTENTFUL_MANAGEMENT_TOKEN` env var over CLI flag.

**No `csdx auth:login` required** — Contentful credentials only.

---

## Output layout

```
migration-workspace/
├── export.json          # Must pass Phase 1 validator
└── assets/              # optional
```

Phase 5 adds `migration-manifest.json` here.

---

## Implementation

Use **Contentful CLI** via `src/lib/contentful-cli-spawn.ts`:

1. If `contentful` is on PATH (`contentful --version` succeeds), run `contentful space export …`.
2. Otherwise run `npx -y contentful-cli space export …` (no global install required).

Do not reimplement CMA export in v1 unless we add Option B later.

### Adapter example

```typescript
// src/adapters/contentful/export.ts
import { formatContentfulCliInvocation, spawnContentfulCli } from '../../lib/contentful-cli-spawn';

export async function exportContentful(opts: ExportOptions): Promise<ExportResult> {
  const exportFile = path.join(opts.outputDir, 'export.json');
  const token = opts.managementToken ?? process.env.CONTENTFUL_MANAGEMENT_TOKEN;
  if (!token) throw new Error('Set CONTENTFUL_MANAGEMENT_TOKEN or --management-token');

  await mkdirp(opts.outputDir);

  const args = [
    'space', 'export',
    '--space-id', opts.spaceId!,
    '--management-token', token,
    '--content-file', exportFile,
    ...(opts.includeDrafts ? ['--include-drafts'] : []),
    ...(opts.includeArchived ? ['--include-archived'] : []),
    ...(opts.downloadAssets ? ['--download-assets'] : []),
  ];

  if (opts.verbose) {
    console.log(`Running: ${formatContentfulCliInvocation(args)}`);
  }

  const code = await spawnContentfulCli(args);
  if (code !== 0) throw new Error(`Contentful export failed (exit ${code})`);
  return { exportFile };
}
```

Future **Option B** (CMA `POST /spaces/{id}/export` + poll) can live in the same adapter without changing command flags.

### Wire adapter

Update `src/adapters/contentful/index.ts`:

```typescript
export const contentfulAdapter: LegacyAdapter = {
  legacy: 'contentful',
  export: exportContentful,
  convert: convertContentfulExport,
};
```

### oclif command

`src/commands/migrate/export.ts` — resolve adapter, call `adapter.export()`.

---

## Validation

After export, run validator before returning success:

```typescript
import contentfulValidator from '../../adapters/contentful/validator';
const raw = await fs.readFile(exportFile, 'utf8');
if (!contentfulValidator(raw)) {
  throw new Error('Export missing required Contentful keys');
}
```

Required keys: `contentTypes`, `editorInterfaces`, `entries`, `assets`, `locales`.

---

## Acceptance criteria

- [ ] Produces valid `export.json`
- [ ] `migrate:convert -i export.json` succeeds
- [ ] Token never logged to stdout
- [ ] Interactive mode works

---

## Manual test script

```bash
export CONTENTFUL_MANAGEMENT_TOKEN="..."
csdx migrate:export \
  --legacy contentful \
  --space-id YOUR_SPACE_ID \
  --output ./migration-workspace

csdx migrate:convert \
  -l contentful \
  -i ./migration-workspace/export.json \
  -o ./migration-workspace/contentstack-import
```

---

## Security

- Read token from env in docs and examples
- Warn against committing export files with embedded secrets
- Never write management token to manifest (Phase 5)
