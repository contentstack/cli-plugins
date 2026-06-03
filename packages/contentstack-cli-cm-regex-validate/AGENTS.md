# cli-cm-regex-validate – Agent guide

**Universal entry point** for contributors and AI agents. Detailed conventions live in **`skills/*/SKILL.md`**.

## What this repo is

| Field | Detail |
|-------|--------|
| **Name:** | `@contentstack/cli-cm-regex-validate` ([contentstack/cli-plugins](https://github.com/contentstack/cli-plugins) → `packages/contentstack-cli-cm-regex-validate`) |
| **Purpose:** | Contentstack CLI oclif plugin with a single command, **`csdx cm:stacks:validate-regex`**, which scans content types and/or global fields in a stack for regex `format` values that fail the `safe-regex` check, then writes results to CSV and prints a summary table. User-facing copy lives in `messages/index.json`. |
| **Out of scope (if any):** | Not a general-purpose Contentstack SDK — only this plugin’s command, utils, and tests. |

## Tech stack (at a glance)

| Area | Details |
|------|---------|
| Language | TypeScript (`strict`), Node `>=14.0.0` per `package.json` engines |
| Build | pnpm; `build` runs `tsc -b`, oclif manifest, oclif readme — see `package.json` |
| Tests | Jest + ts-jest (`jest.config.ts`), `pnpm test`; suites under `test/utils/`, fixtures `test/data/*.json` |
| Lint / coverage | ESLint (`.eslintrc`), `pnpm run lint` |
| Other | oclif v4, `@contentstack/cli-command ^1.8.2`; CI: Node 22.x — [`.github/workflows/unit-test.yml`](../../.github/workflows/unit-test.yml). **CI runs Jest only** (`pnpm test`); **ESLint is not run in CI** — run `pnpm run lint` locally before merge. |

## Commands (quick reference)

| Command type | Command |
|--------------|---------|
| Build (release prep) | `pnpm run build` — cleans `lib`, compiles, generates oclif manifest and readme |
| Test | `pnpm test` |
| Lint | `pnpm run lint` |

CI runs `pnpm install` and `pnpm test` on pull requests — see [`.github/workflows/unit-test.yml`](../../.github/workflows/unit-test.yml). It does **not** run `pnpm run lint` (ESLint); run lint locally before merging.

## Where the documentation lives: skills

| Skill | Path | What it covers |
|-------|------|----------------|
| Development workflow | [`skills/dev-workflow/SKILL.md`](skills/dev-workflow/SKILL.md) | Commands, repo layout, naming, hooks, TDD, before merge |
| Testing | [`skills/testing/SKILL.md`](skills/testing/SKILL.md) | Jest, mocks, fixtures, no live API calls |
| Contentstack CLI | [`skills/contentstack-cli/SKILL.md`](skills/contentstack-cli/SKILL.md) | Command flow, SDK, schema walk, `safe-regex`, CSV/table output |
| Code review | [`skills/code-review/SKILL.md`](skills/code-review/SKILL.md) | PR and release checklist |

An index with “when to use” hints is in [`skills/README.md`](skills/README.md).

## Using Cursor (optional)

If you use **Cursor**, [`.cursor/rules/README.md`](.cursor/rules/README.md) only points to **[`AGENTS.md`](AGENTS.md)** — same docs as everyone else.
