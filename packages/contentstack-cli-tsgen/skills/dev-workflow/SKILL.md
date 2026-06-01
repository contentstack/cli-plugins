---
name: dev-workflow
description: pnpm, monorepo CI, PR and production release workflow for contentstack-cli-tsgen (v1 line).
---

# Development workflow – contentstack-cli-tsgen (v1)

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

## Local plugin link

```bash
cd packages/contentstack-cli-tsgen
pnpm run build
npm i -g @contentstack/cli
csdx plugins:link
csdx tsgen --help
csdx plugins:unlink
```

## Branches and CI

- Development: **`feat/migrate-external-cli-plugins-v1`** → merge to **`v1-dev`** / **`main`**.
- Workflows under [`.github/workflows/`](../../../.github/workflows/):
  - **`tsgen-integration-test.yml`** — live `csdx tsgen` tests (delivery token secrets; global **`@contentstack/cli`**)
  - **`unit-test.yml`** — workspace build + `npm run test` for this package
  - **`release-production-plugins.yml`** — npm publish with **`latest`** tag on push to **`main`**
  - **`sca-scan.yml`**, **`policy-scan.yml`**, **`codeql-analysis.yml`** — monorepo-wide

## Git hooks

- Root **`prepare`** runs Husky; hooks under [`.husky/`](../../../.husky/) when present.

## Pull requests

- Run **`pnpm --filter contentstack-cli-tsgen run build`** before opening a PR.
- Integration tests run in **`tsgen-integration-test.yml`**; local runs need **`TOKEN_ALIAS`** in `.env`.

## Releases

- Version **`4.10.0`**+ in [package.json](../../package.json); published from **`main`** via **`release-production-plugins.yml`**.
