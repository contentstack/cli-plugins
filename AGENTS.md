# Contentstack CLI plugins – Agent guide

**Universal entry point** for contributors and AI agents. Detailed conventions live in **`skills/*/SKILL.md`**.

## What this repo is

| Field | Detail |
| --- | --- |
| **Name:** | Contentstack CLI plugins (pnpm monorepo; root package name `csdx`) |
| **Purpose:** | OCLIF plugins that extend the Contentstack CLI (import/export, clone, migration, seed, audit, variants, etc.). |
| **Out of scope (if any):** | The **core** CLI aggregation lives in the separate `cli` monorepo; this repo ships plugin packages only. |

## Tech stack (at a glance)

| Area | Details |
| --- | --- |
| **Language** | TypeScript / JavaScript, Node **>= 18** (`engines` in root `package.json`) |
| **Build** | pnpm workspaces (`packages/*`); per package: `tsc`, OCLIF manifest/readme where applicable → `lib/` |
| **Tests** | Mocha + Chai; layouts under `packages/*/test/` (see [skills/testing/SKILL.md](skills/testing/SKILL.md)) |
| **Lint / coverage** | ESLint in packages that define `lint` scripts; nyc where configured |
| **Other** | OCLIF v4, Husky |

## Commands (quick reference)

| Command type | Command |
| --- | --- |
| **Build** | `pnpm build` |
| **Test** | `pnpm test` |
| **Lint** | `pnpm run lint` in a package that defines `lint` (no root aggregate lint script) |

CI: [.github/workflows/unit-test.yml](.github/workflows/unit-test.yml) and other workflows under [.github/workflows/](.github/workflows/).

## Where the documentation lives: skills

| Skill | Path | What it covers |
| --- | --- | --- |
| Development workflow | [skills/dev-workflow/SKILL.md](skills/dev-workflow/SKILL.md) | pnpm commands, CI, TDD expectations, PR checklist |
| Contentstack CLI | [skills/contentstack-cli/SKILL.md](skills/contentstack-cli/SKILL.md) | Plugin commands, OCLIF, Contentstack APIs |
| Framework | [skills/framework/SKILL.md](skills/framework/SKILL.md) | Utilities, config, logging, errors |
| Testing | [skills/testing/SKILL.md](skills/testing/SKILL.md) | Mocha/Chai, coverage, mocks |
| Code review | [skills/code-review/SKILL.md](skills/code-review/SKILL.md) | PR review for this monorepo |

## Using Cursor (optional)

If you use **Cursor**, [.cursor/rules/README.md](.cursor/rules/README.md) only points to **`AGENTS.md`**—same docs as everyone else.
