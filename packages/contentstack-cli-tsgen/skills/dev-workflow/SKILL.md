---
name: dev-workflow
description: pnpm, monorepo CI, PR and release workflow for contentstack-cli-tsgen in cli-plugins.
---

# Development workflow – contentstack-cli-tsgen

## When to use

- Running builds or tests before a PR
- Understanding which GitHub Actions run for this package
- Husky / pre-commit expectations in the monorepo

## Commands (from repo root)

| Command | Purpose |
| --- | --- |
| `pnpm --filter contentstack-cli-tsgen run build` | `tsc -b` → `lib/`, OCLIF manifest + readme |
| `pnpm --filter contentstack-cli-tsgen test` | Jest; then **`posttest`** → ESLint |
| `pnpm --filter contentstack-cli-tsgen run test:integration` | Jest integration tests only |
| `pnpm --filter contentstack-cli-tsgen run lint` | ESLint |
| `pnpm --filter contentstack-cli-tsgen run clean` | Remove `lib/`, `node_modules`, build info |

From the package directory, use `pnpm run build`, `pnpm test`, etc.

## Local plugin link

```bash
cd packages/contentstack-cli-tsgen
pnpm run build
csdx plugins:link   # requires global @contentstack/cli@beta
csdx tsgen --help
csdx plugins:unlink
```

## Branches and CI

- Development targets **`feat/migrate-external-cli-plugins-v2`**; releases merge to **`v2-beta`**.
- Workflows under [`.github/workflows/`](../../../.github/workflows/):
  - **`tsgen-integration-test.yml`** — live `csdx tsgen` tests (delivery token secrets)
  - **`unit-test.yml`** — workspace build + ESLint for this package
  - **`release-v2-beta-plugins.yml`** — npm publish with **`beta`** tag on push to **`v2-beta`**
  - **`sca-scan.yml`**, **`policy-scan.yml`**, **`codeql-analysis.yml`** — monorepo-wide

## Git hooks

- Root **`prepare`** runs Husky; hooks under [`.husky/`](../../../.husky/) (Talisman + Snyk on commit).

## Pull requests

- Run **`pnpm --filter contentstack-cli-tsgen run build`** and **`lint`** when changing source.
- Integration tests run in CI; local runs need **`TOKEN_ALIAS`** in `.env` (see [testing](../testing/SKILL.md)).

## Releases

- Version **`5.0.0-beta.0`**+ in [package.json](../../package.json); published from **`v2-beta`** via monorepo release workflow (not standalone autotag on `master`).
