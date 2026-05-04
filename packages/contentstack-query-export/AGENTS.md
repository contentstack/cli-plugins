# CLI export-query plugin – Agent guide

**Universal entry point** for contributors and AI agents. Detailed conventions live in **`skills/*/SKILL.md`**.

## What this repo is

| Field | Detail |
| --- | --- |
| **Name:** | `@contentstack/cli-cm-export-query` ([repository](https://github.com/contentstack/cli)) |
| **Purpose:** | OCLIF plugin for **query-based** stack export (`cm:stacks:export-query` / short `EXPRTQRY`); implements `QueryExporter` and related export flow. |
| **Out of scope (if any):** | Other export/import plugins live in sibling packages; this repo is only the query-export plugin. |

## Tech stack (at a glance)

| Area | Details |
| --- | --- |
| **Language** | TypeScript **^4.9** (`tsconfig.json`); Node **>= 14** (`engines`) |
| **Build** | `tsc -b` → `lib/`; `prepack` runs compile + `oclif manifest` + `oclif readme`; copies `src/config` → `lib/` |
| **Tests** | Mocha + Chai + Sinon; **nyc** coverage; tests under `test/**/*.test.ts` (see [skills/testing/SKILL.md](skills/testing/SKILL.md)) |
| **Lint / coverage** | ESLint `src/**/*.ts`; nyc in `npm test` |
| **Other** | OCLIF v4, Husky |

## Commands (quick reference)

| Command type | Command |
| --- | --- |
| **Build** | `npm run build` |
| **Test** | `npm test` |
| **Lint** | `npm run lint` |

CI: [.github/workflows/unit-test.yml](.github/workflows/unit-test.yml); also `release.yml`, `sca-scan.yml`, `policy-scan.yml` under [.github/workflows/](.github/workflows/).

## Where the documentation lives: skills

| Skill | Path | What it covers |
| --- | --- | --- |
| Development workflow | [skills/dev-workflow/SKILL.md](skills/dev-workflow/SKILL.md) | CI, branches, Husky, PR expectations |
| Contentstack CLI | [skills/contentstack-cli/SKILL.md](skills/contentstack-cli/SKILL.md) | Commands, `QueryExporter`, APIs |
| Framework | [skills/framework/SKILL.md](skills/framework/SKILL.md) | Config, logging, errors, utilities |
| Testing | [skills/testing/SKILL.md](skills/testing/SKILL.md) | Mocha/Chai/Sinon, nyc, TDD |
| Code review | [skills/code-review/SKILL.md](skills/code-review/SKILL.md) | PR checklist |

## Using Cursor (optional)

If you use **Cursor**, [.cursor/rules/README.md](.cursor/rules/README.md) only points to **`AGENTS.md`**—same docs as everyone else.
