# Tsgen CLI migration: standalone repo → cli-plugins monorepo

## Summary

The **contentstack-cli-tsgen** plugin has moved from the standalone repositories [Contentstack-Solutions/contentstack-cli-tsgen](https://github.com/Contentstack-Solutions/contentstack-cli-tsgen) and [contentstack/contentstack-cli-tsgen](https://github.com/contentstack/contentstack-cli-tsgen) into the [contentstack/cli-plugins](https://github.com/contentstack/cli-plugins) monorepo at **`packages/contentstack-cli-tsgen`**.

The **npm package name is unchanged**: `contentstack-cli-tsgen`. Install and command usage stay the same (`csdx tsgen`).

## Repository and issue tracking

| Before | After |
| --- | --- |
| Source: standalone `contentstack-cli-tsgen` repos | Source: `github.com/contentstack/cli-plugins` → `packages/contentstack-cli-tsgen` |
| Issues: standalone repo | Issues: [cli-plugins issues](https://github.com/contentstack/cli-plugins/issues) (label or mention `tsgen` / `contentstack-cli-tsgen`) |

The standalone **contentstack-cli-tsgen** repository should be **archived** after the first release from cli-plugins. Open PRs and bugs should be recreated or linked in cli-plugins.

## Version line (2.x beta only)

| CLI line | cli-plugins branch | Tsgen plugin notes |
| --- | --- | --- |
| **2.x beta** | `feat/migrate-external-cli-plugins-v2` → `v2-beta` | `@contentstack/cli-command` and `@contentstack/cli-utilities` on `~2.0.0-beta.*`; first monorepo release **`5.0.0-beta.0`** |

This migration does not maintain a `v1-dev` line for tsgen.

## Install (unchanged)

```bash
csdx plugins:install contentstack-cli-tsgen@beta
# or
npm install -g contentstack-cli-tsgen
```

Requires **Contentstack CLI 2.x beta** and a **delivery token** alias for `csdx tsgen`.

## Local development

Clone [cli-dev-workspace](https://github.com/contentstack/cli-dev-workspace) (or cli-plugins only), then:

```bash
cd cli-plugins
pnpm install
pnpm --filter contentstack-cli-tsgen run build
cd packages/contentstack-cli-tsgen && csdx plugins:link
csdx tsgen --help
```

See [AGENTS.md](./AGENTS.md), package [AGENTS.md](./packages/contentstack-cli-tsgen/AGENTS.md), and [skills/typescript-cli-tsgen](./packages/contentstack-cli-tsgen/skills/typescript-cli-tsgen/SKILL.md) for contributor docs.

## Related migrations

- Core CLI: [cli](https://github.com/contentstack/cli) monorepo
- Apps CLI: [APPS-CLI-MIGRATION.md](./APPS-CLI-MIGRATION.md)
- Other external plugins: same cli-plugins consolidation effort
