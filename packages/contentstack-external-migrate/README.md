# Contentstack Migrate (`csdx migrate`)

`@contentstack/cli-plugin-migrate` is a **csdx** plugin that migrates content from **Contentful** into **Contentstack**. Each step is a separate CLI command you can run on its own — no AI required, no monolithic “do everything” script.

The plugin **converts** legacy exports in-process and **delegates** stack operations to native Contentstack CLI (`csdx cm:stacks:audit`, `csdx cm:stacks:import`). Contentful export uses the **Contentful CLI** (global `contentful` or `npx -y contentful-cli`).

---

## What you get

| Command | Purpose |
|---------|---------|
| `csdx migrate:export` | Pull a Contentful space to `export.json` |
| `csdx migrate:convert` | Transform export → Contentstack import **bundle** |
| `csdx migrate:audit` | Validate bundle (`csdx cm:stacks:audit`) |
| `csdx migrate:import` | Push bundle to an empty stack |
| `csdx migrate:create` | **One-shot**: convert + create a new stack in an org + import into it |
| `csdx migrate:status` | Show pipeline progress from `migration-manifest.json` |

**Typical flow:** export → convert → **review model** → audit → (optional fix) → import → delivery credentials in the UI.

---

## What gets migrated

There is **no separate command per object** — everything below is handled automatically inside `migrate:convert` (builds it into the bundle) and `migrate:create` / `migrate:import` (pushes it to the stack). You run the same few commands; these are the capabilities they cover.

| Object | Migrated? | Where | Notes |
|--------|-----------|-------|-------|
| **Content types & fields** | ✅ | convert | Full field-type mapping; affix prefixing; Title/URL auto-mapped |
| **Field help text** | ✅ | convert | Contentful `editorInterfaces` help text → Contentstack field instruction |
| **Content-type description** | ✅ | convert | Carried onto the content type |
| **Default values** | ✅ | convert | Per field type → `field_metadata.default_value` |
| **Rich Text → JSON RTE** | ✅ | convert | Structured; embedded entries/assets kept as references |
| **Entries** | ✅ | convert/import | References re-linked; localized variants |
| **Entry tags** | ✅ | convert | Contentful entry `metadata.tags` resolved id → **name** → Contentstack entry tags |
| **Assets** | ✅ | convert/import | Uploaded + re-linked |
| **Locales / languages** | ✅ | convert | Master locale auto-detected; fallback chain |
| **Taxonomy** | ✅ | convert | Taxonomy + terms |
| **Roles** | ✅ | convert/import | Built-ins matched (Owner/Admin/Developer/Content Manager, incl. Editor/Author); others → custom roles |
| **Webhooks** | ✅ | convert/import | Secret values are stripped by Contentful → header **names kept as placeholders**; imported **disabled**. Created via CMA so all webhooks land (works around a csdx limit that imports only the first 5) |
| **Environments → branches** | ✅ | create | Branch-enabled org: each Contentful environment → its own branch (`master`→`main`). Branch-disabled org: master only → default workspace |
| **Delivery + preview tokens** | ✅ | create/import | Provisioned on stack creation; Live Preview enabled; written to `metadata.json` (incl. `branches[]`, main first) |
| **Users / memberships** | ✅ | create (`--space-id`) | Space members fetched from the live CF API, invited with their **exact** mapped roles (on by default; `--no-invite-users` to skip). OAuth/SSO supported |
| **Personalize** | ✅ | import | |
| Workflows & publish rules | ❌ | — | Not exported by Contentful — rebuild via CMA |
| Releases / scheduled actions | ❌ | — | Not exported by Contentful — recreate after cutover |
| Webhook **secret values** | ❌ | — | Redacted by Contentful — operator re-enters (we flag which) |

---

## Prerequisites

| Requirement | Used for |
|-------------|----------|
| **Node.js 20+** | Plugin runtime |
| **`@contentstack/cli`** (`npm i -g @contentstack/cli`) | `csdx` and audit/import |
| **`csdx auth:login`** | Audit and import only |
| **`CONTENTFUL_MANAGEMENT_TOKEN`** | Export (prefer env over CLI flag) |
| **Empty Contentstack stack** | Import destination |

Contentful CLI for export: install globally (`npm i -g contentful-cli`) or rely on automatic `npx -y contentful-cli`.

---

## Install the plugin

From the plugin directory (this repo root, or `cli-plugin-migrate/` inside a parent monorepo):

