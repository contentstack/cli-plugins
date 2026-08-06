![npm](https://img.shields.io/npm/v/contentstack-cli-content-type)

## Description
This is a plugin for [Contentstack's](https://www.contentstack.com/) CLI.
It allows you to quickly retrieve information about Content Types in a Stack.

## Why use this plugin
1. The `csdx content-type:audit` command lists recent changes to a content type and by whom.
This is useful when needing to find Content Type versions to compare with `csdx content-type:compare`.
[Audit logs](https://www.contentstack.com/docs/headless-cms/set-up-stack/monitor-stack-activities-in-audit-log/) are stored for 90 days within Contentstack. 

1. The `csdx content-type:compare-remote` command allows you to compare the same Content Type between two Stacks.
This is useful when you have cloned or duplicated a Stack, and want to check what has changed in a child Stack.

1. The `csdx content-type:compare` command allows you to compare multiple versions of a Content Type within a single Stack.
This is useful when you are working in a development team, and want to compare changes made by colleagues.

1. The `csdx content-type:list` command is useful when you want to see all the Content Types within a Stack.
The Content Type's Display Name, UID, Last Modified Date, and Version number is shown. The list can be ordered by `title` or `modified` date. When developing against Contentstack, Content Type UIDs are needed when requesting data.

1. The `csdx content-type:details` command provides useful information, such as:
    * Field UID and Data Types
    * Referenced Content Types
    * Options such as required, multiple, and unique
    * The full path to a field, useful when using the [include reference endpoint](https://www.contentstack.com/docs/developers/apis/content-delivery-api/#include-reference) or filtering operations, such as the [equality endpoint](https://www.contentstack.com/docs/developers/apis/content-delivery-api/#equals-operator).

1. The `csdx content-type:diagram` command creates a visual representation of a Stack's content model.
    * The ouput format can be either `svg` or `dot`. 
    * The diagram's orientation can be changed, using the `-d landscape|portrait` flag.
    * [GraphViz](https://graphviz.org/) is the layout engine. You can export the generated DOT Language source, using the `-t dot` flag.
    * ![Diagram Output](https://github.com/contentstack/contentstack-cli-content-type/blob/main/screenshots/starter-app.svg)

## How to install this plugin

```shell
$ csdx plugins:install contentstack-cli-content-type
```

<!-- usage -->
```sh-session
$ npm install -g contentstack-cli-content-type
$ csdx COMMAND
running command...
$ csdx (--version)
contentstack-cli-content-type/1.5.4 darwin-arm64 node-v24.18.0
$ csdx --help [COMMAND]
USAGE
  $ csdx COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->

<!-- commandsstop -->
