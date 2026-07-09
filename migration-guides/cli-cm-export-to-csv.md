# Migration Guide — `@contentstack/cli-cm-export-to-csv` (Export-to-CSV plugin) · 1.x → 2.x

> Command: `csdx cm:export-to-csv`
> Package: `@contentstack/cli-cm-export-to-csv`  ·  v1 line: `1.x` (baseline `1.11.0`)  ·  v2 line: `2.x` (`2.0.0-beta.9`)
> Status: verified against code — v1 = `contentstack/cli @ v1.59.0`, v2 = `contentstack/cli-plugins @ v2-dev`.

This guide is written to be read by **both a human and an LLM/agent**. If you feed this file to an agent along with a 1.x command, the [Command Translation Rules](#8-agent-rules-1x--2x-command-translation) section is enough to emit the correct 2.x command.

> **TL;DR — this is the easy one.** Unlike `cm:stacks:export`, the export-to-csv command has **no flag removals, no renames, no short-char drops, and no changed defaults** between v1.59.0 and v2. The command source is byte-for-byte identical. The only migration actions are a **Node runtime bump** and awareness that the package now ships from a different repo. Every documented 1.x invocation runs verbatim on 2.x.

---

## 1. At a glance

| Area | 1.x (`v1.59.0`, pkg `1.11.0`) | 2.x (`2.0.0-beta.9`) | Action needed |
|---|---|---|---|
| Command id | `cm:export-to-csv` | `cm:export-to-csv` | none (id unchanged) |
| Aliases | `cm:export-to-csv` | `cm:export-to-csv` | none |
| Node.js | **`>=18.0.0`** | **`>=22.0.0`** | upgrade Node runtime |
| Flags (all) | 14 flags | **same 14 flags, identical chars/defaults** | none |
| `--action` enum | `entries \| users \| teams \| taxonomies` | **unchanged** | none |
| Teams export CSVs | 3 files | **same 3 files** | none |
| Taxonomy fallback (`--include-fallback`, `--fallback-locale`) | present | **same** | none |
| Delimiter default | `,` | `,` | none |
| Source repo | `contentstack/cli` (`.js` link in README) | `contentstack/cli-plugins` (`.ts` link) | update bookmarks only |
| Interactive prompt lib | `inquirer` + `inquirer-checkbox-plus-prompt` | `@inquirer/prompts` | none (behavior preserved) |

**Nothing about a normal `cm:export-to-csv` invocation changes.** The common paths (`--action entries`, `--action users`, `--action teams`, `--action taxonomies`) all work verbatim.

---

## 2. Quick command translation (copy-paste)

Every 1.x command is already a valid 2.x command. No rewriting required.

| 1.x command | 2.x command |
|---|---|
| `csdx cm:export-to-csv --action entries --alias <a> --content-type <ct> --locale <l>` | *(identical)* |
| `csdx cm:export-to-csv --action users --org <org-uid>` | *(identical)* |
| `csdx cm:export-to-csv --action teams --org <org-uid> --team-uid <uid>` | *(identical)* |
| `csdx cm:export-to-csv --action taxonomies --alias <a> --taxonomy-uid <uid> --locale <l>` | *(identical)* |
| `csdx cm:export-to-csv --action taxonomies --alias <a> --locale <l> --include-fallback --fallback-locale <fl>` | *(identical)* |
| `csdx cm:export-to-csv -k <key> -n <stack-name> --delimiter '\|'` | *(identical)* |

The only environmental change is that the host must run **Node >= 22** (§4.1).

---

## 3. Flag reference — 1.x → 2.x

The `static flags` block is **identical** in both versions (verified: `src/commands/cm/export-to-csv.ts` is byte-for-byte the same in `cli @ v1.59.0` and `cli-plugins @ v2-dev`). No flag was added, removed, renamed, re-charred, or had its default changed.

| Flag | Short | Type | Default | 1.x | 2.x |
|---|---|---|---|---|---|
| `--action` | — | enum `entries\|users\|teams\|taxonomies` | — | ✅ | ✅ |
| `--alias` | `-a` | string | — | ✅ | ✅ |
| `--stack-api-key` | `-k` | string | — | ✅ | ✅ |
| `--stack-name` | `-n` | string | — | ✅ | ✅ |
| `--org` | — | string | — | ✅ | ✅ |
| `--org-name` | — | string | — | ✅ | ✅ |
| `--locale` | — | string | — | ✅ | ✅ |
| `--content-type` | — | string | — | ✅ | ✅ |
| `--branch` | — | string | — | ✅ | ✅ |
| `--team-uid` | — | string | — | ✅ | ✅ |
| `--taxonomy-uid` | — | string | — | ✅ | ✅ |
| `--include-fallback` | — | boolean | `false` | ✅ | ✅ |
| `--fallback-locale` | — | string | — | ✅ | ✅ |
| `--delimiter` | — | string | `,` | ✅ | ✅ |

> There are **no** deprecated-flag removals here — contrast with `cm:stacks:export`, which dropped `-s`, `--data`, `--management-token-alias`, `-A`, and the `-m/-t/-B` short chars. Export-to-csv never carried those aliases.

---

## 4. Breaking / environmental changes

### 4.1 Node runtime: `>=18` → `>=22` (the one real breaking change)
- **1.x:** `package.json` `engines.node` = `>=18.0.0` (verified `cli @ v1.59.0` `packages/contentstack-export-to-csv/package.json`).
- **2.x:** `engines.node` = `>=22.0.0` (verified `cli-plugins @ v2-dev`).
- **Fix:** upgrade the Node runtime to 22 LTS before installing/running the 2.x plugin. This is the only change that can actually break an existing pipeline.

### 4.2 Package now ships from `cli-plugins`, not `cli`
- **1.x:** the plugin source lived in the monorepo `contentstack/cli`. README "See code" pointed at a `.js` file there (§ README note below).
- **2.x:** source lives in `contentstack/cli-plugins`; README "See code" points at the `.ts` file.
- **Impact:** none for CLI users — the published npm package name (`@contentstack/cli-cm-export-to-csv`) and command id are unchanged. Only matters if you had bookmarked/vendored the source path.

### 4.3 Interactive prompt library swapped (internal, no behavior change)
- **1.x:** `src/utils/interactive.ts` used `inquirer` + `inquirer-checkbox-plus-prompt`.
- **2.x:** rewritten on `@inquirer/prompts` (`select`, `checkbox`, `confirm`).
- **Impact:** the interactive flow (choosing action/org/stack/branch/content-types) is functionally identical. No flag or output change. Listed only for completeness.

### 4.4 Org-user pagination refactor (internal)
- `src/utils/api-client.ts` `getOrgUsers`/`getUsers` were refactored in 2.x: owner-invitation handling simplified, page size now driven by `config.limit`, and the recursion terminates on a short page instead of an empty one.
- **Impact:** same CSV output for `--action users`. Behavioral nuance only; no interface change.

---

## 5. Config / output behavior (unchanged)

`src/config/index.ts` is **identical** across versions — no config keys added or removed. Output artifacts are unchanged:

- **entries:** `<stackName>_<contentType>_<locale>_entries_export.csv`
- **users:** `<org-name>_users_export.csv`
- **teams:** 3 files (see §6.1)
- **taxonomies:** `<stackName>_taxonomies.csv`

Delimiter still defaults to `,` and is overridable with `--delimiter`.

---

## 6. Verdict on the two beta-changelog claims

Both claims were checked against `cli @ v1.59.0`. **Neither is new in v2 — both pre-existed in v1.** (This matches the pattern seen elsewhere in this migration project, where beta-changelog "new" items turned out to already ship in v1.59.0.)

### 6.1 Claim: "teams export generates 3 CSVs" — ❌ NOT new; pre-existed in v1.59.0
`src/utils/teams-export.ts` is **byte-for-byte identical** between `cli @ v1.59.0` and `cli-plugins @ v2-dev`. It writes exactly three CSVs in both:
1. **Org teams** — `<org-name>_teams_export.csv` (`teams-export.ts:77-79`).
2. **Team user details** — `<org-name>_team_User_Details_export.csv`, or `..._team_<teamUid>_User_Details_export.csv` when `--team-uid` is passed (`teams-export.ts:118-121` / `145-148`).
3. **Stack role mapping** — `Stack_Role_Mapping[_<teamUid>].csv` (`teams-export.ts:219-223`).

The 3-CSV teams output is long-standing v1 behavior (it predates even the v1.56.0 TypeScript rewrite). **Verdict: pre-existing.**

### 6.2 Claim: "taxonomy fallback locale support" — ❌ NOT new; pre-existed in v1.59.0
The `--include-fallback` (boolean, default `false`) and `--fallback-locale` (string) flags are present in the **identical** `static flags` block of `src/commands/cm/export-to-csv.ts` in both versions (`export-to-csv.ts:157-171`). They are threaded through `exportTaxonomiesData → createTaxonomyAndTermCsvFile` as `include_fallback` / `fallback_locale` in both (`export-to-csv.ts` taxonomy path, identical).

Git history in `contentstack/cli` shows the feature landed in commit `d364abf80` *"feat: Added taxonomy localization support in export-to-csv"* (2025-10-16), first released in tag **v1.52.0** — well before the v1.59.0 baseline. **Verdict: pre-existing (since v1.52.0).**

---

## 7. README / doc accuracy

- **"See code" link — v1.59.0:** `https://github.com/contentstack/cli/blob/main/packages/contentstack-export-to-csv/src/commands/cm/export-to-csv.js` — points at the **`.js`** path in the **`cli`** repo. (The bundled v1.59.0 source is actually `.ts`, so the `.js` link is a legacy artifact of the pre-rewrite README, but it resolves to the right area.)
- **"See code" link — v2-dev:** `https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-export-to-csv/src/commands/cm/export-to-csv.ts` — points at the **`.ts`** path in the **`cli-plugins`** repo. **Accurate:** the file exists at that path on `cli-plugins@main` (verified via `git ls-tree origin/main`), and the `/blob/main/` branch segment is correct.
- **Version banner (v2 README):** `@contentstack/cli-cm-export-to-csv/2.0.0-beta.9 darwin-arm64 node-v22.21.1` — consistent with the `>=22` engine bump.

No doc-accuracy defects found for the v2 README of this command (unlike `cm:stacks:export`, whose `--branch` help text is stale).

---

## 8. Migration checklist

- [ ] Node runtime upgraded to **`>=22`** (§4.1) — the only hard requirement.
- [ ] Reinstall the plugin from npm (`@contentstack/cli-cm-export-to-csv`, now sourced from `cli-plugins`) (§4.2).
- [ ] No script changes needed — all flags, `--action` values, delimiters, and CSV filenames are unchanged.
- [ ] (Optional) Update any bookmarked source links from `cli/.../export-to-csv.js` to `cli-plugins/.../export-to-csv.ts`.

---

## 9. Agent rules: 1.x → 2.x command translation

For `cm:export-to-csv`, translation is the identity function.

1. **Command id:** `cm:export-to-csv` → `cm:export-to-csv` (unchanged).
2. **Flags:** pass through **verbatim**. No renames, no short-char expansions, no removals apply to this command.
3. **`--action` value:** must be one of `entries | users | teams | taxonomies` (unchanged enum). Flag anything else as an error.
4. **Environment:** if advising on setup, note the runtime must be **Node >= 22**.
5. **Never invent flags.** If a flag isn't in §3, keep it and note it's unverified.

**Worked example**
Input: `csdx cm:export-to-csv --action taxonomies --alias prod --locale en-us --include-fallback --fallback-locale fr-fr --delimiter '|'`
Output: *(identical)* — valid on 2.x as-is.
Warnings: none, beyond ensuring the host runs Node >= 22.
