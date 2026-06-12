# Phase 0 — Foundation

**Goal:** Scaffold a single-package `csdx` plugin with stub commands and a working dev link.

**Delivers:** `csdx plugins:link .` → `csdx migrate --help` lists all subcommands.

---

## Scope

### In scope

- Single npm package `@contentstack/cli-plugin-migrate`
- oclif plugin structure per vibe-docs CLI plugin guide
- Stub commands for all migration steps
- Build, test, link workflow
- Folder skeleton for adapters and services

### Out of scope

- Conversion, export, audit, or import logic
- npm publish
- CI beyond `npm test`

---

## Target `package.json`

```json
{
  "name": "@contentstack/cli-plugin-migrate",
  "version": "0.1.0",
  "description": "Contentful → Contentstack migration plugin for csdx",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "files": ["/lib", "/oclif.manifest.json"],
  "oclif": {
    "commands": "./lib/commands",
    "bin": "csdx",
    "plugins": []
  },
  "scripts": {
    "build": "tsc && node scripts/copy-assets.js && oclif manifest",
    "test": "vitest run",
    "lint": "eslint . --ext .ts"
  },
  "dependencies": {
    "@contentstack/cli-command": "^1.6.1",
    "@contentstack/cli-utilities": "^1.14.4",
    "@oclif/core": "^4.8.0"
  },
  "devDependencies": {
    "@oclif/test": "^3.0.0",
    "@types/node": "^20.12.12",
    "typescript": "^5.3.3",
    "vitest": "^4.0.18"
  },
  "engines": { "node": ">=20.0.0" }
}
```

Bootstrap alternative:

```bash
csdx plugins:create
# name: cli-plugin-migrate
# command namespace: migrate
```

Then adjust `package.json` name to `@contentstack/cli-plugin-migrate`.

---

## Folder skeleton

Create empty dirs with placeholder exports:

```
src/
├── commands/migrate/
│   ├── convert.ts
│   ├── export.ts
│   ├── audit.ts
│   ├── import.ts
│   └── status.ts
├── adapters/
│   ├── types.ts
│   ├── registry.ts
│   └── contentful/index.ts
├── services/contentful/.gitkeep
├── lib/
│   ├── csdx-spawn.ts
│   ├── bundle.ts
│   └── log.ts
└── index.ts
```

### Stub command pattern

```typescript
import { Command } from '@contentstack/cli-command';

export default class MigrateConvert extends Command {
  static description = 'Convert a legacy CMS export to a Contentstack import bundle';

  async run(): Promise<void> {
    this.log('Not implemented yet — see docs/phases/phase-1-convert.md');
  }
}
```

Repeat for `export` (Phase 4), `audit` (Phase 2), `import` (Phase 3), `status` (Phase 5).

### Adapter registry stub

```typescript
// src/adapters/registry.ts
export function getAdapter(legacy: string) {
  throw new Error(`Adapter "${legacy}" not implemented yet`);
}
```

---

## `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "declaration": true,
    "outDir": "./lib",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "lib", "test"]
}
```

---

## Dev workflow

```bash
cd cli-plugin-migrate
npm install
npm run build
csdx plugins:link .
csdx plugins:list
csdx migrate --help
```

After code changes:

```bash
npm run build
# linked plugin picks up lib/ changes automatically
```

Unlink when done:

```bash
csdx plugins:unlink cli-plugin-migrate
```

---

## Acceptance criteria

- [ ] `npm run build` succeeds and generates `oclif.manifest.json`
- [ ] `csdx plugins:link .` registers the plugin
- [ ] `csdx migrate --help` lists: convert, export, audit, import, status
- [ ] Each subcommand `--help` renders without error
- [ ] `npm test` runs (smoke test OK)

---

## Manual test script

```bash
cd cli-plugin-migrate
npm install && npm run build
csdx plugins:link .
csdx migrate --help
csdx migrate:convert --help
csdx migrate:audit --help
csdx migrate:import --help
```

---

## Notes

- Node 20+ (vibe-docs CLI plugin requirement)
- Global `@contentstack/cli` required for `csdx plugins:link`
- Package lives at repo root `cli-plugin-migrate/` — not nested under `packages/`
