# Migration Guide — `@contentstack/cli-cm-bootstrap` (Bootstrap plugin) · 1.x → 2.x

> Command: `csdx cm:bootstrap`
> Package: `@contentstack/cli-cm-bootstrap`  ·  v1 line: `1.x` (baseline `1.18.4`, bundled in `contentstack/cli @ v1.59.0`)  ·  v2 line: `2.x` (e.g. `2.0.0-beta.22`)
> Status: verified against code — v1 = `contentstack/cli @ v1.59.0` (`packages/contentstack-bootstrap`), v2 = `contentstack/cli-plugins @ origin/v2-dev` (`packages/contentstack-bootstrap`). Cross-checked against `cli-plugins @ origin/main`.

This guide is written to be read by **both a human and an LLM/agent**. If you feed this file to an agent along with a 1.x command, the [Command Translation Rules](#7-agent-rules-1x--2x-command-translation) section is enough to emit the correct 2.x command.

---

## 1. At a glance

| Area | 1.x | 2.x | Action needed |
|---|---|---|---|
| Command id | `cm:bootstrap` | `cm:bootstrap` | none (id unchanged) |
| Package version | `1.18.4` | `2.0.0-beta.x` | update dependency |
| Node.js | **`>=14`** | **`>=22`** | upgrade Node runtime |
| Deprecated flags `--appName` `--directory` `--appType` | hidden, accepted with a deprecation warning | **removed → unknown-flag error** | use `--app-name`, `--project-dir`, `--app-type` |
| Short chars `-a` (appName) `-d` (directory) `-s` (appType) | worked (hidden aliases) | **removed** for those meanings | see §3 |
| `-a` meaning | **collided**: both `--appName` and `--alias` declared `char: 'a'` | resolves cleanly to `--alias` | `-a` now unambiguously = management-token alias |
| `--yes` / `-y` type | **string** (`flags.string`) | **boolean** (`flags.boolean`) | drop any value; use bare `--yes` |
| `--run-dev-server` | **already present** | present (unchanged) | none — *not a new v2 feature* |
| Live Preview (preview-token) | **already present** | present (unchanged) | none — *not a new v2 feature* |
| "See code" README link | `github.com/contentstack/cli/…` | `github.com/contentstack/cli-plugins/…` | repo moved; link is correct, but `package.json` `homepage` is stale (§5) |

**The core happy path is unchanged.** `csdx cm:bootstrap --app-name <app> --project-dir <dir> [--stack-api-key <key> | --org <uid> --stack-name <name>]` works verbatim in both lines. The breaking changes are the Node bump, the removal of three deprecated hidden flags, and the `--yes` type change.

---

## 2. Quick command translation (copy-paste)

| 1.x command | 2.x command |
|---|---|
| `csdx cm:bootstrap` | `csdx cm:bootstrap` (unchanged) |
| `csdx cm:bootstrap --appName kickstart-next` | `csdx cm:bootstrap --app-name kickstart-next` |
| `csdx cm:bootstrap -a kickstart-next` (meaning appName) | `csdx cm:bootstrap --app-name kickstart-next` |
| `csdx cm:bootstrap --directory ./app` | `csdx cm:bootstrap --project-dir ./app` |
| `csdx cm:bootstrap -d ./app` | `csdx cm:bootstrap --project-dir ./app` |
| `csdx cm:bootstrap --appType starterapp` | `csdx cm:bootstrap --app-type starterapp` |
| `csdx cm:bootstrap -s starterapp` | `csdx cm:bootstrap --app-type starterapp` |
| `csdx cm:bootstrap --yes true` | `csdx cm:bootstrap --yes` |
| `csdx cm:bootstrap --run-dev-server` | `csdx cm:bootstrap --run-dev-server` (unchanged) |
| `csdx cm:bootstrap -a <mgmt-token-alias>` (meaning alias) | `csdx cm:bootstrap --alias <mgmt-token-alias>` (now unambiguous) |

---

## 3. Flag reference — 1.x → 2.x

Verified against `src/commands/cm/bootstrap.ts` in both trees.

Canonical flags **unchanged** (safe in both lines):

| Flag | Short | Notes |
|---|---|---|
| `--app-name` | — | app id (e.g. `kickstart-next`, `kickstart-nuxt`) |
| `--project-dir` | — | target directory |
| `--app-type` | — | `sampleapp` or `starterapp`; **hidden** in both |
| `--stack-api-key` | `-k` | exclusive with `--org` / `--stack-name` |
| `--org` | — | org UID (create new stack); exclusive with `--stack-api-key` |
| `--stack-name` | `-n` | exclusive with `--stack-api-key` |
| `--alias` | `-a` | management-token alias |
| `--run-dev-server` | — | boolean, default `false`; **present in both lines** |

Removed / changed:

| 1.x flag | v1 status | 2.x | Replacement |
|---|---|---|---|
| `--appName`, `-a` | hidden, deprecated (`printFlagDeprecation(['-a','--appName'],['--app-name'])`) | **removed** | `--app-name` |
| `--directory`, `-d` | hidden, deprecated (`printFlagDeprecation(['-d','--directory'],['--project-dir'])`) | **removed** | `--project-dir` |
| `--appType`, `-s` | hidden, deprecated (`printFlagDeprecation(['-s','--appType'],['--app-type'])`) | **removed** | `--app-type` |
| `--yes`, `-y` | `flags.string` (accepted a value) | `flags.boolean` | bare `--yes` / `-y` |

- **Evidence (removed flags):** v1 `packages/contentstack-bootstrap/src/commands/cm/bootstrap.ts:86-112` declares the three deprecated flags under a `// To be deprecated` comment. In v2 that entire block is gone (diff shows lines 86-112 deleted), and the `printFlagDeprecation` import is dropped (v1 `bootstrap.ts:11-18` → v2 `bootstrap.ts:11`).
- **Evidence (`--yes` type):** v1 `bootstrap.ts:76` `yes: flags.string({…})` → v2 `bootstrap.ts:69` `yes: flags.boolean({…})`. Consumption also changed: v1 `bootstrap.ts:160` `const yes = bootstrapCommandFlags.yes as string;` and `bootstrap.ts:184` `if (yes) seedParams.yes = yes;` → v2 `bootstrap.ts:126` `as boolean` and `bootstrap.ts:150` `seedParams.yes = true;`.

> **`-a` disambiguation (subtle but real):** in v1, `char: 'a'` was declared **twice** — once on the deprecated `appName` flag (`bootstrap.ts:88-93`) and once on `alias` (`bootstrap.ts:109-112`). Removing `appName` in v2 leaves `--alias` as the sole owner of `-a` (v2 `bootstrap.ts:75-78`). A 1.x script that used `-a` to mean *app name* must switch to `--app-name`; `-a` in 2.x means the management-token alias only.

---

## 4. Beta changelog claims — verdict

The beta changelog claimed: *"Live Preview 2.0 + auto-publish + `--run-dev-server` flag"* as new in v2. Checked skeptically against the v1.59.0 baseline:

| Claim | Verdict | Evidence |
|---|---|---|
| `--run-dev-server` flag is **new in v2** | ❌ **FALSE — pre-existing in v1.59.0** | v1 `src/commands/cm/bootstrap.ts:77-81` declares `'run-dev-server': flags.boolean({… default: false})` — byte-identical to v2 `bootstrap.ts:70-74`. Runtime handling is identical: v1 `src/bootstrap/index.ts:135-168` vs v2 `index.ts:135-168`. The interactive prompt `inquireRunDevServer()` exists in both (v1 `src/bootstrap/interactive.ts:102`, v2 `interactive.ts:101`). |
| **Live Preview 2.0** is **new in v2** | ❌ **FALSE — pre-existing in v1.59.0** | Live Preview (including the preview-token / "2.0" flow via `create_with_preview_token: true`) is present in v1: `src/bootstrap/utils.ts:107` `.create(body, livePreviewEnabled ? { create_with_preview_token: true } : {})`, identical to v2 `utils.ts:108`. The `inquireLivePreviewSupport()` prompt and `livePreviewEnabled` plumbing exist in both (v1 `interactive.ts:93`, `index.ts:115-125`; v2 `interactive.ts:92`, `index.ts:115-125`). |
| **auto-publish** is **new in v2** | ❌ **FALSE — not new, and no flag** | No `autoPublish` / `auto-publish` / `auto_publish` token exists anywhere in the v2 bootstrap package (`git grep` returns nothing) — nor in v1; there is no `--auto-publish` flag. The official v1 doc *does* describe that "imported content will be automatically published in the target stack after seeding" — i.e. auto-publishing of seeded content is **pre-existing v1 seed behavior**, not a v2 addition and not a CLI flag. |

**Bottom line:** none of the three headline beta claims for bootstrap is a genuine v2 addition. `--run-dev-server` and Live Preview shipped in the v1.59.0 baseline; auto-publishing of seeded content is long-standing v1 behavior (no flag, no code change). The only substantive changes in v2 are the **Node bump**, the **removal of three deprecated hidden flags**, the **`--yes` string→boolean change**, and **TypeScript modernization** (see §6). Treat the changelog as inaccurate for this plugin.

> **Official v1 doc cross-check** (contentstack.com/docs/headless-cms/bootstrap-starter-apps): documents only `--app-name`, `--project-dir`, `-k/--stack-api-key`, `--org`, `-n/--stack-name`, `-y/--yes=yes`, `-a/--alias`. Notably it documents `--yes=yes` **taking a value** (matching v1's `flags.string`) and treats `-a` as `--alias` (not appName). It does **not** document `--run-dev-server` at all — the flag existed in v1.59.0 code but was never surfaced in the doc, which likely fed the "new in v2" misconception.

---

## 5. README / doc-site accuracy

- **"See code" link — correct.** v1 README pointed to `https://github.com/contentstack/cli/blob/main/packages/contentstack-bootstrap/src/commands/cm/bootstrap.ts` (v1 README `bootstrap` section). v2 README points to `https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-bootstrap/src/commands/cm/bootstrap.ts` (v2 README, `_See code:_` line). The package moved repos (`cli` → `cli-plugins`), the file exists on `cli-plugins@main`, so the v2 link resolves correctly.
- **Stale `homepage` — needs fixing.** v2 `package.json` still has `"homepage": "https://github.com/contentstack/cli"` while `repository.url` is `git+https://github.com/contentstack/cli-plugins.git`. The `homepage` should point at `cli-plugins`. (`bugs` was correctly updated to `cli-plugins/issues`.)
- v2 README example/usage block correctly lists `--app-name`, `--project-dir`, `--run-dev-server`, `-k`, `--org`, `-n`, `-y`, `-a` and no longer documents the removed `--appName/--directory/--appType` aliases.

---

## 6. Other changes (non-breaking / internal)

- **Node engine:** `package.json` `engines.node` `>=14.0.0` (v1) → `>=22.0.0` (v2). This is the only hard runtime prerequisite change.
- **TypeScript modernization in `interactive.ts`:** `const inquirer = require('inquirer')` → `import inquirer from 'inquirer'`; the custom-path prompt `type` changed from the invalid `'string'` to `'input'`; minor dedup of `pathValidator` call. Behavior for end users is unchanged.
- **Packaging:** `@oclif/core ^4`, `inquirer 12.x`, `tar 7.x` in v2 (dependency refresh). `repositoryPrefix` template (`<%- repo %>/blob/main/…`) is unchanged; the corrected link in §5 comes from the changed `repository.url`.

---

## 7. Agent rules: 1.x → 2.x command translation

An agent given a 1.x `cm:bootstrap` command should apply these rules in order and output the 2.x equivalent:

1. **Command:** `cm:bootstrap` is unchanged.
2. **Flag renames (value-preserving):**
   - `--appName` → `--app-name`
   - `--directory` → `--project-dir`
   - `--appType` → `--app-type`
3. **Short-char handling:**
   - `-d` (meaning directory) → `--project-dir`
   - `-s` (meaning appType) → `--app-type`
   - `-a` **is ambiguous in v1**: if it was used for the app name → `--app-name`; if it was the management-token alias → keep as `--alias`/`-a`. In v2, `-a` means **alias only**.
   - `-k`, `-n`, `-y` are unchanged in meaning.
4. **`--yes` normalization:** drop any argument — `--yes true`/`--yes false`/`-y anything` all become bare `--yes` (or omit entirely for `false`). In v2 it is a boolean.
5. **Do not treat `--run-dev-server` or Live Preview as new:** they exist in both lines; pass through unchanged.
6. **Never invent flags.** There is no `--auto-publish`. If a 1.x flag is not in this guide, keep it and note it is unverified.

**Worked example**
Input: `csdx cm:bootstrap -a kickstart-next --directory ./app -s starterapp --yes true`
Output: `csdx cm:bootstrap --app-name kickstart-next --project-dir ./app --app-type starterapp --yes`
Notes: `-a` here meant the app name (v1 collision) → `--app-name`; `--directory`→`--project-dir`; `-s`→`--app-type`; `--yes true`→bare `--yes`.

---

## 8. Migration checklist

- [ ] Node runtime upgraded to `>=22`.
- [ ] `--appName` → `--app-name` in all scripts.
- [ ] `--directory` / `-d` → `--project-dir`.
- [ ] `--appType` / `-s` → `--app-type`.
- [ ] `-a` audited: app-name usages → `--app-name`; alias usages stay `--alias`/`-a`.
- [ ] `--yes <value>` reduced to bare `--yes` (boolean).
- [ ] No reliance on a non-existent `--auto-publish`; `--run-dev-server` / Live Preview usage unchanged.
- [ ] (Maintainers) fix stale `package.json` `homepage` → `contentstack/cli-plugins`.
