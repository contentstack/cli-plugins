---
name: testing
description: How to run tests and use env for contentstack-cli-tsgen (Jest, ESLint posttest, integration).
---

# Testing skill (`contentstack-cli-tsgen`)

This package is the **only** cli-plugins package that uses **Jest** (other plugins use Mocha).

## Commands

| Command | What it does |
| --- | --- |
| `pnpm test` | Jest with `--testPathPattern=tests`; then **`posttest`** runs ESLint |
| `pnpm run test:integration` | Jest only for `tests/integration` |
| `pnpm run build` | Build `lib/` (required before local `csdx plugins:link`) |

From repo root, prefix with `pnpm --filter contentstack-cli-tsgen`.

## Config

- [`jest.config.js`](../../jest.config.js): **ts-jest**, **`testEnvironment: node`**.

## Integration tests

- **[tests/integration/tsgen.integration.test.ts](../../tests/integration/tsgen.integration.test.ts)** spawns **`csdx tsgen`** with **`TOKEN_ALIAS`**.
- Loads **`.env`** from package root via **`dotenv`** (`path` relative to test file). **`TOKEN_ALIAS`** must be defined or the suite throws at load time.

## CI

- [`.github/workflows/tsgen-integration-test.yml`](../../../.github/workflows/tsgen-integration-test.yml): `pnpm install`, `pnpm --filter contentstack-cli-tsgen run build`, global **`@contentstack/cli@beta`**, **`csdx config:set:region`**, **`csdx auth:tokens:add`** (delivery), **`csdx plugins:link`**, **`pnpm --filter contentstack-cli-tsgen run test:integration`** with **`TOKEN_ALIAS`** secret.
- Lint on PR: [`.github/workflows/unit-test.yml`](../../../.github/workflows/unit-test.yml) → `pnpm run lint` in this package.
