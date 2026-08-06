@contentstack/cli-cm-export-to-csv
=============

The cm:export-to-csv command allows you to export the following data into a CSV file:
* Multiple stack’s content and structure (schema)
* [Organization users’ details](https://www.contentstack.com/docs/owners-and-admins/organization-users/)

To be able to export the content of a stack, you need to have access to it. Likewise, to export an organization’s user data, you need to be the  “[owner](https://www.contentstack.com/docs/owners-and-admins/organization-roles/#organization-owner)” or an “[admin](https://www.contentstack.com/docs/owners-and-admins/organization-roles/#organization-admin)” user of that organization.

Refer to the [Export Content to .CSV](https://www.contentstack.com/docs/headless-cms/export-content-to-csv-file/) file guide to learn more.

[![License](https://img.shields.io/npm/l/@contentstack/cli)](https://github.com/contentstack/cli/blob/main/LICENSE)

* [Usage](#usage)
* [Commands](#commands)
# Usage
```sh-session
$ npm install -g @contentstack/cli-cm-export-to-csv
$ csdx COMMAND
running command...
$ csdx (--version)
@contentstack/cli-cm-export-to-csv/1.12.8 darwin-arm64 node-v24.18.0
$ csdx --help [COMMAND]
USAGE
  $ csdx COMMAND
...
```
# Commands
* [`csdx cm:export-to-csv`](#csdx-cmexport-to-csv)

## `csdx cm:export-to-csv`

Export entries or organization users to csv using this command

```
USAGE
  $ csdx cm:export-to-csv [--action entries|users|teams|taxonomies] [-a <value>] [--org <value>] [-n <value>] [-k <value>] [--org-name <value>] [--locale <value>] [--content-type <value>] [--branch <value>] [--team-uid <value>] [--taxonomy-uid <value>] [--include-fallback] [--fallback-locale <value>] [--delimiter <value>]

FLAGS
      --action=<option>          Option to export data (entries, users, teams, taxonomies).
                                 <options: entries|users|teams|taxonomies>
  -a, --alias=<value>            Alias of the management token.
      --org=<value>              Provide organization UID to clone org users.
  -n, --stack-name=<value>       Name of the stack that needs to be created as CSV filename.
  -k, --stack-api-key=<value>    API Key of the source stack.
      --org-name=<value>         Name of the organization that needs to be created as CSV filename.
      --locale=<value>           Locale of entries that will be exported.
      --content-type=<value>     Content type of entries that will be exported.
      --branch=<value>           Branch from which entries will be exported.
      --team-uid=<value>         Provide the UID of a specific team in an organization.
      --taxonomy-uid=<value>     Provide the taxonomy UID of the related terms you want to export.
      --include-fallback         [Optional] Include fallback locale data when exporting taxonomies.
      --fallback-locale=<value>  [Optional] Specify a specific fallback locale for taxonomy export.
      --delimiter=<value>        [optional] Provide a delimiter to separate individual data fields within the CSV file.
```

_See code: [src/commands/cm/export-to-csv.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-export-to-csv/src/commands/cm/export-to-csv.ts)_
