# Limitations and scope

Set expectations before running migrations for customers or production stacks.

## Supported today

| Area | Support |
|------|---------|
| Source CMS | **Contentful** only (`--legacy contentful`) |
| Destination | **Contentstack** via `csdx cm:stacks:import` |
| Export | Contentful CLI (`contentful` or `npx -y contentful-cli`) |
| Convert | In-plugin port of reference conversion engine |
| Audit / import | Native `csdx` stack commands |
| Locales | Configurable master locale; re-convert to fix |
| Assets | Exported/transformed; large spaces may need `--download-assets` on export |

## Not supported (v0.1)

| Area | Notes |
|------|------|
| Sanity, Storyblok, other CMS | Future adapters — see [architecture.md](./architecture.md) |
| `migrate:export` for non-Contentful | Not implemented |
| Inline import during convert | Use `migrate:import` separately |
| Stack creation | Create empty stack in UI first |
| Delivery token setup | Manual after import |
| Website / frontend code migration | Out of scope — separate effort |
| AI orchestration | Phase 6 / optional future |
| npm-published plugin install | Use `csdx plugins:link .` from clone |

## Operational requirements

1. **Empty destination stack** for import (recommended dev stack).
2. **`csdx auth:login`** before audit and import.
3. **Manual content model review** after convert, before audit/import — see [phase-5-manifest-and-review.md](./phases/phase-5-manifest-and-review.md).
4. **Audit before import** — import can run audit-fix internally; still review reports for real migrations.

## Validation expectations

- Unit tests cover convert on fixtures, flag mapping, manifest I/O, and spawn helpers.
- **True validation** of field-level Contentstack shape is **audit + import on your stack**, not tests alone.
- Re-run `migrate:convert` with `--master-locale` or `--affix` if model naming is wrong; edit `bundle/content_types/` only with care (then re-audit).

## Security

- Use `CONTENTFUL_MANAGEMENT_TOKEN` via environment variable when possible.
- Do not commit `export.json`, migration workspaces, or API keys.
- Manifest stores only non-secret metadata.

## Native command mapping

| Plugin | Under the hood |
|--------|----------------|
| `migrate:audit` | `csdx cm:stacks:audit` |
| `migrate:import` | `csdx cm:stacks:import` |
| `migrate:convert` | No native equivalent |
| `migrate:export` | `contentful space export` |

Fix workflow: `csdx cm:stacks:audit:fix` (not wrapped; use directly).
