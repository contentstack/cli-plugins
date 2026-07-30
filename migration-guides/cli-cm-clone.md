# Migration Guide — `@contentstack/cli-cm-clone` (Clone plugin) · 1.x → 2.x

> Command: `csdx cm:stacks:clone`
> Package: `@contentstack/cli-cm-clone`  ·  v1 line: `1.x` (e.g. `1.20.1`)  ·  v2 line: `2.x` (e.g. `2.0.0-beta.23`)
> Status: verified against code — v1 = `contentstack/cli @ v1.59.0`, v2 = `contentstack/cli-plugins @ v2-dev`.
> Pairs with the [export guide](cli-cm-export.md) and [import guide](cli-cm-import.md) — **clone runs export then import under the hood, so every export/import behavioral change applies to clone.**

This guide is written for **both a human and an LLM/agent**. Feed it to an agent with a 1.x clone command and the [Agent rules](#8-agent-rules-1x--2x-command-translation) section is enough to emit the correct 2.x command.

---

## 0. TL;DR — what actually changed for clone

**Clone's own command surface is essentially unchanged.** Every flag, short char, alias, default and enum on `cm:stacks:clone` is byte-for-byte identical between v1.59.0 and v2-dev (verified by diffing `src/commands/cm/stacks/clone.ts` — the only functional change is one added line enabling progress bars). There are **no removed flags, no renamed flags, no new flags, no removed short chars, no changed defaults, and no removed aliases** for clone itself.

The migration impact on clone is almost entirely **inherited** from the export and import plugins it wraps:

- **Node `>=14` → `>=22`** (clone's own `package.json`).
- **Progress bars + summary** output (clone is now a progress-supported module).
- **Flat content directory** (no per-branch subfolder) — directly visible in clone's internal export/import wiring.
- Inherited export/import semantics: **default branch scope = `main`**, no `schema.json`, no `export-info.json` / `contentVersion`.
- Inherited import constraint handling + the **unique-fields known issue** (duplicate entries on a non-`title` unique field) — see [import guide §4.7](cli-cm-import.md).

Two commonly-repeated claims are **false** and are debunked with citations below (§4.3): interactive prompts and auto audit-fix are **not new in the beta** — both already shipped in v1.59.0.

---

## 1. At a glance

| Area | 1.x | 2.x | Action needed |
|---|---|---|---|
| Command id | `cm:stacks:clone` | `cm:stacks:clone` | none (id unchanged) |
| Alias `cm:stack-clone` | worked | **still works** (retained) | none — unlike export/import, clone's alias was **not** removed |
| Node.js | `>=14` | **`>=22`** | upgrade Node runtime |
| Clone-specific flags | see §3 | **identical** | none |
| Short chars `-n -y -c` | worked | **unchanged** | none |
| `--type`, `--import-webhook-status` enums/defaults | `a\|b`, `disable` | **unchanged** | none |
| Console output | line-by-line logs | **progress bars + summary** | set `showConsoleLogs` for CI (§5.1) |
| Content dir layout (internal) | per-branch subfolder | **flat** | update path-based tooling (§5.2) |
| Inherited export behavior | 1.x export | **2.x export** | read [export guide](cli-cm-export.md) |
| Inherited import behavior | 1.x import | **2.x import** | read [import guide](cli-cm-import.md) |

**The common path is unchanged:** an interactive `csdx cm:stacks:clone`, or a scripted `csdx cm:stacks:clone -n <name> --source-management-token-alias <a> --destination-management-token-alias <b> --type b -y`, works verbatim across 1.x and 2.x.

---

## 2. Quick command translation (copy-paste)

Because clone's flags did not change, translation is a no-op for the command itself — you only inherit the export/import behavior changes:

| 1.x command | 2.x command |
|---|---|
| `csdx cm:stacks:clone` | `csdx cm:stacks:clone` (identical) |
| `csdx cm:stack-clone …` | `csdx cm:stack-clone …` (alias still valid) |
| `csdx cm:stacks:clone -n <name> --type b -y` | `csdx cm:stacks:clone -n <name> --type b -y` (identical) |
| `csdx cm:stacks:clone --source-branch dev --target-branch main` | same — but source export is now `main`-only by default if you omit `--source-branch` (§5.3) |

There is **no** flag to rename, expand, or drop on `cm:stacks:clone`. (Contrast with export/import, which removed `cm:export`/`cm:import` aliases, `-s/--data/-A`, and short chars.)

---

## 3. Flag reference — 1.x → 2.x (unchanged)

Verified identical in `src/commands/cm/stacks/clone.ts` (`static flags`) between v1.59.0 and v2-dev:

| Flag | Short | Enum / default | Status v1 → v2 |
|---|---|---|---|
| `--source-branch` | — | — (exclusive with `--source-branch-alias`) | unchanged |
| `--source-branch-alias` | — | — | unchanged |
| `--target-branch` | — | — (exclusive with `--target-branch-alias`) | unchanged |
| `--target-branch-alias` | — | — | unchanged |
| `--source-management-token-alias` | — | — | unchanged |
| `--destination-management-token-alias` | — | — | unchanged |
| `--stack-name` | `-n` | — | unchanged |
| `--type` | — | options `a`\|`b` | unchanged |
| `--source-stack-api-key` | — | — | unchanged |
| `--destination-stack-api-key` | — | — | unchanged |
| `--import-webhook-status` | — | options `disable`\|`current`, default `disable` | unchanged |
| `--yes` | `-y` | boolean | unchanged |
| `--skip-audit` | — | boolean | unchanged |
| `--config` | `-c` | — | unchanged |

- **No removed flags. No renamed flags. No new flags. No removed short chars. No changed defaults.**
- **Alias:** `static aliases = ['cm:stack-clone']` in both versions (`clone.ts:37`). The clone alias survives; only export/import lost their `cm:export`/`cm:import` aliases.

> `--type` selects: **a)** structure only (all modules except entries & assets); **b)** structure + content (all modules including entries & assets). Enum text is identical in both versions.

