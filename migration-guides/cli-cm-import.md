# Migration Guide — `@contentstack/cli-cm-import` (Import plugin) · 1.x → 2.x

> Command: `csdx cm:stacks:import`
> Package: `@contentstack/cli-cm-import`  ·  v1 line: `1.x` (e.g. `1.31.x`)  ·  v2 line: `2.x` (e.g. `2.0.0-beta.x`)
> Status: verified against code — v1 = `contentstack/cli @ v1.59.0`, v2 = `contentstack/cli-plugins @ v2-dev`.
> Pairs with the [export guide](cli-cm-export.md) — import consumes what export produces, so the directory/`schema.json` changes are shared.

This guide is written for **both a human and an LLM/agent**. Feed it to an agent with a 1.x import command and the [Agent rules](#9-agent-rules-1x--2x-command-translation) section is enough to emit the correct 2.x command.

---

## 1. At a glance

| Area | 1.x | 2.x | Action needed |
|---|---|---|---|
| Command id | `cm:stacks:import` | `cm:stacks:import` | none (id unchanged) |
| Alias | `cm:import` also worked | **removed** | replace `cm:import` → `cm:stacks:import` |
| Node.js | `>=14` (packages) | **`>=22`** | upgrade Node runtime |
| Deprecated flags | still accepted (hidden) | **removed → hard error** | switch to canonical flags (§3) |
| Short chars `-m -b -B` | worked | **removed** | use `--module --backup-dir --branch` |
| `--skip-app-recreation` | worked | **removed** | see §4.5 — no direct replacement |
| `--skip-taxonomy-publish` | — | **new** | opt out of taxonomy publish (§6) |
| Input directory layout | `.../content/<branch>/…` when branch used | **flat `.../content/…`** (matches new export) | point `-d` at the flat dir (§4.1) |
| `schema.json` | read on import | **not required** — reads per-content-type files | old export dirs still tolerated (§4.2) |
| `export-info.json` / `contentVersion` | read for version-aware logic | **ignored** (not read) | remove tooling that depends on it (§4.3) |
| Console output | line-by-line logs | **progress bars + summary** | set `showConsoleLogs` for CI (§4.4) |
| Asset import | legacy only | legacy **+** AM 2.0 ("cs-assets") | opt-in via config (§6) |
| Branch default | `main` when no `--branch` | `main` when no `--branch` | **unchanged** |

**The common path is unchanged:** `csdx cm:stacks:import --alias <a> --data-dir ./content` works verbatim.

---

## 2. Quick command translation (copy-paste)

| 1.x command | 2.x command |
|---|---|
| `csdx cm:import -a <alias> -d ./content` | `csdx cm:stacks:import -a <alias> -d ./content` |
| `csdx cm:import -s <key> -A -d ./content` | `csdx cm:stacks:import -k <key> -d ./content` (login first) |
| `csdx cm:stacks:import --data ./content` | `csdx cm:stacks:import --data-dir ./content` |
| `csdx cm:stacks:import --management-token-alias <a>` | `csdx cm:stacks:import --alias <a>` |
| `csdx cm:stacks:import -a <a> -m environments -b _backup_123` | `csdx cm:stacks:import -a <a> --module environments --backup-dir _backup_123` |
| `csdx cm:stacks:import -a <a> -B development -d ./content/development` | `csdx cm:stacks:import -a <a> --branch development -d ./content` |
| `csdx cm:stacks:import -a <a> --skip-app-recreation` | `csdx cm:stacks:import -a <a>` (flag removed — see §4.5) |

---

## 3. Flag reference — 1.x → 2.x

**Unchanged / safe** (canonical form): `--config/-c`, `--stack-api-key/-k`, `--data-dir/-d`, `--alias/-a`, `--branch-alias`, `--import-webhook-status`, `--yes/-y`, `--replace-existing`, `--skip-existing`, `--personalize-project-name`, `--skip-audit`, `--exclude-global-modules`, `--skip-assets-publish`, `--skip-entries-publish`, `--module` (long form), `--backup-dir` (long form), `--branch` (long form).

Removed / changed:

| 1.x flag | v1 status | 2.x | Replacement |
|---|---|---|---|
| `-s`, `--stack-uid` | deprecated alias of `-k` | **removed** | `--stack-api-key` / `-k` |
| `--data` | deprecated alias of `--data-dir` | **removed** | `--data-dir` / `-d` |
| `--management-token-alias` | deprecated alias of `--alias` | **removed** | `--alias` / `-a` |
| `-A`, `--auth-token` | deprecated (auth-token flow) | **removed** | management token via `--alias`, or `--stack-api-key` + authenticated session |
| `--skip-app-recreation` | worked | **removed** | none — private apps are recreated (see §4.5) |
| `-m` (short for `--module`) | worked | **short char removed** | `--module` |
| `-b` (short for `--backup-dir`) | worked | **short char removed** | `--backup-dir` |
| `-B` (short for `--branch`) | worked | **short char removed** | `--branch` |

New in 2.x:

| Flag | Purpose |
|---|---|
| `--skip-taxonomy-publish` | Skip publishing taxonomies during import (taxonomy publishing, DX-4981). |

> **`--module` is now enum-validated.** Allowed values: `stack, assets, locales, environments, extensions, webhooks, global-fields, entries, content-types, custom-roles, workflows, publishing-rules, labels, marketplace-apps, taxonomies, personalize, variant-entries, composable-studio`. New selectable modules vs 1.x: **`stack`, `publishing-rules`, `variant-entries`**. An unknown module name now errors.

---

## 4. Breaking behavioral changes (import-specific)

### 4.1 Flat input directory (matches new export layout)
- v2 export writes content **flat** (`exportDir/<module>/…`), not `exportDir/<branch-uid>/…`. Point `-d` at the flat directory.
- Importing an **old** (1.x) per-branch export still works — point `-d` at the branch subfolder as before. Only new exports change shape.

### 4.2 `schema.json` no longer required
- v1 import read the aggregate `content_types/schema.json`.
- v2 import reads the **individual per-content-type files** instead. An old export dir that still contains `schema.json` is tolerated (the file is ignored, not an error).
- **Impact:** none for normal import; only custom pre/post tooling that produced/consumed `schema.json` is affected.

### 4.3 `export-info.json` / `contentVersion` ignored
- v1 import read `export-info.json` → `contentVersion` to pick version-aware code paths.
- v2 import does **not** read it. A v1 export's `export-info.json` is silently ignored.
- **Impact:** normal re-imports unaffected; remove tooling that relied on `contentVersion`.

### 4.4 Output mode: progress bars + summary
- v2 shows a live progress bar + end-of-run summary; `showConsoleLogs` defaults to **false** for import.
- **Impact:** CI parsing import **stdout** sees different output (no error raised).
- **Fix:** `csdx config:set:log --show-console-logs` (persisted key is `log.showConsoleLogs` in 2.x; the v1 key `show-console-logs` is no longer read — re-run after upgrading).

### 4.5 `--skip-app-recreation` removed
- v1 had `--skip-app-recreation` to skip recreating private marketplace apps that already exist.
- v2 removes the flag. If your pipeline passed it, drop it. Verify private-app behavior on a test stack before a production import, since the skip option is no longer available.
- ⚠️ This is **not** the same as `--skip-taxonomy-publish` (a separate, new taxonomy flag). They are unrelated despite both being "skip" flags.

### 4.6 `cm:import` alias removed
- Only `cm:stacks:import` resolves in 2.x. `csdx cm:import …` → "command not found."

---

## 5. Config-file migration (`--config <file>`)

Most 1.x import config keys carry over. Key changes:

| Config key | 2.x status | Action |
|---|---|---|
| `contentVersion` | **removed** | delete (ignored) |
| `onlyTSModules` | **removed** | delete (legacy JS/TS split retired) |
| `modules.asset-management` | **deprecated → `modules.cs-assets`** | rename; 2.x warns if old key used |
| `modules.cs-assets` | **new** AM 2.0 tuning (`assetsFileName`, `mapperAssetsModuleDir`, `uploadAssetsConcurrency`) | optional; add only if using AM 2.0 |
| auth-token driven keys | n/a | switch to management-token / api-key auth |
| other module concurrency/backup keys | retained | none |

---

## 6. New in import 2.x (additive)

- **`--skip-taxonomy-publish`** + taxonomy publishing on import (DX-4981).
- **`variant-entries`** now a selectable `--module` value (branch-aware variants/personalize).
- **Asset Management 2.0 ("cs-assets")** import path — used only when the export contains AM 2.0 assets and the region exposes it; otherwise legacy asset import. Additive; old key deprecated with a warning.
- **Progress bars + end-of-run summary** (import is a progress-supported module).

---

## 7. Migration checklist

- [ ] Node runtime upgraded to `>=22`.
- [ ] `cm:import` → `cm:stacks:import` in all scripts.
- [ ] Deprecated flags replaced (`-s`, `--data`, `--management-token-alias`, `-A`) — §3.
- [ ] Short chars `-m/-b/-B` replaced with long flags.
- [ ] `--skip-app-recreation` removed from scripts; private-app behavior re-tested (§4.5).
- [ ] `-d` points at the flat export dir (or the branch subfolder for old exports) (§4.1).
- [ ] Tooling depending on `schema.json` / `export-info.json` / `contentVersion` removed (§4.2–4.3).
- [ ] CI parsing import stdout runs `config:set:log --show-console-logs` (§4.4).
- [ ] Config JSON cleaned: drop `contentVersion`, `onlyTSModules`; rename `asset-management`→`cs-assets` if used (§5).
- [ ] Auth switched off auth-token to management token / api-key.

---

## 8. v2 README / doc-site accuracy issues (fix before GA)

The v2 import `README.md` is bare auto-generated `oclif readme` output and is stale. Fix in the command flag text (README is regenerated):

| Location | Problem | Correct value |
|---|---|---|
| `--module` help list | Lists the old set (`assets, content-types, entries, …`) | Real enum is 18 modules incl. **`stack`, `publishing-rules`, `variant-entries`, `composable-studio`** (§3) |
| `--skip-taxonomy-publish` | Not surfaced/documented | New flag; add to docs (§6) |
| `--skip-app-recreation` | May still appear in older docs | Removed in 2.x (§4.5) |
| "See code" source link | Points to `github.com/contentstack/cli/blob/main/…` | Plugin now lives in **`contentstack/cli-plugins`** — link is wrong |
| Config-file / Node / output-mode | Not documented | Add config-file section, `>=22`, progress-manager default |

**Legacy doc page** (`/import-content-using-the-cli/old-commands`, the `cm:import` form): the entire page uses the removed `cm:import` alias and lists only the auth-token/`-s`/`--data` flow. It should be marked legacy/1.x-only or redirected — every command form on it is removed in 2.x.

---

## 9. Agent rules: 1.x → 2.x command translation

Apply in order; output the 2.x command:

1. **Command:** `cm:import` → `cm:stacks:import`. Leave `cm:stacks:import` unchanged.
2. **Flag renames (value-preserving):** `-s`|`--stack-uid`→`--stack-api-key`; `--data`→`--data-dir`; `--management-token-alias`→`--alias`.
3. **Short-char expansions:** `-m`→`--module`, `-b`→`--backup-dir`, `-B`→`--branch`. (`-c -k -d -a -y` unchanged.)
4. **Dropped — flag and warn:**
   - `-A`|`--auth-token`: remove; authenticate via `--alias` or `--stack-api-key` + `csdx auth:login`.
   - `--skip-app-recreation`: remove; warn that private apps will be recreated (no skip option in 2.x).
5. **`--module` validation:** value must be in the enum (§3), else flag an error.
6. **Directory:** if the command points `-d` at `.../content/<branch>`, note that new (2.x) exports are flat — point at the flat dir; old exports keep the branch subfolder.
7. **Never invent flags.** Unknown 1.x flags: keep and mark unverified.

**Worked example**
Input: `csdx cm:import -s blt123 -A --data ./out -m entries -b _bkp -B dev --skip-app-recreation`
Output: `csdx cm:stacks:import --stack-api-key blt123 --data-dir ./out --module entries --backup-dir _bkp --branch dev`
Warnings: dropped `-A` (authenticate via `--alias`/login); dropped `--skip-app-recreation` (private apps now always recreated); if `./out` was a per-branch subfolder from a 2.x export, it's now flat.
