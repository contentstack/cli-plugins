# @contentstack/cli-external-migrate

Migrate from external source to Contentstack

<!-- toc -->
* [@contentstack/cli-external-migrate](#contentstackcli-external-migrate)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @contentstack/cli-external-migrate
$ csdx COMMAND
running command...
$ csdx (--version)
@contentstack/cli-external-migrate/2.0.2 darwin-arm64 node-v22.23.3
$ csdx --help [COMMAND]
USAGE
  $ csdx COMMAND
...
```
<!-- usagestop -->
# Commands
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
      --source-token=<value>  Source CMA token (prefer CONTENTFUL_MANAGEMENT_TOKEN env)
      --space-id=<value>      Contentful space ID — export from Contentful first (use this OR --input)
      --workspace=<value>     [default: ./output-dir] Migration workspace root for migration-manifest.json

DESCRIPTION
  Convert a source export, create a new stack in an organization, and import into it

EXAMPLES
  $ csdx migrate:create --source contentful --input ./export.json --org bltOrgUid
```

_See code: [src/commands/migrate/create.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-external-migrate/src/commands/migrate/create.ts)_
<!-- commandsstop -->