---

## 4. Behavioral changes on the clone command itself

Only one functional line changed in `clone.ts` between v1.59.0 and v2-dev.

### 4.1 Node.js `>=14` → `>=22`
- v1 (`cli @ v1.59.0`) clone `package.json` `engines.node` = `>=14.0.0`.
- v2 (`cli-plugins @ v2-dev`) clone `package.json` `engines.node` = `>=22.0.0` (`package.json:39`).
- **Fix:** upgrade the Node runtime before installing the 2.x plugin.

### 4.2 Progress bars + summary (clone is now a progress-supported module)
- v2 registers clone as a progress-supported module. In `run()`, `clone.ts:163` clears any stale value (`configHandler.set('log.progressSupportedModule', null)`), and once auth passes, `clone.ts:182` sets `configHandler.set('log.progressSupportedModule', 'clone')`. Neither line exists in v1.59.0 (confirmed by diff).
- **Effect:** like export/import 2.x, clone shows a live progress bar + end-of-run summary instead of scrolling logs, and `showConsoleLogs` is effectively off by default for the module.
- The comment at `clone.ts:160-162` notes the `null` reset exists so that **auth/pre-flight errors still reach the console** regardless of `showConsoleLogs`.
- **Fix for CI/scripts that parse clone stdout:** `csdx config:set:log --show-console-logs` (persisted key `log.showConsoleLogs`; the v1 key `show-console-logs` is no longer read — re-run after upgrading). Same mechanism as export §4.5 / import §4.4.

### 4.3 Debunked: "beta adds interactive prompts + auto audit-fix"
This claim is **not correct** — both behaviors already shipped in v1.59.0:

- **Interactive prompts** (organization select, stack select, branch select, stack-creation confirmation, clone-type select) use `inquirer.prompt` in **both** versions. v1.59.0 `core/util/clone-handler.ts`: `inquirer.prompt` at lines 120, 204, 324, 469, and clone-type selection at 804. v2-dev `clone-handler.ts`: the same prompts at lines 120, 203, 323, 468, 815. Prompt behavior is unchanged; clone was always interactive when flags were omitted.
- **Audit fix on import** is likewise pre-existing. In both versions the clone-handler pushes `--skip-audit` to the wrapped import command **only when** `importConfig.skipAudit` is set — i.e. the audit fix runs by default and `--skip-audit` opts out. v1.59.0 `clone-handler.ts:651-652`; v2-dev `clone-handler.ts:662-664`. The default-on-audit-during-import comes from the import plugin and is not a new clone-beta feature.

**Conclusion:** treat "interactive prompts" and "auto audit-fix" as pre-existing v1 behavior. There is no new prompt surface or new audit toggle introduced by the clone 2.x beta.

Minor cosmetic differences in v2 clone-handler (non-breaking): the undo hint now writes via `process.stdout.write(getChalk().cyan(...))` instead of `inquirer.ui.BottomBar` (`clone-handler.ts:173`), and the `console.clear()` call present in v1 was removed.

---

## 5. Inherited breaking changes (from export + import)

Clone shells out to `cm:stacks:export` then `cm:stacks:import` internally (see the `-k … -d …` command arrays built in `clone-handler.ts`). Everything in the export/import 2.x guides therefore applies. The highlights, and the clone-specific evidence:

### 5.1 Output mode: progress bars, not logs
Covered in §4.2 above — same `showConsoleLogs` remediation as export/import.

