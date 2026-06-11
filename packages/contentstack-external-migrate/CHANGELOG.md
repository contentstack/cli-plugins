# Changelog

All notable changes to `@contentstack/cli-plugin-migrate` are documented here.

## [0.1.0] — 2026-06-03

### Added

- `csdx migrate:export` — Contentful space export via Contentful CLI
- `csdx migrate:convert` — Contentful export → Contentstack import bundle
- `csdx migrate:audit` — wrapper for `csdx cm:stacks:audit`
- `csdx migrate:import` — wrapper for `csdx cm:stacks:import`
- `csdx migrate:status` — migration workspace manifest and next-step hints
- `migration-manifest.json` tracking (no secrets)
- Documentation set under `docs/` and root `README.md`

### Notes

- Contentful-only (`--legacy contentful`)
- Install via `csdx plugins:link .` after `npm run build`
- Import requires an empty destination stack and `csdx auth:login`
