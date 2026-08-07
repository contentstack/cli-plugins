# Contentstack CLI Query Export Plugin

A powerful CLI plugin for Contentstack that enables query-based content export with intelligent dependency resolution and asset reference detection.

## Overview

This plugin extends the Contentstack CLI to export content based on custom queries, automatically resolving dependencies between content types, global fields, extensions, and taxonomies. It intelligently detects and exports referenced assets to ensure complete content portability.

## Features

- 🔍 **Query-based Export**: Export content using custom queries instead of entire content types
- 🔗 **Dependency Resolution**: Automatically resolve and export dependencies (global fields, extensions, taxonomies)
- 🖼️ **Asset Reference Detection**: Intelligent detection of asset references in various formats
- 📁 **Organized Output**: Well-structured export with separate folders for each module
- ⚙️ **Configurable**: Support for external config files and flexible options
- 🌐 **Multi-locale Support**: Export content across different locales
- 📊 **Export Metadata**: Comprehensive metadata tracking for export operations

## Installation

```bash
# Install as a Contentstack CLI plugin
npm install -g @contentstack/cli-cm-export-query

# Or install locally
npm install @contentstack/cli-cm-export-query
```

## Usage

### Basic Export

```bash
# Export using management token alias
csdx cm:stacks:export-query -a <alias> --query "{'title': {'$exists': true}}"

# Export using API key
csdx cm:stacks:export-query --stack-api-key <api-key> --query "{'title': {'$exists': true}}"
```

### Command Options

| Flag | Description | Required |
|------|-------------|----------|
| `-a, --alias` | Management token alias | No |
| `--stack-api-key` | Stack API key | No |
| `--query` | Query for content export | Yes |
| `-d, --data-dir` | Export directory path | No |
| `--branch` | Branch name to export from | No |
| `--branch-alias` | Alias of Branch to export from | No |
| `--skip-references` | Skip reference resolution | No |
| `--skip-dependencies` | Skip dependency export | No |
| `--secured-assets` | Include secured assets | No |
| `--config` | External config file path | No |
| `-y, --yes` | Skip confirmation prompts | No |

### Query Examples

**Basic Content Query:**
```bash
csdx cm:stacks:export-query -a prod --query "{'title': {'$regex': 'blog'}}"
```

**Date Range Query:**
```bash
csdx cm:stacks:export-query -a prod --query "{'updated_at': {'$gte': '2024-01-01'}}"
```

**Complex Query:**
```bash
csdx cm:stacks:export-query -a prod --query "{'$and': [{'title': {'$exists': true}}, {'tags': {'$in': ['featured']}}]}"
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
csdx cm:stacks:export-query -a prod --query "{'title': {'$exists': true}}" --config ./my-config.json
```