```bash
cd cli-plugin-migrate   # skip if you are already at the repo root
npm install
npm run build
csdx plugins:link .
```

Verify:

```bash
csdx migrate --help
```

To unlink later: `csdx plugins:unlink cli-plugin-migrate` (from the plugin directory).

After code changes, run `npm run build` and `csdx plugins:link .` again.

---

## Sharing with your team

Send colleagues:

1. Link to this repo
2. [docs/getting-started.md](./docs/getting-started.md) — install + first run
3. [docs/expert-workflow.md](./docs/expert-workflow.md) — full migration pipeline

Install is always: clone → `npm install && npm run build` → `csdx plugins:link .` (not npm publish).

## Quick start (existing Contentful export)

**Built-in fixture** (works with only this repo):

```bash
csdx migrate:convert \
  --legacy contentful \
  --input ./test/fixtures/contentful-export.json \
  --output ./contentstack-import \
  --master-locale en-US
```

**Large sample export** (when cloned inside a monorepo with `references/`):

```bash
csdx migrate:convert \
  --legacy contentful \
  --input ../references/contentful-export-nty6h2uki8mm-master-2026-06-02T15-32-37.json \
  --output ./contentstack-import \
  --master-locale en-US
```

Bundle output: `./contentstack-import/bundle/` (content types, entries, locales, assets metadata, `mapper.json`).

Then audit and import (requires Contentstack login):

```bash
csdx auth:login

csdx migrate:audit \
  -d ./contentstack-import/bundle \
  --report-path ./audit-reports

csdx migrate:import \
  -k YOUR_STACK_API_KEY \
  -d ./contentstack-import/bundle \
  -y
```

---

## Full pipeline (recommended workspace layout)

Use one **migration workspace** so `migration-manifest.json` tracks progress:

```bash
export CONTENTFUL_MANAGEMENT_TOKEN="your-cma-token"
csdx auth:login
```

### 1. Export from Contentful

```bash
csdx migrate:export \
  --legacy contentful \
  --space-id YOUR_SPACE_ID \
  --output ./migration-workspace
```

Creates `./migration-workspace/export.json` (and optional asset files with `--download-assets`).

### 2. Convert to Contentstack bundle

```bash
csdx migrate:convert \
  --legacy contentful \
  --input ./migration-workspace/export.json \
  --output ./migration-workspace/contentstack-import \
  --master-locale en-US \
  --workspace ./migration-workspace
```

### 3. Review the content model (manual)

Before audit/import, inspect generated schemas:

```bash
ls ./migration-workspace/contentstack-import/bundle/content_types/
cat ./migration-workspace/contentstack-import/bundle/mapper.json
```

Checklist and rationale: [docs/phases/phase-5-manifest-and-review.md](./docs/phases/phase-5-manifest-and-review.md).

Re-run convert with `--affix` or `--master-locale` if naming or locale mapping is wrong. Do not skip this step on production migrations.

### 4. Audit the bundle

```bash
csdx migrate:audit \
  -d ./migration-workspace/contentstack-import/bundle \
  --report-path ./migration-workspace/audit-reports \
  --workspace ./migration-workspace
```

Fix issues with native CLI, then re-audit:

```bash
csdx cm:stacks:audit:fix \
  -d ./migration-workspace/contentstack-import/bundle \
  --report-path ./migration-workspace/audit-fix

csdx migrate:audit \
  -d ./migration-workspace/contentstack-import/bundle \
  --report-path ./migration-workspace/audit-verify
```

### 5. Import into Contentstack

Target stack must be **empty**.

```bash
csdx migrate:import \
  -k YOUR_STACK_API_KEY \
  -d ./migration-workspace/contentstack-import/bundle \
  --workspace ./migration-workspace \
  -y
```

`--yes` skips confirmation prompts (default). Use `--no-yes` for interactive confirmations.

### 6. Check status anytime

```bash
csdx migrate:status --workspace ./migration-workspace
cat ./migration-workspace/migration-manifest.json
```

The manifest records step timestamps and paths — **never** management tokens or full stack API keys (only a short prefix after import).

### 7. Delivery credentials (manual)

In the Contentstack UI: Stack → API Key and Delivery Token → configure your app (`CONTENTSTACK_API_KEY`, delivery token, region, environment).

---

## Command reference

### `migrate:export`

