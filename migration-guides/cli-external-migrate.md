# Reference Guide — `@contentstack/cli-external-migrate` (External Migrate plugin) · New in 2.x

> Commands: `csdx migrate:create` (public) · `migrate:audit`, `migrate:convert`, `migrate:export`, `migrate:import`, `migrate:status` (hidden building blocks)
> Package: `@contentstack/cli-external-migrate` · v2-dev version: **`2.0.0-beta.1`** · `origin/main` version: `1.0.0-alpha.4`
> Status: verified against code — v1 baseline = `contentstack/cli @ v1.59.0`, v2 = `contentstack/cli-plugins @ v2-dev`.

This guide is written to be read by **both a human and an LLM/agent**. There is **no 1.x version of this plugin** — it never shipped in the `contentstack/cli` monorepo, so there is nothing to migrate *from*. This is a **new-plugin reference**: what the commands are, their flags, and the caveats to know before relying on them.

---

## 0. Is this new in 2.x? — Yes

Verified:
- `git ls-tree -r origin/v2-dev` (cli-plugins) → package present at `packages/contentstack-external-migrate`.
- `git ls-tree -r v1.59.0` (cli) → **no** `external-migrate` path; `git log --all -- "*external-migrate*"` in the cli monorepo returns **nothing**.
- The plugin exists **only** in `contentstack/cli-plugins`, on both `origin/main` (`1.0.0-alpha.4`) and `origin/v2-dev` (`2.0.0-beta.1`).

**Conclusion:** relative to the v1 baseline (`cli @ v1.59.0`) this plugin is entirely new. No flag renames, no removed aliases, no behavioral migration — treat everything below as additive.

---

## 1. At a glance

| Area | Value | Notes |
|---|---|---|
| Purpose | Migrate content from an external/legacy CMS (Contentful) into Contentstack | export → convert → create stack → import |
| Package name | `@contentstack/cli-external-migrate` | verified `package.json` `name` |
| Maturity | **Pre-GA (alpha/beta)** | `main` = `1.0.0-alpha.4`, `v2-dev` = `2.0.0-beta.1` — API/flags may still change |
| Node.js | **`>=22.0.0`** | `package.json` `engines.node` |
| Install | `csdx plugins:install @contentstack/cli-external-migrate` | from README |
| Public command | `migrate:create` only | the one non-hidden command (§2) |
| Hidden commands | `migrate:audit`, `migrate:convert`, `migrate:export`, `migrate:import`, `migrate:status` | `static hidden = true` in each source file |
| Supported source | **Contentful only** | every `--legacy`/`--source` flag is `options: ['contentful']` |
| Official docs | **None** | doc-site gap (§7) |

---

## 2. Command surface — which commands are public

Verified from the `static hidden` property in each command source:

| Command | Purpose | `static hidden` | User-facing? |
|---|---|---|---|
| `migrate:create` | Orchestrator: convert a source export, create a new stack, import into it | *(absent)* | **Yes** |
| `migrate:export` | Export content from Contentful (writes `export.json`) | `true` | hidden step |
| `migrate:convert` | Convert a legacy export into a Contentstack import bundle | `true` | hidden step |
| `migrate:audit` | Audit a bundle (wraps `csdx cm:stacks:audit`) | `true` | hidden step |
| `migrate:import` | Import a bundle into an existing/new stack | `true` | hidden step |
| `migrate:status` | Show migration manifest / step status | `true` | hidden step |

So the intended entry point is **`migrate:create`**; the other five are the individual pipeline stages, runnable directly but hidden from `--help` listings. This is worth stating explicitly because the README documents all six as if co-equal.

---

## 3. Flag reference (verified against `src/commands/migrate/*.ts` on v2-dev)

Short chars are listed only where a `char:` is actually defined in source. **Long flags are canonical.**

