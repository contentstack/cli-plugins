# Migration Guide — `@contentstack/cli-audit` (Audit plugin) · 1.x → 2.x

> Commands: `csdx cm:stacks:audit` · `csdx cm:stacks:audit:fix`
> Package: `@contentstack/cli-audit`  ·  v1 line: `1.x` (verified `1.18.0`)  ·  v2 line: `2.x` (`2.0.0-beta.14`)
> Status: verified against code — v1 = `contentstack/cli @ v1.59.0` (audit package `1.18.0`), v2 = `contentstack/cli-plugins @ origin/v2-dev`. Also cross-checked against the v1 doc-site page (audit-plugin).

This guide is written to be read by **both a human and an LLM/agent**. If you feed this file to an agent along with a 1.x audit command, the [Command Translation Rules](#8-agent-rules-1x--2x-command-translation) section is enough to emit the correct 2.x command.

---

## 1. At a glance

| Area | 1.x | 2.x | Action needed |
|---|---|---|---|
| Command id | `cm:stacks:audit` / `cm:stacks:audit:fix` | same | none (ids unchanged) |
| Short aliases `audit` / `audit:fix` | worked (registered as command aliases) | **removed** | replace `csdx audit` → `csdx cm:stacks:audit`, `csdx audit:fix` → `csdx cm:stacks:audit:fix` (§4.1) |
| Node.js | `>=16` | **`>=22`** | upgrade Node runtime |
| Console output | line-by-line module results by default | **progress bar + summary table; per-module console output suppressed by default** | pass `--show-console-output`, or set `log.showConsoleLogs` for CI (§4.2) |
| Flags (both commands) | see §3 | **identical set** | none — no flag renamed/removed/added |
| `--copy-dir` | already present | present (unchanged) | none — **not** new in v2 (§5) |
| `fixSelectField` config | already present (`false`) | present (`false`, unchanged) | none — **not** new in v2 (§5) |
| Taxonomy audit checks (DX-4981) | none | **still none** (taxonomy is skipped) | none — no new taxonomy checks exist (§6) |

**The common path is unchanged.** `csdx cm:stacks:audit -d ./content --report-path ./report` and `csdx cm:stacks:audit:fix -d ./content --copy-dir` behave the same in 2.x except for the console-output default (§4.2).

---

## 2. Quick command translation (copy-paste)

| 1.x command | 2.x command |
|---|---|
| `csdx audit -d ./content` | `csdx cm:stacks:audit -d ./content` |
| `csdx audit:fix -d ./content --copy-dir` | `csdx cm:stacks:audit:fix -d ./content --copy-dir` |
| `csdx cm:stacks:audit --report-path ./r` | `csdx cm:stacks:audit --report-path ./r` (unchanged) |
| `csdx cm:stacks:audit` (relied on scrolling per-module output) | `csdx cm:stacks:audit --show-console-output` (progress bar + summary is now the default) |

---

## 3. Flag reference — 1.x → 2.x

Every user-facing flag is **identical** between v1 (`1.18.0`) and v2 (`2.0.0-beta.14`). No flag was renamed, removed, or added; no short char changed; no default changed. Verified by comparing the flag blocks in the command and base-command source:

- v1 command flags: `cli @ v1.59.0` → `packages/contentstack-audit/src/commands/cm/stacks/audit/index.ts` and `.../audit/fix.ts`
- v2 command flags: `cli-plugins @ origin/v2-dev` → same two paths
- shared/base flags: `src/base-command.ts:26-40` (both repos)

**`cm:stacks:audit` flags**

| Flag | Short | Source (v2) | Notes |
|---|---|---|---|
| `--config` | `-c` | `base-command.ts:27-31` | path to external config file |
| `--data-dir` | `-d` | `base-command.ts:32-36` | path to exported data |
| `--show-console-output` | — | `base-command.ts:37-40` | display per-module results; **behavior default changed** (§4.2) |
| `--report-path` | — | `commands/cm/stacks/audit/index.ts` | path to store audit reports |
| `--modules` | — | `index.ts` (`multiple`, enum = `config.modules`) | enum-validated (see below) |
| `--reference-only` | — | `index.ts` | hidden |
| `--columns` `--sort` `--filter` `--csv` `--no-truncate` `--no-header` `--output` | — | `util/flags.ts:31` (`CLITable.getTableFlags`) | standard table flags |

**`cm:stacks:audit:fix`** — all of the above **plus**:

| Flag | Short | Source (v2 `commands/cm/stacks/audit/fix.ts`) | Notes |
|---|---|---|---|
| `--copy-dir` | — | `fix.ts:36` | create a backup from the original data before fixing |
| `--copy-path` | — | `fix.ts:39-40` (`dependsOn: ['copy-dir']`) | backup destination; requires `--copy-dir` |
| `--fix-only` | — | `fix.ts:44` (`multiple`, enum = `config['fix-fields']`) | limit fixes to listed fix types |
| `--yes` | `-y` | `fix.ts:47` | hidden; skip confirmation |
| `--external-config` | — | `fix.ts:53` (`getJsonInputFlags`, hidden) | inline JSON config for programmatic callers |

> **Enum-validated values (v2, `src/config/index.ts:6-16`):**
> - `--modules`: `content-types, global-fields, entries, extensions, workflows, custom-roles, assets, field-rules, composable-studio`
> - `--fix-only`: `reference, global_field, json:rte, json:extension, blocks, group, content_types`
> An unknown value errors out. (Same enums in v1 `1.18.0`; the v1 doc-site omits `composable-studio` from its module list — the doc is stale, not the flag.)

---

## 4. Breaking behavioral changes (audit-specific)

### 4.1 `audit` / `audit:fix` command aliases removed
- **1.x:** the commands registered short aliases — `static aliases = ['audit', 'cm:stacks:audit']` (`cli @ v1.59.0` `.../audit/index.ts`) and `['audit:fix', 'cm:stacks:audit:fix']` (`.../audit/fix.ts`). So `csdx audit` and `csdx audit:fix` resolved.
- **2.x:** the `static aliases` lines are **gone** from both command files (`cli-plugins @ origin/v2-dev` `.../audit/index.ts`, `.../audit/fix.ts`). Only the canonical ids resolve. The v2 README's command list confirms this — it documents only `cm:stacks:audit` and `cm:stacks:audit:fix` (v1 README documented `audit`/`audit:fix` sections too).
- **Fix:** replace `csdx audit …` → `csdx cm:stacks:audit …` and `csdx audit:fix …` → `csdx cm:stacks:audit:fix …` in all scripts.
- Note: `package.json` still ships a `bin.audit` entry (the standalone binary name) — that is unrelated to the removed **command** aliases inside `csdx`.

### 4.2 Output mode: progress bar + summary (per-module output suppressed by default)
- **1.x:** no progress bar. `audit-base-command.ts` (`cli @ v1.59.0`) imports no progress manager; per-module results were driven only by `--show-console-output` (`audit-base-command.ts:99`).
- **2.x:** audit is now a **progress-supported module**. On `start()` it:
  - imports and drives `CLIProgressManager` (`src/audit-base-command.ts:14`, `:83` `initializeGlobalSummary('AUDIT', …)`),
  - registers itself as the progress module: `configHandler.set('log.progressSupportedModule', 'audit')` (`src/audit-base-command.ts:80`),
  - **forces console logs off when unset**: if `log.showConsoleLogs` is `undefined`, it sets it to `false` so progress bars replace scrolling logs (`src/audit-base-command.ts:77-79`).
- Per-module tables still only print when `--show-console-output` is passed (`src/audit-base-command.ts:108`); a Summary table always prints (`:138`).
- **Impact:** anything parsing audit **stdout** in CI sees a progress bar + summary instead of line-by-line module logs. No error is raised.
- **Fix for scripts/CI** — re-enable console logging persistently:
  ```bash
  csdx config:set:log --show-console-logs
  ```
  (Persisted key is `log.showConsoleLogs`. The one-shot per-run switch is still `--show-console-output`.)

### 4.3 Node.js `>=16` → `>=22`
- v1 `package.json` `engines.node` = `>=16` (`cli @ v1.59.0`); v2 = `>=22.0.0` (`cli-plugins @ origin/v2-dev` `packages/contentstack-audit/package.json`). Upgrade the runtime before installing 2.x.

---

## 5. Verification of the "new in beta" claims (both FALSE)

The beta was reported to **add** a `--copy-dir` flag and a `fixSelectField` config option. Verified against code — **both already existed in v1**, so neither is new:

| Claim | v2 location | v1 location (`cli @ v1.59.0`, audit `1.18.0`) | Verdict |
|---|---|---|---|
| `--copy-dir` flag added | `src/commands/cm/stacks/audit/fix.ts:36` | `packages/contentstack-audit/src/commands/cm/stacks/audit/fix.ts` (`'copy-dir': Flags.boolean`) | **Not new** — present in v1, unchanged |
| `fixSelectField` config option added | `src/config/index.ts:143` (`fixSelectField: false`) | `packages/contentstack-audit/src/config/index.ts:142` (`fixSelectField: false`) | **Not new** — present in v1, same default `false` |

The v1 doc-site also documents both `--copy-dir` and the `fixSelectField` JSON config, corroborating that they predate 2.x. Treat them as **carried-over**, not additive.

---

## 6. Taxonomy audit checks (DX-4981) — NOT present

Checked for new taxonomy audit checks in v2. **None exist in the audit plugin.** Taxonomy is explicitly **skipped**: `skipFieldTypes: ['taxonomy', 'group']` (`src/config/index.ts:4`). There is no `taxonomy` entry in the `modules` enum (`:6-16`), no `taxonomy` module file under `src/modules/`, and the only match for "taxonom" in the entire v2 audit source is that skip list. DX-4981's taxonomy work (seen in the export plugin) did **not** introduce audit-side taxonomy checks. Do not document a taxonomy audit capability.

---

## 7. README / doc accuracy (v2 `packages/contentstack-audit/README.md`)

Issues found in the auto-generated v2 README (flag for correction before GA):

1. **Wrong "See code" repository link.** Both command sections link to `https://github.com/contentstack/audit/blob/main/packages/contentstack-audit/...` (README, `_See code:_` lines). The repo `contentstack/audit` does not host this package — the source lives in `contentstack/cli-plugins` (and historically `contentstack/cli`). Root cause: `package.json` `"repository": "contentstack/audit"` feeds the `oclif.repositoryPrefix` template `<%- repo %>/blob/main/packages/contentstack-audit/<%- commandPath %>`. Fix the `repository` field (and/or the prefix) to point at `contentstack/cli-plugins`.
2. **Unfilled auto-gen placeholders.** README lines 1-2 still contain the literal comments `<!-- Insert Nodejs CI here -->` and `<!-- Insert Audit version here -->` — the badge/version blocks were never populated.
3. **Doc-site vs README module list drift.** The doc-site page lists audit modules as `content-types, global-fields, entries, extensions, workflows, custom-roles, assets, field-rules` and omits `composable-studio`, which is a valid enum value in both v1 `1.18.0` and v2 (`src/config/index.ts`). The doc-site module list is stale.

(The README version string and `_See code:_` paths are otherwise accurate for 2.x; the version banner reads `@contentstack/cli-audit/2.0.0-beta.14`, matching `package.json`.)

---

## 8. Migration checklist

- [ ] Node runtime upgraded to `>=22`.
- [ ] `csdx audit` → `csdx cm:stacks:audit` and `csdx audit:fix` → `csdx cm:stacks:audit:fix` in all scripts (§4.1).
- [ ] CI that parses audit stdout runs `csdx config:set:log --show-console-logs` (or passes `--show-console-output`) to keep per-module output (§4.2).
- [ ] No flag changes needed — the flag set is identical (§3).
- [ ] No config changes needed for `--copy-dir` / `fixSelectField` — carried over from v1 (§5).
- [ ] Do not expect new taxonomy audit checks — none exist (§6).

---

## 9. Agent rules: 1.x → 2.x command translation

An agent given a 1.x audit command should apply these rules in order and output the 2.x equivalent:

1. **Command / alias expansion:**
   - `audit` → `cm:stacks:audit`
   - `audit:fix` → `cm:stacks:audit:fix`
   - Leave `cm:stacks:audit` / `cm:stacks:audit:fix` unchanged.
2. **Flags are unchanged.** Pass every flag through verbatim — no renames, no removed short chars, no changed defaults. `-c -d -y` and all long flags are identical.
3. **Console output warning (no flag change):** if the original relied on scrolling per-module output, note that 2.x defaults to a progress bar + summary. Advise adding `--show-console-output` (one run) or `csdx config:set:log --show-console-logs` (persistent) — do **not** invent a flag.
4. **Module / fix-only validation:** `--modules` must be in `{content-types, global-fields, entries, extensions, workflows, custom-roles, assets, field-rules, composable-studio}`; `--fix-only` in `{reference, global_field, json:rte, json:extension, blocks, group, content_types}`. Flag out-of-enum values as errors.
5. **Never invent flags.** If a 1.x flag isn't in §3, keep it and note it's unverified.

**Worked example**
Input: `csdx audit:fix -d ./content --copy-dir --fix-only=reference,global_field`
Output: `csdx cm:stacks:audit:fix -d ./content --copy-dir --fix-only=reference,global_field`
Warnings: only the command alias changed (`audit:fix` → `cm:stacks:audit:fix`); all flags pass through unchanged. If you were reading per-module output from stdout, note that 2.x now shows a progress bar + summary by default — add `--show-console-output` or run `csdx config:set:log --show-console-logs`.