| Flag | Description |
|------|-------------|
| `-l, --legacy` | `contentful` (required) |
| `--space-id` | Contentful space ID |
| `--management-token` | CMA token (prefer `CONTENTFUL_MANAGEMENT_TOKEN`) |
| `-o, --output` | Workspace root (default: `./migration-workspace`) |
| `-w, --workspace` | Manifest workspace (defaults to `--output`) |
| `--download-assets` | Download asset binaries |
| `--include-drafts` / `--include-archived` | Export scope |
| `-v, --verbose` | Log CLI invocation (token redacted) |

### `migrate:convert`

| Flag | Description |
|------|-------------|
| `-l, --legacy` | `contentful` (required) |
| `-i, --input` | Path to Contentful export JSON |
| `-o, --output` | Parent dir; bundle → `<output>/bundle` |
| `-m, --master-locale` | Destination master locale (e.g. `en-US`) |
| `-a, --affix` | Content-type UID prefix |
| `-w, --workspace` | Manifest workspace |
| `-v, --verbose` | Verbose conversion logs |

No `--stack` on convert — import is a separate step by design.

### `migrate:audit`

Wraps `csdx cm:stacks:audit`.

| Flag | Description |
|------|-------------|
| `-d, --data-dir` | Bundle directory |
| `--report-path` | Audit report output dir |
| `--modules` | e.g. `content-types,entries,assets` |
| `--csv` | CSV report |
| `-w, --workspace` | Manifest workspace |

### `migrate:import`

Import a converted bundle — **either** into an existing stack (`--stack-api-key`) **or** into a brand-new stack created in an organization (`--org`). All inputs are optional; you're prompted for anything missing.

- `--stack-api-key` given → import into that existing stack (wraps `csdx cm:stacks:import`).
- no `--stack-api-key` → resolve `--org` (or pick from a list of your orgs), create a stack named `Contentful Migration <date>`, and import into it. The master locale is read from the bundle. **Delivery and preview tokens** are then provisioned and written to `<bundle>/metadata.json`.

Auth uses your existing csdx session — both `csdx auth:login` and `csdx auth:login --oauth` work; no re-login.

```bash
# into an existing stack
csdx migrate:import -k bltYOUR_KEY -d ./contentstack-import/bundle

# create a new stack in an org and import into it
csdx migrate:import --org bltYOUR_ORG_UID -d ./contentstack-import/bundle

# fully prompted (bundle path → org pick-list → auto stack name)
csdx migrate:import
```

| Flag | Description |
|------|-------------|
| `-k, --stack-api-key` | Destination stack API key (import into an **existing** stack) |
| `--org` | Org uid — create a **new** stack here when `--stack-api-key` is omitted (prompts with a list if omitted) |
| `--stack-name` | Name for the new stack (default: `Contentful Migration <date>`) |
| `-d, --data-dir` | Bundle directory |
| `-y, --yes` / `--no-yes` | Skip prompts (default: yes) |
| `--skip-audit` | Skip pre-import audit-fix |
| `--module` | Partial import (e.g. `entries`) |
| `--branch` | Branch alias |
| `-w, --workspace` | Manifest workspace |

When a stack is created, delivery + preview tokens are generated (best-effort) and saved to `metadata.json` alongside the bundle.

### `migrate:create`

One-shot org flow: get an export, **create a new stack** in an organization, and import into it. Master locale is auto-detected from the export's default locale and used for both the new stack and the conversion.

You supply the source **one of three ways**:
- `--input ./export.json` — an export JSON you already have, **or**
- `--space-id SPACE_ID` — pull a fresh export from one Contentful space; the JSON is saved to the workspace and reused, **or**
- `--cf-org-id CF_ORG_ID` — migrate **every space** the token can access in that Contentful org, **one stack per space**.

The CMA token is resolved automatically from `--management-token` → `CONTENTFUL_MANAGEMENT_TOKEN` → `contentful login` (`~/.contentfulrc.json`), and prompted only if none is found.

`--org` (the **destination Contentstack** org) is optional — omit it to choose from a pick-list of your orgs. Note: `--org` is the Contentstack destination; `--cf-org-id` is the Contentful source — they are different orgs.

#### Migrate a whole Contentful org (with `--cf-org-id`)

Pass a Contentful **org id** and the command migrates every space in it, one at a time, each into its own stack:

