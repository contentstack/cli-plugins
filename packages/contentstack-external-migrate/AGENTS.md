# Agent guide — Contentstack Migrate plugin

Use this file when automating work in `cli-plugin-migrate/`.

## What this repo is

- **Package:** `@contentstack/cli-plugin-migrate`
- **Commands:** `csdx migrate:export|convert|audit|import|status`
- **Scope:** Contentful → Contentstack migration (expert CLI, no bundled AI)

## User-facing docs (read first)

| Doc | Use when |
|-----|----------|
| [README.md](./README.md) | Install, commands, troubleshooting |
| [docs/getting-started.md](./docs/getting-started.md) | Onboarding colleagues |
| [docs/expert-workflow.md](./docs/expert-workflow.md) | End-to-end pipeline |
| [docs/limitations-and-scope.md](./docs/limitations-and-scope.md) | What is / isn't supported |

## Maintainer docs

| Doc | Use when |
|-----|----------|
| [docs/architecture.md](./docs/architecture.md) | Package layout, adapters |
| [docs/implementation-principles.md](./docs/implementation-principles.md) | Port vs PRD flags, spawn rules |
| [docs/phases/](./docs/phases/) | Per-command implementation specs |

## Rules for changes

1. **Do not** add `--stack` to `migrate:convert` — import stays on `migrate:import`.
2. **Audit/import** → shell out via `src/lib/csdx-spawn.ts`, do not reimplement CMA.
3. **Export** → `src/lib/contentful-cli-spawn.ts` (global `contentful` or `npx -y contentful-cli`).
4. **Never log** management tokens or full stack API keys.
5. **Manifest** updates on successful command completion — see `src/lib/manifest.ts`.
6. Match flag names in [README.md](./README.md) and phase docs, not the old reference Commander CLI.

## Verify

```bash
npm run build && npm test
```

Reference port source (optional, parent monorepo): `../references/import-contentful-cli-main/`.
