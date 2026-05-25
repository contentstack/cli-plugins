---
name: code-review
description: PR review checklist for contentstack-cli-tsgen (v1 line).
---

# Code review skill (`contentstack-cli-tsgen`)

## CLI and docs

- Help text, **`static examples`**, and README/oclif docs stay in sync when flags change.
- Short command **`tsgen`** / **`TSGEN`** from **`csdxConfig`** in [package.json](../../package.json).

## Product language

- Prefer **Delivery** token flows; **GraphQL** requires delivery token.

## Errors

- **`printFormattedError`** in [`src/lib/helper.ts`](../../src/lib/helper.ts)—extend **`error_code`** switches carefully.

## Dependency on the library

- **`generateTS`** / **`graphqlTS`** logic belongs in **`@contentstack/types-generator`**.

## Tests and CI

- Integration tests need **`csdx`** and **`TOKEN_ALIAS`**.
- **v1 semver:** **`4.10.0`**+ on this branch; do not land v2 **`5.0.0-beta.0`** pins here.
- SCA: monorepo [`.github/workflows/sca-scan.yml`](../../../.github/workflows/sca-scan.yml).
