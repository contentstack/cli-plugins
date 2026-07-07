![npm](https://img.shields.io/npm/v/@contentstack/cli-external-migrate)

## Description

This is a plugin for [Contentstack's](https://www.contentstack.com/) CLI.
This plugin migrates content from an external/legacy CMS (e.g. Contentful) into Contentstack. It exports the source, converts it into a Contentstack import bundle, creates a new stack in your organization, and imports the content into it.

Source lives in [contentstack/cli-plugins](https://github.com/contentstack/cli-plugins) at `packages/contentstack-external-migrate`.

## How to install this plugin

```shell
$ csdx plugins:install @contentstack/cli-external-migrate
```

## How to use this plugin

<!-- commands -->
* [`csdx migrate:audit`](#csdx-migrateaudit)
* [`csdx migrate:convert`](#csdx-migrateconvert)
* [`csdx migrate:create`](#csdx-migratecreate)
* [`csdx migrate:export`](#csdx-migrateexport)
* [`csdx migrate:import`](#csdx-migrateimport)
* [`csdx migrate:status`](#csdx-migratestatus)

## `csdx migrate:audit`

Audit a Contentstack import bundle (wraps csdx cm:stacks:audit)

```
USAGE
  $ csdx migrate:audit [-d <value>] [--report-path <value>] [--modules <value>] [--csv] [-w <value>]

FLAGS
  -d, --data-dir=<value>     Path to convert output bundle directory
  -w, --workspace=<value>    Migration workspace root for migration-manifest.json
      --csv                  Export audit report as CSV
      --modules=<value>      Comma-separated audit modules (e.g. content-types,entries,assets)
      --report-path=<value>  Directory for audit reports

DESCRIPTION
  Audit a Contentstack import bundle (wraps csdx cm:stacks:audit)

EXAMPLES
  $ csdx migrate:audit --data-dir ./contentstack-import/bundle

  $ csdx migrate:audit -d ./contentstack-import/bundle --report-path ./audit-reports

  $ csdx migrate:audit -d ./bundle --modules content-types,entries,assets --csv
```

_See code: [src/commands/migrate/audit.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-external-migrate/src/commands/migrate/audit.ts)_

## `csdx migrate:convert`

Convert a legacy CMS export to a Contentstack import bundle

```
USAGE
  $ csdx migrate:convert --legacy contentful [-i <value>] [--output <value>] [--master-locale <value>] [--affix
    <value>] [-v] [-w <value>] [--org <value>]

FLAGS
  -i, --input=<value>         Path to legacy export JSON (e.g. Contentful export)
  -v, --verbose               Verbose conversion logs
  -w, --workspace=<value>     Migration workspace root for migration-manifest.json
      --affix=<value>         [default: ] Content-type UID prefix
      --legacy=<option>       (required) Legacy CMS source (contentful)
                              <options: contentful>
      --master-locale=<value> Destination master locale code
      --org=<value>           Organization UID for migrating marketplace `app` fields (e.g. Cloudinary). Optional:
                              defaults to your csdx org, or prompts when you belong to several.
      --output=<value>        [default: ./contentstack-import] Parent output directory; bundle written to <output>/bundle

DESCRIPTION
  Convert a legacy CMS export to a Contentstack import bundle

EXAMPLES
  $ csdx migrate:convert --legacy contentful --input ./export.json --output ./contentstack-import

  $ csdx migrate:convert -l contentful -i ../references/contentful-export-*.json --output ./contentstack-import --master-locale en-US
```

_See code: [src/commands/migrate/convert.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-external-migrate/src/commands/migrate/convert.ts)_

## `csdx migrate:create`

Convert a source export, create a new stack in an organization, and import into it

```
USAGE
  $ csdx migrate:create --source contentful [--space-id <value>] [--source-token <value>] [--download-assets]
    [--include-drafts] [--include-archived] [--org <value>] [--output <value>] [--affix <value>] [--invite-users] [-y]
    [--workspace <value>]

FLAGS
  -y, --[no-]yes              Skip import confirmation prompts
      --affix=<value>         [default: CS] Content-type UID prefix
      --download-assets       Download asset binaries during export (with --space-id)
      --include-archived      Include archived entries in export (with --space-id)
      --include-drafts        Include draft entries in export (with --space-id)
      --[no-]invite-users     Invite Contentful space members into the new stack with their mapped roles (sends invite
                              emails). On by default; pass --no-invite-users to only write the users-mapping.json
                              report.
      --org=<value>           Contentstack organization uid — a new stack is created here (prompts with a list if
                              omitted)
      --output=<value>        [default: ./output-dir] Parent output directory; bundle written to <output>/bundle
      --source=<option>       (required) Legacy CMS source (contentful)
                              <options: contentful>
      --source-token=<value>  Source CMA token (prefer CONTENTFUL_MANAGEMENT_TOKEN env)
      --space-id=<value>      Contentful space ID — export from Contentful first (use this OR --input)
      --workspace=<value>     [default: ./output-dir] Migration workspace root for migration-manifest.json

DESCRIPTION
  Convert a source export, create a new stack in an organization, and import into it

EXAMPLES
  $ csdx migrate:create --source contentful --input ./export.json --org bltOrgUid
```

_See code: [src/commands/migrate/create.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-external-migrate/src/commands/migrate/create.ts)_

## `csdx migrate:export`

Export content from a legacy CMS (e.g. Contentful)

```
USAGE
  $ csdx migrate:export --legacy contentful [--space-id <value>] [--management-token <value>] [--output <value>]
    [--download-assets] [--include-drafts] [--include-archived] [-v] [-w <value>]

FLAGS
  -v, --verbose                  Verbose export logs
  -w, --workspace=<value>        Migration workspace root for migration-manifest.json (defaults to --output)
      --download-assets          Download asset binaries via Contentful CLI
      --include-archived         Include archived entries in export
      --include-drafts           Include draft entries in export
      --legacy=<option>          (required) Legacy CMS source (contentful)
                                 <options: contentful>
      --management-token=<value> Contentful CMA token (prefer CONTENTFUL_MANAGEMENT_TOKEN env)
      --output=<value>           [default: ./migration-workspace] Migration workspace root (writes export.json here)
      --space-id=<value>         Contentful space ID

DESCRIPTION
  Export content from a legacy CMS (e.g. Contentful)

EXAMPLES
  $ csdx migrate:export --legacy contentful --space-id YOUR_SPACE --output ./migration-workspace

  $ CONTENTFUL_MANAGEMENT_TOKEN=... csdx migrate:export -l contentful --space-id YOUR_SPACE -o ./migration-workspace

  $ csdx migrate:export -l contentful --space-id YOUR_SPACE --download-assets --include-drafts
```

_See code: [src/commands/migrate/export.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-external-migrate/src/commands/migrate/export.ts)_

## `csdx migrate:import`

Import a Contentstack bundle — into an existing stack (--stack-api-key) or a new one created in an organization (--org)

```
USAGE
  $ csdx migrate:import [-k <value>] [--org <value>] [--stack-name <value>] [-d <value>] [-y] [--skip-audit]
    [--module <value>] [--branch <value>] [-w <value>]

FLAGS
  -d, --data-dir=<value>    Path to convert output bundle directory
  -k, --stack-api-key=<value>  Destination stack API key (import into an EXISTING stack)
  -w, --workspace=<value>   Migration workspace root for migration-manifest.json
  -y, --[no-]yes            Skip import confirmation prompts
      --branch=<value>      Branch alias for branch-aware import
      --module=<value>      Import only a module (e.g. entries)
      --org=<value>         Destination organization uid — create a new stack here and import into it (used when
                            --stack-api-key is omitted; prompts with a list if omitted)
      --skip-audit          Skip audit-fix before import
      --stack-name=<value>  Name for the new stack (default: "Contentful Migration <date>")

DESCRIPTION
  Import a Contentstack bundle — into an existing stack (--stack-api-key) or a new one created in an organization
  (--org)

EXAMPLES
  $ csdx migrate:import --stack-api-key bltXXXX --data-dir ./contentstack-import/bundle

  $ csdx migrate:import --org bltOrgUid --data-dir ./contentstack-import/bundle

  $ csdx migrate:import -d ./contentstack-import/bundle   # prompts for org, creates a stack
```

_See code: [src/commands/migrate/import.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-external-migrate/src/commands/migrate/import.ts)_

## `csdx migrate:status`

Show migration manifest and step status

```
USAGE
  $ csdx migrate:status [-w <value>]

FLAGS
  -w, --workspace=<value>  [default: ./migration-workspace] Migration workspace root (contains
                           migration-manifest.json)

DESCRIPTION
  Show migration manifest and step status

EXAMPLES
  $ csdx migrate:status --workspace ./migration-workspace

  $ csdx migrate:status -w .
```

_See code: [src/commands/migrate/status.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-external-migrate/src/commands/migrate/status.ts)_
<!-- commandsstop -->
