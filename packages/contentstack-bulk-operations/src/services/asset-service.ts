import messages, { $t } from '../messages';
import { BATCH_CONSTANTS } from '../utils/constants';
import { Asset, FetchOptions, PublishDetails, ManagementStack, DeliveryStack } from '../interfaces';

/**
 * AssetService - Handles asset fetching and filtering operations
 */
export class AssetService {
  constructor(
    private stack: ManagementStack,
    private deliveryStack: DeliveryStack | null,
    private logger: any
  ) {
    this.logger = logger || {
      info: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };
  }

  /**
   * Fetch published assets from a specific environment by UIDs
   * Uses Delivery SDK when available for more efficient published content retrieval
   */
  async fetchPublishedAssetsByUIDs(uids: string[], environment: string): Promise<any[]> {
    if (uids.length === 0) return [];

    try {
      const publishedAssets: any[] = [];

      if (this.deliveryStack) {
        this.logger.debug($t(messages.USING_DELIVERY_SDK_FETCH, { resourceType: 'published assets' }));

        // Batch process to improve performance
        for (let i = 0; i < uids.length; i += BATCH_CONSTANTS.assetFetchBatchSize) {
          const batchUids = uids.slice(i, i + BATCH_CONSTANTS.assetFetchBatchSize);
          const batchPromises = batchUids.map(async (uid) => {
            try {
              const asset = this.deliveryStack ? await this.deliveryStack.asset(uid).fetch() : undefined;
              return asset;
            } catch (error: any) {
              // Asset might not exist or not be published to this environment
              this.logger.debug($t(messages.ASSET_NOT_FOUND_OR_UNPUBLISHED, { uid, environment }), error);
              return null;
            }
          });

          const batchResults = await Promise.all(batchPromises);
          const validAssets = batchResults.filter((asset) => asset !== null);
          publishedAssets.push(...validAssets);
        }
      }

      this.logger.debug($t(messages.FETCHED_PUBLISHED_ASSETS_BY_UID, { count: publishedAssets.length, environment }));

      return publishedAssets;
    } catch (error: any) {
      this.logger.error($t(messages.FETCH_PUBLISHED_ASSETS_BY_UID_FAILED, { environment }), error);
      throw error;
    }
  }

  /**
   * Fetch all published assets from a specific environment
   * Uses Delivery SDK when available for more efficient published content retrieval
   */
  async fetchAllPublishedAssets(environment: string): Promise<Asset[]> {
    const allAssets: any[] = [];
    const limit = 100;
    let skip = 0;
    let hasMore = true;
    let totalCount: number | undefined;

    this.logger.info($t(messages.FETCHING_PUBLISHED_ASSETS, { environment }));

    try {
      if (this.deliveryStack) {
        this.logger.debug($t(messages.USING_DELIVERY_SDK_FETCH, { resourceType: 'all published assets' }));

        while (hasMore) {
          const query = this.deliveryStack.asset().query().limit(limit).skip(skip).includeCount();
          const response = await query.find();
          const assets = response.assets || [];

          if (totalCount === undefined && response.count !== undefined) {
            totalCount = response.count;
          }

          allAssets.push(...assets);
          if (totalCount !== undefined) {
            hasMore = skip + limit < totalCount;
          } else {
            // Fallback
            hasMore = assets.length === limit;
          }

          skip += limit;

          this.logger.debug($t(messages.FETCHED_ASSETS_BATCH, { count: assets.length, total: allAssets.length }));
        }
      }

      this.logger.info($t(messages.FETCHED_PUBLISHED_ASSETS, { total: allAssets.length, environment }));

      return allAssets;
    } catch (error: any) {
      this.logger.error($t(messages.FETCH_ALL_PUBLISHED_ASSETS_FAILED, { environment }), error);
      throw error;
    }
  }

