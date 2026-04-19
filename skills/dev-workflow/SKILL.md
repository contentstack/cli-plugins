---
name: dev-workflow
description: Branches, CI, pnpm workspace commands, PR expectations, and TDD workflow for the Contentstack CLI plugins monorepo.
---

# Development workflow – Contentstack CLI plugins

## When to use

- Before you run builds or tests across the workspace
- When wiring CI or interpreting `.github/workflows/`
- When following TDD expectations for a plugin under `packages/`

## Monorepo layout

Plugins live under `packages/` (pnpm workspaces: `packages/*`). Current packages include:

- `contentstack-audit`, `contentstack-bootstrap`, `contentstack-branches`, `contentstack-clone`, `contentstack-export`, `contentstack-export-to-csv`, `contentstack-import`, `contentstack-import-setup`, `contentstack-migration`, `contentstack-seed`, `contentstack-variants`

Plugins typically depend on `@contentstack/cli-command` and `@contentstack/cli-utilities`.

## Commands (root)

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install all workspace dependencies |
| `pnpm build` | `pnpm -r --filter './packages/*' run build` |
| `pnpm test` | `pnpm -r --filter './packages/*' run test` |
| `pnpm prepack` | `pnpm -r --filter './packages/*' run prepack` |

There is no root `lint` script; run ESLint in a package that defines `lint` (e.g. `cd packages/contentstack-import && pnpm run lint`). Filter example: `pnpm --filter @contentstack/cli-cm-import test` (adjust scope to the package you change).

## TDD expectations

1. **RED** — one failing test in the package’s unit test tree
2. **GREEN** — minimal `src/` change to pass
3. **REFACTOR** — keep tests green

Do not commit `test.only` / `test.skip`. Target **80%** coverage where `nyc` is configured. Mock external APIs; no real API calls in unit tests.

## CI and hooks

- Workflows: [`.github/workflows/`](../../../.github/workflows/) — e.g. `unit-test.yml`, `release-v2-beta-plugins.yml`, `sca-scan.yml`, `policy-scan.yml`, `codeql-analysis.yml`
- Husky: [`.husky/`](../../../.husky/) when present

## PR expectations

- Tests and build pass for affected packages
- No stray `.only` / `.skip` in tests
- Follow [testing](../testing/SKILL.md) and [code-review](../code-review/SKILL.md)
