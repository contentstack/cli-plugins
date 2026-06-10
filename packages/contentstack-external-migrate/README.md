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
* [`csdx migrate:create`](#csdx-migratecreate)

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
      --source-token=<value>  Sorce CMA token (prefer CONTENTFUL_MANAGEMENT_TOKEN env)
      --space-id=<value>      Contentful space ID — export from Contentful first (use this OR --input)
      --workspace=<value>     [default: ./output-dir] Migration workspace root for migration-manifest.json

DESCRIPTION
  Convert a source export, create a new stack in an organization, and import into it

EXAMPLES
  $ csdx migrate:create --source contentful --input ./export.json --org bltOrgUid
```

_See code: [src/commands/migrate/create.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-external-migrate/src/commands/migrate/create.ts)_
<!-- commandsstop -->
