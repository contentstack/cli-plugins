---
name: testing
description: Jest and integration tests for contentstack-cli-tsgen (v1 line).
---

# Testing skill (`contentstack-cli-tsgen`)

This package is the **only** cli-plugins package that uses **Jest** (other plugins use Mocha).

## Commands

| Command | What it does |
| --- | --- |
| `pnpm test` | Jest with `--testPathPattern=tests`; then **`posttest`** runs ESLint |
| `pnpm run test:integration` | Jest only for `tests/integration` |
| `pnpm run build` | Build `lib/` (required before `csdx plugins:link`) |

From repo root: `pnpm --filter contentstack-cli-tsgen …`

## Config

- [`jest.config.js`](../../jest.config.js): **ts-jest**, **`testEnvironment: node`**.

## Integration tests

- **[tests/integration/tsgen.integration.test.ts](../../tests/integration/tsgen.integration.test.ts)** spawns **`csdx tsgen`** with **`TOKEN_ALIAS`**.
- Loads **`.env`** from package root via **`dotenv`**. **`TOKEN_ALIAS`** must be defined or the suite throws at load time.

## CI

- [`.github/workflows/tsgen-integration-test.yml`](../../../.github/workflows/tsgen-integration-test.yml): `pnpm install`, build, global **`@contentstack/cli`**, token setup, **`csdx plugins:link`**, **`test:integration`** with secrets.
- [`.github/workflows/unit-test.yml`](../../../.github/workflows/unit-test.yml) → `npm run test` in this package.
