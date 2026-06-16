# Phase 6 — AI companion (future)

**Goal:** Optional AI orchestration on top of expert-mode CLI commands.

**Status:** Future — after Phases 0–5 are stable.

---

## Guiding principle

> AI guides, tooling executes.

The AI never transforms migration data. It explains, recommends, validates, and runs approved `csdx migrate:*` commands.

Phases 0–5 remain fully functional without AI.

---

## What the AI uses

| Input | Source |
|-------|--------|
| Step completion | `migration-manifest.json` |
| Audit results | Report files from `--report-path` |
| Model review | `bundle/mapper.json`, `bundle/content_types/` |
| Commands | Same `csdx migrate:*` as expert mode |

No new data paths. No AI-generated bundle files.

---

## PRD step mapping

| Step | AI role | CLI command |
|------|---------|-------------|
| Export | Confirm flags, run | `migrate:export` |
| Convert | Confirm master locale | `migrate:convert` |
| Model review | Analyze, recommend (read-only) | — |
| Audit | Run, summarize report | `migrate:audit` |
| Fix | Explain remediation | `csdx cm:stacks:audit:fix` |
| Import | Confirm empty stack, run | `migrate:import` |
| Credentials | Guide UI steps | — |
| Website | Separate skill | — |

---

## Skills

| Step | Skill |
|------|-------|
| Model review | `cms-data-modeling-best-practices`, vibe-docs |
| Tokens | `cms-tokens-authentication` |
| Website conversion | New **Website Migration Skill** (separate deliverable) |
| Plugin maintenance | vibe-docs `extensions/cli-plugins/*` |

Website migration is intentionally separate from content CLI.

---

## Implementation options

1. [AGENTS.md](../../AGENTS.md) in `cli-plugin-migrate/` — step router for any agent
2. Cursor rules — workflow router + manifest awareness
3. Dedicated `migration-companion` skill via skills CLI

Suggested guardrails in prompt/rules:

```
Read migration-manifest.json before suggesting next steps.
Never modify bundle files without explicit user approval.
Only run csdx migrate:* or documented csdx cm:* commands.
Never invent migration transformations.
```

---

## Acceptance criteria (future)

- [ ] AI guides full migration using only CLI commands
- [ ] Disabling AI does not block any step
- [ ] AI never writes bundle without approval
- [ ] Website skill documented separately

---

## Out of scope

- Autonomous migration
- AI-generated convert logic
- Replacing professional services
