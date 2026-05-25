/**
 * Item fetcher utility
 * Handles fetching and filtering of entries, assets, and taxonomies for bulk operations
 */

import { EntryService, AssetService } from '../services';
import {
  BulkOperationConfig,
  EntryPublishData,
  AssetPublishData,
  ManagementStack,
  DeliveryStack,
  FilterType,
  Entry,
  Asset,
  TaxonomyPublishData,
} from '../interfaces';
import { $t, messages } from './index';

/**
 * Fetch and filter entries
 */
export async function fetchEntries(
  config: BulkOperationConfig,
  managementStack: ManagementStack,
  deliveryStack: DeliveryStack | null,
  logger: any
): Promise<EntryPublishData[]> {
  const entryService = new EntryService(managementStack, deliveryStack, logger);
  const items: EntryPublishData[] = [];

  const contentTypes = config.contentTypes || [];
  const locales = config.locales || [];
  const environments = config.environments || [];
  const environmentUids = config.environmentUids || [];

  // Validate content types - filter out empty strings
  const validContentTypes = contentTypes.filter((ct) => ct && ct.trim() !== '');
  if (validContentTypes.length === 0) {
    logger.error($t(messages.CONTENT_TYPE_REQUIRED));
    throw new Error($t(messages.CONTENT_TYPE_LIST_EMPTY));
  }

  // Validate locales - filter out empty strings
  const validLocales = locales.filter((locale) => locale && locale.trim() !== '');
  const isNonLocalized = config.filter === FilterType.NON_LOCALIZED;

  if (validLocales.length === 0 && !isNonLocalized) {
    logger.error($t(messages.LOCALE_LIST_EMPTY));
    throw new Error($t(messages.LOCALE_LIST_EMPTY));
  }

  // If non-localized and no locales provided, fetch master locale
  let loopLocales = validLocales;
  if (isNonLocalized && validLocales.length === 0) {
    logger.debug('No locales provided for non-localized filter, using master locale');
    const masterLocale = await entryService.getMasterLocale();
    loopLocales = [masterLocale];
  }

  // Validate environments - filter out empty strings
  const validEnvironments = environments.filter((env) => env && env.trim() !== '');
  if (validEnvironments.length === 0) {
    logger.error($t(messages.NO_ENVIRONMENTS_SPECIFIED, { resourceType: 'entry' }));
    throw new Error($t(messages.ENVIRONMENT_LIST_EMPTY));
  }

  // Use environment UIDs for filtering (fallback to names if UIDs not available)
  const validEnvironmentUids = environmentUids.length > 0 ? environmentUids : validEnvironments;

  // Fetch entries for each content type and locale combination
  for (const contentType of validContentTypes) {
    for (const locale of loopLocales) {
      logger.debug(`Fetching entries for content type: ${contentType}, locale: ${locale}`);
      const entries = await entryService.fetchEntriesByContentType(contentType, {
        locale,
        environment: validEnvironments,
      });

      let filteredEntries: Entry[] = entries;

      // Apply filters based on filterType
      const filterEnvironmentUid = validEnvironmentUids[0];
      const filterEnvironmentName = validEnvironments[0];

      if (config.filters?.filterType === FilterType.DRAFT) {
        filteredEntries = await entryService.filterDraftEntries(
          filteredEntries,
          contentType,
          filterEnvironmentUid,
          locale
        );
        logger.debug(`Filtered to ${filteredEntries.length} draft entries (checked against ${filterEnvironmentName})`);
      } else if (config.filters?.filterType === FilterType.UNPUBLISHED || config.filters?.onlyUnpublished) {
        filteredEntries = await entryService.filterUnpublishedEntries(filteredEntries, filterEnvironmentUid);
        logger.debug(
          `Filtered to ${filteredEntries.length} unpublished entries (checked against ${filterEnvironmentName})`
        );
      } else if (config.filters?.filterType === FilterType.MODIFIED) {
        // For modified filter, use the target environment UID to compare
        filteredEntries = await entryService.filterModifiedEntries(filteredEntries, contentType, filterEnvironmentUid);
        logger.debug(`Filtered to ${filteredEntries.length} modified entries (compared to ${filterEnvironmentName})`);
      } else if (config.filters?.filterType === FilterType.NON_LOCALIZED) {
        // For non-localized filter, compare master locale vs other locales in same environment
        // Automatically fetches all available locales and determines master locale

        filteredEntries = await entryService.filterNonLocalizedEntries(
          filteredEntries,
          contentType,
          filterEnvironmentUid
        );
        logger.debug(
          `Filtered to ${filteredEntries.length} entries with non-localized field inconsistencies (environment: ${filterEnvironmentName})`
        );
      }

      // Attach variants if include-variants flag is set
      let processedEntries = filteredEntries;
      if (config.includeVariants) {
        processedEntries = await entryService.attachVariantsToEntries(filteredEntries, contentType, locale);
      }

      // Convert to publish data format
      for (const entry of processedEntries) {
        const entryLocale = entry.locale || locale;
        const publishData: EntryPublishData = {
          type: 'entry',
          uid: entry.uid,
          content_type: contentType,
          locale: entryLocale,
          version: entry._version,
          publish_details: validEnvironments.map((env) => ({
            environment: env,
            locale: entryLocale,
          })),
        };

        // Add variants if present
        if (entry.variants && entry.variants.length > 0) {
          publishData.variants = entry.variants;
          publishData.variant_rules = entry.variant_rules;
        }

        items.push(publishData);
      }
    }
  }

  return items;
}

