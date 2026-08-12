---
name: dev-workflow
description: Local and CI workflow for cli-cm-regex-validate — commands, layout, naming, hooks, and merge expectations
---

# Development workflow – cli-cm-regex-validate

## When to use

- Setting up or explaining how to build, test, and lint this repo
- Finding where commands, utils, tests, and messages live
- Before opening or merging a PR (validation checklist, TDD)

## Instructions

### Validation commands

- `pnpm test` — Jest (`jest.config.ts`, ts-jest). Canonical test runner; CI runs only this in `.github/workflows/unit-test.yml` (no ESLint in CI).
- `pnpm run lint` — ESLint on `.ts` files. Run locally before merge; not executed by the unit-test workflow.

### Local hooks

If Husky is installed, pre-commit may run Talisman (secrets) and Snyk. Use `SKIP_HOOK=1` only when you understand the bypass.

### TDD (recommended)

1. **Red** — Add or change a failing test in `test/utils/` (or add a fixture in `test/data/`).
2. **Green** — Minimal change in `src/` to pass.
3. **Refactor** — Keep tests green; avoid drive-by refactors outside the task.

### Repository layout

| Area | Path | Role |
|------|------|------|
| Command | `src/commands/cm/stacks/validate-regex.ts` | oclif command `cm/stacks/validate-regex` |
| Utils | `src/utils/` | `connect-stack`, `process-stack`, `safe-regex`, `generate-output`, `interactive` |
| Messages | `messages/index.json` | User-facing strings for the command |
| Tests | `test/utils/*.test.ts` | Jest suites mirroring utils |
| Fixtures | `test/data/*.json` | JSON fixtures for schema and expected outputs |

### Naming

- Source files: kebab-case.
- Tests: describe behavior clearly (what should happen under which condition).

### Before merging

- Tests pass (`pnpm test`).
- Lint clean (`pnpm run lint` or ESLint as configured in `package.json`). CI does not run ESLint; this is a local gate.

## References

- [Testing](../testing/SKILL.md) — Jest mocks, fixtures, no live API calls
- [Contentstack CLI](../contentstack-cli/SKILL.md) — Command flow, Management SDK, `safe-regex`, output
- [Code review](../code-review/SKILL.md) — PR and release checklist

## CI

- **Unit tests:** `.github/workflows/unit-test.yml` — runs `pnpm test` on push/PR.
- **Release (production):** `.github/workflows/release-production-plugins.yml` — publishes to npm with tag `latest` on push to `main`.

For workflow and layout questions, open the [`skills/dev-workflow/`](.) folder (or your agent tool’s equivalent to this path).
