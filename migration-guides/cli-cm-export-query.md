# Migration Guide — `@contentstack/cli-cm-export-query` (Query-based export plugin) · 1.x → 2.x

> Command: `csdx cm:stacks:export-query`
> Package: `@contentstack/cli-cm-export-query`  ·  v1 line: `1.x` (baseline used: `1.0.4`)  ·  v2 line: `2.x` (`2.0.0-beta.6`)
> Status: verified against code — v1 = `contentstack/cli-plugins @ origin/main` (package `1.0.4`), v2 = `contentstack/cli-plugins @ origin/v2-dev` (package `2.0.0-beta.6`).
> This plugin is **external** in v1 (it was never part of the `contentstack/cli` monorepo `v1.59.0`). Both the v1 and v2 sources now live in `contentstack/cli-plugins` under `packages/contentstack-query-export`; this guide diffs `origin/main` → `origin/v2-dev`.

This guide is written to be read by **both a human and an LLM/agent**. If you feed this file to an agent along with a 1.x command, the [Command Translation Rules](#7-agent-rules-1x--2x-command-translation) section is enough to emit the correct 2.x command.

---

## ⚠️ Pending decision — short flags `-k` / `-d` / `-a` are NOT yet removed

There is an **open, unmade decision** about whether to drop the short characters `-k` (`--stack-api-key`), `-d` (`--data-dir`), and `-a` (`--alias`) from this command.

**Current state (verified in `origin/v2-dev`, `src/commands/cm/stacks/export-query.ts`): the short chars still exist.** The flag definitions read `char: 'k'`, `char: 'd'`, `char: 'a'` (plus `-c` for `--config` and `-y` for `--yes`). Nothing has been removed.

**The unmerged `origin/fix/DX-9363` branch does NOT remove them from this plugin.** Its command file (`export-query.ts`) is byte-identical to `origin/v2-dev` (`git diff origin/v2-dev origin/fix/DX-9363 -- .../export-query.ts` is empty; `char: 'k' / 'd' / 'a'` are all still present at lines 36/40/44). That branch's commit *"Removed character flag from the command"* and *"normalize short flag consistency across cli-cm-regex-validate, tsgen, migration, and apps-cli"* refers to **other** external plugins — not `cli-cm-export-query`. (`origin/fix/DX-9363` is also *behind* `v2-dev`: it still pins `version 2.0.0-beta.5`, `cli-cm-export ~2.0.0-beta.21`, and `repository: contentstack/cli`.)

> **Do not assume the removal happened.** As of the inspected refs, `-k`, `-d`, `-a` work. If the decision later lands, update §3 and the checklist. This guide documents behaviour **as shipped today**.

---

## 1. At a glance

| Area | 1.x (`origin/main` @ `1.0.4`) | 2.x (`origin/v2-dev` @ `2.0.0-beta.6`) | Action needed |
|---|---|---|---|
| Command id | `cm:stacks:export-query` | `cm:stacks:export-query` | none (id unchanged) |
| Short command alias | `cm:export:query` (via `csdxConfig.shortCommandName`) | `cm:export:query` (unchanged) | none |
| Node.js | **`>=22.0.0`** | **`>=22.0.0`** | none — **no bump between the inspected refs** (both already require Node 22; unlike sibling plugins there is no 14→22 change here) |
| Flag set (names, short chars, defaults) | see §3 | **identical to 1.x** | none — flags did not change v1→v2 |
| `@contentstack/cli-cm-export` dep | `~1.25.2` | **`~2.0.0-beta.22`** | delegates to export 2.x (§4) |
| `@contentstack/cli-command` dep | `~1.8.4` | **`~2.0.0-beta.9`** | transitive |
| `@contentstack/cli-utilities` dep | `~1.18.5` | **`~2.0.0-beta.10`** | transitive |
| `readContentTypeSchemas` | **local** util (`src/utils/read-content-type-schemas.ts`) | **removed → imported from `@contentstack/cli-utilities`** | internal only |
| Region handling | `config.region = this.region` | `applyRegionToQueryExportConfig(config, this.region)` | internal only |
| Chalk load | none | `await loadChalk()` at start of `run()` | internal only |

**Nothing about a normal `export-query` invocation changes** — the flags, defaults, and query syntax are the same. The 1.x → 2.x change is primarily an internal dependency uplift onto export 2.x, not a user-facing contract change.

---

## 2. Quick command translation (copy-paste)

Because the flag set is unchanged, **1.x commands run verbatim on 2.x**:

| 1.x command | 2.x command |
|---|---|
| `csdx cm:stacks:export-query --query '{...}'` | `csdx cm:stacks:export-query --query '{...}'` (unchanged) |
| `csdx cm:stacks:export-query -a <alias> --query ./q.json` | same (unchanged) |
| `csdx cm:stacks:export-query -k <key> -d ./out --query '{...}'` | same (unchanged) — **but see the ⚠️ pending-decision callout for `-k/-d/-a`** |
| `csdx cm:export:query --query '{...}'` (short alias) | same (unchanged) |

---

## 3. Flag reference (current v2-dev — exact)

Verified in `origin/v2-dev:packages/contentstack-query-export/src/commands/cm/stacks/export-query.ts`. The 1.x (`origin/main`) definitions are **identical**.

| Long flag | Short | Type | Required | Default | Notes |
|---|---|---|---|---|---|
| `--config` | `-c` | string | no | — | path to a configuration JSON file for a single run |
| `--stack-api-key` | `-k` | string | no | — | source stack API key |
| `--data-dir` | `-d` | string | no | — | path to store exported content |
| `--alias` | `-a` | string | no | — | management token alias |
| `--branch` | *(none)* | string | no | `main` (set later in `setupBranches`) | mutually exclusive with `--branch-alias` |
| `--branch-alias` | *(none)* | string | no | — | mutually exclusive with `--branch` |
| `--query` | *(none)* | string | **yes** (`required: true`) | — | query as a JSON string **or** a file path |
| `--skip-references` | *(none)* | boolean | no | `false` | skip referenced content types |
| `--skip-dependencies` | *(none)* | boolean | no | `false` | skip dependent modules (global-fields, extensions, taxonomies) |
| `--secured-assets` | *(none)* | boolean | no | `false` | export secured assets |
| `--yes` | `-y` | boolean | no | `false` | skip confirmation prompts |

**Short chars that exist today:** `-c`, `-k`, `-d`, `-a`, `-y`. **No others.**

> **`--query` has NO short char.** The `query` flag is defined without a `char`, so **`-q` does not work** — despite the v2-dev `README.md` documenting `-q, --query` and using `-q` in every example. See §5 (README accuracy).

---

## 4. Relationship to the base export plugin

This plugin does **not** re-implement export. It is a **query-driven orchestrator on top of `@contentstack/cli-cm-export`** (a direct dependency: `~1.25.2` in v1, `~2.0.0-beta.22` in v2).

- **What it exports (from `src/config/index.ts`):**
  - **Queryable target:** `content-types` — the content types matched by your `--query`.
  - **Dependent modules** pulled in automatically for those content types: `global-fields`, `extensions`, `marketplace-apps`, `taxonomies`, `personalize`. Suppress with `--skip-dependencies`.
  - **Referenced content types** discovered by schema traversal (`ContentTypeDependenciesHandler.extractDependencies` in `src/utils/dependency-resolver.ts`). Suppress with `--skip-references`.
  - **Always-exported general modules:** `stack`, `locales`, `environments`.
  - **Content modules:** `entries`, `assets`.
  - Declared `exportOrder`: `stack → locales → environments → content-types → global-fields → extensions → taxonomies → entries → assets`.
- **How it delegates (`src/core/module-exporter.ts`):** for each module it builds an export command (`cmd.push('--module', moduleName)`, plus `--secured-assets` when set) and runs the base export plugin per module. So export 2.x behaviours (progress bars, flat output layout, `main`-only default branch, dropped `schema.json`/`export-info.json`, AM 2.0 assets, etc.) are **inherited transitively** in v2.
  - See the base plugin's own migration guide (`cli-cm-export.md`) for those downstream behavioural changes — they apply to the artifacts this command produces.

## 5. What did NOT change (safe)

- Command id `cm:stacks:export-query` and short alias `cm:export:query`.
- The entire flag set — names, short chars, `--query` requiredness, boolean defaults.
- Query syntax and semantics (JSON string or file path; `--skip-references` / `--skip-dependencies`).
- Node engine (`>=22.0.0` on both refs).
- `@oclif/core ^4.11.4` (same on both).

---

## 6. Migration checklist

- [ ] Confirm Node runtime is `>=22` (already required by v1 `1.0.4` on `origin/main`; no change).
- [ ] No flag changes required — 1.x commands run as-is on 2.x.
- [ ] Do **not** rely on `-q`; use `--query` (README `-q` is wrong in both lines).
- [ ] Expect base-export 2.x behaviours in the output (flat layout, `main`-only default branch, no aggregate `schema.json` / `export-info.json`, progress bars) — see `cli-cm-export.md`.
- [ ] **Watch the ⚠️ pending decision:** if `-k/-d/-a` are later removed, switch scripts to `--stack-api-key` / `--data-dir` / `--alias`. Not required today.
- [ ] Ignore README's `src/config/export-defaults.json`; real config is `src/config/index.ts` + `src/config/export-config.json`.

---

## 7. Agent rules: 1.x → 2.x command translation

1. **Command & alias unchanged:** keep `cm:stacks:export-query` (or `cm:export:query`) exactly.
2. **Flags unchanged:** pass every flag through verbatim. There are **no** renames, no removed flags, no changed defaults between `1.0.4` and `2.0.0-beta.6`.
3. **`--query` is required and has no short form.** Never emit `-q`; always emit `--query`. If a user wrote `-q`, rewrite to `--query` (it never worked, README notwithstanding).
4. **Short chars available:** only `-c`, `-k`, `-d`, `-a`, `-y`. Do not invent `-q`, `-b`, etc.
5. **Pending-removal caution for `-k/-d/-a`:** these currently work. Only if explicitly told the DX short-flag removal has merged should you expand them to `--stack-api-key` / `--data-dir` / `--alias`. Default assumption: they work.
6. **Downstream export behaviour:** if the user asks about output layout, branch scoping, or emitted metadata files, defer to the base export 2.x rules — this command delegates to `@contentstack/cli-cm-export` per module.

**Worked example**
Input: `csdx cm:stacks:export-query -a prod -q '{"modules":{"content-types":{"title":{"$in":["Blog"]}}}}' -d ./out`
Output: `csdx cm:stacks:export-query -a prod --query '{"modules":{"content-types":{"title":{"$in":["Blog"]}}}}' -d ./out`
Only change: `-q` → `--query` (no short form exists). `-a` and `-d` left intact (valid today).
