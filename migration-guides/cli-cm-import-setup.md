# Migration Guide — `@contentstack/cli-cm-import-setup` (Import Setup) · 1.x → 2.x

> Command: `csdx cm:stacks:import-setup`
> Package: `@contentstack/cli-cm-import-setup` · v1: `1.7.3` (in the `cli` monorepo) · v2: `2.0.0-beta.16` (in `cli-plugins`)
> Status: verified against code — v1 = `contentstack/cli @ v1.59.0`, v2 = `contentstack/cli-plugins @ v2-dev`.
> Supporting utility for the **import** plugin — it generates the mapper/config scaffolding the import command consumes. See [cli-cm-import.md](cli-cm-import.md).

## 1. At a glance

| Area | 1.x | 2.x | Action |
|---|---|---|---|
| Command id | `cm:stacks:import-setup` | `cm:stacks:import-setup` | none |
| Alias | `cm:import-setup` also worked | **removed** | replace `cm:import-setup` → `cm:stacks:import-setup` |
| `--branch` short char | `-B` | **removed** | use `--branch` |
| Node.js | lower (`>=14`-era) | **`>=22`** | upgrade Node |
| Official doc page | none | none | **doc gap — create one before GA** |

## 2. Flag reference — 1.x → 2.x

| Flag | v1 | v2 |
|---|---|---|
| `--stack-api-key` / `-k` | ✓ | ✓ (unchanged) |
| `--data-dir` / `-d` | ✓ | ✓ (unchanged) |
| `--alias` / `-a` | ✓ | ✓ (unchanged) |
| `--module` | ✓ (no short char) | ✓ (unchanged) |
| `--branch` | `-B` | **`-B` removed** — long form only |

No flags were removed or renamed other than the `-B` short char.

## 3. Breaking changes

1. **`cm:import-setup` alias removed** — v1 had `static aliases = ['cm:import-setup']`; v2 is `static aliases = []`. Only `cm:stacks:import-setup` resolves → `cm:import-setup` returns "command not found."
2. **`--branch` short char `-B` removed** — use `--branch <name>`.
3. **Node `>=22`.**

## 4. Command translation

| 1.x | 2.x |
|---|---|
| `csdx cm:import-setup -k <key> -d ./content` | `csdx cm:stacks:import-setup -k <key> -d ./content` |
| `csdx cm:stacks:import-setup -a <alias> -B development` | `csdx cm:stacks:import-setup -a <alias> --branch development` |

## 5. Agent rules

1. `cm:import-setup` → `cm:stacks:import-setup`.
2. `-B` → `--branch`.
3. `-k -d -a` unchanged; `--module` unchanged.

**Example** — Input: `csdx cm:import-setup -k blt123 -d ./content -B dev` → Output: `csdx cm:stacks:import-setup -k blt123 -d ./content --branch dev`.