- Prints `Contentful Org name`, `Total space count`, and the space list first.
- For **each space**: export all environments → convert (prints the conversion summary) → create a stack **named after the space** → branches (master→main) → import → webhooks/workflows/users/tokens → `✓ Migration complete`. Then the next space.
- **Continues on failure** — if one space errors it's logged and the run moves on; a final roll-up shows `N/M spaces succeeded` with per-space ✓ stack / ✗ error (and a non-zero exit if any failed).
- If **both** `--space-id` and `--cf-org-id` are given, only `--space-id` is used.
- Each space gets its own output subdir (`<output>/<space-name>/…`); the space name is the stack name (so `--stack-name` is honored only for a single-space/`--input` run).

```bash
# migrate every space in a Contentful org → one stack per space
csdx migrate:create --legacy contentful --cf-org-id CF_ORG_ID --org bltYOUR_ORG_UID
```

Stack creation uses the Contentstack Management API (primary) and falls back to `csdx cm:stacks:seed`. Requires `csdx auth:login` (basic **or** `--oauth`), and the logged-in **region must match the org's region**.

#### Users (with `--space-id`)

Contentful space **members are not in the static export**, so when you use `--space-id` the command fetches them from the live Contentful Management API and migrates them into the new stack:

- Each member is invited with **exactly** their equivalent Contentstack role(s) — a space **admin** → the **Admin** role; other roles → the matching built-in (e.g. `Editor`/`Author` → **Content Manager**) or a **same-name custom role**. A member whose roles map to nothing is **skipped** (never invited into a default/unintended role).
- Inviting is **on by default** (sends invite emails). Pass `--no-invite-users` to only write the mapping report and not email anyone.
- A `users/users-mapping.json` report (who maps to which role, who was skipped) is **always** written to the bundle.
- **OAuth / SSO orgs** are supported: invites use the same authenticated session (`--oauth` Bearer token, auto-refreshed). If a **strict-SSO** org rejects email invites, the command surfaces a hint to provision those users via your IdP (SAML/SCIM) — the role mapping is preserved in the report.

```bash
# A) from an existing export JSON
csdx migrate:create --legacy contentful --input ./export.json --org bltYOUR_ORG_UID

# B) export from Contentful first
export CONTENTFUL_MANAGEMENT_TOKEN="your-cma-token"
csdx migrate:create --legacy contentful --space-id YOUR_SPACE_ID --org bltYOUR_ORG_UID --download-assets
```

| Flag | Description |
|------|-------------|
| `-l, --legacy` | `contentful` (required) |
| `-i, --input` | Path to Contentful export JSON (use this **or** `--space-id`) |
| `--space-id` | Contentful space ID — export one space (use this **or** `--input` **or** `--cf-org-id`) |
| `--cf-org-id` | Contentful **org** id — migrate every space in the org, one stack per space. Ignored if `--space-id` is given |
| `--management-token` | Contentful CMA token — optional; falls back to `CONTENTFUL_MANAGEMENT_TOKEN`, then `contentful login`, then a prompt |
| `--download-assets` / `--include-drafts` / `--include-archived` | Export scope (with `--space-id`) |
| `--org` | Destination organization uid — new stack is created here. Optional: if omitted, you get a pick-list of your organizations |
| `--stack-name` | New stack name (optional). Default: the Contentful **space name** (when using `--space-id`), else `Contentful Migration <date>` |
| `--invite-users` / `--no-invite-users` | Invite Contentful space members into the new stack with their mapped roles (with `--space-id`). **On by default**; `--no-invite-users` writes only the `users-mapping.json` report |
| `-o, --output` | Parent dir; bundle → `<output>/bundle` |
| `-a, --affix` | Content-type UID prefix |
| `--branch` | Branch alias for branch-aware import |
| `-y, --yes` / `--no-yes` | Skip import confirmation prompts (default: yes) |
| `-v, --verbose` | Verbose logs (streams seed fallback output) |
| `-w, --workspace` | Manifest workspace (also where the exported JSON is saved) |

The destination stack does **not** need to exist — it is created fresh. The detected master locale must be a valid Contentstack locale code.

### `migrate:status`

| Flag | Description |
|------|-------------|
| `-w, --workspace` | Workspace containing `migration-manifest.json` |

---

## Workspace layout

```
migration-workspace/
├── migration-manifest.json    # progress (no secrets)
├── export.json                # Contentful export
├── contentstack-import/
│   └── bundle/                # import-ready Contentstack data
│       ├── content_types/
│       ├── entries/
│       ├── locales/
│       ├── export-info.json
│       └── mapper.json
├── audit-reports/             # optional
└── audit-fix/                 # optional
```

