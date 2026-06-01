![npm](https://img.shields.io/npm/v/contentstack-cli-content-type)

## Description
This is a plugin for [Contentstack's](https://www.contentstack.com/) CLI.
It allows you to quickly retrieve information about Content Types in a Stack.

## Why use this plugin
1. The `csdx content-type:audit` command lists recent changes to a content type and by whom.
This is useful when needing to find Content Type versions to compare with `csdx content-type:compare`.
[Audit logs](https://www.contentstack.com/docs/developers/set-up-stack/monitor-stack-activities-in-audit-log/) are stored for 90 days within Contentstack. 

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

## How to use this plugin
This plugin requires you to be authenticated using [csdx auth:login](https://www.contentstack.com/docs/developers/cli/authenticate-with-the-cli/).

Several commands, such as `csdx content-type:compare` support token aliases as input.
These token aliases should be created using `csdx auth:tokens:add`.

The commands only use the **Stack API Key**. The management token is ignored.
They are provided as a convenience, so the Stack API Keys do not have to be re-typed. 

## Usability
The `csdx content-type:details` command requires a wide terminal window. If the `path` column is not needed, you can hide it:

```shell
$ csdx content-type:details -a "management token" -c "content type" --no-path
```
<!-- usagestop -->
# Commands
<!-- commands -->

<!-- commandsstop -->
