# @contentstack/cli-cm-export-query

Contentstack CLI plugin to export content from stack

<!-- toc -->
* [@contentstack/cli-cm-export-query](#contentstackcli-cm-export-query)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @contentstack/cli-cm-export-query
$ csdx COMMAND
running command...
$ csdx (--version)
@contentstack/cli-cm-export-query/2.0.2 darwin-arm64 node-v22.23.3
$ csdx --help [COMMAND]
USAGE
  $ csdx COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`csdx cm:stacks:export-query --query <value> [options]`](#csdx-cmstacksexport-query---query-value-options)

## `csdx cm:stacks:export-query --query <value> [options]`

Export content from a stack using query-based filtering

```
USAGE
  $ csdx cm:stacks:export-query --query <value> [options]

FLAGS
  -a, --alias=<value>          Management token alias
  -c, --config=<value>         Path to the configuration file
  -d, --data-dir=<value>       Path to store exported content
  -k, --stack-api-key=<value>  Stack API key
  -y, --yes                    Skip confirmation prompts
      --branch=<value>         Branch name to export from
      --branch-alias=<value>   Alias of Branch to export from
      --query=<value>          (required) Query as JSON string or file path
      --secured-assets         Export secured assets
      --skip-dependencies      Skip dependent modules (global-fields, extensions, taxonomies)
      --skip-references        Skip referenced content types

DESCRIPTION
  Export content from a stack using query-based filtering

EXAMPLES
  $ csdx cm:stacks:export-query --query '{"modules":{"content-types":{"title":{"$in":["Blog","Author"]}}}}'

  $ csdx cm:stacks:export-query --query ./ct-query.json --skip-references

  $ csdx cm:stacks:export-query --alias <alias> --query '{"modules":{"entries":{"content_type_uid":"blog"}}}'

  $ csdx cm:stacks:export-query --query '{"modules":{"assets":{"title":{"$regex":"image"}}}}'
```

_See code: [src/commands/cm/stacks/export-query.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-query-export/src/commands/cm/stacks/export-query.ts)_
<!-- commandsstop -->