---

## Troubleshooting

| Symptom | What to do |
|---------|----------------|
| `csdx not found` | `npm i -g @contentstack/cli` |
| `Not logged in` | `csdx auth:login` |
| `Invalid bundle` / missing `export-info.json` | Run `migrate:convert` first |
| `Set CONTENTFUL_MANAGEMENT_TOKEN` | Export token via env or flag |
| Contentful CLI fails | Install `contentful-cli` globally or ensure `npx` works |
| Import fails | Run audit + `csdx cm:stacks:audit:fix`; confirm **empty** stack |
| Wrong locales | Re-run `migrate:convert` with `--master-locale` |
| Plugin commands missing | `npm run build && csdx plugins:link .` from plugin root |
| Duplicate migrate plugins | `csdx plugins` — unlink old `cli-plugin-migrate-*` variants |

---

## Development

```bash
npm run build    # tsc + assets + oclif manifest
npm test         # vitest
npm run lint
```

Reference code lives in the parent workspace at [`../references/import-contentful-cli-main/`](../references/import-contentful-cli-main/) when `cli-plugin-migrate` sits beside a `references/` folder (e.g. `contentful-cursor` monorepo). Sample export: [`../references/contentful-export-*.json`](../references/). Unit fixture: [`test/fixtures/contentful-export.json`](./test/fixtures/contentful-export.json).

### Documentation

Full index: **[docs/README.md](./docs/README.md)**

| Doc | Audience | Purpose |
|-----|----------|---------|
| [docs/getting-started.md](./docs/getting-started.md) | Teammates | Onboarding |
| [docs/expert-workflow.md](./docs/expert-workflow.md) | Teammates | End-to-end pipeline |
| [docs/limitations-and-scope.md](./docs/limitations-and-scope.md) | Teammates | Supported CMS, requirements |
| [docs/manifest-schema.md](./docs/manifest-schema.md) | Teammates | `migration-manifest.json` |
| [docs/repository-layout.md](./docs/repository-layout.md) | Teammates | Repo vs monorepo layout |
| [docs/phases/phase-5-manifest-and-review.md](./docs/phases/phase-5-manifest-and-review.md) | Teammates | Model review checklist |
| [docs/architecture.md](./docs/architecture.md) | Maintainers | Package layout |
| [docs/implementation-principles.md](./docs/implementation-principles.md) | Maintainers | Design rules |
| [docs/phases/](./docs/phases/) | Maintainers | Implementation specs |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Maintainers | Build, test, PRs |
| [AGENTS.md](./AGENTS.md) | Agents | Automation router |
| [CHANGELOG.md](./CHANGELOG.md) | All | Release notes |

---

## Security notes

- Prefer `CONTENTFUL_MANAGEMENT_TOKEN` in the environment; verbose logs **never** print the token.
- Do not commit `export.json` or migration workspaces if they contain sensitive content.
- Do not commit stack API keys or delivery tokens.
- `migration-manifest.json` stores only a **prefix** of the stack key after import (e.g. `blt1234…`).

---

## License

[MIT](./LICENSE)

---

# Appendix — Running the whole migration (by hand)

> This appendix is the repo-root walkthrough, included here so this plugin's
> README is self-contained. It explains the full end-to-end migration — the same
> `csdx migrate:*` commands documented above, placed in order with the
> surrounding setup, model-review, credentials, and website-conversion steps.
> Links are relative to this file (`cli-plugin-migrate/`).

This repo contains tooling to migrate content from **Contentful** into
**Contentstack**. There are two ways to run a migration, both using the exact
same underlying commands:

- **AI Migration Companion** — a skill that interviews you once, then runs the
  whole pipeline for you, explaining each step. See
  [migration-companion/README.md](../migration-companion/README.md).
- **By hand (this appendix)** — you run the same `csdx migrate:*` commands
  yourself, in order. No AI required.

This appendix is the **by-hand path**. It is a complete, self-contained
walkthrough: every command, every decision, and the model-review checklist are
inlined here. If you would rather be guided, use the companion skill — it does
exactly what is written below.

> **Core principle: AI guides, tooling executes.**
> A migration is just a sequence of documented `csdx` commands. Nothing is
> hand-transformed or invented — the converter is a deterministic 1:1 mirror of
> your Contentful data. That is precisely why you can do the whole thing by hand:
> the companion has no secret sauce, only the commands below.