### 3.1 `migrate:create` (public)
| Flag | Short | Type | Default | Required | Notes |
|---|---|---|---|---|---|
| `--source` | — | string | — | **yes** | `options: ['contentful']` |
| `--space-id` | — | string | — | | Contentful space ID (use this OR `--input`) |
| `--source-token` | — | string | — | | prefer `CONTENTFUL_MANAGEMENT_TOKEN` env |
| `--download-assets` | — | boolean | `false` | | with `--space-id` |
| `--include-drafts` | — | boolean | `false` | | with `--space-id` |
| `--include-archived` | — | boolean | `false` | | with `--space-id` |
| `--org` | — | string | — | | new stack created here; prompts if omitted |
| `--output` | — | string | `./output-dir` | | bundle → `<output>/bundle` |
| `--affix` | — | string | `CS` | | content-type UID prefix |
| `--invite-users` / `--no-invite-users` | — | boolean | `true` (`allowNo`) | | on by default; sends invite emails |
| `--yes` | `-y` | boolean | **`true`** (`allowNo`) | | skips import confirmation by default |
| `--workspace` | — | string | `./output-dir` | | manifest root (**no `-w`** on create) |
| `--input` | `-i` | string | — | | **`hidden: true`** — use this OR `--space-id` |
| `--cf-org-id` | — | string | — | | **`hidden: true`** — migrate every space in a CF org |
| `--stack-name` | — | string | — | | **`hidden: true`** |
| `--branch` | — | string | — | | **`hidden: true`** — branch alias |
| `--verbose` | — | boolean | `false` | | **`hidden: true`** |

> Note: `create` has **no `-w`** short char for `--workspace` (unlike the hidden commands, which do). Five `create` flags are `hidden: true` — that is why the README `USAGE` block omits them even though they are accepted.

### 3.2 `migrate:export` (hidden)
| Flag | Short | Type | Default | Required |
|---|---|---|---|---|
| `--legacy` | `-l` | string | — | **yes** (`options: ['contentful']`) |
| `--space-id` | — | string | — | |
| `--management-token` | — | string | — | |
| `--output` | — | string | `./migration-workspace` | |
| `--download-assets` | — | boolean | `false` | |
| `--include-drafts` | — | boolean | `false` | |
| `--include-archived` | — | boolean | `false` | |
| `--verbose` | `-v` | boolean | `false` | |
| `--workspace` | `-w` | string | — | |

### 3.3 `migrate:convert` (hidden)
| Flag | Short | Type | Default | Required |
|---|---|---|---|---|
| `--legacy` | `-l` | string | — | **yes** (`options: ['contentful']`) |
| `--input` | `-i` | string | — | |
| `--output` | — | string | `./contentstack-import` | |
| `--master-locale` | — | string | — | |
| `--affix` | — | string | `''` (empty) | |
| `--verbose` | `-v` | boolean | `false` | |
| `--workspace` | `-w` | string | — | |
| `--org` | — | string | — | |

### 3.4 `migrate:import` (hidden)
| Flag | Short | Type | Default | Required |
|---|---|---|---|---|
| `--stack-api-key` | `-k` | string | — | |
| `--org` | — | string | — | |
| `--stack-name` | — | string | — | |
| `--data-dir` | `-d` | string | — | |
| `--yes` | `-y` | boolean | `true` (`allowNo`) | |
| `--skip-audit` | — | boolean | `false` | |
| `--module` | — | string | — | |
| `--branch` | — | string | — | |
| `--workspace` | `-w` | string | — | |

### 3.5 `migrate:audit` (hidden)
| Flag | Short | Type | Default |
|---|---|---|---|
| `--data-dir` | `-d` | string | — |
| `--report-path` | — | string | — |
| `--modules` | — | string | — |
| `--csv` | — | boolean | `false` |
| `--workspace` | `-w` | string | — |

### 3.6 `migrate:status` (hidden)
| Flag | Short | Type | Default |
|---|---|---|---|
| `--workspace` | `-w` | string | `./migration-workspace` |

---

## 4. Pending / verified decisions on short chars (DX-9363)

Prior analysis flagged that branch `origin/fix/DX-9363` removes the `-o/-m/-a` short chars from `migrate:convert` and the `-o` short char from `migrate:export`. **Verified against v2-dev today:**

- `migrate:convert` — `output`, `master-locale`, and `affix` have **no `char:`** in source. `-o`, `-m`, `-a` are **absent**.
- `migrate:export` — `output` has **no `char:`**. `-o` is **absent**.
- `git diff origin/v2-dev origin/fix/DX-9363 -- .../convert.ts .../export.ts` returns **empty** (files identical), and `git branch -r --contains <DX-9363 HEAD>` lists `origin/v2-dev` — i.e. **DX-9363 is already contained in v2-dev's history**.

