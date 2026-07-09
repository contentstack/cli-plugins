# Migration Guide — `@contentstack/apps-cli` (Apps / Developer Hub plugin) · 1.x → 2.x

> Commands: `app:create`, `app:delete`, `app:deploy`, `app:get`, `app:install`, `app:reinstall`, `app:uninstall`, `app:update`
> Package: `@contentstack/apps-cli`  ·  v1 line: `1.x` (baseline ref `origin/main` = `1.7.1`, last true v1 = `1.7.0`)  ·  v2 line: `2.x` (`2.0.0-beta.2`)
> Status: verified against code — v1 = `contentstack/cli-plugins @ origin/main`, v2 = `contentstack/cli-plugins @ origin/v2-dev`. The apps plugin is an **external** plugin; it is **not** part of the `contentstack/cli` monorepo `v1.59.0`.

This guide is written to be read by **both a human and an LLM/agent**. If you feed this file to an agent along with a 1.x command, the [Command Translation Rules](#7-agent-rules-1x--2x-command-translation) section is enough to emit the correct 2.x command.

---

## 1. At a glance

| Area | 1.x | 2.x | Action needed |
|---|---|---|---|
| Command set | 8 commands | **same 8 commands** | none — no command added or removed |
| Command ids | `app:create/delete/deploy/get/install/reinstall/uninstall/update` | **unchanged** | none |
| Aliases | none defined | none defined | none |
| Node.js | `>=16` (published 1.7.0 and earlier) | **`>=22`** | upgrade Node runtime (§2) |
| `app:create` `--name` short `-n` | worked (`-n <name>`) | **`-n` removed** | use long flag `--name` (§3.1) |
| `app:install` `--stack-api-key` short | long form only | **`-k` added** | additive; `--stack-api-key` still works (§3.2) |
| `app:reinstall` `--stack-api-key` short | long form only | **`-k` added** | additive; `--stack-api-key` still works (§3.2) |
| Package chalk dep | `chalk@^4` (CJS) | `chalk@^5` (ESM) + `init` hook `load-chalk` | internal only — no user action |
| README "See code" links | point to `main` (correct for v1) | still hardcoded to **`blob/main`** (points at v1 source) | doc bug — see §4 |

**The overwhelming majority of apps commands are byte-for-byte identical between 1.x and 2.x.** Only three flag-level changes exist (`create -n` removed; `install`/`reinstall` gain `-k`), plus the Node bump. There are **no** behavioral/output changes in the command logic itself — the eight command `run()` bodies are unchanged.

---

## 2. Node.js bump: `>=16` → `>=22`

- **v1 published line:** `package.json` `engines.node` was **`>=16`** through `1.7.0`.
- The bump to **`>=22.0.0`** landed in commit `df4fe437` ("Upgraded Node version to 22 for plugins and Readme Update"), shipped as `1.7.1` on `origin/main`, and carries into v2 `2.0.0-beta.2`. Both `origin/main` (1.7.1) and `origin/v2-dev` now declare `"node": ">=22.0.0"`.
- **Net effect for a user upgrading from a real v1 install (≤1.7.0):** Node must go from `>=16` to `>=22`.
- ⚠️ **README banner is misleading (doc-gen artifact):** the v2 README usage banner reads `@contentstack/apps-cli/2.0.0-beta.2 darwin-arm64 node-v18.20.2` — it was generated on a machine running Node 18 even though the package **requires `>=22`**. Ignore the `node-v18` string; the enforced requirement is `>=22`. (The v1 README banner similarly shows a stale version `1.6.1` while `package.json` is `1.7.1`.)

---

## 3. Flag reference — 1.x → 2.x

Flags shared by **all 8 commands** (from `base-command.ts` `baseFlags`, unchanged v1↔v2): `--org` (no short char), `--yes` / `-y` (hidden, skip-confirmation). `--config` / `-c` exists only on `app:create` and `app:deploy` (per-command, not a base flag).

### 3.1 `app:create` — `--name` lost its `-n` short char  ⚠️ breaking

| Flag | v1 | v2 | Note |
|---|---|---|---|
| `--name` | `-n`, `--name` | **`--name` only** | short char `-n` removed |
| `--app-type` | `--app-type` (default `stack`, enum `stack\|organization`) | unchanged | |
| `--config` / `-c` | unchanged | unchanged | |
| `--data-dir` / `-d` | unchanged | unchanged | |
| `--boilerplate` | unchanged | unchanged | |
| `--org`, `--yes`/`-y` | base flags | unchanged | |

- **Verified:** `src/commands/app/create.ts` on `origin/main` declares `name: flags.string({ char: "n", ... })`; on `origin/v2-dev` it declares `name: flags.string({ description: ... })` with **no `char`**.
- **Answer to the DX-9363 question:** the `-n` removal **is in `origin/v2-dev` TODAY** — not merely on the `origin/fix/DX-9363` branch. `fix/DX-9363` was merged into `v2-dev` via **PR #261** (merge commit `e22e8b6a`, confirmed by `git branch -r --contains`). The DX-9363 commit `1fcb2658` ("updated short flags of external commands") is the single source of all three flag changes in this guide.
- **Fix:** replace `-n <name>` with `--name <name>`.

### 3.2 `app:install` / `app:reinstall` — `--stack-api-key` gained `-k`  (additive, non-breaking)

| Flag | v1 | v2 |
|---|---|---|
| `--stack-api-key` | `--stack-api-key` (long only) | **`-k`, `--stack-api-key`** |

- **Verified:** `git diff origin/main origin/v2-dev` on both `install.ts` and `reinstall.ts` shows exactly one added line — `char: "k",` on the `stack-api-key` flag.
- Purely additive: existing scripts using `--stack-api-key` keep working; `-k` is a new convenience alias.
- Full flag set for both commands (unchanged otherwise): `--app-uid`, `--stack-api-key`/`-k`, `--org`, `--yes`/`-y`.

### 3.3 Commands with **no flag changes** (identical v1↔v2)

`git diff origin/main origin/v2-dev` returns **empty** for each of these command files (and for `base-command.ts`, `app-cli-base-command.ts`, and `app/index.ts`):

| Command | Flags (v1 = v2) |
|---|---|
| `app:delete` | `--app-uid`, `--org`, `--yes`/`-y` |
| `app:deploy` | `--app-uid`, `--hosting-type` (enum `hosting-with-launch\|custom-hosting`), `--app-url`, `--launch-project` (enum `existing\|new`), `--config`/`-c`, `--org`, `--yes`/`-y` |
| `app:get` | `--app-uid`, `--app-type` (default `stack`, enum `stack\|organization`), `--data-dir`/`-d`, `--org`, `--yes`/`-y` |
| `app:uninstall` | `--app-uid`, `--installation-uid`, `--uninstall-all`, `--org`, `--yes`/`-y` |
| `app:update` | `--app-manifest`, `--org`, `--yes`/`-y` |

No removed flags, no renamed flags, no changed defaults, no removed aliases on any of these five.

---

## 4. README / doc-gen accuracy issues (v2 `origin/v2-dev`)

Verified against `packages/contentstack-apps-cli/README.md` and `package.json` on `origin/v2-dev`:

1. **"See code" links point to the wrong branch.** v2 `package.json` adds `oclif.repositoryPrefix = ".../blob/main/packages/contentstack-apps-cli/<commandPath>"`. Because it is hardcoded to `blob/main`, every generated "See code:" link in the v2 README resolves to source on the **`main` branch (v1.7.x)**, not the v2 code. A reader clicking "See code" for `app:create` lands on the v1 file that **still has `-n`**, contradicting the v2 behavior in §3.1. Fix: point `repositoryPrefix` at the v2 branch/tag (or a version-pinned ref) before GA.
2. **Usage-banner Node string is stale/misleading:** README shows `node-v18.20.2` while the package requires `>=22` (see §2). Regenerate the README on a Node 22 host.
3. **Version banner drift** is a known doc-gen pattern here — the v1 README banner shows `1.6.1` vs `package.json` `1.7.1`. Cosmetic; regenerate via `oclif readme`.

(v1's `package.json` has **no** `repositoryPrefix`; its README links to `blob/main` too, which is correct for v1 since v1 source lives on `main`.)

---

## 5. Command additions / removals

None. All eight commands (`create`, `delete`, `deploy`, `get`, `install`, `reinstall`, `uninstall`, `update`) plus the `app` topic command (`app/index.ts`) exist on both `origin/main` and `origin/v2-dev` (verified via `git ls-tree`). No command was added, removed, or renamed. No command aliases are defined in either version.

---

## 6. Migration checklist

- [ ] Node runtime upgraded to `>=22`.
- [ ] `app:create -n <name>` → `app:create --name <name>` in all scripts (§3.1).
- [ ] (Optional) adopt `-k` as shorthand for `--stack-api-key` on `app:install`/`app:reinstall` (§3.2) — not required.
- [ ] Ignore the `node-v18.20.2` string in the v2 README banner; the real requirement is `>=22` (§2).
- [ ] Don't rely on the v2 README "See code" links for v2 source — they point at the `main` (v1) branch (§4).

---

## 7. Agent rules: 1.x → 2.x command translation

An agent given a 1.x apps command should apply these rules and output the 2.x equivalent:

1. **Command ids:** unchanged. Never rewrite the command id; there are no aliases to expand.
2. **`app:create` only — expand `-n`:** replace `-n <value>` with `--name <value>`. This is the single breaking flag change.
3. **`-k` is safe to keep or introduce** on `app:install`/`app:reinstall` (alias of `--stack-api-key`); do not remove `--stack-api-key`.
4. **All other flags pass through unchanged** — `--app-uid`, `--app-type`, `--data-dir`/`-d`, `--config`/`-c`, `--boilerplate`, `--hosting-type`, `--app-url`, `--launch-project`, `--installation-uid`, `--uninstall-all`, `--app-manifest`, `--org`, `--yes`/`-y`.
5. **Environment:** if the runtime is Node `<22`, warn that v2 requires `>=22`.
6. **Never invent flags.** If a 1.x flag isn't in this guide, keep it and note it's unverified.

**Worked example**
Input: `csdx app:create -n "My App" --app-type organization --org blt123`
Output: `csdx app:create --name "My App" --app-type organization --org blt123`
Warnings: expanded `-n`→`--name` (v2 removed the `-n` short char); ensure Node `>=22`.