/**
 * Fetch and filter assets
 */
export async function fetchAssets(
  config: BulkOperationConfig,
  managementStack: ManagementStack,
  deliveryStack: DeliveryStack | null,
  logger: any
): Promise<AssetPublishData[]> {
  const assetService = new AssetService(managementStack, deliveryStack, logger);
  const items: AssetPublishData[] = [];

  const environments = config?.environments || [];
  const environmentUids = config?.environmentUids || [];
  const locales = config.locales || [];

  // Validate environments - filter out empty strings
  const validEnvironments = environments.filter((env) => env && env.trim() !== '');
  if (validEnvironments.length === 0) {
    logger.error($t(messages.NO_ENVIRONMENTS_SPECIFIED, { resourceType: 'asset' }));
    throw new Error($t(messages.ENVIRONMENT_LIST_EMPTY));
  }

  // Validate locales - filter out empty strings
  const validLocales = locales.filter((locale) => locale && locale.trim() !== '');
  if (validLocales.length === 0) {
    logger.error($t(messages.LOCALE_LIST_EMPTY));
    throw new Error($t(messages.LOCALE_LIST_EMPTY));
  }

  // Use environment UIDs for filtering (fallback to names if UIDs not available)
  const validEnvironmentUids = environmentUids.length > 0 ? environmentUids : validEnvironments;

  let assets: Asset[] = [];

  // Strategy 1: Fetch assets from a specific folder
  if (config.folderUid) {
    logger.debug(`Fetching assets from folder: ${config.folderUid}`);
    assets = await assetService.fetchAssetsByFolder(config.folderUid);
    logger.debug(`Fetched ${assets.length} assets from folder`);
  }
  // Strategy 2: Fetch all assets (default)
  else {
    logger.debug($t(messages.FETCHING_ALL_ASSETS));
    assets = await assetService.fetchAllAssets({
      environment: validEnvironments[0],
    });
    logger.debug(`Fetched ${assets.length} total assets`);
  }

  let filteredAssets: Asset[] = assets;

  // Apply filters if specified
  if (config.filters?.onlyUnpublished && validEnvironmentUids[0]) {
    const filterEnvironmentUid = validEnvironmentUids[0];
    const filterEnvironmentName = validEnvironments[0];
    filteredAssets = await assetService.filterUnpublishedAssets(filteredAssets, filterEnvironmentUid);
    logger.debug(`Filtered to ${filteredAssets.length} unpublished assets (checked against ${filterEnvironmentName})`);
  }

  // Convert to publish data format
  for (const locale of validLocales) {
    for (const asset of filteredAssets) {
      items.push({
        type: 'asset',
        uid: asset.uid,
        locale,
        version: asset._version,
        publish_details: validEnvironments.map((env) => ({
          environment: env,
          locale,
        })),
      });
    }
  }

  logger.info(`Prepared ${items.length} asset items for operation across ${validLocales.length} locale(s)`);
  return items;
}

/**
 * Fetch and filter taxonomies
 */
export async function fetchTaxonomyList(stack: ManagementStack, branch?: string): Promise<TaxonomyPublishData[]> {
  const queryOptions: Record<string, string> = {};
  if (branch && branch !== 'main') {
    queryOptions.branch = branch;
  }

  const response = (await stack.taxonomy().query(queryOptions).find()) as {
    taxonomies?: unknown[];
    items?: unknown[];
  };
  const taxonomies = response.taxonomies ?? response.items ?? [];
  const allTaxonomies: TaxonomyPublishData[] = [];
  for (const item of taxonomies) {
    const row = item as { uid?: string; name?: string };
    const uid = row.uid;
    if (!uid) {
      continue;
    }
    allTaxonomies.push({ uid, name: row.name ?? uid });
  }

  return allTaxonomies;
}
