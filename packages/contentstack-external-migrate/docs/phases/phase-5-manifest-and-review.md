# Phase 5 — Manifest, status & model review

**Goal:** Track migration progress in a workspace manifest and document manual content model review.

**Delivers:** Resumable workflows and step 3 without AI.

---

## Scope

### In scope

- `src/lib/manifest.ts` — read/write `migration-manifest.json`
- `csdx migrate:status` command
- Each command updates manifest on success
- Manual review checklist (expert path for step 3)
- Delivery credentials checklist (step 6 — manual)

### Out of scope

- AI-driven review command
- Storing secrets in manifest
- Website conversion (Phase 6)

---

## Manifest schema (v1)

`migration-manifest.json` at workspace root:

```json
{
  "version": 1,
  "legacy": "contentful",
  "workspace": "./migration-workspace",
  "source": {
    "spaceId": "10897132",
    "exportedAt": "2026-06-03T09:00:00.000Z",
    "exportFile": "export.json"
  },
  "convert": {
    "completedAt": "2026-06-03T09:15:00.000Z",
    "bundleDir": "contentstack-import/bundle",
    "masterLocale": "en-US",
    "stats": { "locales": 2, "contentTypes": 16, "entries": 1204 }
  },
  "audit": {
    "lastRunAt": "2026-06-03T09:20:00.000Z",
    "reportPath": "audit-reports"
  },
  "import": {
    "completedAt": null,
    "stackApiKeyPrefix": "bltXXXX",
    "status": "pending"
  }
}
```

**Never store:** management tokens, delivery tokens, full stack keys (prefix only OK).

---

## Implementation

### `src/lib/manifest.ts`

```typescript
export interface MigrationManifest { /* ... */ }

export async function readManifest(workspace: string): Promise<MigrationManifest | null>;
export async function writeManifest(workspace: string, manifest: MigrationManifest): Promise<void>;
export async function patchManifest(workspace: string, patch: Partial<MigrationManifest>): Promise<void>;
```

Atomic write: temp file + rename.

Each command accepts `--workspace <dir>` (default: infer from `--output` or cwd).

| Command | Updates |
|---------|---------|
| `migrate:export` | `source` |
| `migrate:convert` | `convert` |
| `migrate:audit` | `audit` |
| `migrate:import` | `import` |

### `src/commands/migrate/status.ts`

```typescript
async run() {
  const manifest = await readManifest(workspace);
  if (!manifest) { this.error('No migration-manifest.json found'); }
  // Print step checklist with ✓ / ✗ and suggest next command
}
```

Example output:

```
Migration workspace: ./migration-workspace

  [✓] export    export.json
  [✓] convert   16 types, 1204 entries → contentstack-import/bundle
  [✓] audit     audit-reports
  [ ] import    not run

Next: csdx migrate:import -k <stack-api-key> -d ./migration-workspace/contentstack-import/bundle
```

---

## Step 3 — Manual model review

After convert, before audit/import. No CLI command required.

### Files to inspect

| Path | Purpose |
|------|---------|
| `bundle/mapper.json` | Field mapping table |
| `bundle/content_types/*.json` | Generated schemas |
| `bundle/reference/reference.json` | Reference mappings |
| `../references/contentstack-model/MODEL-RATIONALE.md` | Project notes |
| `../references/contentstack-model/CONVERSION-AUDIT.md` | Known risks |

### Checklist

1. Content type count matches expectation
2. UID naming OK? Re-convert with `--affix` if not
3. Master locale correct? Re-convert with `--master-locale` if not
4. Reference depth acceptable?
5. Modular blocks vs references — consult `cms-data-modeling-best-practices` skill
6. Spot-check JSON RTE in `bundle/entries/`
7. Taxonomies in `bundle/taxonomies/` if present

### Applying changes

| Change | Action |
|--------|--------|
| Locale / affix | Re-run `migrate:convert` |
| Manual schema edit | Edit `bundle/content_types/`, then audit |
| Structural redesign | Fix source export, re-convert |

**Rule:** no silent auto-modification.

### Optional AI review

Advisory only — developer approves all changes. Skills: `cms-data-modeling-best-practices`, `contentstack-vibe-docs`.

---

## Step 6 — Delivery credentials (manual)

Document in [expert-workflow.md](../expert-workflow.md):

1. Stack → Settings → copy API Key
2. Settings → Tokens → Delivery Token
3. Set env vars in target app (`CONTENTSTACK_API_KEY`, `CONTENTSTACK_DELIVERY_TOKEN`, region, environment)

---

## Acceptance criteria

- [ ] Commands write/update manifest on success
- [ ] `migrate:status` shows accurate state
- [ ] No secrets in manifest
- [ ] Review checklist usable without AI

---

## Manual test script

```bash
# After export + convert + audit
csdx migrate:status --workspace ./migration-workspace
cat ./migration-workspace/migration-manifest.json
```
