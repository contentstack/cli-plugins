> **Source of truth:** [cli-plugins](https://github.com/contentstack/cli-plugins) — `packages/contentstack-bulk-operations` (v1 line: `v1-dev` / `v1-beta`)  
> Migrated from [cli-bulk-operations](https://github.com/contentstack/cli-plugins/tree/main/packages/contentstack-bulk-operations). See [BULK-OPERATIONS-MIGRATION.md](../../BULK-OPERATIONS-MIGRATION.md).

# @contentstack/cli-bulk-operations

> Contentstack CLI plugin for performing bulk operations on your content.

## Features

- Perform bulk operations on Contentstack content
- Built with TypeScript for type safety
- Comprehensive test coverage
- Code quality enforced with ESLint and Prettier
- Automated CI/CD workflows

## Usage

<!-- usage -->
```sh-session
# For CLI 1.x:**

# Install Contentstack CLI
$ npm install -g @contentstack/cli
$ csdx 
running command...
$ csdx (--version|-v)
$ csdx --help [COMMAND]

# Install bulk operations plugin
csdx plugins:install @contentstack/cli-bulk-operations

# Verify installation
csdx cm:stacks:bulk-entries --help
```
```sh-session
# For CLI 2.x:**

# Install Contentstack CLI
$ npm install -g @contentstack/cli
$ csdx 
running command...
$ csdx (--version|-v)
$ csdx --help [COMMAND]

# Verify installation
csdx cm:stacks:bulk-entries --help
```
<!-- usagestop -->

## Commands

<!-- commands -->
* [`csdx cm:stacks:bulk-assets`](#csdx-cmstacksbulk-assets)
* [`csdx cm:stacks:bulk-entries`](#csdx-cmstacksbulk-entries)
* [`csdx cm:stacks:bulk-taxonomies`](#csdx-cmstacksbulk-taxonomies)

## `csdx cm:stacks:bulk-assets`

Bulk operations for assets (publish/unpublish/cross-publish)

```
USAGE
  $ csdx cm:stacks:bulk-assets [-a <value>] [-k <value>] [--operation publish|unpublish] [--environments <value>...]
    [--locales <value>...] [--source-env <value>] [--source-alias <value>] [--publish-mode bulk|single] [--branch
    <value>] [-c <value>] [-y] [--retry-failed <value>] [--revert <value>] [--bulk-operation-file <value>] [--folder-uid
    <value>]

FLAGS
  -a, --alias=<value>                Uses the name of a saved Management Token to authenticate the command. The command
                                     can only access the branches allowed for that token. This option can be used as an
                                     alternative to` --stack-api-key.`
  -c, --config=<value>               (optional) Specifies the path to a JSON configuration file that defines the options
                                     for the command. Use this file instead of passing multiple CLI flags for a single
                                     run.
  -k, --stack-api-key=<value>        API key of the source stack. You must use either the --stack-api-key flag or the
                                     --alias flag.
  -y, --yes                          Skips interactive confirmation prompts and runs the command immediately using the
                                     provided options. Useful for automation and scripts.
      --branch=<value>               [default: main] The name of the branch where you want to perform the bulk publish
                                     operation. If you don't mention the branch name, then by default the content from
                                     main branch will be published.
      --bulk-operation-file=<value>  [default: bulk-operation] (optional) Folder path to store operation logs. Creates
                                     separate files for success and failed operations. Default: bulk-operation
      --environments=<value>...      Specifies one or more environments where the entries or assets should be published.
                                     Separate multiple environments with spaces.
      --folder-uid=<value>           (optional) The UID of the Assets' folder from which the assets need to be
                                     published. The default value is cs_root.
      --locales=<value>...           Specifies one or more locale codes for which the entries or assets should be
                                     published. Separate multiple locales with spaces.
      --operation=<option>           Specifies whether to `publish` or `unpublish` content.
                                     <options: publish|unpublish>
      --publish-mode=<option>        [default: bulk] Publish mode: bulk (uses Bulk Publish API) or single (individual
                                     API calls)
                                     <options: bulk|single>
      --retry-failed=<value>         (optional) Use this option to retry publishing the failed entries/assets from the
                                     logfile. Specify the name of the logfile that lists failed publish calls. If this
                                     option is used, it will override all other flags.
      --revert=<value>               (optional) Revert publish operations from a log folder. Specify the folder path
                                     containing success logs. Works similar to retry-failed.
      --source-alias=<value>         Alias name for source environment delivery token (required for cross-publish). Add
                                     delivery token using: csdx auth:tokens:add
      --source-env=<value>           Source environment for cross-publish

DESCRIPTION
  Bulk operations for assets (publish/unpublish/cross-publish)

EXAMPLES
  $ csdx cm:stacks:bulk-assets --operation publish --environments dev,staging --locales en-us -k blt123

  $ csdx cm:stacks:bulk-assets --operation unpublish --environments prod --locales en-us -a myAlias

  $ csdx cm:stacks:bulk-assets --operation publish --folder-uid cs_root --environments prod --locales en-us -k blt123

  $ csdx cm:stacks:bulk-assets --operation publish --environments prod --locales en-us --publish-mode bulk -k blt123

  $ csdx cm:stacks:bulk-assets --operation publish --source-env production --source-alias prod-delivery --environments staging,dev --locales en-us -a myAlias

  $ csdx cm:stacks:bulk-assets --retry-failed ./bulk-operation -a myAlias

  $ csdx cm:stacks:bulk-assets --revert ./bulk-operation -a myAlias
```

_See code: [src/commands/cm/stacks/bulk-assets.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-bulk-operations/src/commands/cm/stacks/bulk-assets.ts)_

## `csdx cm:stacks:bulk-entries`

Bulk operations for entries (publish/unpublish/cross-publish)

```
USAGE
  $ csdx cm:stacks:bulk-entries [-a <value>] [-k <value>] [--operation publish|unpublish] [--environments <value>...]
    [--locales <value>...] [--source-env <value>] [--source-alias <value>] [--publish-mode bulk|single] [--branch
    <value>] [-c <value>] [-y] [--retry-failed <value>] [--revert <value>] [--bulk-operation-file <value>]
    [--content-types <value>...] [--filter draft|modified|non-localized|unpublished] [--include-variants] [--api-version
    <value>]

FLAGS
  -a, --alias=<value>                Uses the name of a saved Management Token to authenticate the command. The command
                                     can only access the branches allowed for that token. This option can be used as an
                                     alternative to` --stack-api-key.`
  -c, --config=<value>               (optional) Specifies the path to a JSON configuration file that defines the options
                                     for the command. Use this file instead of passing multiple CLI flags for a single
                                     run.
  -k, --stack-api-key=<value>        API key of the source stack. You must use either the --stack-api-key flag or the
                                     --alias flag.
  -y, --yes                          Skips interactive confirmation prompts and runs the command immediately using the
                                     provided options. Useful for automation and scripts.
      --api-version=<value>          [default: 3.2] Specifies the Content Management API version used for publishing.
                                     Use version `3.2` when publishing entries with nested references, otherwise, use
                                     the default version 3.2
      --branch=<value>               [default: main] The name of the branch where you want to perform the bulk publish
                                     operation. If you don't mention the branch name, then by default the content from
                                     main branch will be published.
      --bulk-operation-file=<value>  [default: bulk-operation] (optional) Folder path to store operation logs. Creates
                                     separate files for success and failed operations. Default: bulk-operation
      --content-types=<value>...     Content type UIDs to perform operation on. If not provided, operates on all content
                                     types.
      --environments=<value>...      Specifies one or more environments where the entries or assets should be published.
                                     Separate multiple environments with spaces.
      --filter=<option>              Filter entries by status
                                     <options: draft|modified|non-localized|unpublished>
      --include-variants             Includes entry variants (alternate versions of a base entry) in the bulk operation.
                                     By default, only base entries are processed.
      --locales=<value>...           Specifies one or more locale codes for which the entries or assets should be
                                     published. Separate multiple locales with spaces.
      --operation=<option>           Specifies whether to `publish` or `unpublish` content.
                                     <options: publish|unpublish>
      --publish-mode=<option>        [default: bulk] Publish mode: bulk (uses Bulk Publish API) or single (individual
                                     API calls)
                                     <options: bulk|single>
      --retry-failed=<value>         (optional) Use this option to retry publishing the failed entries/assets from the
                                     logfile. Specify the name of the logfile that lists failed publish calls. If this
                                     option is used, it will override all other flags.
      --revert=<value>               (optional) Revert publish operations from a log folder. Specify the folder path
                                     containing success logs. Works similar to retry-failed.
      --source-alias=<value>         Alias name for source environment delivery token (required for cross-publish). Add
                                     delivery token using: csdx auth:tokens:add
      --source-env=<value>           Source environment for cross-publish

DESCRIPTION
  Bulk operations for entries (publish/unpublish/cross-publish)

EXAMPLES
  $ csdx cm:stacks:bulk-entries --operation publish --environments dev --locales en-us -k blt123

  $ csdx cm:stacks:bulk-entries --operation publish --content-types blog,article --environments dev --locales en-us -k blt123

  $ csdx cm:stacks:bulk-entries --operation unpublish --content-types blog --environments prod --locales en-us -a myAlias

  $ csdx cm:stacks:bulk-entries --operation publish --content-types blog --source-env production --source-alias prod-delivery --environments staging --locales en-us -a myAlias

  $ csdx cm:stacks:bulk-entries --operation publish --content-types blog --environments prod --locales en-us --publish-mode bulk -k blt123

  $ csdx cm:stacks:bulk-entries --operation publish --content-types blog --environments prod --locales en-us --filter modified -k blt123

  $ csdx cm:stacks:bulk-entries --operation publish --content-types blog --environments prod --locales en-us --filter draft -k blt123

  $ csdx cm:stacks:bulk-entries --operation publish --content-types blog --environments prod --locales en-us --filter unpublished -k blt123

  $ csdx cm:stacks:bulk-entries --operation publish --content-types blog --environments prod --filter non-localized -k blt123

  $ csdx cm:stacks:bulk-entries --operation publish --content-types blog --environments prod --locales en-us --include-variants -k blt123

  $ csdx cm:stacks:bulk-entries --retry-failed ./bulk-operation

  $ csdx cm:stacks:bulk-entries --revert ./bulk-operation
```

_See code: [src/commands/cm/stacks/bulk-entries.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-bulk-operations/src/commands/cm/stacks/bulk-entries.ts)_

## `csdx cm:stacks:bulk-taxonomies`

Publish taxonomies to environments and locales (CMA POST /v3/taxonomies/publish; initiates a publish job)

```
USAGE
  $ csdx cm:stacks:bulk-taxonomies [-a <value>] [-k <value>] [--operation publish|unpublish] [--environments <value>...]
    [--locales <value>...] [--source-env <value>] [--source-alias <value>] [--publish-mode bulk|single] [--branch
    <value>] [-c <value>] [-y] [--retry-failed <value>] [--revert <value>] [--bulk-operation-file <value>] [--taxonomies
    <value>] [--api-version <value>]

FLAGS
  -a, --alias=<value>                Uses the name of a saved Management Token to authenticate the command. The command
                                     can only access the branches allowed for that token. This option can be used as an
                                     alternative to` --stack-api-key.`
  -c, --config=<value>               (optional) Specifies the path to a JSON configuration file that defines the options
                                     for the command. Use this file instead of passing multiple CLI flags for a single
                                     run.
  -k, --stack-api-key=<value>        API key of the source stack. You must use either the --stack-api-key flag or the
                                     --alias flag.
  -y, --yes                          Skips interactive confirmation prompts and runs the command immediately using the
                                     provided options. Useful for automation and scripts.
      --api-version=<value>          [default: 3.2] Content Management API version for taxonomy publish (default: `3.2`;
                                     required for the `items` + locales/environments body on POST
                                     /v3/taxonomies/publish).
      --branch=<value>               [default: main] The name of the branch where you want to perform the bulk publish
                                     operation. If you don't mention the branch name, then by default the content from
                                     main branch will be published.
      --bulk-operation-file=<value>  [default: bulk-operation] (optional) Folder path to store operation logs. Creates
                                     separate files for success and failed operations. Default: bulk-operation
      --environments=<value>...      Specifies one or more environments where the entries or assets should be published.
                                     Separate multiple environments with spaces.
      --locales=<value>...           Specifies one or more locale codes for which the entries or assets should be
                                     published. Separate multiple locales with spaces.
      --operation=<option>           Specifies whether to `publish` or `unpublish` content.
                                     <options: publish|unpublish>
      --publish-mode=<option>        [default: bulk] Publish mode: bulk (uses Bulk Publish API) or single (individual
                                     API calls)
                                     <options: bulk|single>
      --retry-failed=<value>         (optional) Use this option to retry publishing the failed entries/assets from the
                                     logfile. Specify the name of the logfile that lists failed publish calls. If this
                                     option is used, it will override all other flags.
      --revert=<value>               (optional) Revert publish operations from a log folder. Specify the folder path
                                     containing success logs. Works similar to retry-failed.
      --source-alias=<value>         Alias name for source environment delivery token (required for cross-publish). Add
                                     delivery token using: csdx auth:tokens:add
      --source-env=<value>           Source environment for cross-publish
      --taxonomies=<value>           Comma-separated taxonomy UIDs to include in the job. If omitted, all taxonomies in
                                     the stack (current branch) are included. Example: products_tax,brands_tax

DESCRIPTION
  Publish taxonomies to environments and locales (CMA POST /v3/taxonomies/publish; initiates a publish job)

EXAMPLES
  $ csdx cm:stacks:bulk-taxonomies --operation publish --environments dev,staging --locales en-us --taxonomies products_tax,brands_tax -k blt123

  $ csdx cm:stacks:bulk-taxonomies --operation publish --environments development --locales en-us,hi-in -k blt123

  $ csdx cm:stacks:bulk-taxonomies --operation unpublish --environments prod --locales en-us --taxonomies my_taxonomy -a myAlias

  $ csdx cm:stacks:bulk-taxonomies --operation publish --environments staging --locales en-us,fr-fr --taxonomies taxonomy_a -a myAlias

  $ csdx cm:stacks:bulk-taxonomies --operation publish --environments development --locales en-us --taxonomies products_tax --api-version 3.2 -k blt123

  $ csdx cm:stacks:bulk-taxonomies --operation publish --branch feature --environments development --locales en-us --taxonomies brands_tax -k blt123
```

_See code: [src/commands/cm/stacks/bulk-taxonomies.ts](https://github.com/contentstack/cli-plugins/blob/main/packages/contentstack-bulk-operations/src/commands/cm/stacks/bulk-taxonomies.ts)_
<!-- commandsstop -->

## Requirements

- Node.js >= 22
- Contentstack account with API credentials

## Development

### Setup

```bash
git clone https://github.com/contentstack/cli-plugins.git
cd cli-plugins/packages/contentstack-bulk-operations
# From monorepo root: pnpm install && pnpm --filter @contentstack/cli-bulk-operations run build
```

### Available Scripts

- `npm run build` - Build the TypeScript project
- `npm run lint` - Run ESLint checks
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm test` - Run tests
- `npm run test:coverage` - Run tests with coverage
- `npm run clean` - Clean build artifacts


## Testing

This project uses Mocha for testing with comprehensive coverage reporting.

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests with detailed coverage report
npm run test:coverage:report
```

## Code Quality

### Linting

The project uses ESLint with TypeScript-specific rules:

```bash
npm run lint
```

### Formatting

Code formatting is handled by Prettier:

```bash
npm run format
```

### Git Hooks

Husky is configured to run checks before commits and pushes:

- **Pre-commit**: Runs lint-staged to check and format staged files
- **Pre-push**: Runs linting and tests to ensure code quality

## CI/CD

### GitHub Actions Workflows

1. **PR Checks** (`pr-checks.yml`): Runs on pull requests
   - Lint checks
   - Test execution with coverage
   - Build verification

2. **Test** (`test.yml`): Runs on pushes and PRs
   - Tests across multiple Node.js versions (18, 20, 22)
   - Coverage reporting to Codecov

3. **Release** (`release.yml`): Runs on main branch
   - Automated npm publishing
   - GitHub release creation
   - Semantic versioning

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history.
