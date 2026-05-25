---
name: typescript-cli-tsgen
description: Mental model for the contentstack-cli-tsgen OCLIF plugin and tsgen command (CLI 1.x line).
---

# TypeScript CLI tsgen skill

## Role of this package

- **Plugin** for **`csdx`**: implements **`TypeScriptCodeGeneratorCommand`** in [`src/commands/tsgen.ts`](../../src/commands/tsgen.ts).
- **Generation** is delegated to **`@contentstack/types-generator`** ([npm](https://www.npmjs.com/package/@contentstack/types-generator))—version **^3.10.0** in [package.json](../../package.json).
- Uses **v1** `@contentstack/cli-command` **~1.8.2** and `@contentstack/cli-utilities` **~1.18.3**.

## Change here vs change in the library

| Concern | Where |
| --- | --- |
| New flags, output path, `csdx` UX, **`printFormattedError`** | This package (`src/commands/`, `src/lib/`) |
| Schema mapping, Delivery SDK calls, GraphQL introspection | **`@contentstack/types-generator`** |

## Helpers

- [`src/lib/helper.ts`](../../src/lib/helper.ts): **`sanitizePath`**, **`printFormattedError`**.
- [`src/types/index.ts`](../../src/types/index.ts): **`StackConnectionConfig`**.

## Command shape (`tsgen`)

- Extends **`Command`** from **`@contentstack/cli-command`**.
- **Flags:** `token-alias` (`-a`, required), `output` (`-o`), `prefix`, `doc`, `branch`, `include-system-fields`, `include-editable-tags`, `include-referenced-entry`, `api-type` (`rest` \| `graphql`), `namespace` (GraphQL).
- **`this.getToken(flags["token-alias"])`**; warn if not a delivery token.
- REST → **`generateTS`**; GraphQL → **`graphqlTS`**; write with **`fs.writeFileSync`**.
