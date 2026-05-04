---
name: dev-workflow
description: CI, Husky hooks, branch and PR expectations for the cli-cm-export-query plugin repo.
---

# Development workflow – CLI export-query

## When to use

- Running builds/tests before a PR
- Understanding which GitHub Actions run on this package
- Husky / pre-commit expectations

## Commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Clean, install, compile, copy `src/config` → `lib/` |
| `npm test` | `pretest` compiles tests; nyc + mocha `test/**/*.test.ts` |
| `npm run test:unit` | Mocha `test/unit/**/*.test.ts` only |
| `npm run lint` | ESLint `src/**/*.ts` |
| `npm run prepack` | Compile + OCLIF manifest/readme + config copy (release path) |

## CI

Workflows under [`.github/workflows/`](../../../.github/workflows/): e.g. `unit-test.yml`, `release.yml`, `sca-scan.yml`, `policy-scan.yml`.

## Git hooks

- `prepare` runs Husky setup (see `package.json`); hooks live under [`.husky/`](../../../.husky/) when configured.

## PR expectations

- Tests and lint pass; no `describe.only` / `it.only` (`--forbid-only` in test scripts).
- Coordinate with [testing](../testing/SKILL.md) and [code-review](../code-review/SKILL.md).
