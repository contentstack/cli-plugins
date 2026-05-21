# Apps CLI migration: standalone repo → cli-plugins monorepo

## Summary

The **@contentstack/apps-cli** plugin has moved from [contentstack/contentstack-apps-cli](https://github.com/contentstack/contentstack-apps-cli) into [contentstack/cli-plugins](https://github.com/contentstack/cli-plugins) at **`packages/contentstack-apps-cli`**.

The **npm package name is unchanged**: `@contentstack/apps-cli`.

## Repository and issues

| Before | After |
| --- | --- |
| `github.com/contentstack/contentstack-apps-cli` | `github.com/contentstack/cli-plugins` → `packages/contentstack-apps-cli` |
| Issues on standalone repo | [cli-plugins issues](https://github.com/contentstack/cli-plugins/issues) |

## Version lines (1.x vs 2.x)

| CLI line | cli-plugins branch | Apps plugin |
| --- | --- | --- |
| **1.x** | `v1-dev` / `v1-beta` | Version **1.7.x**; `@contentstack/cli-command` ~1.8.2, `@contentstack/cli-utilities` ~1.18.x; chalk v4 |
| **2.x beta** | `v2-dev` / `v2-beta` | Version **2.0.0-beta.x**; 2.x beta core packages; chalk v5 |

Develop and release each line on its branch.

## Install (unchanged)

```bash
csdx plugins:install @contentstack/apps-cli
```

## Local development (cli-dev-workspace)

```bash
cd cli-dev-workspace
pnpm install
pnpm --filter @contentstack/apps-cli run build
pnpm -C cli/packages/contentstack run build
```

Core CLI must list `@contentstack/apps-cli` as `workspace:*` and register it in `oclif.plugins` — see [cli](https://github.com/contentstack/cli) `packages/contentstack/package.json`.

## Contributor docs

- [AGENTS.md](./AGENTS.md)
- [skills/contentstack-apps/SKILL.md](./skills/contentstack-apps/SKILL.md)
