# contentstack-cli-tsgen – Agent guide

**Universal entry point** for contributors and AI agents. Detailed conventions live in **`skills/*/SKILL.md`**.

## What this repo is

| Field | Detail |
| --- | --- |
| **Name:** | `contentstack-cli-tsgen` ([contentstack/cli-plugins](https://github.com/contentstack/cli-plugins) → `packages/contentstack-cli-tsgen`) |
| **Purpose:** | OCLIF plugin that adds **`csdx tsgen`** to generate TypeScript typings from a stack. Generation is delegated to **`@contentstack/types-generator`** (`generateTS` / `graphqlTS`); this package owns flags, auth alias, file output, and CLI error formatting. |
| **Out of scope (if any):** | Core type-generation logic belongs in **`@contentstack/types-generator`** ([npm](https://www.npmjs.com/package/@contentstack/types-generator)), not reimplemented here. |

## Tech stack (at a glance)

| Area | Details |
| --- | --- |
| **Language** | TypeScript **5.9** (`strict` in [tsconfig.json](tsconfig.json)) |
| **Build** | `pnpm run build` → `tsc -b` → `lib/`; OCLIF manifest + readme |
| **Tests** | **Jest** + **ts-jest** ([jest.config.js](jest.config.js)); integration tests under `tests/integration/` |
| **Lint / coverage** | ESLint via `lint` and `posttest` |
| **Other** | OCLIF v4, Node **>= 14**; **v1** `@contentstack/cli-command` ~1.8.2 / `@contentstack/cli-utilities` ~1.18.3 |

**Main dependencies:** `@contentstack/cli-command`, `@contentstack/cli-utilities`, `@contentstack/types-generator`.

## Commands (quick reference)

| Command type | Command |
| --- | --- |
| **Build** | `pnpm run build` (from repo root: `pnpm --filter contentstack-cli-tsgen run build`) |
| **Test** | `pnpm test` (then **`posttest`** → ESLint) |
| **Integration** | `pnpm run test:integration` |
| **Lint** | `pnpm run lint` |

CI: [tsgen-integration-test.yml](../../.github/workflows/tsgen-integration-test.yml) (live stack); tests in [unit-test.yml](../../.github/workflows/unit-test.yml); release via [release-production-plugins.yml](../../.github/workflows/release-production-plugins.yml) on **`main`** (`latest` tag).

## Credentials and integration tests

Integration tests spawn **`csdx tsgen`** and require a **delivery token alias**. Set **`TOKEN_ALIAS`** (e.g. **`.env`** at package root; see [tests/integration/tsgen.integration.test.ts](tests/integration/tsgen.integration.test.ts)). CI uses secrets **`REGION`**, **`TOKEN_ALIAS`**, **`APIKEY`**, **`DELIVERYKEY`**, **`ENVIRONMENT`**.

## Where the documentation lives: skills

| Skill | Path | What it covers |
| --- | --- | --- |
| Development workflow | [skills/dev-workflow/SKILL.md](skills/dev-workflow/SKILL.md) | pnpm, CI, PRs, releases |
| TypeScript CLI tsgen | [skills/typescript-cli-tsgen/SKILL.md](skills/typescript-cli-tsgen/SKILL.md) | OCLIF command, flags, delegation to the library |
| Testing | [skills/testing/SKILL.md](skills/testing/SKILL.md) | Jest, integration env, CI |
| Code review | [skills/code-review/SKILL.md](skills/code-review/SKILL.md) | PR checklist, terminology, semver |

An index with “when to use” hints is in [skills/README.md](skills/README.md).

## Migration from standalone repo

See [TSGEN-MIGRATION.md](../../TSGEN-MIGRATION.md) at the monorepo root.
