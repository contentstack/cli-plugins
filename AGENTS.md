# Contentstack CLI plugins – Agent guide

**Universal entry point** for contributors and AI agents. Detailed conventions live in **`skills/*/SKILL.md`** (per-package).

## What this repo is

| Field | Detail |
| --- | --- |
| **Name:** | Contentstack CLI plugins (pnpm monorepo; root package name `csdx`) |
| **Purpose:** | OCLIF plugins that extend the Contentstack CLI (import/export, clone, migration, seed, audit, variants, Developer Hub apps, regex validation, etc.). |
| **Out of scope (if any):** | The **core** CLI aggregation lives in the separate `cli` monorepo; this repo ships plugin packages only. |

## Tech stack (at a glance)

| Area | Details |
| --- | --- |
| **Language** | TypeScript / JavaScript, Node **>= 18** (`engines` in root `package.json`) |
| **Build** | pnpm workspaces (`packages/*`); per package: `tsc`, OCLIF manifest/readme where applicable → `lib/` |
| **Tests** | Mocha + Chai (most packages); Jest + ts-jest (`contentstack-cli-cm-regex-validate`); layouts under `packages/*/test/` |
| **Lint / coverage** | ESLint in packages that define `lint` scripts; nyc where configured |
| **Other** | OCLIF v4, Husky |

## Commands (quick reference)

| Command type | Command |
| --- | --- |
| **Build** | `pnpm build` |
| **Test** | `pnpm test` |
| **Lint** | `pnpm run lint` in a package that defines `lint` (no root aggregate lint script) |

CI: [.github/workflows/unit-test.yml](.github/workflows/unit-test.yml) and other workflows under [.github/workflows/](.github/workflows/).

## Apps CLI plugin (`@contentstack/apps-cli`)

- **Package path:** [packages/contentstack-apps-cli](packages/contentstack-apps-cli)
- **npm name:** `@contentstack/apps-cli` (unchanged for consumers)
- **Migrated from:** [contentstack/contentstack-apps-cli](https://github.com/contentstack/contentstack-apps-cli) — see [APPS-CLI-MIGRATION.md](APPS-CLI-MIGRATION.md)
- **v1 / v2:** This branch carries the **v1 line** (`@contentstack/cli-command ^1.8.2`, `@contentstack/cli-utilities ^1.18.3`).
- **Docs:** See [packages/contentstack-apps-cli/AGENTS.md](packages/contentstack-apps-cli/AGENTS.md)

## Regex Validate plugin (`@contentstack/cli-cm-regex-validate`)

- **Package path:** [packages/contentstack-cli-cm-regex-validate](packages/contentstack-cli-cm-regex-validate)
- **npm name:** `@contentstack/cli-cm-regex-validate`
- **Migrated from:** [contentstack/cli-cm-regex-validate](https://github.com/contentstack/cli-cm-regex-validate) — see [REGEX-VALIDATE-MIGRATION.md](REGEX-VALIDATE-MIGRATION.md)
- **v1 / v2:** This branch carries the **v1 line** (`@contentstack/cli-command ^1.8.2`, `@contentstack/cli-utilities ^1.18.3`, version `1.0.0`, npm tag `latest`).
- **Tests:** Jest + ts-jest (unlike most other packages which use Mocha + Chai)
- **Command:** Single command `cm:stacks:validate-regex` (short name `RGXVLD`)
- **Docs:** [packages/contentstack-cli-cm-regex-validate/AGENTS.md](packages/contentstack-cli-cm-regex-validate/AGENTS.md)

## Using Cursor (optional)

If you use **Cursor**, [.cursor/rules/README.md](.cursor/rules/README.md) only points to **`AGENTS.md`**—same docs as everyone else.
