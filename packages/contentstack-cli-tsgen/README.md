# contentstack-cli-tsgen

Generate TypeScript typings from a Stack.

<!-- toc -->
* [contentstack-cli-tsgen](#contentstack-cli-tsgen)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g contentstack-cli-tsgen
$ csdx COMMAND
running command...
$ csdx (--version)
contentstack-cli-tsgen/5.1.1 darwin-arm64 node-v22.23.3
$ csdx --help [COMMAND]
USAGE
  $ csdx COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`csdx tsgen`](#csdx-tsgen)

## `csdx tsgen`

Generate TypeScript typings from a Stack

```
USAGE
  $ csdx tsgen -a <value> --output <value> [--prefix <value>] [--doc] [--branch <value>]
    [--include-system-fields] [--include-editable-tags] [--include-referenced-entry] [--api-type rest|graphql]
    [--namespace <value>]

FLAGS
  -a, --alias=<value>             (required) delivery token alias
      --api-type=<option>         [default: rest] [Optional] Please enter an API type to generate the type definitions.
                                  <options: rest|graphql>
      --branch=<value>            branch
      --[no-]doc                  include documentation comments
      --include-editable-tags     include editable tags in generated types
      --include-referenced-entry  Includes the ReferencedEntry interface in generated types. Use this option to add a
                                  generic interface for handling referenced entries when the exact content type is
                                  unknown or when you need a flexible reference type
      --include-system-fields     include system fields in generated types
      --namespace=<value>         [Optional]Please enter a namespace for the GraphQL API type to organize the generated
                                  types.
      --output=<value>            (required) full path to output
      --prefix=<value>            interface prefix, e.g. "I"

DESCRIPTION
  Generate TypeScript typings from a Stack

EXAMPLES
  $ csdx tsgen -a "delivery token alias" --output "contentstack/generated.d.ts"

  $ csdx tsgen -a "delivery token alias" --output "contentstack/generated.d.ts" --prefix "I"

  $ csdx tsgen -a "delivery token alias" --output "contentstack/generated.d.ts" --no-doc

  $ csdx tsgen -a "delivery token alias" --output "contentstack/generated.d.ts" --include-referenced-entry

  $ csdx tsgen -a "delivery token alias" --output "contentstack/generated.d.ts" --api-type graphql

  $ csdx tsgen -a "delivery token alias" --output "contentstack/generated.d.ts" --api-type graphql --namespace "GraphQL"
```

_See code: [src/commands/tsgen.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-cli-tsgen/src/commands/tsgen.ts)_
<!-- commandsstop -->
