/**
 * Cross-Publish Handler - Handles cross-publishing operations between environments
 * Implements cross-publish workflow: fetch from source env → publish to target envs
 */

import { PAGINATION_CONSTANTS } from './constants';
import { $t, messages } from './index';
import { ResourceType, DeliveryStack, CrossPublishConfig } from '../interfaces';

/**
 * Main cross-publish operation orchestrator
 * Workflow:
 * 1. Fetch published items from source environment using Delivery API
 * 2. Return items ready for publishing to target environments
 */
export async function handleCrossPublishOperation(config: CrossPublishConfig, logger: any): Promise<any[]> {
  logger.info(
    $t(messages.CROSS_PUBLISHING_FROM_TO, {
      sourceEnv: config.sourceEnv,
      targetEnvs: config.targetEnvs.join(', '),
    })
  );

  try {
    // Fetch published items from source environment using Delivery API
    if (!config.deliveryStack) {
      throw new Error($t(messages.DELIVERY_STACK_REQUIRED));
    }

    const items = await syncFromEnvironment(
      config.deliveryStack,
      config.sourceEnv,
      config.resourceType,
      config.contentTypes,
      config.locales,
      logger
    );

    // Transform raw Delivery API items into PublishData format
    const transformedItems = transformToPublishData(
      items,
      config.resourceType,
      config.targetEnvs,
      config.locales || ['en-us']
    );

    logger.info(
      $t(messages.RESOURCES_READY_FOR_CROSS_PUBLISH, {
        count: transformedItems.length,
        resourceType: config.resourceType,
      })
    );

    return transformedItems;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Sync items from source environment using Delivery API with pagination
 * Used to fetch published content from source environment for cross-publish
 *
 * @param deliveryStack - Pre-initialized Delivery SDK client (from command)
 * @param resourceType - Type of resource (entry or asset)
 * @param contentTypes - Content types to fetch (for entries)
 * @param locales - Locales to fetch (for entries only)
 * @param logger - Logger instance
 */
async function syncFromEnvironment(
  deliveryStack: DeliveryStack,
  sourceEnv: string,
  resourceType: ResourceType,
  contentTypes?: string[],
  locales?: string[],
  logger?: any
): Promise<any[]> {
  if (!deliveryStack) {
    throw new Error($t(messages.DELIVERY_STACK_SYNC_REQUIRED));
  }

  logger?.info(
    $t(messages.SYNCING_FROM_ENVIRONMENT, {
      resourceType: resourceType || 'entry',
      environment: sourceEnv,
    })
  );

  try {
    const syncedItems =
      resourceType === ResourceType.ASSET
        ? await syncAssetsFromEnvironment(deliveryStack)
        : await syncEntriesFromEnvironment(deliveryStack, contentTypes, locales, logger);

    logger?.success(
      $t(messages.SYNCED_ITEMS_COUNT, {
        count: syncedItems.length,
        environment: sourceEnv,
      })
    );

    return syncedItems;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Sync assets from source environment with pagination
 * @param deliveryStack - Delivery SDK client
 */
async function syncAssetsFromEnvironment(deliveryStack: DeliveryStack): Promise<unknown[]> {
  const syncedAssets: unknown[] = [];
  let skip = 0;
  const limit = PAGINATION_CONSTANTS.deliveryApiLimit;
  let hasMore = true;
  let totalCount: number | undefined;

  while (hasMore) {
    const query = deliveryStack.asset().query();
    const response = await query.includeCount().skip(skip).limit(limit).find();
    const assets = response.assets || [];

    if (totalCount === undefined && (response as any).count !== undefined) {
      totalCount = (response as any).count;
    }

    if (assets && assets.length > 0) {
      syncedAssets.push(...assets);
    }

    // Determine if more pages exist
    if (totalCount !== undefined) {
      hasMore = skip + limit < totalCount;
    } else {
      // Fallback: check if we got a full page
      hasMore = assets.length === limit;
    }

    skip += limit;
  }

  return syncedAssets;
}

/**
 * Sync entries from source environment with locale support and pagination
 * Optimized to fetch multiple locales in parallel for better performance
 *
 * @param deliveryStack - Delivery SDK client
 * @param contentTypes - Content types to fetch (if empty/undefined, fetches all)
 * @param locales - Locales to fetch
 * @param logger - Logger instance
 */
async function syncEntriesFromEnvironment(
  deliveryStack: DeliveryStack,
  contentTypes?: string[],
  locales?: string[],
  logger?: any
): Promise<unknown[]> {
  const syncedEntries: unknown[] = [];
  const localesToFetch = locales || ['en-us'];

  // If no content types specified, fetch all content types
  let contentTypesToFetch = contentTypes || [];

  if (!contentTypes || contentTypes.length === 0) {
    logger?.debug('No content types specified. Fetching all content types from stack...');
    try {
      const response = await deliveryStack.contentType().find();
      const contentTypes = response.content_types || [];
      contentTypesToFetch = contentTypes.map((ct: any) => ct.uid);
      logger?.info(`Found ${contentTypesToFetch.length} content types in the stack`);
    } catch (error: any) {
      throw new Error(`Failed to fetch content types from stack: ${error?.message || error}`);
    }
  }

  if (contentTypesToFetch.length === 0) {
    logger?.warn('No content types to fetch. Cross-publish will have no entries.');
    return syncedEntries;
  }

  for (const contentType of contentTypesToFetch) {
    // Fetch all locales in parallel for better performance
    const localePromises = localesToFetch.map((locale) =>
      fetchEntriesByLocale(deliveryStack, contentType, locale, logger)
    );

    const localeResults = await Promise.all(localePromises);

    // Aggregate results from all locales
    localeResults.forEach((result) => {
      if (result.entries && result.entries.length > 0) {
        // Add content_type_uid to each entry for later transformation
        const entriesWithContentType = result.entries.map((entry: any) => ({
          ...entry,
          content_type_uid: result.contentType, // Add content type from result
        }));
        syncedEntries.push(...entriesWithContentType);
      }
    });
  }

  return syncedEntries;
}

/**
 * Fetch entries for a specific content type and locale with pagination
 *
 * @param deliveryStack - Delivery SDK client
 * @param contentType - Content type UID
 * @param locale - Locale code
 * @param logger - Logger instance
 */
async function fetchEntriesByLocale(
  deliveryStack: DeliveryStack,
  contentType: string,
  locale: string,
  logger?: any
): Promise<{ entries: any[]; contentType: string; locale: string }> {
  const entries: any[] = [];
  let skip = 0;
  const limit = PAGINATION_CONSTANTS.deliveryApiLimit;
  let hasMore = true;
  let totalCount: number | undefined;

  while (hasMore) {
    const query = deliveryStack.contentType(contentType).entry().query({ locale });
    const response = await query.includeCount().skip(skip).limit(limit).find();
    const fetchedEntries = response.entries || [];

    // Get total count from first response
    if (totalCount === undefined && response.count !== undefined) {
      totalCount = response.count;
    }

    if (fetchedEntries && fetchedEntries.length > 0) {
      entries.push(...fetchedEntries);
    }

    // Determine if more pages exist
    if (totalCount !== undefined) {
      hasMore = skip + limit < totalCount;
    } else {
      // Fallback: check if we got a full page
      hasMore = fetchedEntries.length === limit;
    }

    skip += limit;
  }

  logger?.success(
    $t(messages.SYNCED_ENTRIES_FOR_CONTENT_TYPE_LOCALE, {
      count: entries.length,
      contentType,
      locale,
    })
  );

  return { entries, contentType, locale };
}

/**
 * Transform raw Delivery API items into PublishData format with publish_details
 * Items already have their correct locale from the fetch process
 */
function transformToPublishData(
  items: any[],
  resourceType: ResourceType,
  targetEnvs: string[],
  locales: string[]
): any[] {
  // For entries, items already have locale from the fetch
  // For assets, we need to create items for each locale
  if (resourceType === ResourceType.ASSET) {
    // Assets: Create one item per locale for each asset
    return locales.flatMap((locale) =>
      items.map((item) => ({
        type: 'asset',
        uid: item.uid,
        locale,
        version: item._version,
        publish_details: targetEnvs.map((environment) => ({
          environment,
          locale,
        })),
      }))
    );
  } else {
    // Entries: Items already have locale, just transform the structure
    return items.map((item) => ({
      type: 'entry',
      uid: item.uid,
      locale: item.locale, // Use the locale from the fetched item
      version: item._version,
      content_type: item.content_type_uid,
      publish_details: targetEnvs.map((environment) => ({
        environment,
        locale: item.locale, // Use the item's locale, not the config locale
      })),
    }));
  }
}
