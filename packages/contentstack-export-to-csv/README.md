# @contentstack/cli-cm-export-to-csv

The cm:export-to-csv command allows you to export the following data into a CSV file:
* Multiple stacks' content and structure (schema)
* [Organization users' details](https://www.contentstack.com/docs/owners-and-admins/organization-users/)

To be able to export the content of a stack, you need to have access to it. Likewise, to export an organization's user data, you need to be the  "[owner](https://www.contentstack.com/docs/owners-and-admins/organization-roles/#organization-owner)" or an "[admin](https://www.contentstack.com/docs/owners-and-admins/organization-roles/#organization-admin)" user of that organization.

Refer to the [Export Content to .CSV](https://www.contentstack.com/docs/developers/cli/export-content-to-csv-file/) file guide to learn more.

[![License](https://img.shields.io/npm/l/@contentstack/cli)](https://github.com/contentstack/cli-plugins/blob/main/LICENSE)

<!-- toc -->
* [@contentstack/cli-cm-export-to-csv](#contentstackcli-cm-export-to-csv)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage
<!-- usage -->
```sh-session
$ npm install -g @contentstack/cli-cm-export-to-csv
$ csdx COMMAND
running command...
$ csdx (--version)
@contentstack/cli-cm-export-to-csv/1.12.9 darwin-arm64 node-v22.21.1
$ csdx --help [COMMAND]
USAGE
  $ csdx COMMAND
...
```
<!-- usagestop -->

# Commands
<!-- commands -->
* [`csdx cm:export-to-csv`](#csdx-cmexport-to-csv)

## `csdx cm:export-to-csv`

Export entries, taxonomies, terms or organization users to csv using this command

```
USAGE
  $ csdx cm:export-to-csv [--action entries|users|teams|taxonomies] [-a <value>] [--org <value>] [-n <value>] [-k
    <value>] [--org-name <value>] [--locale <value>] [--content-type <value>] [--branch <value>] [--team-uid <value>]
    [--taxonomy-uid <value>] [--include-fallback] [--fallback-locale <value>] [--delimiter <value>]

FLAGS
  -a, --alias=<value>            Alias of the management token.
  -k, --stack-api-key=<value>    API Key of the source stack.
  -n, --stack-name=<value>       Name of the stack that needs to be created as CSV filename.
      --action=<option>          Option to export data (entries, users, teams, taxonomies). <options:
                                 entries|users|teams|taxonomies>
                                 <options: entries|users|teams|taxonomies>
      --branch=<value>           Branch from which entries will be exported.
      --content-type=<value>     Content type of entries that will be exported.
      --delimiter=<value>        [default: ,] [optional] Provide a delimiter to separate individual data fields within
                                 the CSV file. For example: cm:export-to-csv --delimiter '|'
      --fallback-locale=<value>  [Optional] Specify a specific fallback locale for taxonomy export. This locale will be
                                 used when a taxonomy term doesn't exist in the primary locale. Takes priority over
                                 branch fallback hierarchy when both are specified.
      --include-fallback         [Optional] Include fallback locale data when exporting taxonomies. When enabled, if a
                                 taxonomy term doesn't exist in the specified locale, it will fallback to the hierarchy
                                 defined in the branch settings.
      --locale=<value>           Locale of entries that will be exported.
      --org=<value>              Provide organization UID to clone org users.
      --org-name=<value>         Name of the organization that needs to be created as CSV filename.
      --taxonomy-uid=<value>     Provide the taxonomy UID of the related terms you want to export.
      --team-uid=<value>         Provide the UID of a specific team in an organization.

DESCRIPTION
  Export entries, taxonomies, terms or organization users to csv using this command

ALIASES
  $ csdx cm:export-to-csv

EXAMPLES
  $ csdx cm:export-to-csv



  Exporting entries to CSV

  $ csdx cm:export-to-csv --action entries --locale <locale> --alias <management-token-alias> --content-type <content-type>



  Exporting entries to CSV with stack name and branch

  $ csdx cm:export-to-csv --action entries --locale <locale> --alias <management-token-alias> --content-type <content-type> --stack-name <stack-name> --branch <branch-name>



  Exporting organization users to CSV

  $ csdx cm:export-to-csv --action users --org <org-uid>



  Exporting organization teams to CSV

  $ csdx cm:export-to-csv --action teams --org <org-uid>



  Exporting teams with specific team UID

  $ csdx cm:export-to-csv --action teams --org <org-uid> --team-uid <team-uid>



  Exporting taxonomies to CSV

  $ csdx cm:export-to-csv --action taxonomies --alias <management-token-alias>



  Exporting specific taxonomy with locale

  $ csdx cm:export-to-csv --action taxonomies --alias <management-token-alias> --taxonomy-uid <taxonomy-uid> --locale <locale>



  Exporting taxonomies with fallback locale

  $ csdx cm:export-to-csv --action taxonomies --alias <management-token-alias> --locale <locale> --include-fallback --fallback-locale <fallback-locale>
```

_See code: [src/commands/cm/export-to-csv.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-export-to-csv/src/commands/cm/export-to-csv.ts)_
<!-- commandsstop -->
