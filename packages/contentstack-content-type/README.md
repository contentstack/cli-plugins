# contentstack-cli-content-type

Retrieve information about Content Types in a Stack.

<!-- toc -->
* [contentstack-cli-content-type](#contentstack-cli-content-type)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g contentstack-cli-content-type
$ csdx COMMAND
running command...
$ csdx (--version)
contentstack-cli-content-type/2.0.2 darwin-arm64 node-v22.23.3
$ csdx --help [COMMAND]
USAGE
  $ csdx COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`csdx content-type:audit`](#csdx-content-typeaudit)
* [`csdx content-type:compare`](#csdx-content-typecompare)
* [`csdx content-type:compare-remote`](#csdx-content-typecompare-remote)
* [`csdx content-type:details`](#csdx-content-typedetails)
* [`csdx content-type:diagram`](#csdx-content-typediagram)
* [`csdx content-type:list`](#csdx-content-typelist)

## `csdx content-type:audit`

Display recent changes to a Content Type

```
USAGE
  $ csdx content-type:audit --content-type <value> [-k <value> | -a <value>]

FLAGS
  -a, --alias=<value>          Alias of the management token
  -k, --stack-api-key=<value>  Stack API Key
      --content-type=<value>   (required) Content Type UID

DESCRIPTION
  Display recent changes to a Content Type

EXAMPLES
  $ csdx content-type:audit --stack-api-key "xxxxxxxxxxxxxxxxxxx" --content-type "home_page"

  $ csdx content-type:audit --alias "management token" --content-type "home_page"
```

_See code: [src/commands/content-type/audit.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-content-type/src/commands/content-type/audit.ts)_

## `csdx content-type:compare`

Compare two Content Type versions

```
USAGE
  $ csdx content-type:compare --content-type <value> [-k <value> | -a <value>] [--left <value> --right <value>]

FLAGS
  -a, --alias=<value>          Alias of the management token
  -k, --stack-api-key=<value>  Stack API Key
      --content-type=<value>   (required) Content Type UID
      --left=<value>           Content Type version, i.e. prev version
      --right=<value>          Content Type version, i.e. later version

DESCRIPTION
  Compare two Content Type versions

EXAMPLES
  $ csdx content-type:compare --stack-api-key "xxxxxxxxxxxxxxxxxxx" --content-type "home_page"

  $ csdx content-type:compare --stack-api-key "xxxxxxxxxxxxxxxxxxx" --content-type "home_page" --left # --right #

  $ csdx content-type:compare --alias "management token" --content-type "home_page" --left # --right #
```

_See code: [src/commands/content-type/compare.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-content-type/src/commands/content-type/compare.ts)_

## `csdx content-type:compare-remote`

compare two Content Types on different Stacks

```
USAGE
  $ csdx content-type:compare-remote (--origin-stack <value> --remote-stack <value>) --content-type <value>

FLAGS
  --content-type=<value>  (required) Content Type UID
  --origin-stack=<value>  (required) Origin Stack API Key
  --remote-stack=<value>  (required) Remote Stack API Key

DESCRIPTION
  compare two Content Types on different Stacks

EXAMPLES
  $ csdx content-type:compare-remote --origin-stack "xxxxxxxxxxxxxxxxxxx" --remote-stack "xxxxxxxxxxxxxxxxxxx" --content-type "home_page"
```

_See code: [src/commands/content-type/compare-remote.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-content-type/src/commands/content-type/compare-remote.ts)_

## `csdx content-type:details`

Display Content Type details

```
USAGE
  $ csdx content-type:details --content-type <value> [-k <value> | -a <value>] [--path]

FLAGS
  -a, --alias=<value>          Alias of the management token
  -k, --stack-api-key=<value>  Stack API Key
      --content-type=<value>   (required) Content Type UID
      --[no-]path              show path column

DESCRIPTION
  Display Content Type details

EXAMPLES
  $ csdx content-type:details --stack-api-key "xxxxxxxxxxxxxxxxxxx" --content-type "home_page"

  $ csdx content-type:details --alias "management token" --content-type "home_page"

  $ csdx content-type:details --alias "management token" --content-type "home_page" --no-path
```

_See code: [src/commands/content-type/details.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-content-type/src/commands/content-type/details.ts)_

## `csdx content-type:diagram`

Create a visual diagram of a Stack's Content Types

```
USAGE
  $ csdx content-type:diagram --output <value> --direction portrait|landscape --type svg|dot [-k <value> | -a <value>]

FLAGS
  -a, --alias=<value>          Alias of the management token
  -k, --stack-api-key=<value>  Stack API Key
      --direction=<option>     (required) [default: portrait] graph orientation
                               <options: portrait|landscape>
      --output=<value>         (required) full path to output
      --type=<option>          (required) [default: svg] graph output file type
                               <options: svg|dot>

DESCRIPTION
  Create a visual diagram of a Stack's Content Types

EXAMPLES
  $ csdx content-type:diagram --stack-api-key "xxxxxxxxxxxxxxxxxxx" --output "content-model.svg"

  $ csdx content-type:diagram --alias "management token" --output "content-model.svg"

  $ csdx content-type:diagram --alias "management token" --output "content-model.svg" --direction "landscape"

  $ csdx content-type:diagram --alias "management token" --output "content-model.dot" --type "dot"
```

_See code: [src/commands/content-type/diagram.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-content-type/src/commands/content-type/diagram.ts)_

## `csdx content-type:list`

List all Content Types in a Stack

```
USAGE
  $ csdx content-type:list [-k <value> | -a <value>] [--order title|modified]

FLAGS
  -a, --alias=<value>          Alias of the management token
  -k, --stack-api-key=<value>  Stack API Key
      --order=<option>         [default: title] order by column
                               <options: title|modified>

DESCRIPTION
  List all Content Types in a Stack

EXAMPLES
  $ csdx content-type:list --stack-api-key "xxxxxxxxxxxxxxxxxxx"

  $ csdx content-type:list --alias "management token"

  $ csdx content-type:list --alias "management token" --order modified
```

_See code: [src/commands/content-type/list.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-content-type/src/commands/content-type/list.ts)_
<!-- commandsstop -->
