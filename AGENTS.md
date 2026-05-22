# Contentstack CLI plugins – Agent guide

**Universal entry point** for contributors and AI agents. Detailed conventions live in **`skills/*/SKILL.md`**.

## What this repo is

| Field | Detail |
| --- | --- |
| **Name:** | Contentstack CLI plugins (pnpm monorepo; root package name `csdx`) |
| **Purpose:** | OCLIF plugins that extend the Contentstack CLI (import/export, clone, migration, migrate RTE, seed, audit, variants, Developer Hub apps, etc.). |
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
| Contentstack CLI | [skills/contentstack-cli/SKILL.md](skills/contentstack-cli/SKILL.md) | Plugin commands, OCLIF, Contentstack APIs (incl. `app:*` / `@contentstack/apps-cli`) |
| Framework | [skills/framework/SKILL.md](skills/framework/SKILL.md) | Utilities, config, logging, errors (incl. Developer Hub SDK, manifests, GraphQL) |
| Testing | [skills/testing/SKILL.md](skills/testing/SKILL.md) | Mocha/Chai, coverage, mocks |
| Code review | [skills/code-review/SKILL.md](skills/code-review/SKILL.md) | PR review for this monorepo |

## Apps CLI plugin (`@contentstack/apps-cli`)

- **Package path:** [packages/contentstack-apps-cli](packages/contentstack-apps-cli)
- **npm name:** `@contentstack/apps-cli` (unchanged for consumers)
- **Migrated from:** [contentstack/contentstack-apps-cli](https://github.com/contentstack/contentstack-apps-cli) — see [APPS-CLI-MIGRATION.md](APPS-CLI-MIGRATION.md)
- **v1 / v2:** Maintain on `v1-dev` (1.x CLI deps) and `v2-dev` / `v2-beta` (2.x beta deps) branches; align `@contentstack/cli-command` and `@contentstack/cli-utilities` versions with the target CLI line.
- **Docs:** OCLIF / `app:*` commands → [contentstack-cli](skills/contentstack-cli/SKILL.md#apps-cli-commands-app); SDK, manifests, GraphQL, HTTP → [framework](skills/framework/SKILL.md#apps-cli-plugin-contentstackapps-cli)

## Migrate RTE plugin (`@contentstack/cli-cm-migrate-rte`)

- **Package path:** [packages/contentstack-migrate-rte](packages/contentstack-migrate-rte)
- **npm name:** `@contentstack/cli-cm-migrate-rte` (unchanged)
- **Migrated from:** [contentstack/cli-cm-migrate-rte](https://github.com/contentstack/cli-cm-migrate-rte) — see [MIGRATE-RTE-MIGRATION.md](MIGRATE-RTE-MIGRATION.md)
- **Command:** `csdx cm:entries:migrate-html-rte` — JS sources in `src/`; `pnpm --filter @contentstack/cli-cm-migrate-rte run build` (`oclif manifest`) and `test` (see [dev-workflow](skills/dev-workflow/SKILL.md))

## Using Cursor (optional)

If you use **Cursor**, [.cursor/rules/README.md](.cursor/rules/README.md) only points to **`AGENTS.md`**—same docs as everyone else.
