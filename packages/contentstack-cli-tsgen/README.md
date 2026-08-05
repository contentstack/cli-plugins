# @contentstack/contentstack-cli-tsgen

[![npm](https://img.shields.io/npm/v/contentstack-cli-tsgen)](https://npmjs.org/package/@contentstack/contentstack-cli-tsgen)

## Description

This is a plugin for [Contentstack's](https://www.contentstack.com/) CLI.
This plugin generates TypeScript typings from Content Types. Interfaces and fields are optionally annotated with JSDoc comments.

Source lives in [contentstack/cli-plugins](https://github.com/contentstack/cli-plugins) at `packages/contentstack-cli-tsgen` (**CLI 1.x** line).

## How to install this plugin

```shell
$ csdx plugins:install contentstack-cli-tsgen
```

## Migration

- **Monorepo move (4.10.0):** See [MIGRATION.md](./MIGRATION.md).
- **Older plugin versions:** See [MIGRATION.md](./MIGRATION.md) for v3→v4 schema changes.

## How to use this plugin

`$ csdx tsgen`

generate TypeScript typings from a Stack

<!-- commands -->
* [`csdx tsgen`](#csdx-tsgen)

## `csdx tsgen`

Generate TypeScript typings from a Stack

```
USAGE
  $ csdx tsgen -a <value> -o <value> [-p <value>] [-d] [--branch <value>] [--include-system-fields]
    [--include-editable-tags] [--include-referenced-entry] [--api-type rest|graphql] [--namespace <value>]

FLAGS
  -a, --token-alias=<value>       (required) delivery token alias
  -d, --[no-]doc                  include documentation comments
  -o, --output=<value>            (required) full path to output
  -p, --prefix=<value>            interface prefix, e.g. "I"
      --api-type=<option>         [default: rest] [Optional] Please enter an API type to generate the type definitions.
                                  <options: rest|graphql>
      --branch=<value>            branch
      --include-editable-tags     include editable tags in generated types
      --include-referenced-entry  Includes the ReferencedEntry interface in generated types. Use this option to add a
                                  generic interface for handling referenced entries when the exact content type is
                                  unknown or when you need a flexible reference type
      --include-system-fields     include system fields in generated types
      --namespace=<value>         [Optional]Please enter a namespace for the GraphQL API type to organize the generated
                                  types.

DESCRIPTION
  Generate TypeScript typings from a Stack

EXAMPLES
  $ csdx tsgen -a "delivery token alias" -o "contentstack/generated.d.ts"

  $ csdx tsgen -a "delivery token alias" -o "contentstack/generated.d.ts" -p "I"

  $ csdx tsgen -a "delivery token alias" -o "contentstack/generated.d.ts" --no-doc

  $ csdx tsgen -a "delivery token alias" -o "contentstack/generated.d.ts" --include-referenced-entry

  $ csdx tsgen -a "delivery token alias" -o "contentstack/generated.d.ts" --api-type graphql

  $ csdx tsgen -a "delivery token alias" -o "contentstack/generated.d.ts" --api-type graphql --namespace "GraphQL"
```

_See code: [src/commands/tsgen.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-cli-tsgen/src/commands/tsgen.ts)_
<!-- commandsstop -->

## Supported Fields
* Number
* Text
* IsoDate
* Boolean
* Single Select w/ String and Number Types
* Multiple Select w/ String and Number Types
* Modular Block
* Global Field
* Group
* Link
* File
* References

## Supported Field Options
* Mandatory
* Multiple
* Multiple Max Limit
* Description (used in JSDoc comment)

## Example Output
```typescript
/** This is a description. */
interface BuiltinExample {
  /** Title */
  title: string;
  /** URL */
  url: string;
  /** Group1 */
  group1?: {
    /** Group2 */
    group2?: {
      /** Group3 */
      group3?: {
        /** Number */
        number?: number;
      };
    };
  };
  /** SEO */
  seo?: Seo;
  /** Single line textbox */
  single_line?: string;
  /** Multi line textbox */
  multi_line?: string;
  /** Rich text editor */
  rich_text_editor?: string;
  /** Multiple Single Line Textbox */
  multiple_single_line_textbox?: string[];
  /** Markdown */
  markdown?: string;
  /** Multiple Choice */
  multiple_choice?: ("Choice 1" | "Choice 2" | "Choice 3")[];
  /** Single Choice */
  single_choice: "Choice 1" | "Choice 2" | "Choice 3";
  /** Modular Blocks */
  modular_blocks?:ModularBlocks[];
  /** Number */
  number?: number;
  /** Link */
  link?: Link;
  /** File */
  file?: File;
  /** Boolean */
  boolean?: boolean;
  /** Date */
  date?: string;
}

interface ModularBlocks {
  block_1: {
    /** Number */
    number?: number;
    /** Single line textbox */
    single_line?: string;
  };
  block_2: {
    /** Boolean */
    boolean?: boolean;
    /** Date */
    date?: string;
  };
  seo_gf: {
    /** Keywords */
    keywords?: string;
    /** Description */
    description?: string;
  };
}
```
