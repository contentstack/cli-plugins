# Migration Note — `@contentstack/cli-asset-management` (internal library) · v2

> Package: `@contentstack/cli-asset-management` · v2 version: `1.0.0-beta.5`
> Type: **internal library — no CLI commands.** Verified: no `src/commands` directory on `origin/v2-dev`.

## Summary

- **New in v2. Did not exist in v1** (absent from `cli-plugins @ origin/main` and from the `cli @ v1.59.0` monorepo).
- Provides the **Asset Management 2.0 ("cs-assets")** API adapter used internally by the **export** and **import** plugins. It is not installed or invoked directly by users and exposes **no `csdx` commands**.

## Migration impact

- **None directly.** There is nothing for a user to change about this package.
- The user-visible AM 2.0 behavior it powers is documented in the **export** and **import** guides:
  - [cli-cm-export.md](cli-cm-export.md) — §6 "New in export 2.x" (cs-assets export path, `modules.asset-management` → `modules.cs-assets` config rename).
  - [cli-cm-import.md](cli-cm-import.md) — §6 (cs-assets import path).
- AM 2.0 is **additive and conditional**: the cs-assets path is taken only when the stack has linked workspaces and the region exposes `csAssetsUrl`; otherwise export/import fall back to the legacy asset path.

## Doc-site

- No standalone doc page is needed (library). Ensure the AM 2.0 behavior is covered on the export/import pages instead.