  /**
   * Fetch all assets with pagination
   */
  async fetchAllAssets(options: FetchOptions = {}): Promise<Asset[]> {
    const allAssets: Asset[] = [];
    const limit = 100; // API maximum
    let skip = 0;
    let hasMore = true;
    let totalCount: number | undefined;

    const envInfo = options.environment ? ` (environment: ${options.environment})` : '';
    this.logger.info($t(messages.FETCHING_ASSETS) + envInfo);

    try {
      while (hasMore) {
        const queryOptions: any = { skip, limit, include_count: true, include_publish_details: true };

        // Add any filters from options
        if (options.query) {
          Object.assign(queryOptions, options.query);
        }
        const query = this.stack.asset().query(queryOptions);
        const response = await query.find();
        const assets = response.items || [];

        if (totalCount === undefined && response.count !== undefined) {
          totalCount = response.count;
        }

        allAssets.push(...assets);

        if (totalCount !== undefined) {
          hasMore = skip + limit < totalCount;
        } else {
          // Fallback
          hasMore = assets.length === limit;
        }

        skip += limit;

        this.logger.debug($t(messages.FETCHED_ASSETS_BATCH, { count: assets.length, total: allAssets.length }));
      }

      this.logger.info($t(messages.FETCHED_TOTAL_ASSETS, { total: allAssets.length }));

      return allAssets;
    } catch (error: any) {
      this.logger.error($t(messages.FETCH_ASSETS_FAILED));
      throw error;
    }
  }

  /**
   * Fetch specific assets by UIDs
   */
  async fetchAssetsByUIDs(uids: string[]): Promise<Asset[]> {
    if (uids.length === 0) return [];

    this.logger.info($t(messages.FETCHING_ASSETS_BY_UID, { count: uids.length }));

    try {
      const assets: Asset[] = [];
      for (const uid of uids) {
        try {
          const asset = await this.stack.asset(uid).fetch({ include_publish_details: true });
          assets.push(asset);
        } catch (error: any) {
          this.logger.warn($t(messages.FETCH_ASSET_FAILED, { uid }), error);
          // Continue with other assets
        }
      }

      this.logger.info($t(messages.FETCHED_ASSETS_BY_UID, { count: assets.length }));

      return assets;
    } catch (error: any) {
      this.logger.error($t(messages.FETCH_ASSETS_BY_UIDS_FAILED), error);
      throw error;
    }
  }

  /**
   * Fetch assets from a specific folder
   */
  async fetchAssetsByFolder(folderUid: string): Promise<Asset[]> {
    const allAssets: Asset[] = [];
    const limit = 100;
    let skip = 0;
    let hasMore = true;
    let totalCount: number | undefined;

    this.logger.info($t(messages.FETCHING_ASSETS_BY_FOLDER, { folderUid }));

    try {
      while (hasMore) {
        const query = this.stack
          .asset()
          .query({ skip, limit, include_count: true, include_publish_details: true, folder: folderUid });
        const response = await query.find();
        const assets = response.items || [];

        if (totalCount === undefined && response.count !== undefined) {
          totalCount = response.count;
        }

        allAssets.push(...assets);

        if (totalCount !== undefined) {
          hasMore = skip + limit < totalCount;
        } else {
          // Fallback
          hasMore = assets.length === limit;
        }

        skip += limit;

        this.logger.debug($t(messages.FETCHED_ASSETS_BATCH, { count: assets.length, total: allAssets.length }));
      }

      this.logger.info($t(messages.FETCHED_ASSETS_BY_FOLDER, { total: allAssets.length, folderUid }));

      return allAssets;
    } catch (error: any) {
      this.logger.error($t(messages.FETCH_ASSETS_BY_FOLDER_FAILED, { folderUid }), error);
      throw error;
    }
  }

  /**
   * Filter assets not published to target environment
   * Note: This checks if asset is published to ANY locale in the target environment
   */
  async filterUnpublishedAssets(assets: Asset[], targetEnv: string): Promise<Asset[]> {
    const unpublishedAssets = assets.filter((asset) => {
      if (!asset.publish_details || asset.publish_details.length === 0) {
        return true; // Never published
      }

      // Check if published to target environment (any locale)
      const publishedToTarget = asset.publish_details.some((pd: PublishDetails) => pd.environment === targetEnv);

      return !publishedToTarget;
    });

    this.logger.info(
      $t(messages.FILTERED_UNPUBLISHED_ASSETS, { count: unpublishedAssets.length, total: assets.length })
    );

    return unpublishedAssets;
  }

  /**
   * Get asset by UID
   */
  async getAsset(uid: string): Promise<Asset> {
    try {
      const asset = await this.stack.asset(uid).fetch();
      return asset;
    } catch (error: any) {
      this.logger.error($t(messages.FETCH_ASSET_FAILED, { uid }), error);
      throw error;
    }
  }
}
