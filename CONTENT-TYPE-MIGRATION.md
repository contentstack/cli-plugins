# Content Type plugin migration: standalone repo → cli-plugins monorepo

## Summary

The **contentstack-cli-content-type** plugin has moved from the standalone repository [contentstack/contentstack-cli-content-type](https://github.com/contentstack/contentstack-cli-content-type) into the [contentstack/cli-plugins](https://github.com/contentstack/cli-plugins) monorepo at **`packages/contentstack-content-type`**.

The **npm package name is unchanged**: `contentstack-cli-content-type`. Install and command usage stay the same.

First release from the monorepo: **2.0.0-beta.0** (previously 1.4.6 from the standalone repo).

## Repository and issue tracking

| Before | After |
| --- | --- |
| Source: `github.com/contentstack/contentstack-cli-content-type` | Source: `github.com/contentstack/cli-plugins` → `packages/contentstack-content-type` |
| Issues: contentstack-cli-content-type repo | Issues: [cli-plugins issues](https://github.com/contentstack/cli-plugins/issues) (label or mention `content-type` / `contentstack-cli-content-type`) |

The standalone **contentstack-cli-content-type** repository should be **archived** after the first release from cli-plugins. Open PRs and bugs should be recreated or linked in cli-plugins.

## Version lines (1.x vs 2.x)

| CLI line | cli-plugins branch | Plugin notes |
| --- | --- | --- |
| **1.x** | `v1-dev` / `main` | `@contentstack/cli-command ~1.8.2`, `@contentstack/cli-utilities ~1.18.3`; npm tag `latest` |
| **2.x beta** | `v2-dev` / `v2-beta` | Align with 2.x beta core packages; npm tag `beta` |

Develop and release each line on its branch; do not mix 1.x and 2.x dependency pins in the same branch.

## Install (unchanged)

```bash
csdx plugins:install contentstack-cli-content-type
```

## Commands (unchanged)

All 6 commands are identical to the standalone version:

| Command | Description |
| --- | --- |
| `csdx content-type:list` | List all Content Types in a Stack |
| `csdx content-type:details` | Display Content Type fields, types, references, and paths |
| `csdx content-type:audit` | Display recent changes (audit log) for a Content Type |
| `csdx content-type:compare` | Compare two versions of a Content Type in the same Stack |
| `csdx content-type:compare-remote` | Compare the same Content Type across two Stacks |
| `csdx content-type:diagram` | Generate a visual diagram (SVG or DOT) of the Stack content model |

## Local development

Clone [cli-dev-workspace](https://github.com/contentstack/cli-dev-workspace) (or cli-plugins only), then:

```bash
cd cli-plugins
pnpm install
pnpm --filter contentstack-cli-content-type run build
pnpm --filter contentstack-cli-content-type test
```

To link the plugin locally into your `csdx` installation:

```bash
cd packages/contentstack-content-type
csdx plugins:link
```

See [packages/contentstack-content-type/AGENTS.md](./packages/contentstack-content-type/AGENTS.md) and the [skills/](./packages/contentstack-content-type/skills/) directory for contributor docs.

## Test framework note

This package uses **Jest + ts-jest** (unlike most other packages in this monorepo which use Mocha + Chai). Tests live under `packages/contentstack-content-type/tests/` and run via `pnpm test` or `pnpm run test:unit`.

## Related migrations

- Apps CLI: [APPS-CLI-MIGRATION.md](./APPS-CLI-MIGRATION.md)
- Tsgen plugin: [TSGEN-MIGRATION.md](./TSGEN-MIGRATION.md)
- Core CLI: [cli](https://github.com/contentstack/cli) monorepo
