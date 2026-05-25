# Regex Validate plugin migration: standalone repo → cli-plugins monorepo

## Summary

The **@contentstack/cli-cm-regex-validate** plugin has moved from the standalone repository [contentstack/cli-cm-regex-validate](https://github.com/contentstack/cli-cm-regex-validate) into the [contentstack/cli-plugins](https://github.com/contentstack/cli-plugins) monorepo at **`packages/contentstack-cli-cm-regex-validate`**.

The **npm package name is unchanged**: `@contentstack/cli-cm-regex-validate`. This is the **first npm release** — the package was previously not published.

First release: **1.0.0** (v1 line) / **2.0.0-beta.0** (v2-beta line).

## Repository and issue tracking

| Before | After |
| --- | --- |
| Source: `github.com/contentstack/cli-cm-regex-validate` | Source: `github.com/contentstack/cli-plugins` → `packages/contentstack-cli-cm-regex-validate` |
| Issues: cli-cm-regex-validate repo | Issues: [cli-plugins issues](https://github.com/contentstack/cli-plugins/issues) (label or mention `regex-validate`) |

The standalone **cli-cm-regex-validate** repository should be **archived** after the first release from cli-plugins.

## Version lines

| CLI line | cli-plugins branch | Plugin notes |
| --- | --- | --- |
| **1.x** | `v1-dev` / `main` | `@contentstack/cli-command ^1.8.2`, `@contentstack/cli-utilities ^1.18.3`; npm tag `latest`; version `1.0.0` |
| **2.x beta** | `v2-dev` / `v2-beta` | `@contentstack/cli-command ~2.0.0-beta.7`, `@contentstack/cli-utilities ~2.0.0-beta.8`; npm tag `beta`; version `2.0.0-beta.0` |

## Install

```bash
csdx plugins:install @contentstack/cli-cm-regex-validate
```

## Command (unchanged)

| Command | Description |
| --- | --- |
| `csdx cm:stacks:validate-regex` | Validate fields with regex property in Content Types and Global Fields of a Stack |

Flags: `-a` (token alias), `-c` (content types), `-g` (global fields), `-f` (CSV output path).

## Local development

```bash
cd cli-plugins
pnpm install
pnpm --filter @contentstack/cli-cm-regex-validate run build
pnpm --filter @contentstack/cli-cm-regex-validate test
```

## Test framework note

This package uses **Jest + ts-jest** (unlike most other packages in this monorepo which use Mocha + Chai). Tests live under `packages/contentstack-cli-cm-regex-validate/test/` and run via `pnpm test` or `pnpm run test:unit`.

## Related migrations

- Apps CLI: [APPS-CLI-MIGRATION.md](./APPS-CLI-MIGRATION.md)