### 5.2 Flat content directory (no per-branch nesting) — visible inside clone
- **v1.59.0:** the wrapped import pointed at a **branch subfolder**: `path.join(importConfig.pathDir, importConfig.sourceStackBranch)`, and the export data dir was `path.join(cloneTypePackageRoot, 'contents', this.config.sourceStackBranch || '')` (`clone-handler.ts:637-638, 799-800`).
- **v2-dev:** flat — import uses `importConfig.contentDir || importConfig.pathDir` with **no branch segment**, and the export dir is `this.config.contentDir || this.config.pathDir || …/contents` (`clone-handler.ts:640-649, 807-811`; comment at 808: *"single-branch layout: modules live directly under -d, not pathDir/<branch>"*).
- **Impact:** clone manages its own scratch `contents/` dir so most users never see this, but any tooling that inspected the on-disk clone staging directory by branch subfolder must drop the branch segment. Matches export §4.2 / import §4.1.

### 5.3 Default branch scope = `main` (source export)
- The wrapped export in v2 follows the export plugin's new default: with no `--source-branch`, only the **`main`** branch is exported (v1 export iterated all branches). See export §4.1.
- **Fix:** pass `--source-branch <name>` (and `--target-branch <name>`) explicitly when cloning a non-`main` branch or when you relied on all-branch behavior.

### 5.4 `schema.json` and `export-info.json` / `contentVersion` no longer written/read
- The wrapped export no longer writes the aggregate `content_types/schema.json` or `export-info.json`/`contentVersion`; the wrapped import reads per-content-type files and ignores `contentVersion`. See export §4.3–4.4 and import §4.2–4.3.
- **Impact on clone:** none for a normal end-to-end clone (export and import are the same 2.x versions and agree on layout). Only external tooling that inspected clone's intermediate files breaks.

> For the full inherited flag/config/behavior detail, read [`cli-cm-export.md`](cli-cm-export.md) and [`cli-cm-import.md`](cli-cm-import.md). Clone does not re-expose export/import flags (e.g. `--module`, `--backup-dir`) on its own command line — it drives them internally — so those flag removals do not affect the clone CLI surface.

---

## 6. Config-file migration (`--config <file>`)

Clone's `--config`/`-c` handling is unchanged (`clone.ts` reads the file, `merge.recursive` into the clone config). Clone-specific keys still recognized: `cloneType`, `stackName`, `sourceStackBranch`, `sourceStackBranchAlias`, `targetStackBranch`, `targetStackBranchAlias`, `source_stack`, `target_stack`, `source_alias`, `destination_alias`, `importWebhookStatus`, `skipAudit`, `forceStopMarketplaceAppsPrompt`.

Because the wrapped export/import run as 2.x, any **export/import** config keys you nest for those phases follow their 2.x rules — notably `contentVersion` and `onlyTSModules` are removed, and `modules.asset-management` → `modules.cs-assets`. See export §5 / import §5.

---

## 7. Migration checklist

- [ ] Node runtime upgraded to `>=22` (§4.1).
- [ ] No clone flag changes required — command lines are unchanged (§3).
- [ ] `cm:stack-clone` alias may stay (not removed) (§3).
- [ ] CI that parses clone stdout runs `config:set:log --show-console-logs` (§4.2/§5.1).
- [ ] `--source-branch` / `--target-branch` passed explicitly if you relied on multi-branch/all-branch cloning (§5.3).
- [ ] Tooling that inspected clone's intermediate `contents/<branch>/…` staging updated for the flat layout (§5.2).
- [ ] Export + import guides reviewed for the inherited behavior your pipeline depends on (§5).
- [ ] Do **not** expect new prompt/audit toggles in the beta — they pre-existed (§4.3).

---

## 8. Agent rules: 1.x → 2.x command translation

Apply in order; output the 2.x command:

1. **Command / alias:** leave `cm:stacks:clone` and `cm:stack-clone` unchanged — both resolve in 2.x.
2. **Flags:** pass every clone flag through **verbatim**. No renames, no short-char expansions, no removals apply to clone (unlike export/import).
3. **Branch scope — warn if `--source-branch`/`--source-branch-alias` absent:** in 2.x the wrapped export defaults to **`main` only**. If the original relied on all-branch behavior, advise passing `--source-branch` (and `--target-branch`) explicitly.
4. **Output mode:** if the caller parses clone stdout, warn that 2.x emits progress bars + summary and suggest `csdx config:set:log --show-console-logs`.
5. **Node:** warn that 2.x requires Node `>=22`.
6. **Never invent flags.** Clone's flag set is fixed (§3); anything else is unverified.

**Worked example**
Input: `csdx cm:stacks:clone -n "Prod copy" --source-management-token-alias src --destination-management-token-alias dst --type b -y`
Output: `csdx cm:stacks:clone -n "Prod copy" --source-management-token-alias src --destination-management-token-alias dst --type b -y` (identical)
Warnings: source export now defaults to `main` if no `--source-branch`; output is progress bars (set `--show-console-logs` for CI); requires Node >=22.