**Conclusion (correction to the prior "pending" framing):** the short-char removal has **already landed** in v2-dev; the flags are confirmed absent. This is **decided, not pending**. The only live gap is a **stale README example** (§7): the `migrate:export` example still shows `-o ./migration-workspace`, but `-o` no longer exists and would error. Fix the example.

---

## 5. Typical flow

```bash
# One-shot orchestration (public command):
CONTENTFUL_MANAGEMENT_TOKEN=... \
  csdx migrate:create --source contentful --space-id YOUR_SPACE --org bltOrgUid

# Or drive the hidden stages manually:
csdx migrate:export  --legacy contentful --space-id YOUR_SPACE --output ./migration-workspace
csdx migrate:convert --legacy contentful --input ./migration-workspace/export.json --output ./contentstack-import
csdx migrate:audit   --data-dir ./contentstack-import/bundle --report-path ./audit-reports
csdx migrate:import  --org bltOrgUid --data-dir ./contentstack-import/bundle
csdx migrate:status  --workspace ./migration-workspace
```

Source token resolution order (export/create): explicit `--management-token`/`--source-token` → `CONTENTFUL_MANAGEMENT_TOKEN` env → interactive prompt.

---

## 6. Node engine & packaging

- `engines.node`: **`>=22.0.0`** (verified `package.json`).
- `oclif.bin`: `csdx`; commands compiled to `./lib/commands`.
- `csdxConfig.shortCommandName`: maps `external-migrate:create` → `EMCRT`.
- Runtime deps of note: `@oclif/core ^4.8.0`, `@contentstack/cli-utilities ~2.0.0-beta.10`, `axios`, `jsdom`, `@contentstack/json-rte-serializer` (RTE conversion), `@contentstack/marketplace-sdk` (marketplace app field migration).

---

## 7. Documentation & README accuracy (gaps to close)

- **No official doc page exists** for this plugin on the Contentstack docs site. This is the primary gap: the plugin is user-installable but undocumented outside the package README. Because it is **still pre-GA (alpha/beta)**, calling this out is important — behavior and flags may change before a documented GA release.
- **README "See code" links** point to `https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-external-migrate/src/commands/migrate/<cmd>.ts`. Verified: the package and all six command files **exist on `origin/main`**, so the links resolve. (Note the linked `main` copy is the `1.0.0-alpha.4` line, not v2 — standard oclif `repositoryPrefix` behaviour.)
- **Stale `migrate:export` example** — README shows `csdx migrate:export -l contentful --space-id YOUR_SPACE -o ./migration-workspace`, but `-o` is not a defined short char (§4). Would error. Replace `-o` with `--output`.
- **README `migrate:create` `USAGE` is incomplete** — it omits `--input`/`-i`, `--cf-org-id`, `--stack-name`, `--branch`, `--verbose` because those flags are `hidden: true`. The `create` example uses `--input`, a hidden flag; consider documenting the `--input` vs `--space-id` choice explicitly.
- **`package.json` has no `homepage` or `bugs` fields** for this package (present on some sibling packages). Minor metadata gap.
- **README frames all six commands as co-equal**, but five are `static hidden` (§2). Docs should make clear `migrate:create` is the intended entry point.

---

## 8. Agent rules

1. This plugin is **new in 2.x** — there is no 1.x equivalent. Never emit a "1.x → 2.x" translation for `migrate:*`; there is nothing to translate from.
2. Prefer **`migrate:create`** for end-to-end migration. Only reach for `migrate:export/convert/audit/import/status` when the user explicitly wants a single stage — and warn that they are hidden/internal.
3. Source is **Contentful only**. If asked for another CMS, state it is unsupported (`--legacy`/`--source` accept only `contentful`).
4. Do **not** use `-o` for `migrate:export`/`migrate:convert` output — that short char does not exist; use `--output` (§4).
5. Never invent flags. If a flag is not in §3, keep it verbatim and note it is unverified.
6. Warn the user the plugin is **pre-GA** and undocumented; flags may change.
