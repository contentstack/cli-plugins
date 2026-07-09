# Migration Note — `@contentstack/cli-variants` (internal library) · 1.x → 2.x

> Package: `@contentstack/cli-variants` · v1: `1.5.2` · v2: `2.0.0-beta.17`
> Type: **internal library — no CLI commands.** Verified: no `src/commands` directory on `origin/v2-dev`; package exists on both `origin/main` (v1) and `origin/v2-dev` (v2).

## Summary

- Handles **variant entries and personalization** export/import, used internally by the **export** and **import** plugins. Exposes **no `csdx` commands**.
- Existed in v1 (`1.5.2`) and continues in v2 (`2.x`).

## Migration impact

- **None directly** — no user-invoked commands or flags.
- The user-visible behavior it powers (branch scoping for Personalize/Variants) is documented in the export/import guides:
  - Branch support for **experiences** and a CMA **branch header** on variant list/PUT/publish are the genuinely new v2 parts (DX-4486 / DX-7310).
  - Variant-entries already carried a `branch` scope in v1, so that part is **not** net-new.
- In v2, `variant-entries` is also now a selectable `--module` value on the import command — see [cli-cm-import.md](cli-cm-import.md) §3.

## Doc-site

- No standalone doc page needed (library). Ensure variant/personalize branch behavior is covered on the export/import pages.
