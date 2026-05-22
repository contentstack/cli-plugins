# Migrate RTE migration: standalone repo → cli-plugins monorepo

## Summary

**@contentstack/cli-cm-migrate-rte** moved from [contentstack/cli-cm-migrate-rte](https://github.com/contentstack/cli-cm-migrate-rte) into [contentstack/cli-plugins](https://github.com/contentstack/cli-plugins) at **`packages/contentstack-migrate-rte`**.

The npm package name and command **`csdx cm:entries:migrate-html-rte`** are unchanged.

## Repository and issues

| Before | After |
| --- | --- |
| `github.com/contentstack/cli-cm-migrate-rte` | `github.com/contentstack/cli-plugins` → `packages/contentstack-migrate-rte` |
| Issues on standalone repo | [cli-plugins issues](https://github.com/contentstack/cli-plugins/issues) |

## Version lines (1.x vs 2.x)

| CLI line | cli-plugins branch | Plugin notes |
| --- | --- | --- |
| **1.x** | `v1-dev` / `v1-beta` | 1.x-compatible `cli-command` / `cli-utilities` |
| **2.x beta** | `v2-dev` / `v2-beta` | e.g. `2.0.0-beta.x`; uses `@contentstack/json-rte-serializer`, jsdom |

## Install

```bash
csdx plugins:install @contentstack/cli-cm-migrate-rte
# or
npm install -g @contentstack/cli-cm-migrate-rte
```

## Local development

```bash
cd cli-dev-workspace
pnpm install
pnpm --filter @contentstack/cli-cm-migrate-rte run build
pnpm --filter @contentstack/cli-cm-migrate-rte test
```

Core CLI: add `@contentstack/cli-cm-migrate-rte` to `cli/packages/contentstack` dependencies and `oclif.plugins` (use `workspace:*` in cli-dev-workspace).
