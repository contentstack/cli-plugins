# Repository layout

## This repository (`cli-plugin-migrate`)

Self-contained **csdx plugin** source:

```
cli-plugin-migrate/
├── src/commands/migrate/     # oclif commands
├── src/adapters/contentful/  # export + convert orchestration
├── src/services/contentful/  # conversion engine (ported reference)
├── src/lib/                  # spawn helpers, manifest, bundle validation
├── test/fixtures/            # small Contentful export for tests & try-outs
├── docs/                     # documentation
├── package.json
└── README.md                 # primary user guide
```

Generated on build (not committed): `lib/`, `oclif.manifest.json`.

## Parent monorepo (optional)

Some teams keep the plugin inside a larger workspace, e.g. `contentful-cursor/`:

```
contentful-cursor/
├── cli-plugin-migrate/       # this plugin
├── references/
│   ├── import-contentful-cli-main/   # original reference CLI
│   ├── contentful-export-*.json      # large sample exports
│   └── contentstack-model/           # model notes (review helpers)
└── cf-starter/                # example app (if present)
```

In that layout:

- Large sample exports: `../references/contentful-export-*.json` from the plugin directory
- Vitest optional integration test uses the same path (skipped if file missing)

## Local migration workspaces (not in git)

Created when you run the CLI — **do not commit** (see `.gitignore`):

```
migration-workspace/
├── migration-manifest.json
├── export.json
├── contentstack-import/bundle/
└── audit-reports/
```

Or ad-hoc:

```
contentstack-import/bundle/
audit-reports/
```

These may contain customer content and tokens in export files. Keep them local or in secure storage.
