# Migration manifest schema

File: **`migration-manifest.json`** at the migration workspace root.

Written/updated by `migrate:export`, `migrate:convert`, `migrate:audit`, and `migrate:import` on success. Read by `migrate:status`.

## Security

**Never stored in the manifest:**

- Contentful management tokens
- Delivery tokens
- Full stack API keys (only a short prefix after import, e.g. `blt1234…`)

## Schema (v1)

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
    "affix": "",
    "stats": {
      "locales": 2,
      "contentTypes": 16,
      "entries": 1204
    }
  },
  "audit": {
    "lastRunAt": "2026-06-03T09:20:00.000Z",
    "reportPath": "audit-reports"
  },
  "import": {
    "completedAt": "2026-06-03T10:00:00.000Z",
    "stackApiKeyPrefix": "blt1234…",
    "status": "completed"
  }
}
```

Paths (`exportFile`, `bundleDir`, `reportPath`) are **relative to the workspace root**.

## Fields

| Section | Field | Set by | Description |
|---------|-------|--------|-------------|
| root | `version` | all | Always `1` |
| root | `legacy` | export/convert | Source CMS (`contentful`) |
| root | `workspace` | all | Display path to workspace |
| `source` | `spaceId` | export | Contentful space ID |
| `source` | `exportedAt` | export | ISO timestamp |
| `source` | `exportFile` | export | Relative path to export JSON |
| `convert` | `completedAt` | convert | ISO timestamp |
| `convert` | `bundleDir` | convert, import | Relative path to bundle |
| `convert` | `masterLocale` | convert | Master locale used |
| `convert` | `affix` | convert | UID prefix if any |
| `convert` | `stats` | convert | `locales`, `contentTypes`, `entries` counts |
| `audit` | `lastRunAt` | audit | ISO timestamp |
| `audit` | `reportPath` | audit | Relative report directory |
| `import` | `completedAt` | import | ISO timestamp on success |
| `import` | `stackApiKeyPrefix` | import | First 7 chars + `…` |
| `import` | `status` | import | `completed` (or pending before run) |

## Workspace inference

Commands accept optional `--workspace` / `-w`. If omitted, the plugin infers the workspace from:

- Existing `migration-manifest.json` (walk up from `--data-dir` or `--input`)
- `--output` (e.g. `contentstack-import` → parent folder)
- Default: `./migration-workspace` for `migrate:status`

Implementation: `src/lib/manifest.ts`.

## Example

```bash
csdx migrate:status --workspace ./migration-workspace
```

Prints a checklist and suggests the next command.
