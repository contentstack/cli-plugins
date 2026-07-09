# Migration Guide — `contentstack-cli-tsgen` (TypeScript typings generator) · v1 → v2

> Command: `csdx tsgen`
> Package: `contentstack-cli-tsgen`  ·  v1 line: `4.x` (baseline `4.10.1`)  ·  v2 line: `5.x` (ships today as `5.0.0-beta.2`)
> Status: verified against code.
>   - **v1 ref used:** `contentstack/cli-plugins @ origin/main` → `packages/contentstack-cli-tsgen` (version **4.10.1**). tsgen was an **external plugin** in the v1 era (installed via `csdx plugins:install contentstack-cli-tsgen`); `origin/main` is the pre-v2 line and is the concrete v1 source inspected here. Cross-checked against the official v1 doc: <https://www.contentstack.com/docs/headless-cms/tsgen-plugin>.
>   - **v2 ref used:** `contentstack/cli-plugins @ origin/v2-dev` → `packages/contentstack-cli-tsgen` (version **5.0.0-beta.2**). (The task brief referenced `5.0.0-beta.0`; the branch currently reads `5.0.0-beta.2` — noted so the version string isn't mistaken for a discrepancy.)

This guide is written to be read by **both a human and an LLM/agent**. If you feed this file to an agent along with a v1 `tsgen` command, the [Command Translation Rules](#7-agent-rules-v1--v2-command-translation) section is enough to emit the correct v2 command.

---

## 1. At a glance

| Area | v1 (`origin/main`, 4.10.1) | v2 (`v2-dev`, 5.0.0-beta.2) | Action needed |
|---|---|---|---|
| Command id | `tsgen` | `tsgen` | none (id unchanged) |
| Package | `contentstack-cli-tsgen` (external, `plugins:install`) | `contentstack-cli-tsgen` (now inside the cli-plugins monorepo) | none for callers; command is unchanged |
| Token alias flag | `--token-alias` (`-a`) | **`--alias`** (`-a`) | rename `--token-alias` → `--alias`; `-a` still works |
| `--output` short char | `-o, --output` | **`--output`** (`-o` removed) | use long `--output` |
| `--prefix` short char | `-p, --prefix` | **`--prefix`** (`-p` removed) | use long `--prefix` |
| `--doc` short char | `-d, --[no-]doc` | **`--[no-]doc`** (`-d` removed) | use long `--doc` / `--no-doc` |
| Node.js | `>=22.0.0` | `>=22.0.0` | none within inspected refs (see §4) |
| Other flags | `--branch`, `--include-system-fields`, `--include-editable-tags`, `--include-referenced-entry`, `--api-type`, `--namespace` | identical | none |

**Nothing about the core generation behaviour changes.** A normal `tsgen -a <alias> --output <file>` run works the same. The only breaking surface is the flag naming/short-char cleanup (§3) — and every one of those has an unchanged long form except the renamed `--token-alias`.

---

## 2. Quick command translation (copy-paste)

| v1 command | v2 command |
|---|---|
| `csdx tsgen -a <alias> -o ./gen.d.ts` | `csdx tsgen -a <alias> --output ./gen.d.ts` |
| `csdx tsgen --token-alias <alias> --output ./gen.d.ts` | `csdx tsgen --alias <alias> --output ./gen.d.ts` |
| `csdx tsgen -a <alias> -o ./gen.d.ts -p I` | `csdx tsgen -a <alias> --output ./gen.d.ts --prefix I` |
| `csdx tsgen -a <alias> -o ./gen.d.ts -d` | `csdx tsgen -a <alias> --output ./gen.d.ts --doc` |
| `csdx tsgen -a <alias> -o ./gen.d.ts --no-doc` | `csdx tsgen -a <alias> --output ./gen.d.ts --no-doc` (unchanged) |
| `csdx tsgen -a <alias> --output ./gen.d.ts --api-type graphql --namespace GraphQL` | identical (unchanged) |

`-a` is the only short char that survives. `-o`, `-p`, and `-d` no longer exist — passing them errors with "Nonexistent flag".

---

## 3. Flag reference — v1 → v2 (real, merged changes only)

Both flag sets below were read directly from `src/commands/tsgen.ts` on each ref.

### v1 (`origin/main`, 4.10.1) — exact set

| Flag | Short | Required | Default | Notes |
|---|---|---|---|---|
| `--token-alias` | `-a` | yes | — | delivery token alias |
| `--output` | `-o` | yes | — | full path to output |
| `--prefix` | `-p` | no | `""` | interface prefix, e.g. `"I"` |
| `--doc` / `--no-doc` | `-d` | no | `true` | include documentation comments (`allowNo`) |
| `--branch` | — | no | — | branch |
| `--include-system-fields` | — | no | `false` | |
| `--include-editable-tags` | — | no | `false` | |
| `--include-referenced-entry` | — | no | `false` | |
| `--api-type` | — | no | `rest` | options: `rest`, `graphql` |
| `--namespace` | — | no | — | GraphQL namespace |

This matches the official v1 doc verbatim (`-a/--token-alias`, `-o/--output`, `-p/--prefix`, `-d/--[no-]doc`, plus the same optional set).

### v2 (`origin/v2-dev`, 5.0.0-beta.2) — exact set (SHIPS TODAY)

| Flag | Short | Required | Default | Notes |
|---|---|---|---|---|
| `--alias` | `-a` | yes | — | delivery token alias (**renamed** from `--token-alias`) |
| `--output` | — | yes | — | full path to output (`-o` **removed**) |
| `--prefix` | — | no | `""` | interface prefix (`-p` **removed**) |
| `--doc` / `--no-doc` | — | no | `true` | include documentation comments, `allowNo` (`-d` **removed**) |
| `--branch` | — | no | — | branch |
| `--include-system-fields` | — | no | `false` | unchanged |
| `--include-editable-tags` | — | no | `false` | unchanged |
| `--include-referenced-entry` | — | no | `false` | unchanged |
| `--api-type` | — | no | `rest` | options: `rest`, `graphql` — unchanged |
| `--namespace` | — | no | — | unchanged |

### Changed rows (v1 → v2)

| v1 | v2 | Change |
|---|---|---|
| `-a, --token-alias` | `-a, --alias` | **renamed** long name; short `-a` kept |
| `-o, --output` | `--output` | short `-o` **removed** |
| `-p, --prefix` | `--prefix` | short `-p` **removed** |
| `-d, --[no-]doc` | `--[no-]doc` | short `-d` **removed** |

Everything else (names, defaults, required-ness, `api-type` enum) is identical between the two refs.

---

## 4. Node engine

- `origin/main` (v1, 4.10.1) `package.json` → `engines.node: ">=22.0.0"` (bumped to 22 on `origin/main` in commit `df4fe437`, "Upgraded Node version to 22 for plugins").
- `origin/v2-dev` (v2, 5.0.0-beta.2) `package.json` → `engines.node: ">=22.0.0"`.

**Within the inspected refs there is no Node bump — both require `>=22`.** If you are migrating from a much older **externally published** tsgen release (pre-monorepo) rather than from `origin/main`, that historical build required an older Node; that older artifact was not inspected here, so treat `>=22` as the verified requirement for both the v1 baseline used and v2.

---

## 5. ⚠️ Pending decision (DX-9363) — actual repo state contradicts the "not merged" premise

The brief flagged an **open decision** about removing tsgen short flags (`-a/--token-alias`, `-o/--output`, `-p/--prefix`, `-d/--[no-]doc`) and stated that branch `origin/fix/DX-9363` "reportedly renames `--token-alias`→`--alias` and removes `-o/-p/-d`" and is **not merged** into `v2-dev`.

**Inspection of the repository does not support "not merged." The change has already shipped.** Evidence (all from `contentstack/cli-plugins`):

- `git merge-base --is-ancestor origin/fix/DX-9363 origin/v2-dev` → **true**. `origin/fix/DX-9363` (tip `c57bef99`) is an **ancestor of `origin/v2-dev`** — i.e. fully contained/merged. `v2-dev` is 45 commits ahead of it; the branch is 0 commits ahead.
- `git diff origin/v2-dev origin/fix/DX-9363 -- .../src/commands/tsgen.ts` → **empty**. The two `tsgen.ts` files are **byte-identical**; both already declare `--alias` (`-a`) and carry **no** `-o/-p/-d`.
- The two commits that performed this cleanup — `d840c17d` "fix(flags): normalize short flag consistency across … tsgen …" and `1fcb2658` "updated short flags of external commands" — are present in `origin/v2-dev`'s history for `tsgen.ts`.

**So:** the `--token-alias`→`--alias` rename and the removal of `-o`, `-p`, `-d` are **not pending — they are the current shipped v2-dev behaviour** documented in §3. There is no unmerged branch that would additionally change these flags; DX-9363's `tsgen.ts` introduces **zero** delta over `v2-dev`.

> If a genuine open question remains, it is the inverse — whether to **restore** the removed short chars (`-o/-p/-d`) for backward compatibility. No branch or revert doing that exists in the inspected refs. This callout is retained per the brief, but the flag change itself is **already merged and live in v2-dev**.

The only real differences on the `origin/fix/DX-9363` branch versus `v2-dev` are stale metadata that `v2-dev` has since moved past:
- `package.json` version `5.0.0-beta.1` on DX-9363 vs `5.0.0-beta.2` on `v2-dev`.
- An **older README** on DX-9363 that still documents `-a/--token-alias`, `-o/--output`, `-p/--prefix`, `-d/--[no-]doc` (i.e. the pre-cleanup docs) — see §6.

---

## 6. README / "See code" accuracy issues (v2-dev)

Two inaccuracies in the current `origin/v2-dev` `README.md` for this package, both verified against `src/commands/tsgen.ts`:

1. **`-o` documented but not implemented.** The README FLAGS block lists:
   ```
   -a, --alias=<value>    (required) delivery token alias
   -o, --output=<value>   (required) full path to output
   ```
   The source defines `output` with **no `char`** — `-o` does not exist in v2. The README's `-o, --output` is stale. (`--alias`, `--prefix`, `--[no-]doc` are shown correctly without short chars.)

2. **"See code" link points to the wrong branch.** The README footer reads:
   ```
   _See code: [src/commands/tsgen.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-cli-tsgen/src/commands/tsgen.ts)_
   ```
   `blob/main` resolves to the **v1 line (4.10.1)**, whose `tsgen.ts` still has `--token-alias` and `-o/-p/-d`. A reader following this link from the v2 README lands on v1 source. It should point at the v2 branch (e.g. `v2-beta`/`v2-dev`). The link is generated from `oclif`'s `repositoryPrefix` in `package.json`, which is set to `…/blob/main/…` while `homepage` uses `…/tree/v2-beta/…` — the two disagree.

Neither issue affects runtime; both are doc-accuracy fixes to make before GA.

---

## 7. Agent rules: v1 → v2 command translation

Apply in order and output the v2 equivalent:

1. **Command:** `tsgen` is unchanged.
2. **Rename (value-preserving):** `--token-alias` → `--alias`. (`-a` maps to `--alias` and is unchanged.)
3. **Short-char expansions (short char removed in v2):**
   - `-o <path>` → `--output <path>`
   - `-p <val>`  → `--prefix <val>`
   - `-d`        → `--doc`  (and any `--no-doc` stays `--no-doc`)
4. **Unchanged, pass through verbatim:** `-a`, `--branch`, `--include-system-fields`, `--include-editable-tags`, `--include-referenced-entry`, `--api-type <rest|graphql>`, `--namespace`.
5. **`--api-type` validation:** only `rest` and `graphql` are valid; flag anything else as an error.
6. **Never invent flags.** If a v1 flag isn't in this guide, keep it and note it's unverified.

**Worked example**
Input:  `csdx tsgen --token-alias prod -o ./types/gen.d.ts -p I -d`
Output: `csdx tsgen --alias prod --output ./types/gen.d.ts --prefix I --doc`

---

## 8. Migration checklist

- [ ] `--token-alias` → `--alias` in all scripts (`-a` needs no change).
- [ ] `-o` → `--output`, `-p` → `--prefix`, `-d` → `--doc` (long forms).
- [ ] Confirm Node runtime `>=22` (already required by the v1 `origin/main` baseline).
- [ ] Don't rely on the v2 README's `-o` example or its `blob/main` "See code" link (§6) — both are stale.
- [ ] Note that the short-flag removal is **already shipped** in v2-dev, not pending (§5).
