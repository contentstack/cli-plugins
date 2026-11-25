# @contentstack/cli-cm-seed

create a Stack from existing content types, entries, assets, etc.

<!-- toc -->
* [@contentstack/cli-cm-seed](#contentstackcli-cm-seed)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @contentstack/cli-cm-seed
$ csdx COMMAND
running command...
$ csdx (--version)
@contentstack/cli-cm-seed/2.0.2 darwin-arm64 node-v22.23.3
$ csdx --help [COMMAND]
USAGE
  $ csdx COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`csdx cm:stacks:seed [--repo <value>] [--org <value>] [--stack-api-key <value>] [--stack-name <value>] [-y] [--alias <value>]`](#csdx-cmstacksseed---repo-value---org-value---stack-api-key-value---stack-name-value--y---alias-value)

## `csdx cm:stacks:seed [--repo <value>] [--org <value>] [--stack-api-key <value>] [--stack-name <value>] [-y] [--alias <value>]`

Create a stack from existing content types, entries, assets, etc

```
USAGE
  $ csdx cm:stacks:seed [--repo <value>] [--org <value>] [--stack-api-key <value>] [--stack-name <value>] [-y]
    [--alias <value>]

FLAGS
  -a, --alias=<value>          Alias of the management token
  -k, --stack-api-key=<value>  Provide stack API key to seed content to
  -n, --stack-name=<value>     Name of a new stack that needs to be created.
  -y, --yes                    [Optional] Skip the stack confirmation.
      --org=<value>            Provide Organization UID to create a new stack
      --repo=<value>           GitHub organization name or GitHub user name/repository name.

DESCRIPTION
  Create a stack from existing content types, entries, assets, etc

EXAMPLES
  $ csdx cm:stacks:seed

  $ csdx cm:stacks:seed --repo "account"

  $ csdx cm:stacks:seed --repo "account/repository"

  $ csdx cm:stacks:seed --repo "account/repository" --stack-api-key "stack-api-key" //seed content into specific stack

  $ csdx cm:stacks:seed --repo "account/repository" --org "your-org-uid" --stack-name "stack-name" //create a new stack in given org uid
```

_See code: [src/commands/cm/stacks/seed.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-seed/src/commands/cm/stacks/seed.ts)_
<!-- commandsstop -->
