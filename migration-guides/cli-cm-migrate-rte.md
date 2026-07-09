# Migration Guide — `@contentstack/cli-cm-migrate-rte` (Migrate HTML RTE → JSON RTE plugin) · 1.x → 2.x

> Command: `csdx cm:entries:migrate-html-rte`
> Package: `@contentstack/cli-cm-migrate-rte`  ·  v1 line: `1.x` (bundled `1.6.4` in `@contentstack/cli@1.59.0`)  ·  v2 line: `2.x` (`2.0.0-beta.8`)
> Status: verified against code — v1 = `contentstack/cli @ v1.59.0` (bundled plugin `1.6.4`), v2 = `contentstack/cli-plugins @ origin/v2-dev` + core `contentstack/cli @ origin/v2-dev` (`@contentstack/cli@2.0.0-beta.26`).

This guide is written to be read by **both a human and an LLM/agent**. If you feed this file to an agent along with a 1.x command, the [Command Translation Rules](#8-agent-rules-1x--2x-command-translation) section is enough to emit the correct 2.x command.

---

## 1. At a glance

| Area | 1.x | 2.x | Action needed |
|---|---|---|---|
| **Bundled with core CLI?** | **YES** — dependency **and** `oclif.plugins` entry of `@contentstack/cli` | **NO** — neither a dependency nor in `oclif.plugins` | **`csdx plugins:install @contentstack/cli-cm-migrate-rte` before first use** (§2) |
| Command id | `cm:entries:migrate-html-rte` | `cm:entries:migrate-html-rte` | none (id unchanged) |
| Old command alias | `cm:migrate-rte` mapped via `expiredCommands` (helpful redirect message) | mapping **removed** | use `cm:entries:migrate-html-rte`; `cm:migrate-rte` now just "command not found" |
| Node.js | `>=14` | **`>=22`** | upgrade Node runtime |
| Deprecated flags | still accepted (hidden, warn) | **removed → hard error** | switch to canonical flags (§3) |
| Canonical flags & defaults | `-c -a -y`, `--delay 1000`, `--batch-limit 50`, etc. | **identical** | none — the documented flags are unchanged |

**The flags you actually use did not change.** The one thing that breaks a working 1.x setup on upgrade is that the plugin is **no longer installed for you** (§2), plus the retirement of long-hidden deprecated flag spellings (§3).

---

## 2. #1 breaking change — the plugin is no longer bundled (install it first)

In **v1** the core `@contentstack/cli` package shipped this plugin **out of the box**. Verified in `git show v1.59.0:packages/contentstack/package.json`:

- listed under `dependencies`: `"@contentstack/cli-cm-migrate-rte": "~1.6.4"`, **and**
- listed under `oclif.plugins`: `"@contentstack/cli-cm-migrate-rte"`.

So on any v1 install of `csdx`, `cm:entries:migrate-html-rte` worked immediately.

In **v2** it is **gone from both lists**. Verified in `git show origin/v2-dev:packages/contentstack/package.json` (`@contentstack/cli@2.0.0-beta.26`): `@contentstack/cli-cm-migrate-rte` appears **neither** in `dependencies` **nor** in `oclif.plugins`.

**Consequence:** on a fresh v2 `csdx`, `cm:entries:migrate-html-rte` is **not available out of the box**. Running it yields a "command not found" (handled by `@oclif/plugin-not-found`).

**Fix — install the plugin once before using the command:**

```bash
csdx plugins:install @contentstack/cli-cm-migrate-rte
# verify
csdx plugins
csdx cm:entries:migrate-html-rte --help
```

> ⚠️ **Correcting an earlier doc note:** a previous summary labeled RTE as "not breaking" because the plugin's own packaging (its `package.json`/`oclif` block) is separate from the core CLI in *both* v1 and v2. That is true but beside the point — what changed is the **default bundling by the core CLI**. For any user who relied on `csdx cm:entries:migrate-html-rte` working after installing only `@contentstack/cli`, v2 **is breaking**: the command disappears until the plugin is installed explicitly. Treat this as the #1 migration item for this plugin.

---

## 3. Flag reference — 1.x → 2.x

The **canonical, documented** flag set is **identical** across v1 (`1.6.4`) and v2 (`2.0.0-beta.8`) — same names, same short chars, same defaults. Verified by diffing `JsonMigrationCommand.flags` in `src/commands/cm/entries/migrate-html-rte.js` between `v1.59.0` (cli repo) and `origin/v2-dev` (cli-plugins).

Unchanged (safe) flags:

| Flag | Short | Type | Default |
|---|---|---|---|
| `--config-path` | `-c` | string | — |
| `--alias` | `-a` | string | — |
| `--stack-api-key` | — | string | — |
| `--content-type` | — | string | — |
| `--global-field` | — | boolean | `false` |
| `--yes` | `-y` | boolean | `false` |
| `--branch` | — | string | — |
| `--html-path` | — | string (requires `--json-path`) | — |
| `--json-path` | — | string (requires `--html-path`) | — |
| `--delay` | — | integer | `1000` |
| `--locale` | — | string | — |
| `--batch-limit` | — | integer | `50` |

**Removed in 2.x** — the hidden/deprecated flag spellings that v1 still accepted (each carried a `printFlagDeprecation` warning in `1.6.4`). They are **absent** from the v2 command and now hard-error:

| 1.x deprecated flag | Short | 2.x | Replacement |
|---|---|---|---|
| `--configPath` | `-p` | **removed** | `--config-path` / `-c` |
| `--content_type` | — | **removed** | `--content-type` |
| `--isGlobalField` | `-g` | **removed** | `--global-field` |
| `--htmlPath` | `-h` | **removed** | `--html-path` |
| `--jsonPath` | `-j` | **removed** | `--json-path` |

> Note the freed-up short chars: `-p`, `-g`, `-h`, `-j` no longer belong to this command in v2. (`-h` now resolves to the standard help flag.)

No new flags were added in 2.x.

---

## 4. Other behavioral / packaging changes

### 4.1 `cm:migrate-rte` alias no longer redirected
- **1.x:** `csdxConfig.expiredCommands` mapped `cm:migrate-rte` → `csdx cm:entries:migrate-html-rte`, so the retired name produced a helpful "use this instead" message.
- **2.x:** `csdxConfig` keeps only `shortCommandName` (`cm:entries:migrate-html-rte` → `MGRTRTE`); the `expiredCommands` mapping is gone. `csdx cm:migrate-rte` now falls through to plain "command not found."
- **Fix:** always call `cm:entries:migrate-html-rte`.

### 4.2 Node.js `>=22`
- Plugin `engines.node`: `>=14.0.0` (v1 `1.6.4`) → **`>=22.0.0`** (v2 `2.0.0-beta.8`). Matches the core CLI bump (`>=14` → `>=22`). Upgrade the runtime before installing.

### 4.3 Internal-only changes (no user impact)
- v2 sources chalk via `getChalk()` from `@contentstack/cli-utilities` (plus a `hooks.init` → `./src/hooks/init/load-chalk.js`) instead of importing `chalk` directly; `chalk` bumped `^4` → `^5`. Runtime behavior (output, flags, config handling) is unchanged.
- Repo home moved from `contentstack/cli` to `contentstack/cli-plugins` (`bugs`/`homepage`/`repository` fields).

---

## 5. Config-file usage (`--config-path <file>`)

Unchanged. The config-file contract (`getConfig` / `normalizeFlags` in `src/lib/util/index.js`, schema at `src/lib/util/config_schema.json`) is the same in both versions; the command still throws `No value provided for the "paths" property in config.` when `paths` is empty. Existing config JSON files continue to work as-is.

---

## 6. README / doc-site accuracy issues (v2)

Checked `git show origin/v2-dev:packages/contentstack-migrate-rte/README.md`:

- **Stale version string.** The generated Usage block advertises `@contentstack/cli-cm-migrate-rte/2.0.0-beta.4`, but `package.json` is `2.0.0-beta.8`. Regenerate with `oclif readme`.
- **"See code" link is wrong for the shipped code.** The footer link points to
  `https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-migrate-rte/src/commands/cm/entries/migrate-html-rte.js`
  (from `oclif.repositoryPrefix` → `blob/main`). The v2 code actually lives on the **`v2-dev`** branch; the `main` branch of `cli-plugins` still carries an older, pre-v2 variant of this file (it uses a direct `chalk` import and lacks the v2 `load-chalk` hook), so the link does not point at the code the README documents. Fix the `repositoryPrefix` branch (or merge v2 to `main`) before GA.
- **Missing install/bundling note.** The README's install line (`npm install -g @contentstack/cli-cm-migrate-rte`) is the standalone-package install; it does **not** tell existing `csdx` users that this plugin is no longer bundled and must be added with `csdx plugins:install @contentstack/cli-cm-migrate-rte`. Given §2 this is the single most important thing to document.

The official v1 doc-site page (contentstack.com/docs/.../migrate-content-from-html-rte-to-json-rte) documents the same canonical flags and, as expected for v1, says nothing about installing the plugin (it was bundled). It needs a v2 prerequisite/install section added.

---

## 7. Migration checklist

- [ ] Node runtime upgraded to `>=22`.
- [ ] **`csdx plugins:install @contentstack/cli-cm-migrate-rte`** run on every machine/CI image that uses this command (§2).
- [ ] `csdx plugins` confirms the plugin is present; `cm:entries:migrate-html-rte --help` resolves.
- [ ] Deprecated flag spellings replaced: `-p/--configPath`→`-c/--config-path`, `--content_type`→`--content-type`, `-g/--isGlobalField`→`--global-field`, `-h/--htmlPath`→`--html-path`, `-j/--jsonPath`→`--json-path` (§3).
- [ ] Any use of the retired `cm:migrate-rte` name switched to `cm:entries:migrate-html-rte` (§4.1).
- [ ] Config JSON files verified to still load (no changes expected, §5).

---

## 8. Agent rules: 1.x → 2.x command translation

An agent given a 1.x `cm:entries:migrate-html-rte` (or `cm:migrate-rte`) command should apply these rules in order and output the 2.x equivalent:

1. **Prerequisite (emit first, always):** in v2 this plugin is not bundled. Prepend, or instruct the user to run once:
   `csdx plugins:install @contentstack/cli-cm-migrate-rte`
2. **Command name:** replace `cm:migrate-rte` with `cm:entries:migrate-html-rte`. Leave `cm:entries:migrate-html-rte` unchanged.
3. **Deprecated flag renames (value-preserving):**
   - `-p` | `--configPath` → `--config-path` (or `-c`)
   - `--content_type` → `--content-type`
   - `-g` | `--isGlobalField` → `--global-field`
   - `-h` | `--htmlPath` → `--html-path`
   - `-j` | `--jsonPath` → `--json-path`
4. **Unchanged flags — pass through verbatim:** `-c/--config-path`, `-a/--alias`, `--stack-api-key`, `--content-type`, `--global-field`, `-y/--yes`, `--branch`, `--html-path`, `--json-path`, `--delay`, `--locale`, `--batch-limit`. Defaults are unchanged (`--delay 1000`, `--batch-limit 50`).
5. **`--html-path` / `--json-path` come as a pair** (each `dependsOn` the other) — never emit one without the other.
6. **Never invent flags.** If a 1.x flag isn't in this guide, keep it and note it's unverified.

**Worked example**
Input: `csdx cm:migrate-rte -p ./cfg.json -g -h field.html -j field.json --content_type ct1`
Output:
```
csdx plugins:install @contentstack/cli-cm-migrate-rte
csdx cm:entries:migrate-html-rte --config-path ./cfg.json --global-field --html-path field.html --json-path field.json --content-type ct1
```
Warnings: plugin must be installed first (no longer bundled in v2); all five flag spellings were deprecated aliases removed in v2.
