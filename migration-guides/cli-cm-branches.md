# Migration Guide — `@contentstack/cli-cm-branches` (Branches plugin) · 1.x → 2.x

> Commands: `csdx cm:branches`, `cm:branches:create`, `cm:branches:delete`, `cm:branches:diff`, `cm:branches:merge`, `cm:branches:merge-status`
> Package: `@contentstack/cli-cm-branches`  ·  v1 line: `1.x` (e.g. `1.6.3`)  ·  v2 line: `2.x` (e.g. `2.0.0-beta.9`)
> Status: verified against code — v1 = `contentstack/cli @ v1.59.0` (branches `1.6.3`), v2 = `contentstack/cli-plugins @ origin/v2-dev` (branches `2.0.0-beta.9`).
> Official doc cross-checked: <https://www.contentstack.com/docs/developers/cli/compare-and-merge-branches-using-the-cli>

This guide is written to be read by **both a human and an LLM/agent**. If you feed this file to an agent along with a 1.x command, the [Agent rules](#7-agent-rules-1x--2x-command-translation) section is enough to emit the correct 2.x command.

**TL;DR:** The branches plugin is one of the *least* breaking plugins in the 2.x line. **Every flag on every pre-existing command is byte-for-byte identical between v1.59.0 and v2-dev.** The only changes that matter are: (1) Node `>=22`, (2) one brand-new command `cm:branches:merge-status`, and (3) a rewrite of the merge status-polling loop (DX-5584). There are no removed flags, no removed short chars, no renames, and no changed flag defaults.

---

## 1. At a glance

| Area | 1.x | 2.x | Action needed |
|---|---|---|---|
| Command ids | `cm:branches` / `:create` / `:delete` / `:diff` / `:merge` | unchanged | none |
| Flags (all 5 legacy commands) | see §3 | **identical** | none |
| Node.js | `>=14` (branches `1.6.3`) | **`>=22`** | upgrade Node runtime |
| `cm:branches:merge-status` | **did not exist** | **new command** (DX-5584) | adopt for async merge polling (§5) |
| Merge status polling | unbounded recursive poll, fixed 5s | **bounded `for`-loop, backoff, structured timeout** (§4.1) | review CI that relied on merge blocking forever |
| Official doc coverage | 5 commands | still 5 commands | `merge-status` is **undocumented** on the doc site (§6) |

**Nothing about a normal `cm:branches` / `create` / `delete` / `diff` / `merge` invocation changes.** Existing scripts run verbatim on 2.x (after the Node upgrade).

---

## 2. Quick command translation (copy-paste)

| 1.x command | 2.x command |
|---|---|
| `csdx cm:branches -k <key>` | `csdx cm:branches -k <key>` (unchanged) |
| `csdx cm:branches:create --source main --uid new_branch -k <key>` | identical |
| `csdx cm:branches:delete --uid dev -k <key> --yes` | identical |
| `csdx cm:branches:diff --base-branch main --compare-branch dev -k <key>` | identical |
| `csdx cm:branches:merge -k <key> --compare-branch dev --no-revert` | identical |
| *(n/a — did not exist)* | `csdx cm:branches:merge-status -k <key> --merge-uid <merge_uid>` |

There is no rewriting to do for the five legacy commands. The only *new* thing you can emit is `merge-status`.

---

## 3. Flag reference — 1.x → 2.x (per command)

Verified via `git show <ref>:.../src/commands/cm/branches/<cmd>.ts` for both refs. Flag objects are character-for-character equal across v1.59.0 and v2-dev unless noted.

### `cm:branches` (index)
| Flag | Short | Type | v1 | v2 |
|---|---|---|---|---|
| `--stack-api-key` | `-k` | string | ✓ | ✓ (unchanged) |
| `--verbose` | — | boolean | ✓ | ✓ (unchanged) |

### `cm:branches:create`
| Flag | Short | Type | v1 | v2 |
|---|---|---|---|---|
| `--uid` | — | string | ✓ | ✓ |
| `--source` | — | string | ✓ | ✓ |
| `--stack-api-key` | `-k` | string | ✓ | ✓ |

### `cm:branches:delete`
| Flag | Short | Type | v1 | v2 |
|---|---|---|---|---|
| `--uid` | — | string | ✓ | ✓ |
| `--stack-api-key` | `-k` | string | ✓ | ✓ |
| `--yes` | `-y` | boolean | ✓ | ✓ |

### `cm:branches:diff`
| Flag | Short | Type | Default | v1 | v2 |
|---|---|---|---|---|---|
| `--base-branch` | — | string | — | ✓ | ✓ |
| `--compare-branch` | — | string | — | ✓ | ✓ |
| `--module` | — | enum `content-types, global-fields, all` | — | ✓ | ✓ |
| `--stack-api-key` | `-k` | string | — | ✓ | ✓ |
| `--format` | — | enum `compact-text, detailed-text` | `compact-text` | ✓ | ✓ (default unchanged) |
| `--csv-path` | — | string | cwd | ✓ | ✓ |

### `cm:branches:merge`
| Flag | Short | Type | v1 | v2 | Notes |
|---|---|---|---|---|---|
| `--compare-branch` | — | string | ✓ | ✓ | |
| `--base-branch` | — | string | ✓ | ✓ | |
| `--comment` | — | string | ✓ | ✓ | |
| `--stack-api-key` | `-k` | string | ✓ | ✓ | |
| `--export-summary-path` | — | string | ✓ | ✓ | |
| `--use-merge-summary` | — | string | ✓ | ✓ | |
| `--no-revert` | — | boolean | ✓ | ✓ | |
| `--strategy` | — | enum (hidden) | ✓ | ✓ | hidden in both |
| `--strategy-sub-options` | — | enum (hidden) | ✓ | ✓ | hidden in both |
| `--merge-action` | — | enum (hidden) | ✓ | ✓ | hidden in both |

**Removed flags:** none. **Removed short chars:** none. **Renamed flags:** none. **New flags on legacy commands:** none. **Changed defaults:** none.

---

## 4. Breaking behavioral changes

### 4.1 Merge status polling rewritten (DX-5584)
The `cm:branches:merge` flow calls `MergeHandler` → `executeMerge` → `fetchMergeStatus`. When the backend reports the merge as `in_progress`, the CLI polls the merge queue until it resolves. **The polling implementation changed:**

**v1** (`cli @ v1.59.0`, `src/utils/merge-helper.ts`, `fetchMergeStatus`) — unbounded recursion with a fixed delay:
```ts
export const fetchMergeStatus = async (stackAPIClient, mergePayload, delay = 5000): Promise<any> => {
  return new Promise(async (resolve, reject) => {
    ...
    } else if (mergeStatus === 'in-progress' || mergeStatus === 'in_progress') {
      setTimeout(async () => {
        await fetchMergeStatus(stackAPIClient, mergePayload, delay).then(resolve).catch(reject);
      }, delay);   // re-polls forever at a constant 5s interval; never times out
```
There is no retry cap and no backoff — the CLI blocks indefinitely until the merge completes or fails.

**v2** (`cli-plugins @ origin/v2-dev`, `packages/contentstack-branches/src/utils/merge-helper.ts:171-217`) — a bounded `for`-loop with linear backoff and a structured timeout return instead of blocking recursion:
```ts
export const fetchMergeStatus = async (
  stackAPIClient,
  mergePayload,
  initialDelay = 5000,
  maxRetries = 10000, // Temporary making infinite polling to unblock the users
): Promise<any> => {
  let delayMs = initialDelay;
  const maxDelayMs = 60000; // Cap delay at 60 seconds
  for (let attempt = 1; attempt <= maxRetries; attempt++) {         // merge-helper.ts:180
    ...
    } else if (mergeStatus === 'in-progress' || mergeStatus === 'in_progress') {
      if (attempt < maxRetries) {
        cliux.print(`Merge in progress... (Attempt ${attempt}/${maxRetries})`, { color: 'grey' });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs = Math.min(delayMs + 1000, maxDelayMs);             // merge-helper.ts:193 (backoff)
      } else {
        return { merge_details: ..., pollingTimeout: true, status: 'in_progress', uid: mergePayload.uid }; // :198
      }
    }
  }
};
```

What actually changed, code-accurately:
- **Structure:** unbounded recursion → a finite `for (attempt = 1; attempt <= maxRetries; attempt++)` loop (`merge-helper.ts:180`).
- **Backoff:** fixed 5s → starts at 5s and increases by 1s each attempt, **capped at 60s** (`delayMs = Math.min(delayMs + 1000, maxDelayMs)`, `merge-helper.ts:193`).
- **Timeout outcome:** on exhausting retries, v2 **returns a structured object** `{ pollingTimeout: true, status: 'in_progress', uid }` (`merge-helper.ts:196-201`) rather than looping forever. Error states (`failed` / invalid / no-queue) now `throw new Error(...)` instead of the promise `reject(...)` used in v1.
- **Progress output:** v2 prints `Merge in progress... (Attempt N/maxRetries)` on each poll; v1 was silent between polls.

> ⚠️ **Honest caveat (do not overstate the timeout).** Although the docstring above the function says *"max 10 retries"*, the **shipped default is `maxRetries = 10000`** with an inline comment: `// Temporary making infinite polling to unblock the users` (`merge-helper.ts:175`). So in the beta the loop is *structurally* finite with backoff, but the default retry budget is set so high (10000 × up-to-60s) that it is effectively near-infinite in practice. The mechanism (bounded loop + backoff + structured `pollingTimeout` return) is the real DX-5584 change; the tight "10-retry timeout" described in the code comments is **not** what the default value currently enforces. Treat the timeout as "very large, temporarily" until the default is lowered before GA.

**Impact:** Interactive merges behave the same for the user (they still wait for completion). The observable differences are the new `Attempt N/…` progress lines on stdout and, if the retry budget is ever exhausted, a non-throwing `pollingTimeout` result instead of an infinite hang. CI that parses merge stdout should tolerate the new progress lines.

---

## 5. New in branches 2.x (additive)

### `cm:branches:merge-status` — NEW command (DX-5584)
**Confirmed absent from v1:** `git ls-tree -r v1.59.0 …/commands/cm/branches` lists only `create`, `delete`, `diff`, `index`, `merge` — there is no `merge-status.ts`. It exists only on `cli-plugins @ origin/v2-dev` (`.../commands/cm/branches/merge-status.ts`).

Purpose: check the status of a long-running / asynchronous branch merge job by its merge UID, without re-running (or blocking on) the merge itself.

```
csdx cm:branches:merge-status -k <stack_api_key> --merge-uid <merge_uid>
```

| Flag | Short | Required | Description |
|---|---|---|---|
| `--stack-api-key` | `-k` | **yes** | Stack API key |
| `--merge-uid` | — | **yes** | Merge job UID to check status for |

Both flags are `required: true` (`merge-status.ts`). The command fetches `stack.branch().mergeQueue(mergeUID).fetch()` and renders the result through `displayMergeStatusDetails` (`src/utils/merge-status-helper.ts:29`), which prints a status line (✅ complete / ⏳ in progress / ❌ failed / ⚠️ unknown — `getMergeStatusMessage`, `merge-status-helper.ts:10`), merge metadata (UID, created/updated/completed timestamps, `completion_percentage` while in progress), a `+added ~modified -deleted` summary for content types and global fields, and any errors. If no job matches the UID it errors and exits `1`.

Supporting helpers new in v2: `merge-status-helper.ts` (whole file is new) and `getMergeStatusWithContentTypes` (`merge-status-helper.ts:138`) for script generation off a completed merge.

## 6. Migration checklist

- [ ] Node runtime upgraded to `>=22` (was `>=14` in branches `1.6.3`).
- [ ] No flag/command rewrites needed for `cm:branches` / `:create` / `:delete` / `:diff` / `:merge` — confirm scripts run as-is.
- [ ] CI that parses `cm:branches:merge` stdout updated to tolerate new `Merge in progress... (Attempt N/…)` progress lines (§4.1).
- [ ] Long-running-merge tooling reviewed: on retry-budget exhaustion v2 returns `{ pollingTimeout: true, status: 'in_progress' }` instead of blocking forever — handle that shape if you consume the return (§4.1).
- [ ] Adopt `cm:branches:merge-status -k <key> --merge-uid <uid>` for async/out-of-band merge status checks (§5).
- [ ] Docs: raise a ticket to document `cm:branches:merge-status` on the doc site (§6.1).
- [ ] (Maintainers) Fix stale `homepage`/`repository`/`repositoryPrefix` in `package.json`; lower the temporary `maxRetries = 10000` default before GA (§4.1, §6.2).

---

## 7. Agent rules: 1.x → 2.x command translation

An agent given a 1.x branches command should apply these rules and output the 2.x equivalent:

1. **The five legacy commands are unchanged.** `cm:branches`, `cm:branches:create`, `cm:branches:delete`, `cm:branches:diff`, `cm:branches:merge` keep the same ids, the same flags, the same short chars (`-k`, `-y`), and the same defaults (`--format` still defaults to `compact-text`). Emit the command verbatim. Do **not** invent renames — there are none.
2. **Never emit `merge-status` as a rewrite of an old command.** It is a genuinely new command with no v1 predecessor. Only emit it when the user asks to *check the status* of an existing merge job by its merge UID.
3. **`merge-status` requires both flags:** `-k/--stack-api-key` **and** `--merge-uid` are `required: true`. If either is missing, ask for it rather than guessing.
4. **Merge behavior note (warn, don't rewrite):** if the user has CI that assumes `cm:branches:merge` either blocks forever or is silent, note that 2.x prints `Merge in progress... (Attempt N/…)` lines and can return a `pollingTimeout` object. This is a behavior heads-up, not a flag change.
5. **Node:** if the user is on Node < 22, flag the runtime upgrade before anything else.
6. **Doc gap:** if asked "where are the docs for merge-status", state that it is not on the official doc page yet; the v2 README is the current reference.

**Worked example**
Input (v1): `csdx cm:branches:merge -k blt123 --compare-branch feature --no-revert`
Output (v2): `csdx cm:branches:merge -k blt123 --compare-branch feature --no-revert`  *(identical — no rewrite)*
Note: on 2.x this prints `Merge in progress... (Attempt N/…)` while polling. To check the resulting job later without re-merging: `csdx cm:branches:merge-status -k blt123 --merge-uid <merge_uid>` (new in 2.x).
