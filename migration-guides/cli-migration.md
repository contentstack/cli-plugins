# Migration Guide — `@contentstack/cli-migration` (Migration plugin) · 1.x → 2.x

> Command: `csdx cm:stacks:migration`
> Package: `@contentstack/cli-migration`  ·  v1 line: `1.x` (official release `1.11.0`)  ·  v2 line: `2.x` (`2.0.0-beta.15`)
> Status: verified against code — v1 = `contentstack/cli @ v1.59.0` (`cli-migration 1.11.0`) cross-checked with `contentstack/cli-plugins @ origin/main`, v2 = `contentstack/cli-plugins @ origin/v2-dev`.

This guide is written to be read by **both a human and an LLM/agent**. If you feed this file to an agent along with a 1.x command, the [Command Translation Rules](#8-agent-rules-1x--2x-command-translation) section is enough to emit the correct 2.x command.

---

## 1. At a glance

| Area | 1.x | 2.x | Action needed |
|---|---|---|---|
| Command id | `cm:stacks:migration` | `cm:stacks:migration` | none (id unchanged) |
| Alias | `cm:migration` worked | **still works** (retained) | none |
| Node.js | `>=8.3.0` (official `1.11.0`) | **`>=22.0.0`** | upgrade Node runtime |
| Short char `-k` (`--stack-api-key`) | worked | **still works** | none — **`-k` was NOT removed** |
| Short char `-B` (`--branch`) | worked | **removed** | use long flag `--branch` |
| Short char `-A` (`--authtoken`) | worked (hidden) | **removed** | use `--alias` or login session |
| Short char `-n` (`--filePath`) | worked (hidden) | **removed** | use `--file-path` |
| Short char `-k` on hidden `--api-key` | worked | **removed** | use `--stack-api-key` / `-k` |
| Deprecation warnings (`printFlagDeprecation`) | printed on legacy flags | **removed** (no warning) | switch to canonical flags anyway (§3) |
| Custom `.js` migration scripts | `require()`-loaded | **identical** | **none — not a breaking change** (§4.3) |
| Multiple-script run | `--multiple` (and hidden `--multi`) | `--multiple` (hidden `--multi` still works) | none — `--multiple` is **not** new (§4.2) |

**Nothing about a normal `--stack-api-key`/`--alias` + `--file-path` migration changes.** The common path still works verbatim, `-k` included.

---

## 2. Quick command translation (copy-paste)

| 1.x command | 2.x command |
|---|---|
| `csdx cm:migration --file-path ./m.js -k <key>` | `csdx cm:stacks:migration --file-path ./m.js -k <key>` (unchanged; alias still resolves) |
| `csdx cm:stacks:migration -k <key> --file-path ./m.js` | `csdx cm:stacks:migration -k <key> --file-path ./m.js` (identical — `-k` retained) |
| `csdx cm:stacks:migration --file-path ./m.js -B development` | `csdx cm:stacks:migration --file-path ./m.js --branch development` |
| `csdx cm:stacks:migration -n ./m.js -k <key>` | `csdx cm:stacks:migration --file-path ./m.js -k <key>` |
| `csdx cm:stacks:migration --filePath ./m.js -k <key>` | `csdx cm:stacks:migration --file-path ./m.js -k <key>` |
| `csdx cm:stacks:migration --api-key <key> --file-path ./m.js` | `csdx cm:stacks:migration --stack-api-key <key> --file-path ./m.js` |
| `csdx cm:stacks:migration -A --api-key <key> --file-path ./m.js` | `csdx cm:stacks:migration --file-path ./m.js -k <key>` (auth via active login session) |
| `csdx cm:stacks:migration --management-token-alias <a> --file-path ./m.js` | `csdx cm:stacks:migration --alias <a> --file-path ./m.js` |
| `csdx cm:stacks:migration --multi --file-path ./scripts/` | `csdx cm:stacks:migration --multiple --file-path ./scripts/` |

---

## 3. Flag reference — 1.x → 2.x

Canonical flags **unchanged / safe** in 2.x (verified `src/commands/cm/stacks/migration.ts` lines 53–108, `origin/v2-dev`):
`--stack-api-key/-k`, `--alias/-a`, `--file-path`, `--branch` (long form), `--config-file`, `--config`, `--multiple`.

> **`-k` is retained.** `--stack-api-key` still declares `char: 'k'` (v2 line 53–54). A prior draft claimed `-k` was removed — that is **wrong**. What was removed is the *duplicate* `-k` that the hidden legacy `--api-key` flag also declared in v1 (v1 line 84–89); dropping it just makes `-k` unambiguous.

Removed / changed:

| 1.x flag | v1 status | 2.x | Replacement |
|---|---|---|---|
| `-B` (short for `--branch`) | worked; printed deprecation | **short char removed** | `--branch` |
| `-A`, `--authtoken` | hidden; deprecation shim | **short char `-A` removed; flag still hidden, no warning** | omit — auth via active `csdx auth:login` session or `--alias` |
| `-n` (short for `--filePath`) | hidden alias of `--file-path` | **short char removed** | `--file-path` |
| `--filePath` | hidden alias; deprecation shim | **still works (hidden), no warning** | `--file-path` |
| `--api-key` (+ its `-k`) | hidden alias of `--stack-api-key`; deprecation shim | **`-k` removed; flag still hidden, no warning** | `--stack-api-key` / `-k` |
| `--management-token-alias` | hidden alias of `--alias`; deprecation shim | **still works (hidden), no warning** | `--alias` / `-a` |
| `--multi` | hidden alias of `--multiple`; deprecation shim | **still works (hidden), no warning** | `--multiple` |

> **Deprecation shims gone.** In v1 every legacy flag above ran `printFlagDeprecation(...)` in its `parse` (v1 lines 68, 87, 94, 101, 105, 111) which printed a "flag is deprecated, use X" notice. In v2 all six shims (`branch`, `authtoken`, `management-token-alias`, `filePath`, `multi`, `api-key`) are removed. The legacy long-form flags themselves (except the dropped short chars) **still exist as hidden flags and still function** — `run()` reads `filePath`, `multi`, `api-key`, and `management-token-alias` (v2 lines 121–125) — they just no longer warn. Treat them as unsupported and migrate to the canonical flags.

---

## 4. Breaking / behavioral changes (migration-specific)

### 4.1 Node runtime `>=8.3.0` → `>=22.0.0`
- **v1 (official `1.11.0`, `cli @ v1.59.0`):** `engines.node` = `>=8.3.0`.
- **v2 (`2.0.0-beta.15`):** `engines.node` = `>=22.0.0`.
- **Fix:** upgrade your Node runtime before installing. (Note: the later v1 maintenance snapshot on `cli-plugins@main`, `1.12.4`, already declares `>=22.0.0`; the real jump is from the `1.11.0`-era `>=8.3.0`.)

### 4.2 `--multiple` is NOT new; `--multi` is the old deprecated alias
- **Claim checked:** "beta adds a `--multiple` flag for batch runs." **False.** `--multiple` (boolean) exists in **both** v1 (line 61) and v2 (line 78) as a visible flag.
- `--multi` is the *older* hidden alias of `--multiple` (v1 line 110 with a deprecation shim; v2 line 106, hidden, shim removed). `run()` collapses them: `const multi = flags.multiple || flags.multi` (v2 line 122).
- **Fix:** prefer `--multiple`; `--multi` still works but is undocumented and unsupported.

### 4.3 Custom `.js` migration scripts load identically — NOT breaking
- Both versions resolve and load the user script the same way: `execSingleFile` does `require(pathValidator(filePath))` (v1/v2 line 217), and `execMultiFiles` iterates `.js` files in the folder and calls `execSingleFile` per file (v1/v2 lines 245–256).
- The script contract is unchanged: `module.exports = async ({ migration, stackSDKInstance }) => { ... }`.
- **Impact:** none. Existing migration scripts run unchanged in 2.x. **This is explicitly not a breaking change.**

### 4.4 Loss of deprecation warnings
- Scripts/CI that scraped stdout for the "flag is deprecated" lines will no longer see them (§3). No error is raised; the legacy flags simply run silently.
- **Fix:** stop relying on the warning text; switch to canonical flags.

### 4.5 `cm:migration` alias retained
- Unlike some other 2.x plugins, `cm:migration` is **not** removed — `static aliases = ['cm:migration']` is present in both v1 and v2 (line 113). `csdx cm:migration …` still resolves. No action required, though `cm:stacks:migration` is the canonical id.

---

## 5. Authentication behavior (unchanged)

The auth resolution in `run()` is identical between v1 and v2 (v2 lines 123–195):

1. If `--alias` (or hidden `--management-token-alias`) is given, the management token for that alias is used.
2. Otherwise, if an auth token is present (`isAuthenticated()` — i.e. you ran `csdx auth:login`), the current session is used with the API key.
3. If neither an auth token nor an alias is available, the command logs *"AuthToken is not present … use 'csdx auth:login' … or provide management token alias"* and exits.

The only auth-related change is cosmetic: the `-A/--authtoken` **short char** is gone and its deprecation warning is gone. You never needed `-A` explicitly — an active login session is detected automatically.

---

## 6. New in migration 2.x (additive)

- Nothing functionally new was added to this command in the inspected `v2-dev` code. The 2.x diff is entirely **removals** (short chars, deprecation shims) plus the Node bump and code-style/formatting changes. `--multiple`, `--config`, `--config-file`, `--branch`, and the `.js` script contract all pre-date 2.x.

---

## 7. Migration checklist

- [ ] Node runtime upgraded to `>=22.0.0` (§4.1).
- [ ] `-B` → `--branch` in all scripts (§3).
- [ ] `-n` / `--filePath` → `--file-path` (§3).
- [ ] `--api-key` → `--stack-api-key` (and drop any `-k` that was meant for `--api-key` — `-k` now means `--stack-api-key` only) (§3).
- [ ] `--management-token-alias` → `--alias` (§3).
- [ ] `-A` / `--authtoken` removed; rely on `csdx auth:login` session or `--alias` (§3, §5).
- [ ] `--multi` → `--multiple` (§4.2).
- [ ] Keep `-k` where it already means `--stack-api-key` — no change needed.
- [ ] Custom `.js` migration scripts: no change needed (§4.3).
- [ ] CI that parsed deprecation-warning output updated (§4.4).

---

## 8. Agent rules: 1.x → 2.x command translation

An agent given a 1.x `cm:migration`/`cm:stacks:migration` command should apply these rules in order and output the 2.x equivalent:

1. **Command:** `cm:migration` and `cm:stacks:migration` both still resolve — leave either as-is (prefer canonical `cm:stacks:migration`).
2. **Keep unchanged:** `--stack-api-key`/`-k`, `--alias`/`-a`, `--file-path`, `--branch` (long), `--config`, `--config-file`, `--multiple`. **Do not touch `-k`.**
3. **Short-char expansions (short char removed in 2.x):** `-B`→`--branch`, `-n`→`--file-path`.
4. **Legacy long-flag renames (value-preserving):**
   - `--filePath` → `--file-path`
   - `--api-key` → `--stack-api-key`
   - `--management-token-alias` → `--alias`
   - `--multi` → `--multiple`
5. **Dropped with no 1:1 replacement — flag and warn:**
   - `-A` | `--authtoken`: remove; tell the user auth comes from an active `csdx auth:login` session or from `--alias <management_token_alias>`.
   - A `-k` that was attached to `--api-key`: `-k` now maps only to `--stack-api-key`; keep it, it resolves correctly.
6. **Custom `.js` script path:** unchanged — pass through the value of `--file-path` verbatim.
7. **Never invent flags.** If a 1.x flag isn't in this guide, keep it and note it's unverified.

**Worked example**
Input: `csdx cm:migration --filePath ./m.js --api-key blt123 -B dev -A --multi`
Output: `csdx cm:stacks:migration --file-path ./m.js --stack-api-key blt123 --branch dev --multiple`
Warnings: dropped `-A` (auth via active login session or `--alias`); `-B`→`--branch`, `--filePath`→`--file-path`, `--api-key`→`--stack-api-key`, `--multi`→`--multiple`.

