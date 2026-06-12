# Documentation index

Start with the [README](../README.md) in the repo root for install, commands, and troubleshooting. Use this page to find everything else.

## For teammates (migrations)

| Document | Description |
|----------|-------------|
| [getting-started.md](./getting-started.md) | Install plugin, first convert, audit/import |
| [expert-workflow.md](./expert-workflow.md) | Full pipeline copy-paste (export → import) |
| [limitations-and-scope.md](./limitations-and-scope.md) | What is supported, requirements, expectations |
| [manifest-schema.md](./manifest-schema.md) | `migration-manifest.json` fields |
| [repository-layout.md](./repository-layout.md) | Repo vs monorepo, local workspaces |
| [phases/phase-5-manifest-and-review.md](./phases/phase-5-manifest-and-review.md) | Manual content model review checklist |

## For maintainers (code changes)

| Document | Description |
|----------|-------------|
| [architecture.md](./architecture.md) | Package layout, adapters, port map |
| [implementation-principles.md](./implementation-principles.md) | Reference port rules, spawn helpers, flags |
| [phases/](./phases/) | Per-command implementation specs (see [phases/README.md](./phases/README.md)) |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Build, test, PR notes |
| [../AGENTS.md](../AGENTS.md) | Short guide for coding agents |

## Commands at a glance

| Runtime order | Command | Auth |
|---------------|---------|------|
| 1 | `migrate:export` | Contentful CMA token |
| 2 | `migrate:convert` | None |
| 3 | *(manual review)* | — |
| 4 | `migrate:audit` | `csdx auth:login` |
| 5 | `migrate:import` | `csdx auth:login` |
| — | `migrate:status` | None |

Native equivalents: audit → `csdx cm:stacks:audit`; import → `csdx cm:stacks:import`; fix → `csdx cm:stacks:audit:fix`.

## Design principles

1. Every step runs without AI — `csdx migrate:*` only.
2. Single package — `@contentstack/cli-plugin-migrate`.
3. Do not reimplement stack audit/import — delegate to `csdx`.
4. Convert and import are **separate** commands (no `--stack` on convert).
5. Contentful export uses Contentful CLI (global or `npx`).

## Phase specs (implementation history)

Phases 0–5 are **complete**. Phase 6 (AI companion) is future work.

| Phase | Doc | Delivers |
|-------|-----|----------|
| 0 | [phase-0-foundation.md](./phases/phase-0-foundation.md) | Plugin scaffold |
| 1 | [phase-1-convert.md](./phases/phase-1-convert.md) | `migrate:convert` |
| 2 | [phase-2-audit.md](./phases/phase-2-audit.md) | `migrate:audit` |
| 3 | [phase-3-import.md](./phases/phase-3-import.md) | `migrate:import` |
| 4 | [phase-4-export.md](./phases/phase-4-export.md) | `migrate:export` |
| 5 | [phase-5-manifest-and-review.md](./phases/phase-5-manifest-and-review.md) | `migrate:status` + review |
| 6 | [phase-6-ai-companion.md](./phases/phase-6-ai-companion.md) | Future |

Build order in phase docs ≠ runtime order. Runtime order matches [expert-workflow.md](./expert-workflow.md).