---

## What you'll do (the 7 steps)

| Step | Command / action | Produces |
|---|---|---|
| 1. Export | `csdx migrate:export` | `export.json` from your Contentful space |
| 2. Convert | `csdx migrate:convert` | A Contentstack import **bundle** |
| 3. Model review | Read the bundle (manual, read-only) | A findings list; maybe a re-convert |
| 4. Audit (+ fix) | `csdx migrate:audit` → `csdx cm:stacks:audit:fix` | A validation report |
| 5. Import | `csdx migrate:import` | Content live in an **empty** stack |
| 6. Delivery credentials | Contentstack UI (manual) | API key + delivery token for your app |
| 7. Website conversion | Update your app's SDK code | A working frontend on Contentstack |

Steps 1–5 are CLI commands. Step 6 is a UI task. Step 7 is a separate frontend
effort, summarized at the end.

---

## Prerequisites & one-time setup

### 1. Install the tools

```bash
node --version                 # must be 20+
npm i -g @contentstack/cli     # provides the `csdx` command
npm i -g contentful-cli        # optional; export falls back to `npx -y contentful-cli`
```

### 2. Link the migrate plugin

The `csdx migrate:*` commands come from the `cli-plugin-migrate` plugin in this
repo. Build and link it once:

```bash
cd cli-plugin-migrate
npm install
npm run build
csdx plugins:link .
```

Verify the subcommands are available:

```bash
csdx migrate --help            # should list: export, convert, audit, import, status
```

If commands are missing, re-run `npm run build` and `csdx plugins:link .`. If you
see duplicates, run `csdx plugins` and unlink older `cli-plugin-migrate-*`
variants. After any plugin code change, build and link again.

### 3. Log in and set your region

Audit and import talk to your Contentstack stack, so you must be logged in **in
the right region**:

```bash
csdx config:get:region                 # check current region
csdx config:set:region EU              # only if your stack is not in the default (e.g. NA, EU, AU, Azure)
csdx auth:login                        # interactive (browser/SSO)
csdx auth:whoami                       # confirm you're logged in
```

Login is **region-specific**. If you switch region, log in again and re-run
`csdx auth:whoami`. Sessions can also expire mid-migration — re-check before
import even if an earlier check passed.

### 4. Create the destination stack

Import requires an **empty** Contentstack stack. Create one in the UI first
(a dedicated dev stack is recommended). The plugin does not create stacks.

---

## Gather everything up front

The companion collects every input in one pass before running anything. Do the
same by hand — having these ready means the rest is uninterrupted:

| Input | Where it comes from | Used by |
|---|---|---|
| Workspace path | your choice; default `./migration-workspace` | all steps |
| Contentful space ID | Contentful UI / your records | Step 1 export |
| `CONTENTFUL_MANAGEMENT_TOKEN` | **environment variable only** | Step 1 export |
| Download assets / drafts / archived? | your call (default off) | Step 1 export |
| Master locale (e.g. `en-US`) | your destination model | Step 2 convert |
| Affix / UID prefix (optional) | naming convention | Step 2 convert |
| Destination stack API key (`blt…`) | Contentstack UI → Settings → Stack | Step 5 import |
| Is the stack empty? | confirm yourself — **gate for import** | Step 5 import |
| Branch alias (optional) | if you use branches | Step 5 import |

**Handle the management token safely.** Put it in the environment — never paste
it into a command you share, a log, or a chat:

```bash
export CONTENTFUL_MANAGEMENT_TOKEN="your-cma-token"
```

To generate one, you can log in with the Contentful CLI (`contentful login`),
which stores a token locally, or create a CMA token in the Contentful UI.

> Use one **migration workspace** folder for the whole run. The plugin writes a
> `migration-manifest.json` there to track progress, so every command below
> points at the same `./migration-workspace`.

---

## Step 1 — Export from Contentful

**What it does:** pulls your Contentful space into a single `export.json` (plus
asset binaries if you ask for them). Reads from Contentful via the Contentful
CLI; writes into your workspace. **Success:**
`./migration-workspace/export.json` exists.

```bash
csdx migrate:export \
  --legacy contentful \
  --space-id YOUR_SPACE_ID \
  --output ./migration-workspace
# optional: --download-assets --include-drafts --include-archived
```

Requires `CONTENTFUL_MANAGEMENT_TOKEN` in the environment (see above).

