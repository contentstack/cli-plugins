# Implementation principles

Guidance for porting the reference CLI into `@contentstack/cli-plugin-migrate`.

## 1. Reuse reference code, not its architecture

`references/import-contentful-cli-main` is a **standalone Commander CLI** (auth session, single `contentful` command, inline `--stack` import). Do not replicate that shape.

| Reference | Plugin approach |
|-----------|-----------------|
| Commander + `src/index.ts` | oclif commands under `src/commands/migrate/` |
| `runContentful()` monolith | Thin command → `getAdapter(legacy)` → adapter |
| `process.env.CLI_OUT_DIR` at import | `initContentfulMigrateConfig({ outputDir })` before loading services |
| `getSession()` / Contentstack auth on convert | **No** `csdx auth` on convert or export |
| `runCsdxImport()` inside convert | **`migrate:import`** only (Phase 3) |
| `--stack` on one command | `--stack-api-key` on `migrate:import` per PRD |

**Port:** conversion engine files into `src/services/contentful/` and orchestration into `src/adapters/contentful/`. **Delete** reference-only layers (auth, render UI, bundled import).

## 2. Follow csdx plugin rules (vibe-docs)

- Extend `Command` from `@contentstack/cli-command` (not raw `@oclif/core`).
- Declare flags with `flags` from `@contentstack/cli-utilities`.
- Namespace: `migrate:convert`, `migrate:export`, etc.
- Commands stay thin; business logic in adapters + `src/services/`.
- Audit/import: spawn native `csdx` via `src/lib/csdx-spawn.ts` — do not reimplement stack audit/import.
- Region/auth: use base class helpers only where a command needs Contentstack (`migrate:audit`, `migrate:import`). Never hardcode CMA hosts.

See `.agents/skills/contentstack-vibe-docs/references/extensions/cli-plugins/`.

## 3. Options come from the PRD (phase docs), not the reference CLI

Flag names, defaults, and required fields are defined in `docs/phases/phase-*.md` and `docs/expert-workflow.md`. Do not copy reference `Config` or Commander option names unless they match the PRD.

Examples:

- `migrate:convert`: `--legacy`, `--input`, `--output`, `--master-locale`, `--affix`, `--verbose`
- `migrate:export`: `--legacy`, `--space-id`, `--management-token` (prefer `CONTENTFUL_MANAGEMENT_TOKEN`), `--output`, asset/draft flags
- `migrate:import`: `--stack-api-key`, `--data-dir`, `--yes`, `--skip-audit` — **no** inline stack on convert

Interactive mode: flags override prompts; prompts only when a required flag is missing (CI-safe).

## 4. Contentful export: real CLI if installed, else `npx`

Phase 4 export shells out to **Contentful CLI**, not a reimplemented CMA export (unless we add Option B later).

Resolution order (`src/lib/contentful-cli-spawn.ts`):

1. If `contentful` is on `PATH` and responds (`contentful --version`), run `contentful <args>`.
2. Otherwise run `npx -y contentful-cli <args>` (no global install required).

Never log `--management-token` or env token values.

## 5. Native csdx for Contentstack operations

| Step | Mechanism |
|------|-----------|
| Audit | `csdx cm:stacks:audit` via `csdx-spawn.ts` |
| Import | `csdx cm:stacks:import` via `csdx-spawn.ts` |
| Convert | In-process port of reference engine |

Use global `csdx` when installed (`ENOENT` → clear install message).
