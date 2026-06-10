# Expert workflow — no AI required

Complete Contentful → Contentstack migration using only CLI commands.

## Prerequisites

```bash
node --version    # 20+
npm i -g @contentstack/cli
csdx auth:login   # audit + import only

# Phase 4+:
export CONTENTFUL_MANAGEMENT_TOKEN="..."
```

Install the plugin (after Phase 0):

```bash
cd cli-plugin-migrate
npm install && npm run build
csdx plugins:link .
```

---

## Full pipeline

### 1. Export (Phase 4)

```bash
csdx migrate:export \
  --legacy contentful \
  --space-id YOUR_SPACE_ID \
  --output ./migration-workspace
```

Skip if you already have a Contentful export JSON (your own file, or `../references/contentful-export-*.json` in a monorepo).

### 2. Convert (Phase 1)

```bash
csdx migrate:convert \
  --legacy contentful \
  --input ./migration-workspace/export.json \
  --output ./migration-workspace/contentstack-import \
  --master-locale en-US
```

Output: `./migration-workspace/contentstack-import/bundle/`

### 3. Review content model (Phase 5 — manual)

```bash
cat ./migration-workspace/contentstack-import/bundle/mapper.json
ls ./migration-workspace/contentstack-import/bundle/content_types/
```

Checklist: [phase-5-manifest-and-review.md](./phases/phase-5-manifest-and-review.md)

### 4. Audit (Phase 2)

```bash
csdx migrate:audit \
  --data-dir ./migration-workspace/contentstack-import/bundle \
  --report-path ./migration-workspace/audit-reports
```

Fix:

```bash
csdx cm:stacks:audit:fix \
  --data-dir ./migration-workspace/contentstack-import/bundle
```

### 5. Import (Phase 3)

Empty destination stack required.

```bash
csdx migrate:import \
  --stack-api-key bltYOUR_KEY \
  --data-dir ./migration-workspace/contentstack-import/bundle \
  --yes
```

### 6. Delivery credentials (manual)

From Contentstack UI: Stack API Key + Delivery Token → app env vars.

### 7. Update application (future)

Separate Website Migration Skill — see Phase 6.

---

## Quick start (convert only)

**This repo only** (built-in fixture):

```bash
csdx migrate:convert \
  --legacy contentful \
  --input ./test/fixtures/contentful-export.json \
  --output ./contentstack-import \
  --master-locale en-US
```

**Monorepo** (large sample export):

```bash
csdx migrate:convert \
  --legacy contentful \
  --input ../references/contentful-export-nty6h2uki8mm-master-2026-06-02T15-32-37.json \
  --output ./contentstack-import \
  --master-locale en-US
```

---

## Check progress (Phase 5)

```bash
csdx migrate:status --workspace ./migration-workspace
```

---

## Native csdx equivalents

| Our command | Native |
|-------------|--------|
| `migrate:audit` | `csdx cm:stacks:audit` |
| `migrate:import` | `csdx cm:stacks:import` |
| `migrate:convert` | No native equivalent |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `csdx not found` | `npm i -g @contentstack/cli` |
| `Not logged in` | `csdx auth:login` |
| Invalid bundle | Run `migrate:convert` first |
| Import fails | Audit + audit:fix; verify empty stack |
| Wrong master locale | Re-run convert with `--master-locale` |
| Plugin missing | `csdx plugins:link .` from project root |
