## Migrating to 5.0.0-beta.0 (cli-plugins monorepo)

The plugin source moved to [contentstack/cli-plugins](https://github.com/contentstack/cli-plugins) at `packages/contentstack-cli-tsgen`. See [TSGEN-MIGRATION.md](../../TSGEN-MIGRATION.md).

| Change | Notes |
| --- | --- |
| Version | `5.0.0-beta.0` — aligns with **CLI 2.x beta** |
| Install | `csdx plugins:install contentstack-cli-tsgen@beta` |
| Dependencies | `@contentstack/cli-command` / `@contentstack/cli-utilities` `~2.0.0-beta.*` |
| Command | `csdx tsgen` unchanged |

---

## Migrating from v3 to v4

This changelog documents a breaking change to the `ISystemFields` interface, specifically related to the `publish_details` field.

## What Changed

The `publish_details` field is no longer an array of objects. It is now represented as a single `IPublishDetails` object.

This update aligns the generated types with the actual [Contentstack API](https://www.contentstack.com/docs/developers/apis/content-delivery-api) response.

## Before

```typescript
export interface ISystemFields {
  uid?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  _content_type_uid?: string;
  tags?: string[];
  ACL?: any[];
  _version?: number;
  _in_progress?: boolean;
  locale?: string;
  publish_details?: IPublishDetails[]; // Incorrect: Array of IPublishDetails
  title?: string;
}
```

## After

```typescript
export interface ISystemFields {
  uid?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  _content_type_uid?: string;
  tags?: string[];
  ACL?: any[];
  _version?: number;
  _in_progress?: boolean;
  locale?: string;
  publish_details?: IPublishDetails; // Corrected: Single IPublishDetails object
  title?: string;
}
```

---

## Migrating from v2 to v3

This document outlines the necessary changes to separate nested modular blocks into distinct interfaces. This update will affect how modular blocks are structured and used throughout the codebase.

## Before

```typescript
export interface Test {
  /** Version */
  _version?: 2;
  /** Title */
  title: string;
  /** Modular Blocks */
  modular_blocks?: {
    test: {
      /** Multi Line Textbox */
      multi_line?: string;
      /** Rich Text Editor */
      rich_text_editor?: string;
      /** Modular Blocks1 */
      modular_blocks1?: {
        test1: {
          /** Multi Line Textbox */
          multi_line?: string;
        };
      }[];
    };
  }[];
}
```

## After

```typescript
export interface Test {
  /** Version */
  _version: 2;
  /** Title */
  title: string;
  /** Modular Blocks */
  modular_blocks?: ModularBlocks[];
}

export interface ModularBlocks {
  /** Multi Line Textbox */
  multi_line?: string;
  /** Rich Text Editor */
  rich_text_editor?: string;
  /** Modular Blocks1 */
  modular_blocks1?: ModularBlocks1[];
}

export interface ModularBlocks1 {
  /** Multi Line Textbox */
  multi_line?: string;
}
```
