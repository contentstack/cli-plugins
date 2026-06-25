# @contentstack/cli-cm-export-query

<!-- toc -->
* [@contentstack/cli-cm-export-query](#contentstackcli-cm-export-query)
* [Install as a Contentstack CLI plugin](#install-as-a-contentstack-cli-plugin)
* [Export using management token alias](#export-using-management-token-alias)
* [Export using API key and alias](#export-using-api-key-and-alias)
<!-- tocstop -->

A powerful CLI plugin for Contentstack that enables query-based content export with intelligent dependency resolution and asset reference detection.

## Overview

This plugin extends the Contentstack CLI to export content based on custom queries, automatically resolving dependencies between content types, global fields, extensions, and taxonomies. It intelligently detects and exports referenced assets to ensure complete content portability.

## Features

- Query-based Export: Export content using custom queries instead of entire content types
- Dependency Resolution: Automatically resolve and export dependencies (global fields, extensions, taxonomies)
- Asset Reference Detection: Intelligent detection of asset references in various formats
- Organized Output: Well-structured export with separate folders for each module
- Configurable: Support for external config files and flexible options
- Multi-locale Support: Export content across different locales
- Export Metadata: Comprehensive metadata tracking for export operations

## Installation

```bash
# Install as a Contentstack CLI plugin
csdx plugins:install @contentstack/cli-cm-export-query
```

## Usage

### Basic Export

```bash
# Export using management token alias
csdx cm:stacks:export-query -a <alias> --query '{"title": {"$exists": true}}'

# Export using API key and alias
csdx cm:stacks:export-query --stack-api-key <api-key> -a <alias> --query '{"title": {"$exists": true}}'
```

### Command Options

| Flag | Description | Required |
|------|-------------|----------|
| `-a, --alias` | Management token alias | Yes (or use `-k, --stack-api-key`) |
| `-k, --stack-api-key` | Stack API key | Yes (or use `--alias`) |
| `-c, --config` | External config file path | No |
| `--query` | Query as JSON string or file path | Yes |
| `-d, --data-dir` | Export directory path | No |
| `--branch` | Branch name to export from | No |
| `--branch-alias` | Alias of branch to export from (mutually exclusive with `--branch`) | No |
| `--skip-references` | Skip referenced content types | No |
| `--skip-dependencies` | Skip dependent modules (global-fields, extensions, taxonomies) | No |
| `--secured-assets` | Export secured assets | No |
| `-y, --yes` | Skip confirmation prompts | No |

### Query Examples

**Basic Content Query:**
```bash
csdx cm:stacks:export-query -a prod --query '{"title": {"$regex": "blog"}}'
```

**Date Range Query:**
```bash
csdx cm:stacks:export-query -a prod --query '{"updated_at": {"$gte": "2024-01-01"}}'
```

**Complex Query:**
```bash
csdx cm:stacks:export-query -a prod --query '{"$and": [{"title": {"$exists": true}}, {"tags": {"$in": ["featured"]}}]}'
```

## Configuration

### Default Configuration

The plugin includes a default configuration file at `src/config/export-defaults.json`:

```json
{
  "skipReferences": false,
  "skipDependencies": false,
  "securedAssets": false,
  "includeGlobalFieldSchema": true,
  "includePublishDetails": true,
  "includeDimension": false,
  "fetchConcurrency": 5,
  "writeConcurrency": 5,
  "batchSize": 100
}
```

### External Configuration

Create a custom config file and pass it using the `--config` flag:

```json
{
  "skipReferences": true,
  "batchSize": 50,
  "fetchConcurrency": 3,
  "securedAssets": true
}
```

```bash
csdx cm:stacks:export-query -a prod --query '{"title": {"$exists": true}}' --config ./my-config.json
```

## Commands

<!-- commands -->
* [`csdx cm:stacks:export-query --query <value> [options]`](#csdx-cmstacksexport-query---query-value-options)

## `csdx cm:stacks:export-query --query <value> [options]`

Export content from a stack using query-based filtering

```
USAGE
  $ csdx cm:stacks:export-query --query <value> [options]

FLAGS
  -a, --alias=<value>          Management token alias
  -c, --config=<value>         Path to the configuration file
  -d, --data-dir=<value>       Path to store exported content
  -k, --stack-api-key=<value>  Stack API key
  -y, --yes                    Skip confirmation prompts
      --branch=<value>         Branch name to export from
      --branch-alias=<value>   Alias of Branch to export from
      --query=<value>          (required) Query as JSON string or file path
      --secured-assets         Export secured assets
      --skip-dependencies      Skip dependent modules (global-fields, extensions, taxonomies)
      --skip-references        Skip referenced content types

DESCRIPTION
  Export content from a stack using query-based filtering

EXAMPLES
  $ csdx cm:stacks:export-query --query '{"modules":{"content-types":{"title":{"$in":["Blog","Author"]}}}}'

  $ csdx cm:stacks:export-query --query ./ct-query.json --skip-references

  $ csdx cm:stacks:export-query --alias <alias> --query '{"modules":{"entries":{"content_type_uid":"blog"}}}'

  $ csdx cm:stacks:export-query --query '{"modules":{"assets":{"title":{"$regex":"image"}}}}'
```

_See code: [src/commands/cm/stacks/export-query.ts](https://github.com/contentstack/cli/blob/main/packages/contentstack-query-export/src/commands/cm/stacks/export-query.ts)_
<!-- commandsstop -->
