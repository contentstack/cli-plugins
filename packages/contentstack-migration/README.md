# @contentstack/cli-migration



<!-- toc -->
* [@contentstack/cli-migration](#contentstackcli-migration)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @contentstack/cli-migration
$ csdx COMMAND
running command...
$ csdx (--version)
@contentstack/cli-migration/2.0.2 darwin-arm64 node-v22.23.3
$ csdx --help [COMMAND]
USAGE
  $ csdx COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`csdx cm:stacks:migration [-k <value>] [-a <value>] [--file-path <value>] [--branch <value>] [-c <value>] [--inline-config <value>] [--multiple]`](#csdx-cmstacksmigration--k-value--a-value---file-path-value---branch-value--c-value---inline-config-value---multiple)

## `csdx cm:stacks:migration [-k <value>] [-a <value>] [--file-path <value>] [--branch <value>] [-c <value>] [--inline-config <value>] [--multiple]`

Contentstack migration script.

```
USAGE
  $ csdx cm:stacks:migration [-k <value>] [-a <value>] [--file-path <value>] [--branch <value>] [-c <value>]
    [--inline-config <value>] [--multiple]

FLAGS
  -a, --alias=<value>             Use this flag to add the management token alias. You must use either the --alias flag
                                  or the --stack-api-key flag.
  -c, --config=<value>            [optional] Path of the JSON configuration file.
  -k, --stack-api-key=<value>     Use this flag to add the API key of your stack. You must use either the
                                  --stack-api-key flag or the --alias flag.
      --branch=<value>            Use this flag to add the branch name where you want to perform the migration. (target
                                  branch name)
      --file-path=<value>         Use this flag to provide the path of the file of the migration script.
      --inline-config=<value>...  [optional] Inline configuration, <key1>:<value1>. Passing an external configuration
                                  makes the script re-usable.
      --multiple                  This flag helps you to migrate multiple content files in a single instance. Mention
                                  the folder path where your migration script files are stored.

DESCRIPTION
  Contentstack migration script.

EXAMPLES
  $ csdx cm:stacks:migration --file-path <migration/script/file/path> -k <api-key>

  $ csdx cm:stacks:migration --file-path <migration/script/file/path> -k <api-key> --branch <target branch name>

  $ csdx cm:migration --inline-config <key1>:<value1> <key2>:<value2> ... --file-path <migration/script/file/path>

  $ csdx cm:migration --config <path/to/json/config/file> --file-path <migration/script/file/path>

  $ csdx cm:stacks:migration --multiple --file-path <migration/scripts/dir/path> 

  $ csdx cm:stacks:migration --alias <management-token-alias> --file-path <migration/script/file/path>
```

_See code: [src/commands/cm/stacks/migration.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-migration/src/commands/cm/stacks/migration.ts)_
<!-- commandsstop -->
