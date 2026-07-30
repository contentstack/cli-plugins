# Migration Guide — `@contentstack/cli-bulk-operations` (Bulk publish/unpublish) · 1.x → 2.x

> v1 package: `@contentstack/cli-cm-bulk-publish` (commands `cm:entries:*`, `cm:assets:*`, `cm:bulk-publish:*`, `cm:stacks:publish*`)
> v2 package: `@contentstack/cli-bulk-operations` (commands `cm:stacks:bulk-*`)
> Status: verified against code — v1 = `contentstack/cli @ v1.59.0` + the official [bulk publish/unpublish docs](https://www.contentstack.com/docs/developers/cli/bulk-publish-and-unpublish-content); v2 = `contentstack/cli-plugins @ v2-dev`.

**This is the most disruptive plugin migration.** ~15 separate v1 commands collapse into a small set of `--operation`/`--filter`-driven commands. Every old command id is **removed** → "command not found." All scripts/CI calling the old names must be rewritten.

> ⚠️ **Two decisions still open in code (may change what's below before GA):**
> 1. **`bulk-am-assets` may be merged into `bulk-assets`** — if that lands, there are 3 commands, not 4, and AM 2.0 delete/move moves under `bulk-assets`.
> 2. **`--api-version` may be removed** (NRP decision) — currently present on `bulk-entries`/`bulk-taxonomies` (default `3.2`).
> This guide reflects `v2-dev` **as it stands today**.

---

## 1. At a glance

| Area | 1.x | 2.x |
|---|---|---|
| Command model | ~15 purpose-specific commands | 4 commands driven by `--operation` + `--filter` |
| Commands | `cm:entries:publish`, `cm:assets:unpublish`, `cm:bulk-publish:cross-publish`, `cm:stacks:publish-revert`, … | `cm:stacks:bulk-entries`, `cm:stacks:bulk-assets`, `cm:stacks:bulk-taxonomies`, `cm:stacks:bulk-am-assets` |
| Publish vs unpublish | separate commands | one command, `--operation publish\|unpublish` |
| "bulk" toggle | `--bulk-publish` / `--bulk-unpublish` (boolean) | `--publish-mode bulk\|single` (default `bulk`) |
| Env / locale flags | mixed singular (`--environment`, `--locale`) & plural | consistent plural (`--environments`, `--locales`) |
| Retry | `--retry-failed` (boolean) | `--retry-failed <path>` (path to prior run dir) |
| Revert | `cm:stacks:publish-revert` command | `--revert <path>` flag |
| Output mode | plain, line-by-line `[timestamp] INFO:` logs | **progress-bar UI + end-of-run summary** by default (console logs suppressed) |
| Node.js | `>=14` | `>=22` |

---

## 2. Command translation map (v1 → v2)

| v1 command | v2 equivalent |
|---|---|
| `cm:entries:publish` | `cm:stacks:bulk-entries --operation publish` |
| `cm:entries:unpublish` | `cm:stacks:bulk-entries --operation unpublish` |
| `cm:entries:publish-modified` | `cm:stacks:bulk-entries --operation publish --filter modified` |
| `cm:entries:publish-only-unpublished` | `cm:stacks:bulk-entries --operation publish --filter unpublished` |
| `cm:entries:publish-non-localized-fields` | `cm:stacks:bulk-entries --operation publish --filter non-localized` |
| `cm:entries:update-and-publish` | `cm:stacks:bulk-entries --operation publish --filter draft` |
| `cm:bulk-publish:cross-publish` | `cm:stacks:bulk-entries --operation publish --source-env <env> --source-alias <alias>` (same for assets via `bulk-assets`) |
| `cm:assets:publish` | `cm:stacks:bulk-assets --operation publish` |
| `cm:assets:unpublish` | `cm:stacks:bulk-assets --operation unpublish` |
| `cm:stacks:publish` | `cm:stacks:bulk-entries` / `cm:stacks:bulk-assets --operation publish` |
| `cm:stacks:unpublish` | `cm:stacks:bulk-entries` / `cm:stacks:bulk-assets --operation unpublish` |
| `cm:stacks:publish-revert` | `cm:stacks:bulk-entries --revert <path>` (or `bulk-assets`) |
| `cm:stacks:publish-configure` | **removed** — no config-template generator. Write the config JSON by hand and pass with `-c/--config` |
| `cm:stacks:publish-clear-logs` | **removed** — no equivalent (log handling changed) |
| `cm:bulk-publish` (topic index) | n/a |

The `--filter` mapping is the crux: the four old "flavors" of entry publish become one command + a filter.

| Old command | Filter |
|---|---|
| `publish-modified` | `--filter modified` |
| `publish-only-unpublished` | `--filter unpublished` |
| `publish-non-localized-fields` | `--filter non-localized` |
| `update-and-publish` | `--filter draft` |

---

## 3. Flag mapping (v1 → v2)

| v1 flag | v2 |
|---|---|
| `--bulk-publish` / `--bulk-unpublish` (boolean) | **replaced** by `--publish-mode bulk\|single` (default `bulk`) |
| `-e`, `--environment` (singular) | `--environments` (plural, comma-separated) |
| `--locale` (singular) | `--locales` (plural, comma-separated) |
| `--content-types` | `--content-types` (unchanged) |
| `--publish-all-content-types` | **removed** — omit `--content-types` to publish all |
| `--delivery-token` | **removed** — not used by v2 unpublish |
| `--entry-uid` (variant publish) | **removed** — use `--include-variants` (see below) |
| `--include-variants` | `--include-variants` (unchanged, `bulk-entries`) |
| `--folder-uid` | `--folder-uid` (unchanged, `bulk-assets`) |
| `--retry-failed` (boolean) | `--retry-failed <path>` — pass the prior run dir, e.g. `./bulk-operation` |
| `--log-file` (revert input) | fold into `--revert <path>` |
| `--api-version` | present (default `3.2`) — **may be removed pre-GA** |
| `-a/--alias`, `--stack-api-key`, `--branch`, `-y/--yes`, `-c/--config` | unchanged (note `-k` is the short char for `--stack-api-key`) |
| `--source-env`, `--source-alias` | the cross-publish mechanism in v2 |

Shared v2 flags (all publish/unpublish commands): `--operation` (publish\|unpublish), `--environments`, `--locales`, `--source-env`, `--source-alias`, `--publish-mode` (bulk\|single, default bulk), `--branch` (default main), `--alias/-a`, `--stack-api-key/-k`, `--config/-c`, `--yes/-y`, `--retry-failed`, `--revert`.

---

## 4. New commands (no v1 equivalent)

### `cm:stacks:bulk-taxonomies`
Publish/unpublish taxonomies in bulk (taxonomy publishing, DX-4981).
```
csdx cm:stacks:bulk-taxonomies --operation publish --environments dev,staging --locales en-us --taxonomies products_tax,brands_tax -k <key>
```
Own flags: `--taxonomies`, `--api-version` (default `3.2`). `--operation` limited to publish/unpublish.

### `cm:stacks:bulk-am-assets`  (Asset Management 2.0)
Bulk **delete** and **move** assets in AM 2.0 spaces (DX-7873). This is **not** a publish command — different flag set entirely:
```
csdx cm:stacks:bulk-am-assets --operation delete --space-uid am123 --org-uid <org> --locale en-us --asset-uids-file ./assets.json
csdx cm:stacks:bulk-am-assets --operation move   --space-uid am123 --org-uid <org> --target-folder-uid amFolder --asset-uids-file ./assets.json
```
Own flags: `--operation delete|move`, `--space-uid`, `--org-uid`, `--workspace`, `--asset-uids-file`, `--locale`, `--target-folder-uid`, `--yes/-y`.
> ⚠️ May merge into `bulk-assets` before GA (see top-of-doc note).

---

## 5. Output mode: progress bars + summary (new in 2.x)

v1 bulk commands streamed plain, line-by-line `[timestamp] INFO:` logs. In v2, every `cm:stacks:bulk-*` command shows a **progress-bar UI + an end-of-run summary** instead, and the timestamped console logs are **suppressed by default**. The summary includes a per-command **Module Details** row (`ENTRY` / `ASSET` / `TAXONOMY`).

**What the summary counts mean**
- **SINGLE mode** (`--publish-mode single`): real per-item success/failed counts.
- **BULK mode** (default): items are submitted as **async jobs**, so the counts reflect **submission** — items in batches that failed to submit are counted as failed; the rest as successfully submitted. The **actual publish outcome** is tracked at the printed **status URL** (Publish Queue), not in this summary.

**Impact / fix for scripts & CI**
- Anything **parsing bulk-command stdout** sees different output (progress UI + summary, not `INFO:` lines) — with **no error raised**. Update log-scraping accordingly.
- To restore raw console logs (e.g. for CI/debugging):
  ```bash
  csdx config:set:log --show-console-logs
  ```
  This sets `log.showConsoleLogs = true`; bulk commands then print the timestamped logs as before. (Note the persisted config key is `log.showConsoleLogs` in 2.x.)

> Setup/auth errors during a run surface via the error handler / log file rather than as inline console output (a consequence of suppressing console logs) — same behavior as export/import.

---

## 6. Worked examples

| 1.x | 2.x |
|---|---|
| `csdx cm:entries:publish --content-types blog --environments prod --locales en-us --bulk-publish -a myAlias` | `csdx cm:stacks:bulk-entries --operation publish --content-types blog --environments prod --locales en-us --publish-mode bulk -a myAlias` |
| `csdx cm:entries:unpublish --content-type blog --environment prod --locale en-us --delivery-token <tok> -a myAlias` | `csdx cm:stacks:bulk-entries --operation unpublish --content-types blog --environments prod --locales en-us -a myAlias` |
| `csdx cm:assets:publish -e prod --locales en-us --folder-uid cs_root -k blt` | `csdx cm:stacks:bulk-assets --operation publish --environments prod --locales en-us --folder-uid cs_root -k blt` |
| `csdx cm:bulk-publish:cross-publish --content-types blog --source-env prod -e staging --locales en-us -a myAlias` | `csdx cm:stacks:bulk-entries --operation publish --content-types blog --source-env prod --source-alias prod-delivery --environments staging --locales en-us -a myAlias` |
| `csdx cm:stacks:publish-revert --log-file ./logs --retry-failed` | `csdx cm:stacks:bulk-entries --revert ./bulk-operation` |
| `csdx cm:entries:update-and-publish --content-types blog -e prod --locales en-us` | `csdx cm:stacks:bulk-entries --operation publish --filter draft --content-types blog --environments prod --locales en-us` |

---

## 7. Migration checklist

- [ ] Node runtime `>=22`.
- [ ] Every old command id replaced per §2 (grep scripts/CI for `cm:entries:publish`, `cm:assets:`, `cm:bulk-publish`, `cm:stacks:publish`, `cm:stacks:unpublish`).
- [ ] `--bulk-publish`/`--bulk-unpublish` → `--publish-mode bulk|single`.
- [ ] Singular `--environment`/`--locale` → plural `--environments`/`--locales`.
- [ ] `--publish-all-content-types` removed (drop `--content-types` instead).
- [ ] `--delivery-token`, `--entry-uid` removed from unpublish/variant scripts.
- [ ] `--retry-failed` now takes a path; `publish-revert` → `--revert <path>`.
- [ ] `publish-configure` (config generator) and `publish-clear-logs` have no equivalent — remove those steps.
- [ ] CI/scripts that parse bulk-command stdout updated for the progress-UI + summary output; run `config:set:log --show-console-logs` where raw logs are still needed (§5).
- [ ] Confirm `--api-version` decision before finalizing scripts.

---

## 8. Doc-site accuracy issues (fix before GA)

- The **v1 doc page** (`bulk-publish-and-unpublish-content`) documents commands whose package (`contentstack-bulk-publish`) is **empty/removed** in v2 — mark it 1.x-only or redirect.
- The **v2 doc page** (`bulk-operations-in-cli`) covers only `bulk-entries` + `bulk-assets`. **Missing: `cm:stacks:bulk-am-assets` and `cm:stacks:bulk-taxonomies`** — both need documenting. No beta page exists.

---

## 9. Agent rules: 1.x → 2.x command translation

1. **Identify the old command** and map to a v2 command + `--operation` per §2.
2. **Set `--operation`:** `publish` for any `*:publish*`, `unpublish` for any `*:unpublish`.
3. **Apply `--filter`** if the old command was `publish-modified` (modified), `publish-only-unpublished` (unpublished), `publish-non-localized-fields` (non-localized), `update-and-publish` (draft).
4. **Cross-publish:** old `cross-publish` → add `--source-env` + `--source-alias`.
5. **Flag rewrites:** `--bulk-publish|--bulk-unpublish`→`--publish-mode bulk|single`; singular `--environment/--locale`→plural; drop `--delivery-token`, `--publish-all-content-types`, `--entry-uid`; `--retry-failed`→`--retry-failed <dir>`.
6. **Revert:** `cm:stacks:publish-revert` → `--revert <dir>` on the matching bulk command.
7. **No equivalent:** `publish-configure`, `publish-clear-logs` → tell the user these are removed.
8. **Taxonomies/AM 2.0:** taxonomy publish → `bulk-taxonomies`; AM 2.0 asset delete/move → `bulk-am-assets` (delete|move, not publish).

**Worked example**
Input: `csdx cm:entries:publish-modified --content-types blog --source-env prod -e staging --locale en-us --bulk-publish -a myAlias`
Output: `csdx cm:stacks:bulk-entries --operation publish --filter modified --content-types blog --source-env prod --source-alias <delivery-alias> --environments staging --locales en-us --publish-mode bulk -a myAlias`
Warnings: `--source-env` now also needs `--source-alias`; `--locale`→`--locales`.