> **Already have an export?** If you already have a Contentful export JSON (your
> own file, or a sample under `references/`), **skip this step** and point Step 2
> at that file.

Verify:

```bash
ls -la ./migration-workspace/export.json
```

---

## Step 2 — Convert to a Contentstack bundle

**What it does:** transforms the Contentful export into an import-ready
Contentstack **bundle** (content types, entries, locales, assets metadata, and a
`mapper.json` that records the source → Contentstack mapping). This is a
deterministic 1:1 port. **Success:**
`./migration-workspace/contentstack-import/bundle/` is populated.

```bash
csdx migrate:convert \
  --legacy contentful \
  --input ./migration-workspace/export.json \
  --output ./migration-workspace/contentstack-import \
  --master-locale en-US \
  --workspace ./migration-workspace
# optional: --affix YOUR_PREFIX
```

Verify:

```bash
ls ./migration-workspace/contentstack-import/bundle/content_types/
cat ./migration-workspace/contentstack-import/bundle/mapper.json
```

The only conversion knobs are `--master-locale` and `--affix`. Everything else
about the model is reviewed in Step 3.

---

## Step 3 — Review the content model (read-only, manual)

**What it does:** you read the generated schema and decide whether it's good to
import. This is **advisory** — the converter mirrors your source exactly, so the
only in-pipeline changes are `--affix` and `--master-locale` on a **re-run of
convert**. Everything else is a recommendation you apply **in Contentstack after
import**.

> **Hard rule:** never hand-edit files in the bundle (`content_types/`,
> `entries/`, `locales/`, `mapper.json`). Editing the model means re-running
> `convert`, not editing JSON. Hand-edits break the 1:1 mapping that makes the
> migration verifiable.

Read the schema:

```bash
ls ./migration-workspace/contentstack-import/bundle/content_types/
cat ./migration-workspace/contentstack-import/bundle/content_types/<type>.json
cat ./migration-workspace/contentstack-import/bundle/mapper.json
```

Go through this checklist against the **actual** converted schema — flag, don't
fix:

| Lens | What to look for | Action |
|---|---|---|
| Naming / affix | Unclear, channel-specific, or colliding content-type UIDs | **Fixable now** — re-run `convert --affix <prefix>` |
| Master locale | Wrong master, or fields localized that never need translation | **Fixable now** — re-run `convert --master-locale` |
| Global-field candidates | A nested, lifecycle-less field set reused across types (classic: `seo`, `address`, `social_links`) | Advisory — convert to a **global field** post-import |
| Reference depth | Reference chains deeper than ~2–3 hops | Advisory — flatten/denormalize post-import; watch query cost |
| Modular blocks | Blocks with very many options, or options never used | Advisory — split or trim post-import |
| JSON RTE | Filterable/queryable facts buried inside rich text | Advisory — promote to discrete fields post-import |
| Taxonomy / tags | Free-text fields that are really governed classification | Advisory — model as taxonomy (governed) or tags post-import |

Write your findings in two buckets:

- **Fixable now (re-run convert):** for each item, the type/field, the issue, and
  the flag (`--affix` / `--master-locale`) that addresses it. If you accept any,
  go back to Step 2, re-run `convert` with the adjusted flags, and re-review.
- **Advisory (apply in Contentstack after import):** record these for later — they
  do **not** block audit or import.

