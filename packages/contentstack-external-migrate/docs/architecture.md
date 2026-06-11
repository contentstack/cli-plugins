# Architecture

## Implementation principles

Before porting `references/import-contentful-cli-main`:

- **Reuse its conversion code** in `src/services/contentful/` — do not copy Commander layout, auth-on-convert, or inline `--stack` import.
- **Command flags** come from `docs/phases/*.md` (PRD), declared with `@contentstack/cli-utilities` on oclif commands extending `@contentstack/cli-command`.
- **Contentful export** shells out via `src/lib/contentful-cli-spawn.ts`: global `contentful` if on PATH, else `npx -y contentful-cli`.
- **Audit/import** shell out via `src/lib/csdx-spawn.ts` to native `csdx cm:stacks:*`.

Full detail: [implementation-principles.md](./implementation-principles.md).

## Single package

One `csdx` plugin — no monorepo, no separate core library.

Future Sanity and Storyblok support is added as adapter folders inside the same package, not as new npm workspaces.

```
cli-plugin-migrate/
├── src/
│   ├── commands/migrate/          # Thin oclif commands
│   │   ├── convert.ts
│   │   ├── export.ts
│   │   ├── audit.ts
│   │   ├── import.ts
│   │   └── status.ts              # Phase 5
│   ├── adapters/                  # Per legacy CMS
│   │   ├── types.ts               # LegacyAdapter interface
│   │   ├── registry.ts            # legacy flag → adapter
│   │   └── contentful/            # Phase 1 + 4
│   │       ├── convert.ts         # Orchestrator (from reference)
│   │       ├── export.ts          # Phase 4
│   │       └── validator.ts
│   ├── services/contentful/       # Ported reference engine
│   │   ├── contentful.service.ts
│   │   ├── content-type-creator.ts
│   │   ├── migration-contentful/
│   │   ├── jsonRTE.ts
│   │   ├── taxonomy.service.ts
│   │   ├── constants.ts
│   │   ├── mapper/write.ts
│   │   └── prompts/master-locale.ts
│   ├── lib/
│   │   ├── csdx-spawn.ts          # Spawn native csdx for audit/import
│   │   ├── contentful-cli-spawn.ts # Global contentful or npx contentful-cli
│   │   ├── bundle.ts              # assertBundleDir, paths
│   │   ├── manifest.ts            # Phase 5
│   │   └── log.ts                 # Stage progress output
│   └── index.ts
├── test/
│   ├── commands/
│   ├── adapters/contentful/
│   └── fixtures/
├── scripts/copy-assets.js
├── package.json
├── tsconfig.json
├── docs/
└── README.md
```

Package name: `@contentstack/cli-plugin-migrate`

---

## Adapter pattern

Commands stay thin. They parse flags, resolve the adapter from `--legacy`, and delegate.

```typescript
// src/adapters/types.ts

export interface ExportOptions {
  outputDir: string;
  downloadAssets?: boolean;
  includeDrafts?: boolean;
  includeArchived?: boolean;
  verbose?: boolean;
  // Contentful-specific — extend per adapter or use adapter-specific options bag
  spaceId?: string;
  managementToken?: string;
}

export interface ExportResult {
  exportFile: string;
  assetsDir?: string;
}

export interface ConvertOptions {
  input: string;
  outputDir: string;
  affix?: string;
  masterLocale?: string;
  verbose?: boolean;
}

export interface ConvertResult {
  bundleDir: string;
  mapperPath: string;
  stats: { locales: number; contentTypes: number; entries: number };
}

export interface LegacyAdapter {
  readonly legacy: string;
  export(options: ExportOptions): Promise<ExportResult>;
  convert(options: ConvertOptions): Promise<ConvertResult>;
}
```

```typescript
// src/adapters/registry.ts

import { contentfulAdapter } from './contentful';

const adapters = { contentful: contentfulAdapter };

export function getAdapter(legacy: string): LegacyAdapter {
  const adapter = adapters[legacy as keyof typeof adapters];
  if (!adapter) throw new Error(`Unsupported legacy CMS: ${legacy}. Supported: ${Object.keys(adapters).join(', ')}`);
  return adapter;
}
```

Adding Sanity or Storyblok later = new folder + one line in the registry.

---

## Command → adapter mapping

| Command | Delegates to | Native csdx |
|---------|--------------|-------------|
| `migrate:export` | `adapter.export()` | — |
| `migrate:convert` | `adapter.convert()` | — |
| `migrate:audit` | `lib/csdx-spawn` | `csdx cm:stacks:audit` |
| `migrate:import` | `lib/csdx-spawn` | `csdx cm:stacks:import` |
| `migrate:status` | `lib/manifest` | — |

Audit and import do **not** go through legacy adapters — they operate on the Contentstack bundle regardless of source CMS.

---

## Reference port map

From `references/import-contentful-cli-main/`:

