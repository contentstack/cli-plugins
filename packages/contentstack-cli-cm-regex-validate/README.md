# Regex Validation CLI Plugin

The “Regex Validation” plugin in Contentstack CLI allows users to search for invalid regexes within the content types and global fields of their stack.

Using the CLI “Regex Validation” plugin, you can find the invalid regexes within your stack
and rectify them.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@contentstack/cli-cm-regex-validate.svg)](https://npmjs.org/package/@contentstack/cli-cm-regex-validate)
[![Downloads/week](https://img.shields.io/npm/dw/@contentstack/cli-cm-regex-validate.svg)](https://npmjs.org/package/@contentstack/cli-cm-regex-validate)
[![License](https://img.shields.io/npm/l/@contentstack/cli-cm-regex-validate.svg)](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-cli-cm-regex-validate/package.json)

<!-- toc -->
* [Regex Validation CLI Plugin](#regex-validation-cli-plugin)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage-no-overwrite -->

#### Step 1:

```sh-session
$ npm install -g @contentstack/cli

$ csdx plugins:install @contentstack/cli-cm-regex-validate

$ csdx plugins
running command...
@contentstack/cli-cm-regex-validate/2.0.0 darwin-arm64 node-v22.x

$ csdx --help [COMMAND]
USAGE
  $ csdx COMMAND
...
```

#### Step 2:

[Set the region](https://www.contentstack.com/docs/headless-cms/configure-regions-in-the-cli#set-region)

<!-- usagestop-overwrite -->

#### Step 3:

[Configured management token alias](https://www.contentstack.com/docs/headless-cms/cli-authentication#add-management-token)

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