When the fixable-now bucket is empty (or you've re-converted), continue.

---

## Step 4 — Audit (and fix)

**What it does:** validates the bundle against Contentstack's import rules and
writes a report. Wraps the native `csdx cm:stacks:audit`. **Success:** the report
shows no blocking errors.

```bash
csdx migrate:audit \
  --data-dir ./migration-workspace/contentstack-import/bundle \
  --report-path ./migration-workspace/audit-reports \
  --workspace ./migration-workspace
```

Read the report under `--report-path` and translate it: errors block import;
warnings are usually safe but worth understanding. To remediate, run the native
fix command, then **re-audit into a fresh report directory** to confirm:

```bash
csdx cm:stacks:audit:fix \
  --data-dir ./migration-workspace/contentstack-import/bundle \
  --report-path ./migration-workspace/audit-fix

csdx migrate:audit \
  --data-dir ./migration-workspace/contentstack-import/bundle \
  --report-path ./migration-workspace/audit-verify \
  --workspace ./migration-workspace
```

Only proceed to import once the audit is clean (or the remaining items are
warnings you've consciously accepted).

---

## Step 5 — Import into Contentstack

**What it does:** pushes the bundle into your destination stack. Wraps the native
`csdx cm:stacks:import`. **Success:** content types, entries, locales, and assets
appear in the stack.

> **The stack must be empty.** This is the one destructive, outward-facing step.
> Confirm the destination is empty before running. Re-check your session and
> region first — they can drift since setup:

```bash
csdx auth:whoami            # must be logged in
csdx config:get:region      # must match the destination stack's region
```

Then import:

```bash
csdx migrate:import \
  --stack-api-key bltYOUR_KEY \
  --data-dir ./migration-workspace/contentstack-import/bundle \
  --workspace ./migration-workspace \
  --yes
# optional: --branch ALIAS --module entries --skip-audit
```

`--yes` skips confirmation prompts (the default); use `--no-yes` if you want to
confirm interactively. After it completes, spot-check the stack in the UI.

---

## Step 6 — Delivery credentials (manual UI step)

**What it does:** gets the keys your application needs to read content. There is
no CLI command for this — it's done in the Contentstack UI.

From your stack in the Contentstack UI, collect:

- **Stack API key** (`blt…`)
- **Delivery token** (for published content)
- **Preview token** (for drafts / live preview, if you use it)
- **Region** (NA / EU / Azure / …) and **environment** name

Set them in your application's environment, e.g.:

```bash
CONTENTSTACK_API_KEY=blt...
CONTENTSTACK_DELIVERY_TOKEN=cs...
CONTENTSTACK_PREVIEW_TOKEN=cs...     # if using live preview
CONTENTSTACK_REGION=EU
CONTENTSTACK_ENVIRONMENT=production
```

---

## Step 7 — Website / application conversion

**What it does:** updates your frontend to read from Contentstack instead of
Contentful. This is a **separate effort** from the content migration above — the
content is now in Contentstack regardless of when you do this.

The good news from porting the sample starter: the architecture maps almost 1:1
(same file count, same env-var switch, same prop-injection pattern). The main
changes:

- **Fetchers** — swap the `contentful` SDK for `@contentstack/delivery-sdk`
  (`contentstack.stack({ apiKey, deliveryToken, environment, region })`) and
  rewrite queries to the `stack.contentType(...).entry().query()...` style.
- **Reference resolution** — Contentstack uses **explicit** includes
  (`.includeReference(['path.to.ref'])`) instead of Contentful's depth-based
  `include: 10`. Sections modeled as **modular blocks** come back inline and need
  no includes at all.
- **Live preview** — replace `@contentful/live-preview` hooks with
  `@contentstack/live-preview-utils` (`ContentstackLivePreview.init()` +
  `onEntryChange()`), which is more callback-driven (you re-fetch and set state).
- **Editable tags** — swap `data-contentful-*` for `data-cslp` via
  `addEditableTags(...)` / `entry.$`.
- **Region** — must be set in the stack config or every call fails.

Full piece-by-piece mapping and effort notes:
[docs/contentful-vs-contentstack-audit.md](../docs/contentful-vs-contentstack-audit.md).
A reference Contentful starter app lives in [cf-starter/](../cf-starter/).

---

## Tracking progress & resuming

The `migration-manifest.json` in your workspace is the single source of truth.
Every successful command updates it; you never edit it by hand. Check where you
are at any time:

```bash
csdx migrate:status --workspace ./migration-workspace
cat ./migration-workspace/migration-manifest.json
```

This is also how you **resume**: the manifest tells you the last completed step,
so you just run the next command. Rough mapping from manifest state to next step:

```
no manifest / no source       -> Step 1 export (or skip if you already have export.json)
source set, no convert        -> Step 2 convert
convert set                   -> Step 3 model review -> Step 4 audit
audit clean                   -> Step 5 import
import.status = completed      -> Step 6 credentials -> Step 7 website
```

The manifest records timestamps and paths only — **never** management tokens or
full stack API keys (it keeps just a short `blt…` prefix after import).

---

## Going deeper

- **Run it with AI instead:** [migration-companion/README.md](../migration-companion/README.md)
  — the companion skill performs exactly this pipeline for you.
- **CLI plugin reference & internals:** this README (above) and
  [docs/](./docs/).
- **Why this product exists:** [docs/PRD.md](../docs/PRD.md).
- **Website porting detail:** [docs/contentful-vs-contentstack-audit.md](../docs/contentful-vs-contentstack-audit.md).
