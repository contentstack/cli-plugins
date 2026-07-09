# Migration Guide — `@contentstack/cli-cm-seed` (Seed plugin) · 1.x → 2.x

> Command: `csdx cm:stacks:seed`
> Package: `@contentstack/cli-cm-seed`  ·  v1 line: `1.x` (e.g. `1.14.3`)  ·  v2 line: `2.x` (e.g. `2.0.0-beta.22`)
> Status: verified against code — v1 = `contentstack/cli @ v1.59.0` (`packages/contentstack-seed`, `1.14.3`), v2 = `contentstack/cli-plugins @ origin/v2-dev` (`packages/contentstack-seed`, `2.0.0-beta.22`). v1 doc = the [Seed command docs](https://www.contentstack.com/docs/developers/cli/import-content-using-the-seed-command).

This guide is written to be read by **both a human and an LLM/agent**. If you feed this file to an agent along with a 1.x command, the [Command Translation Rules](#7-agent-rules-1x--2x-command-translation) section is enough to emit the correct 2.x command.

---

## 1. At a glance

| Area | 1.x | 2.x | Action needed |
|---|---|---|---|
| Command id | `cm:stacks:seed` | `cm:stacks:seed` | none (id unchanged) |
| Alias | `cm:seed` also worked | **removed** | replace `cm:seed` → `cm:stacks:seed` |
| Node.js | `>=14` | **`>=22`** | upgrade Node runtime |
| `-s` / `--stack` flag | deprecated alias of `--stack-api-key` | **removed → hard error** | use `--stack-api-key` / `-k` (§3) |
| Short char `-r` (`--repo`) | worked (deprecated) | **removed** | use `--repo` |
| Short char `-o` (`--org`) | worked (deprecated) | **removed** | use `--org` |
| Short char `-l` (`--fetch-limit`) | worked (hidden) | **removed** | use `--fetch-limit` (still hidden) |
| `--yes` / `-y` type | value flag (`-y <value>`) | **boolean** (`-y`, no value) | drop the value after `-y` (§4.1) |
| `--locale` default | none (undefined) | **`en-us`** | master locale now defaults to `en-us` (§4.2) |
| `org`/`stack-api-key`/`stack-name` exclusivity | partial | **mutually exclusive set** | don't combine them (§4.3) |

**Nothing about a normal `--repo`/`--stack-api-key`/`--org --stack-name` seed changes.** The common path still works verbatim — only short chars, the `--stack` alias, and the `cm:seed` alias are gone.

---

## 2. Quick command translation (copy-paste)

| 1.x command | 2.x command |
|---|---|
| `csdx cm:seed` | `csdx cm:stacks:seed` |
| `csdx cm:stacks:seed -r "account/repo"` | `csdx cm:stacks:seed --repo "account/repo"` |
| `csdx cm:stacks:seed -o <org_uid> -n <name>` | `csdx cm:stacks:seed --org <org_uid> --stack-name <name>` |
| `csdx cm:stacks:seed -s <stack_uid>` | `csdx cm:stacks:seed --stack-api-key <stack_api_key>` (`-k`) |
| `csdx cm:stacks:seed -l 100` | `csdx cm:stacks:seed --fetch-limit 100` |
| `csdx cm:stacks:seed -y true` | `csdx cm:stacks:seed -y` (boolean — no value) |
| `csdx cm:stacks:seed -k <key> -a <alias>` | `csdx cm:stacks:seed -k <key> -a <alias>` (unchanged) |

---

## 3. Flag reference — 1.x → 2.x

Canonical flags that are **unchanged (safe)**: `--stack-api-key` / `-k`, `--stack-name` / `-n`, `--alias` / `-a`. The `--yes` / `-y` short char is kept, but its *type* changed (§4.1).

Verified in v2 code — `cli-plugins/packages/contentstack-seed/src/commands/cm/stacks/seed.ts`:
- `repo` (no char) — line 20
- `org` (no char, `exclusive: ['stack-api-key']`) — line 25
- `stack-api-key` / `-k` (`exclusive: ['org', 'stack-name']`) — line 31
- `stack-name` / `-n` (`exclusive: ['stack-api-key']`) — line 38
- `fetch-limit` (no char, `hidden`) — line 45
- `yes` / `-y` (`flags.boolean`) — line 51
- `alias` / `-a` — line 56
- `locale` (no char, `hidden`, `default: 'en-us'`) — line 60

Removed / changed vs v1 (`cli/packages/contentstack-seed/src/commands/cm/stacks/seed.ts @ v1.59.0`):

| 1.x flag | v1 status | 2.x | Replacement |
|---|---|---|---|
| `-s`, `--stack` | deprecated alias of `-k` (v1 line 70, `parse: printFlagDeprecation`) | **removed** (no `stack` flag in v2) | `--stack-api-key` / `-k` |
| `-r` (short for `--repo`) | worked, deprecated (v1 line 27) | **short char removed** | `--repo` |
| `-o` (short for `--org`) | worked, deprecated (v1 line 34) | **short char removed** | `--org` |
| `-l` (short for `--fetch-limit`) | worked, hidden (v1 line 56) | **short char removed** | `--fetch-limit` (still hidden) |
| `cm:seed` alias | worked (v1 line 87, `static aliases = ['cm:seed']`) | **removed** (no `static aliases` in v2) | `cm:stacks:seed` |

> **v1 doc note:** the official v1 [Seed docs](https://www.contentstack.com/docs/developers/cli/import-content-using-the-seed-command) list `-r/--repo`, `-o/--org`, `-k/--stack-api-key`, `-n/--stack-name`, `-a/--alias`, `-s/--stack`, `-y/--yes` and document `-s`/`--stack` as active. In 2.x, `--stack` is gone and the `-r`/`-o` short chars no longer resolve. The doc does **not** mention `--locale`, `--fetch-limit`, or the `cm:seed` alias (all real in 1.x but hidden/undocumented).

---

## 4. Breaking behavioral changes (seed-specific)

### 4.1 `--yes` / `-y` is now a boolean flag
- **1.x:** declared as `flags.string` — usage was `[-y <value>]`, i.e. `-y` expected a value (`cm:stacks:seed -y true`). It was consumed as `skipStackConfirmation: seedFlags['yes']` (v1 line ~110).
- **2.x:** declared as `flags.boolean` (`seed.ts` line 51) — usage is `[-y]`. Pass `-y` / `--yes` with **no value** to skip the stack confirmation.
- **Fix:** drop any value after `-y`. `-y true` will now error (unexpected argument) or treat `true` as a positional.

### 4.2 `--locale` now defaults to `en-us`
- **1.x (`v1.59.0`):** `locale` flag was `hidden` with **no default** (v1 line 81). `master_locale` passed through as `undefined` unless the user set `--locale`.
- **2.x:** `locale` is still `hidden` but now has `default: 'en-us'` (`seed.ts` line 62). New stacks created by seed get master locale `en-us` unless overridden with `--locale`.
- **Impact:** only matters when creating a **new** stack (`--org --stack-name`) and relying on a different master locale. Pass `--locale <code>` explicitly if you need something other than `en-us`.

### 4.3 `org` / `stack-api-key` / `stack-name` are a mutually-exclusive set
- **2.x** tightens exclusivity: `org` is `exclusive: ['stack-api-key']`, `stack-api-key` is `exclusive: ['org', 'stack-name']`, `stack-name` is `exclusive: ['stack-api-key']` (`seed.ts` lines 29, 36, 43).
- **Meaning:** you either target an **existing stack** (`--stack-api-key`) *or* **create a new one** (`--org` + `--stack-name`) — never both. Combining `--stack-api-key` with `--org`/`--stack-name` now errors instead of being silently resolved.

### 4.4 `cm:seed` alias removed
- Only `cm:stacks:seed` resolves in 2.x. `csdx cm:seed …` → "command not found." Update scripts.

---

## 5. New in seed 2.x (additive)

There are **no genuinely new user-facing flags** in seed 2.x. Two flags are sometimes reported as "new in beta" — they are **not**:

- **`--fetch-limit`** — *already existed in 1.x* (v1 `seed.ts` line 55, hidden, with short char `-l`). In 2.x it is unchanged except the `-l` short char was dropped (`seed.ts` line 45). Purpose: **limits the number of organizations or stacks fetched** for the interactive selection prompt (`description: 'Limit for number of organizations or stacks to be fetched.'`). Still `hidden: true`.
- **`--locale`** — *already existed in 1.x* (v1 `seed.ts` line 81, hidden, no default). In 2.x it gains `default: 'en-us'` (`seed.ts` line 60). Purpose: **master locale of the (new) stack** (`description: 'Master Locale of the stack'`), wired to `master_locale` in the seeder options. Still `hidden: true`.

> **Correction to the "beta adds `--fetch-limit` and `--locale`" claim:** both flags predate 2.x and are present in the v1.59.0 source. The only 2.x deltas are the removed `-l` short char and the new `en-us` default on `--locale`. Both remain hidden (not shown in `--help`).

The 2.x seed still uses the same curated official-repo list + arbitrary GitHub repo import model described in the README; no new command surface was added.

---

## 6. README / doc accuracy (v2 `packages/contentstack-seed/README.md`)

Issues found in the auto-generated v2 README (verified against `seed.ts @ v2-dev`):

1. **"See code" link points to the wrong branch.** The README links to
   `https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-seed/src/commands/cm/stacks/seed.ts`.
   The `main` branch of `cli-plugins` currently holds the **1.15.7 (v1-line)** code, not the 2.x code being documented (which lives on `v2-dev`). The link should target the v2 branch/tag (e.g. `v2-dev` or the release tag), not `blob/main`. (For reference, the v1 README in the `cli` repo linked to `contentstack/cli/blob/main/...`.)
2. **`Advanced Flags` section uses the removed `-r` short char.** Examples such as `csdx cm:stacks:seed -r "account/repository"` and `csdx cm:stacks:seed -r "account"` appear multiple times. `--repo` **no longer has a `-r` short char** in 2.x (`seed.ts` line 20 has no `char`). These examples are invalid — they must use `--repo`.
3. **References the removed export `-A` flag.** The section says *"running `csdx cm:stacks:export -A` … should work"*. `-A` (auth-token) was **removed** from export in 2.x. Stale cross-reference.
4. **Hidden flags absent from the `FLAGS` block.** The README `FLAGS` list omits `--fetch-limit` and `--locale` because both are `hidden: true`. This is expected oclif behavior, but users migrating from 1.x should know these flags still exist (see §5).
5. **Documentation footer link uses a legacy path.** The bottom link is `.../docs/headless-cms/import-content-using-the-seed-command`; the canonical CLI doc path is `.../docs/developers/cli/import-content-using-the-seed-command`.

---

## 7. Migration checklist

- [ ] Node runtime upgraded to `>=22`.
- [ ] `cm:seed` → `cm:stacks:seed` in all scripts.
- [ ] `-s` / `--stack` replaced with `--stack-api-key` / `-k` (§3).
- [ ] Short chars `-r` / `-o` / `-l` replaced with long flags `--repo` / `--org` / `--fetch-limit`.
- [ ] `-y <value>` calls changed to bare `-y` / `--yes` (now boolean, §4.1).
- [ ] New-stack flows verified for the `--locale` default of `en-us`; pass `--locale` if a different master locale is needed (§4.2).
- [ ] Confirmed no command mixes `--stack-api-key` with `--org`/`--stack-name` (now mutually exclusive, §4.3).
- [ ] README/doc references to `-r` examples, export `-A`, and the `blob/main` "See code" link flagged for correction (§6).

---

## 8. Agent rules: 1.x → 2.x command translation

An agent given a 1.x `cm:seed`/`cm:stacks:seed` command should apply these rules in order and output the 2.x equivalent:

1. **Command:** replace `cm:seed` with `cm:stacks:seed`. Leave `cm:stacks:seed` unchanged.
2. **Flag rename (value-preserving):** `-s` | `--stack` → `--stack-api-key` (`-k`).
3. **Short-char expansions:** `-r`→`--repo`, `-o`→`--org`, `-l`→`--fetch-limit`. (`-k -n -a -y` short chars are unchanged.)
4. **`--yes` / `-y` is boolean:** strip any value that followed it (`-y true` → `-y`).
5. **Exclusivity:** if the command combines `--stack-api-key` with `--org` or `--stack-name`, flag it — 2.x rejects the combination. `--stack-api-key` targets an existing stack; `--org` + `--stack-name` creates a new one.
6. **`--locale` default:** absent `--locale`, 2.x uses `en-us` for a newly created stack. Add `--locale <code>` only if a different master locale is required.
7. **Never invent flags.** If a 1.x flag isn't in this guide, keep it and note it's unverified. Do not treat `--fetch-limit`/`--locale` as new — they existed in 1.x (hidden).

**Worked example**
Input: `csdx cm:seed -r "acme/stack-starter" -s blt123 -l 50 -y true`
Output: `csdx cm:stacks:seed --repo "acme/stack-starter" --stack-api-key blt123 --fetch-limit 50 -y`
Warnings: `cm:seed` alias removed → `cm:stacks:seed`; `-s`/`--stack` removed → `--stack-api-key`; `-r`/`-l` short chars removed → long flags; `-y` is now boolean (dropped the `true` value).
