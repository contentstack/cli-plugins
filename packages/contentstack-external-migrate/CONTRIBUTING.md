# Contributing

Thanks for working on `@contentstack/cli-plugin-migrate`. This repo is a **csdx plugin** — colleagues install it with `csdx plugins:link .`, not from npm (unless you publish it later).

## Setup

```bash
cd cli-plugin-migrate
npm install
npm run build
csdx plugins:link .
csdx migrate --help
```

Node **20+** required. Built output goes to `lib/` (gitignored); always run `npm run build` after pulling TypeScript changes.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run build` | `tsc`, copy JSON assets, regenerate `oclif.manifest.json` |
| `npm test` | Vitest (unit + convert integration on fixtures) |
| `npm run lint` | ESLint on `.ts` files |

## Where to change things

| Area | Path |
|------|------|
| CLI commands | `src/commands/migrate/*.ts` |
| Contentful orchestration | `src/adapters/contentful/` |
| Conversion engine | `src/services/contentful/` |
| Spawn helpers | `src/lib/csdx-spawn.ts`, `src/lib/contentful-cli-spawn.ts` |
| Manifest | `src/lib/manifest.ts` |
| Tests | `test/` |

## Documentation

When you change behavior or flags, update:

1. [README.md](./README.md) — user-facing command reference
2. [docs/expert-workflow.md](./docs/expert-workflow.md) — copy-paste pipeline
3. Relevant [docs/phases/](./docs/phases/) spec if the contract changed
4. [docs/manifest-schema.md](./docs/manifest-schema.md) if manifest fields change

See [docs/README.md](./docs/README.md) for the full doc map.

## Tests

- Small fixture: `test/fixtures/contentful-export.json` (always in repo)
- Large export test skips if `../references/contentful-export-*.json` is missing (monorepo only)

## Pull requests

- Run `npm run build && npm test` before opening a PR
- Do not commit `migration-workspace/`, `export.json`, tokens, or `node_modules/`
- Do not commit `lib/` or `oclif.manifest.json` (generated on build)
