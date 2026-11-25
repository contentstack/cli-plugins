# @contentstack/cli-cm-regex-validate

Validate Fields with Regex Property of Content Type and Global Field in a Stack

<!-- toc -->
* [@contentstack/cli-cm-regex-validate](#contentstackcli-cm-regex-validate)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @contentstack/cli-cm-regex-validate
$ csdx COMMAND
running command...
$ csdx (--version)
@contentstack/cli-cm-regex-validate/2.0.2 darwin-arm64 node-v22.23.3
$ csdx --help [COMMAND]
USAGE
  $ csdx COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`csdx cm:stacks:validate-regex`](#csdx-cmstacksvalidate-regex)

## `csdx cm:stacks:validate-regex`

This command is used to find all the invalid regexes present in the content types and global fields of your stack.

```
USAGE
  $ csdx cm:stacks:validate-regex [-a <value>] [--contentType] [--filePath <value>] [--globalField]

FLAGS
  -a, --alias=<value>     Alias (name) assigned to the management token
      --contentType       To find invalid regexes within the content types
      --filePath=<value>  [optional] The path or the location in your file system where the CSV output file should be
                          stored.
      --globalField       To find invalid regexes within the global fields

DESCRIPTION
  This command is used to find all the invalid regexes present in the content types and global fields of your stack.

EXAMPLES
  $ csdx cm:stacks:validate-regex

  $ csdx cm:stacks:validate-regex -a <management_token_alias>

  $ csdx cm:stacks:validate-regex --contentType

  $ csdx cm:stacks:validate-regex --globalField

  $ csdx cm:stacks:validate-regex --filePath <path/to/the/directory>

  $ csdx cm:stacks:validate-regex -a <management_token_alias> --contentType --globalField

  $ csdx cm:stacks:validate-regex -a <management_token_alias> --contentType --globalField --filePath <path/to/the/directory>
```

_See code: [src/commands/cm/stacks/validate-regex.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-cli-cm-regex-validate/src/commands/cm/stacks/validate-regex.ts)_
<!-- commandsstop -->
