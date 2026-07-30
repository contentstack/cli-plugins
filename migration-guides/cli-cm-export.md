# Migration Guide — `@contentstack/cli-cm-export` (Export plugin) · 1.x → 2.x

> Command: `csdx cm:stacks:export`
> Package: `@contentstack/cli-cm-export`  ·  v1 line: `1.x` (e.g. `1.25.2`)  ·  v2 line: `2.x` (e.g. `2.0.0-beta.x`)
> Status: verified against code — v1 = `contentstack/cli @ v1.59.0`, v2 = `contentstack/cli-plugins @ v2-dev`.

This guide is written to be read by **both a human and an LLM/agent**. If you feed this file to an agent along with a 1.x command, the [Command Translation Rules](#8-agent-rules-1x--2x-command-translation) section is enough to emit the correct 2.x command.

---

## 1. At a glance

| Area | 1.x | 2.x | Action needed |
|---|---|---|---|
| Command id | `cm:stacks:export` | `cm:stacks:export` | none (id unchanged) |
| Alias | `cm:export` also worked | **removed** | replace `cm:export` → `cm:stacks:export` |
| Node.js | `>=14` (packages) | **`>=22`** | upgrade Node runtime |
| Deprecated flags | still accepted (hidden) | **removed → hard error** | switch to canonical flags (§3) |
| Short chars `-m -t -B` | worked | **removed** | use long flags `--module --content-types --branch` |
| Default branch scope | **all branches** | **`main` only** | pass `--branch` explicitly (§4.1) |
| Output layout | `exportDir/<branch-uid>/…` when branch used | **flat `exportDir/…`** | update path-based tooling (§4.2) |
| `schema.json` | written (aggregate) | **not written** | read per-content-type files instead (§4.3) |
| `export-info.json` / `contentVersion` | written | **not written** | remove tooling that reads it (§4.4) |
| Console output | line-by-line logs | **progress bars + summary** | set `showConsoleLogs` for CI (§4.5) |
| Asset export | legacy only | legacy **+** AM 2.0 ("cs-assets") | opt-in via config (§6) |

**Nothing about a normal `--alias`/`--stack-api-key --data-dir` export changes.** The common path still works verbatim.

---

## 2. Quick command translation (copy-paste)

| 1.x command | 2.x command |
|---|---|
| `csdx cm:export -k <key> -d ./content` | `csdx cm:stacks:export -k <key> -d ./content` |
| `csdx cm:stacks:export -s <key>` | `csdx cm:stacks:export -k <key>` |
| `csdx cm:stacks:export --data ./content` | `csdx cm:stacks:export --data-dir ./content` |
| `csdx cm:stacks:export --management-token-alias <a>` | `csdx cm:stacks:export --alias <a>` |
| `csdx cm:stacks:export -A` (auth token) | *no replacement* — use `--alias <management_token_alias>` or `--stack-api-key` + login |
| `csdx cm:stacks:export -m entries` | `csdx cm:stacks:export --module entries` |
| `csdx cm:stacks:export -t ct_uid` | `csdx cm:stacks:export --content-types ct_uid` |
| `csdx cm:stacks:export -B development` | `csdx cm:stacks:export --branch development` |
| `csdx cm:stacks:export` (multi-branch stack, exports **all** branches) | run once **per branch**: `csdx cm:stacks:export --branch <name> -d ./content/<name>` |

---

## 3. Flag reference — 1.x → 2.x

Canonical flags that are **unchanged** (safe): `--config/-c`, `--stack-api-key/-k`, `--data-dir/-d`, `--alias/-a`, `--branch-alias`, `--secured-assets`, `--yes/-y`, `--query` (hidden), `--module` (long form), `--content-types` (long form), `--branch` (long form).

Removed / changed:

| 1.x flag | v1 status | 2.x | Replacement |
|---|---|---|---|
| `-s`, `--stack-uid` | deprecated alias of `-k` | **removed** | `--stack-api-key` / `-k` |
| `--data` | deprecated alias of `--data-dir` | **removed** | `--data-dir` / `-d` |
| `--management-token-alias` | deprecated alias of `--alias` | **removed** | `--alias` / `-a` |
| `-A`, `--auth-token` | deprecated (auth-token flow) | **removed** | management token via `--alias`, or `--stack-api-key` with an authenticated session |
| `-m` (short for `--module`) | worked | **short char removed** | `--module` |
| `-t` (short for `--content-types`) | worked | **short char removed** | `--content-types` |
| `-B` (short for `--branch`) | worked | **short char removed** | `--branch` |

> **New in 2.x:** `--module` is now **enum-validated**. Allowed values: `stack, assets, locales, environments, extensions, webhooks, global-fields, entries, content-types, custom-roles, workflows, publishing-rules, labels, marketplace-apps, taxonomies, personalize, composable-studio`. An unknown module name now errors instead of silently doing nothing.

---

## 4. Breaking behavioral changes (export-specific)

### 4.1 Default branch scope: all branches → `main` only
- **1.x:** with no `--branch`, export iterated **every branch** of the stack, each into its own subdirectory.
- **2.x:** with no `--branch`, export writes **only the `main` branch**, flat.
- **Fix:** pass `--branch <name>` explicitly. To reproduce the old "export everything," run the command once per branch, e.g.:
  ```bash
  for b in main development release; do
    csdx cm:stacks:export --branch "$b" -d "./content/$b" -k <key>
  done
  ```
- ⚠️ **Known doc bug:** the `--branch` help text in 2.x still says *"by default … exported from all the branches"*. That text is stale; actual behavior is `main`-only. (Flag for correction before GA.)

### 4.2 Output directory is now flat (no per-branch nesting)
- **1.x:** `exportDir/<branch-uid>/<module>/…`
- **2.x:** `exportDir/<module>/…` (single-branch export, content directly under `exportDir`)
- **Fix:** any script/tool that globs `exportDir/<branch>/…` must drop the branch segment. If you need per-branch folders, set `-d ./content/<branch>` yourself (as in §4.1).

### 4.3 Aggregate `schema.json` no longer written
- **1.x:** export wrote a combined `content_types/schema.json` **and** individual `<ct_uid>.json` files.
- **2.x:** writes **only** the individual per-content-type files. `schema.json` is not produced.
- **Fix:** read individual content-type files. (Import 2.x reads them via an internal loader; an old export dir that still has `schema.json` is tolerated on import for backward-compat.)

### 4.4 `export-info.json` / `contentVersion` no longer written
- **1.x:** wrote `export-info.json` containing `contentVersion`, read on import for version-aware logic.
- **2.x:** the metadata file is **not written** (`writeExportMetaFile` was removed) and `contentVersion` no longer exists.
- **Impact:** normal re-imports are unaffected (import 2.x doesn't need it). Only **custom tooling that reads `export-info.json` / `contentVersion`** breaks — remove that dependency.

### 4.5 Output mode: progress bars + summary (not line-by-line logs)
- **2.x** shows a live progress bar and an end-of-run summary instead of scrolling logs; `showConsoleLogs` defaults to **false** for export.
- **Impact:** anything parsing export **stdout** in CI sees different output (no error is raised).
- **Fix for scripts/CI:**
  ```bash
  csdx config:set:log --show-console-logs
  ```
  (Persisted config key is `log.showConsoleLogs` in 2.x — note the v1 key `show-console-logs` is **not** read anymore, so re-run this after upgrading.)

### 4.6 `cm:export` alias removed
- Only `cm:stacks:export` resolves in 2.x. `csdx cm:export …` → "command not found." Update scripts.

---

## 5. Config-file migration (`--config <file>`)

The config-file options documented for 1.x, and their 2.x status (verified against `src/config/index.ts`):

| Config key (from 1.x docs) | 2.x status | Action |
|---|---|---|
| `contentVersion` | **removed** | delete the key (silently ignored) |
| `onlyTSModules` | **removed** | delete the key (legacy JS/TS split retired) |
| `master_locale` | retained | none |
| `source_stack` | retained | none |
| `data` | retained (maps to data dir) | prefer `--data-dir` on CLI |
| `branchName` | retained | see §4.1 — default is now `main`, not "all branches" |
| `branchAlias` | retained | none |
| `moduleName` | retained | value must be a valid module name (§3) |
| `fetchConcurrency` | retained (default `5`) | none |
| `writeConcurrency` | retained (default `5`) | none |
| `securedAssets` | retained | none |
| `versioning` | retained (default `false`) | none |
| `preserveStackVersion` | retained (default `false`) | none |
| `host` | retained | none |
| `maxContentLength` / `maxBodyLength` / `delayMs` / `createBackupDir` | not top-level defaults in 2.x — verify per run before relying on them | test before depending |
| `modules.asset-management` | **deprecated → `modules.cs-assets`** | rename; 2.x warns if old key used |
| `modules.cs-assets` | **new** AM 2.0 tuning (`chunkFileSizeMb`, `apiConcurrency`, `downloadAssetsConcurrency`, `pageSize`, `fetchConcurrency`) | optional; add only if using AM 2.0 |

Exported `stack.json` also now **strips** `SYS_ACL`, `user_uids`, `owner_uid`, `description`, `master_key` — expect a slightly smaller stack module file.

**Module name correction:** the 1.x docs list a module called `stacks` (plural). The real module id is **`stack`** (singular) in both 1.x and 2.x — `--module stacks` was never correct. 2.x additionally exposes `publishing-rules` as a selectable module.

---

## 6. New in export 2.x (additive)

- **Progress bars + end-of-run summary** (`CLIProgressManager` / summary) — export is a progress-supported module.
- **Asset Management 2.0 ("cs-assets")** — new asset export path, used **only** when the stack has linked workspaces and the region exposes `csAssetsUrl`; otherwise export falls back to "legacy asset export." Purely additive; no legacy key removed (old key deprecated with a warning, still honored).
- **Taxonomy publish details** in the export payload (part of taxonomy publishing, DX-4981).
- **Branch scoping for Personalize experiences** — export can pass a branch to personalization/experiences data (optional, backward compatible).

---

## 7. Migration checklist

- [ ] Node runtime upgraded to `>=22`.
- [ ] `cm:export` → `cm:stacks:export` in all scripts.
- [ ] Deprecated flags replaced (`-s`, `--data`, `--management-token-alias`, `-A`) — see §3.
- [ ] Short chars `-m/-t/-B` replaced with long flags.
- [ ] `--branch` passed explicitly wherever multi-branch export was relied on (§4.1).
- [ ] Tooling that globs `exportDir/<branch>/…` updated for flat layout (§4.2).
- [ ] Tooling reading `schema.json` switched to per-content-type files (§4.3).
- [ ] Tooling reading `export-info.json` / `contentVersion` removed (§4.4).
- [ ] CI that parses export stdout runs `config:set:log --show-console-logs` (§4.5).
- [ ] Config JSON cleaned: drop `contentVersion`, `onlyTSModules`; rename `asset-management`→`cs-assets` if used (§5).

## 8. Agent rules: 1.x → 2.x command translation

An agent given a 1.x `cm:export`/`cm:stacks:export` command should apply these rules in order and output the 2.x equivalent:

1. **Command:** replace `cm:export` with `cm:stacks:export`. Leave `cm:stacks:export` unchanged.
2. **Flag renames (value-preserving):**
   - `-s` | `--stack-uid`  → `--stack-api-key`
   - `--data`             → `--data-dir`
   - `--management-token-alias` → `--alias`
3. **Short-char expansions:** `-m`→`--module`, `-t`→`--content-types`, `-B`→`--branch`. (`-c -k -d -a -y` are unchanged.)
4. **Dropped with no 1:1 replacement — flag and warn:**
   - `-A` | `--auth-token`: remove; tell the user to authenticate via `--alias <management_token_alias>` or `--stack-api-key` + `csdx auth:login`.
5. **Branch semantics — warn if `--branch`/`--branch-alias` absent:** in 2.x this exports **only `main`**. If the original relied on the default to export all branches, advise running once per branch with `--branch` + a per-branch `--data-dir`.
6. **`--module` validation:** if a `--module` value is not in the allowed enum (§3), flag it as an error.
7. **Never invent flags.** If a 1.x flag isn't in this guide, keep it and note it's unverified.

**Worked example**
Input: `csdx cm:export -s blt123 --data ./out -m entries -B dev -A`
Output: `csdx cm:stacks:export --stack-api-key blt123 --data-dir ./out --module entries --branch dev`
Warnings: dropped `-A` (authenticate with `--alias`/login); `--branch dev` now required to scope (2.x defaults to `main`).
