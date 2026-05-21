# Apps CLI migration: standalone repo → cli-plugins monorepo

## Summary

The **@contentstack/apps-cli** plugin (`contentstack-apps-cli`) has moved from the standalone repository [contentstack/contentstack-apps-cli](https://github.com/contentstack/contentstack-apps-cli) into the [contentstack/cli-plugins](https://github.com/contentstack/cli-plugins) monorepo at **`packages/contentstack-apps-cli`**.

The **npm package name is unchanged**: `@contentstack/apps-cli`. Install and command usage stay the same.

## Repository and issue tracking

| Before | After |
| --- | --- |
| Source: `github.com/contentstack/contentstack-apps-cli` | Source: `github.com/contentstack/cli-plugins` → `packages/contentstack-apps-cli` |
| Issues: contentstack-apps-cli repo | Issues: [cli-plugins issues](https://github.com/contentstack/cli-plugins/issues) (label or mention `apps-cli` / `@contentstack/apps-cli`) |

The standalone **contentstack-apps-cli** repository is **archived** after the first release from cli-plugins. Open PRs and bugs should be recreated or linked in cli-plugins.

## Version lines (1.x vs 2.x)

| CLI line | cli-plugins branch | Apps plugin notes |
| --- | --- | --- |
| **1.x** | `v1-dev` / `v1-beta` | `@contentstack/cli-command` and `@contentstack/cli-utilities` on 1.x-compatible ranges |
| **2.x beta** | `v2-dev` / `v2-beta` | Align with 2.x beta core packages (same pattern as export, import, bootstrap) |

Develop and release each line on its branch; do not mix 1.x and 2.x dependency pins in the same branch.

## Install (unchanged)

```bash
csdx plugins:install @contentstack/apps-cli
# or
npm install -g @contentstack/apps-cli
```

## Local development

Clone [cli-dev-workspace](https://github.com/contentstack/cli-dev-workspace) (or cli-plugins only), then:

```bash
cd cli-plugins
pnpm install
pnpm --filter @contentstack/apps-cli run build
pnpm --filter @contentstack/apps-cli test
```

See [AGENTS.md](./AGENTS.md), [skills/contentstack-cli/SKILL.md](./skills/contentstack-cli/SKILL.md#apps-cli-commands-app), and [skills/framework/SKILL.md](./skills/framework/SKILL.md#apps-cli-plugin-contentstackapps-cli) for contributor docs.

## Related migrations

- Core CLI: [cli](https://github.com/contentstack/cli) monorepo
- Other external plugins (bulk operations, migrate-rte): same cli-plugins consolidation effort