| Reference | Destination |
|-----------|-------------|
| `src/lib/contentful.service.ts` | `src/services/contentful/contentful.service.ts` |
| `src/lib/content-type-creator.ts` | `src/services/contentful/content-type-creator.ts` |
| `src/lib/validator.ts` | `src/adapters/contentful/validator.ts` |
| `src/lib/migration-contentful/**` | `src/services/contentful/migration-contentful/**` |
| `src/lib/contentful/jsonRTE.ts` | `src/services/contentful/jsonRTE.ts` |
| `src/lib/contentful/taxonomy.service.ts` | `src/services/contentful/taxonomy.service.ts` |
| `src/lib/constants.ts` | `src/services/contentful/constants.ts` |
| `src/lib/types.ts` | `src/services/contentful/types.ts` |
| `src/lib/utils/**` | `src/services/contentful/utils/**` |
| `src/lib/*.json` | `src/services/contentful/assets/` |
| `src/mapper/write.ts` | `src/services/contentful/mapper/write.ts` |
| `src/commands/contentful.ts` | `src/adapters/contentful/convert.ts` |
| `src/ui/prompt.ts` | `src/services/contentful/prompts/master-locale.ts` |
| `tests/fixtures/contentful-export.json` | `test/fixtures/` |
| `scripts/copy-assets.js` | `scripts/copy-assets.js` |

**Not ported:**

| Reference | Reason |
|-----------|--------|
| `src/index.ts` | oclif commands replace it |
| `src/auth/session.ts` | Auth only for audit/import via `@contentstack/cli-command` |
| `src/ui/render.ts` | `src/lib/log.ts` + oclif `this.log()` |
| `runCsdxImport()` | `migrate:import` command (Phase 3) |
| `--stack` flag | Split into separate import step |

---

## Bundle output contract

Convert writes `<output>/bundle/` compatible with native csdx audit and import:

```
bundle/
├── content_types/
├── global_fields/
├── locales/
├── entries/<uid>/<locale>/
├── assets/
├── environments/
├── reference/
├── rteReference/
├── taxonomies/
├── mapper.json
└── export-info.json
```

Default: `--output ./contentstack-import` → `./contentstack-import/bundle/`

---

## Refactor during port

The reference binds output paths via `process.env.CLI_OUT_DIR` at import time. Fix this:

1. Pass `outputDir` through `ConvertOptions`
2. Initialize path config in a factory before loading services
3. No import-time env side effects — keeps vitest clean

---

## csdx primitives (do not reimplement)

| Operation | Command |
|-----------|---------|
| Audit | `csdx cm:stacks:audit --data-dir <bundle>` |
| Audit fix | `csdx cm:stacks:audit:fix --data-dir <bundle>` |
| Import | `csdx cm:stacks:import --stack-api-key <key> --data-dir <bundle> --yes` |

Import runs audit-fix by default unless `--skip-audit`.

Docs: [Audit plugin](https://www.contentstack.com/docs/developers/cli/audit-plugin), [Import content](https://www.contentstack.com/docs/developers/cli/import-content-using-the-cli).

---

## Dependencies

Single `package.json`:

```json
{
  "dependencies": {
    "@contentstack/cli-command": "^1.6.1",
    "@contentstack/cli-utilities": "^1.14.4",
    "@contentstack/json-rte-serializer": "^2.0.13",
    "@oclif/core": "^4.8.0",
    "axios": "^1.15.2",
    "chalk": "^4.1.2",
    "jsdom": "^23.0.0",
    "lodash": "^4.17.21",
    "mkdirp": "^1.0.4",
    "p-limit": "^3.1.0",
    "uuid": "^14.0.0"
  },
  "devDependencies": {
    "@oclif/test": "^3.0.0",
    "@types/node": "^20.12.12",
    "typescript": "^5.3.3",
    "vitest": "^4.0.18"
  }
}
```

Convert does not require `@contentstack/cli-*` at runtime — only audit/import commands use the base class session.

---

## Future adapters (not in initial scope)

Research confirms both platforms can export content, but neither matches Contentful's single JSON export. Each needs a dedicated adapter — little code shared with Contentful convert.

### Sanity (future)

| Aspect | Detail |
|--------|--------|
| Export | `sanity dataset export production backup.tar.gz` — NDJSON + assets in tarball |
| Schema | **Not** in dataset export; requires Studio repo + `sanity schemas extract` (experimental) |
| Convert | Map `_type` documents, portable text, asset refs → Contentstack bundle |
| Docs | [Dataset CLI](https://www.sanity.io/docs/cli-reference/cli-datasets), [Schema migrations](https://www.sanity.io/docs/content-lake/schema-and-content-migrations) |

### Storyblok (future)

| Aspect | Detail |
|--------|--------|
| Export | Multiple CLI pulls: `components pull`, `stories pull`, `assets pull`, `languages pull`, `datasources pull` |
| Unified export | No — v4 removed `sync`; full backup = orchestrate several commands or use CLI v3 |
| Convert | Map bloks/components → content types + modular blocks |
| Docs | [Storyblok CLI](https://www.storyblok.com/docs/libraries/storyblok-cli), [CLI v4 blog](https://www.storyblok.com/mp/introducing-storyblok-cli-v4) |

Implement as `src/adapters/sanity/` and `src/adapters/storyblok/` when prioritized — no architectural change required.

---

## Testing

| Layer | Tool | Target |
|-------|------|--------|
| Convert | vitest | `test/adapters/contentful/convert.test.ts` |
| Commands | vitest + `@oclif/test` | Flag parsing, spawn args |
| Fixtures | vitest | `test/fixtures/contentful-export.json` + repo `references/contentful-export-*.json` |
| E2E | manual | convert → audit → import on empty dev stack |
