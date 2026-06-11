# Getting started

Onboarding guide for teammates using `csdx migrate`. For the full command reference, see [README.md](../README.md).

## 1. Install tools

```bash
node --version          # must be 20+
npm i -g @contentstack/cli
# optional for export:
npm i -g contentful-cli
```

## 2. Install this plugin

Clone this repository, then from the repo root:

```bash
npm install
npm run build
csdx plugins:link .
csdx migrate --help
```

You should see subcommands: `export`, `convert`, `audit`, `import`, `status`.

If commands are missing, run `npm run build` again and re-link. Check `csdx plugins` for duplicate migrate plugins and unlink old ones.

## 3. Try convert (no Contentful account)

Uses the built-in test fixture only — works with **this repo alone** (no parent `references/` folder):

```bash
csdx migrate:convert \
  --legacy contentful \
  --input ./test/fixtures/contentful-export.json \
  --output ./contentstack-import \
  --master-locale en-US
```

Inspect output:

```bash
ls ./contentstack-import/bundle/content_types/
cat ./contentstack-import/bundle/mapper.json
```

## 4. Audit and import (needs Contentstack)

```bash
csdx auth:login

csdx migrate:audit \
  -d ./contentstack-import/bundle \
  --report-path ./audit-reports

# Empty destination stack required:
csdx migrate:import \
  -k YOUR_STACK_API_KEY \
  -d ./contentstack-import/bundle \
  -y
```

## 5. Full production-style run

Use a dedicated workspace and manifest tracking — step-by-step: [expert-workflow.md](./expert-workflow.md).

Summary:

1. `migrate:export` (needs `CONTENTFUL_MANAGEMENT_TOKEN` + space ID), **or** use an existing Contentful export JSON
2. `migrate:convert`
3. **Manual review** of `bundle/content_types/` — [phase-5-manifest-and-review.md](./phases/phase-5-manifest-and-review.md)
4. `migrate:audit` → optional `csdx cm:stacks:audit:fix`
5. `migrate:import`
6. Delivery tokens in Contentstack UI

Check progress anytime:

```bash
csdx migrate:status --workspace ./migration-workspace
```

## Repository layouts

| Layout | Sample export path |
|--------|-------------------|
| **This repo only** | `./test/fixtures/contentful-export.json` or your own `export.json` |
| **Monorepo** (`cli-plugin-migrate` next to `references/`) | `../references/contentful-export-*.json` |

Details: [repository-layout.md](./repository-layout.md).

## What to read next

- [limitations-and-scope.md](./limitations-and-scope.md) — supported CMS, stack requirements, validation expectations
- [manifest-schema.md](./manifest-schema.md) — `migration-manifest.json` fields
- [expert-workflow.md](./expert-workflow.md) — complete copy-paste workflow
