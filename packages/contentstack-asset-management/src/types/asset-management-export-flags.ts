/**
 * Values derived from an on-disk export layout for Asset Management–backed stacks.
 * Used by `contentstack-import` and `contentstack-import-setup` config handlers.
 */
export type AssetManagementExportFlags = {
  assetManagementEnabled: boolean;
  assetManagementUrl?: string;
  /** Source stack API key from `branches.json`, when present — used for URL reconstruction. */
  source_stack?: string;
};
