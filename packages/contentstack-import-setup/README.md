# @contentstack/cli-cm-import-setup

Contentstack CLI plugin to setup the mappers and configurations for the import command

<!-- toc -->
* [@contentstack/cli-cm-import-setup](#contentstackcli-cm-import-setup)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @contentstack/cli-cm-import-setup
$ csdx COMMAND
running command...
$ csdx (--version)
@contentstack/cli-cm-import-setup/2.0.2 darwin-arm64 node-v22.23.3
$ csdx --help [COMMAND]
USAGE
  $ csdx COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`csdx cm:stacks:import-setup [-k <value>] [-d <value>] [-a <value>] [--module <value,value>]`](#csdx-cmstacksimport-setup--k-value--d-value--a-value---module-valuevalue)

## `csdx cm:stacks:import-setup [-k <value>] [-d <value>] [-a <value>] [--module <value,value>]`

Helps to generate mappers and backup folder for importing (overwriting) specific modules

```
USAGE
  $ csdx cm:stacks:import-setup [-k <value>] [-d <value>] [-a <value>] [--module <value,value>]

FLAGS
  -a, --alias=<value>          The management token of the destination stack where you will import the content.
  -d, --data-dir=<value>       The path or the location in your file system where the content, you intend to import, is
                               stored. For example, -d "C:\Users\Name\Desktop\cli\content". If the export folder has
                               branches involved, then the path should point till the particular branch. For example,
                               “-d "C:\Users\Name\Desktop\cli\content\branch_name"
  -k, --stack-api-key=<value>  API key of the target stack
      --branch=<value>         The name of the branch where you want to import your content. If you don't mention the
                               branch name, then by default the content will be imported to the main branch.
      --branch-alias=<value>   Specify the branch alias where you want to import your content. If not specified, the
                               content is imported into the main branch by default.
      --module=<option>...     [optional] Specify the modules/module to import into the target stack. currently options
                               are global-fields, content-types, entries
                               <options: global-fields|content-types|entries>

DESCRIPTION
  Helps to generate mappers and backup folder for importing (overwriting) specific modules

EXAMPLES
  $ csdx cm:stacks:import-setup --stack-api-key <target_stack_api_key> --data-dir <path/of/export/destination/dir> --module <module_name, module_name> --branch <branch_name>
```

_See code: [src/commands/cm/stacks/import-setup.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-import-setup/src/commands/cm/stacks/import-setup.ts)_
<!-- commandsstop -->
