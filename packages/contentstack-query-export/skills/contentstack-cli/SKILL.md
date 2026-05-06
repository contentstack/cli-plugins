---
name: contentstack-cli
description: Contentstack CLI query-export plugin — OCLIF command, QueryExporter, cli-utilities, and export behavior. Use for commands, core export logic, utils, and API usage in this repo.
---

# Contentstack CLI — query export

Guidance for **`@contentstack/cli-cm-export-query`**: query-driven export with dependency and asset handling.

## This package

- **Command:** `ExportQueryCommand` in `src/commands/cm/stacks/export-query.ts` extends **`Command`** from **`@contentstack/cli-command`**.
- **Orchestration:** **`QueryExporter`** and **`ModuleExporter`** in **`src/core/`**.
- **Helpers:** Query parsing, config, dependencies, assets, branches under **`src/utils/`**.
- **Integration:** **`@contentstack/cli-cm-export`**, **`@contentstack/cli-utilities`**, **`@oclif/core`** (transitive / manifest).

## Practices

- Authenticate and build the management client via **`@contentstack/cli-utilities`**; never log secrets.
- Keep **`run()`** thin; delegate to **`QueryExporter`** and existing utils.
- Respect rate limits and handle **429** / transient errors when adding API calls.
- Tests: mock SDK and file I/O; no real stack access in unit tests.

## Repository layout

| Area | Role |
|------|------|
| `src/commands/cm/stacks/export-query.ts` | CLI entry: flags, config setup, `QueryExporter` |
| `src/core/query-executor.ts` | `QueryExporter` — main export pipeline |
| `src/core/module-exporter.ts` | `ModuleExporter` — module export details |
| `src/utils/` | Query parser, config, branches, dependencies, assets, files, logger |
| `src/types/index.ts` | Shared types (e.g. `QueryExportConfig`, `Modules`) |
| `src/config/` | Defaults (copied to `lib/` on build) |

There is **no** `src/services/` directory in this repo.

## Command pattern

Use **`@contentstack/cli-command`** and **`@contentstack/cli-utilities`**:

```typescript
import { Command } from '@contentstack/cli-command';
import {
  flags,
  FlagInput,
  managementSDKClient,
  log,
  handleAndLogError,
} from '@contentstack/cli-utilities';
import { QueryExporter } from '../../../core/query-executor';

export default class ExportQueryCommand extends Command {
  static description = 'Export content from a stack using query-based filtering';

  static flags: FlagInput = {
    query: flags.string({
      required: true,
      description: 'Query as JSON string or file path',
    }),
    alias: flags.string({ char: 'a', description: 'Management token alias' }),
    // ...see export-query.ts for full flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ExportQueryCommand);
    // setupQueryExportConfig(flags), managementSDKClient(...), then:
    // const exporter = new QueryExporter(client, exportQueryConfig);
    // await exporter.execute();
  }
}
```

### Conventions

- Validate required inputs early (`query`, stack credentials).
- Use **`log`** with export **context** objects for structured messages.
- Use **`handleAndLogError`** for consistent error reporting where the codebase already does.

## Export pipeline (conceptual)

1. **Parse** query via **`QueryParser`** (JSON string or path to JSON file).
2. **Export** general and queried modules (aligned with **`@contentstack/cli-cm-export`**).
3. **Resolve** content types, references, and assets unless disabled (`skip-references`, `skip-dependencies`, `secured-assets`).

When extending behavior, prefer new methods on **`QueryExporter`** / **`ModuleExporter`** or focused utils under **`src/utils/`**.

## Authentication and secrets

- Resolve tokens through CLI utilities and command flags; do not print management tokens or API keys.
- Do not write secrets into export directories.

## API and rate limits

- Contentstack APIs are rate-limited; use delays or backoff on **429** when introducing new call patterns.
- In tests, stub **`managementSDKClient`**, stack client methods, and **`fsUtil`** as the existing unit tests do.

---

## Other CLI plugins (context)

Other Contentstack CLI packages sometimes use **`BaseBulkCommand`**, batch processors, or JSON logs under `bulk-operation/`. **This query-export plugin does not use those patterns.**

### Rate limit sketch (generic)

```typescript
class RateLimiter {
  private lastRequest = 0;
  private readonly minIntervalMs = 100; // order-of-magnitude; tune per API guidance

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.minIntervalMs) {
      await new Promise((r) => setTimeout(r, this.minIntervalMs - elapsed));
    }
    this.lastRequest = Date.now();
  }
}
```

Adapt to whatever **`@contentstack/cli-utilities`** or **`@contentstack/cli-cm-export`** already provides before adding parallel limiters.
