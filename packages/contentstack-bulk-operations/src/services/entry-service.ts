import messages, { $t } from '../messages';
import { Entry, FetchOptions, PublishDetails, ManagementStack, DeliveryStack } from '../interfaces';
import { hasNonLocalizedFields, checkNonLocalizedFieldChanges } from '../utils';

/**
 * EntryService - Handles entry fetching and filtering operations
 */
export class EntryService {
  private logger: any;

  constructor(
    private stack: ManagementStack,
    private deliveryStack: DeliveryStack | null,
    logger?: any
  ) {
    // TODO: Use proper logger from utils
    this.logger = logger || {
      info: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };
  }

  /**
   * Fetch all entries for a specific content type with pagination
   * Supports filtering by locale and environment
   */
  async fetchEntriesByContentType(contentType: string, options: FetchOptions = {}): Promise<any[]> {
    const allEntries: any[] = [];
    const limit = 100;
    let skip = 0;
    let hasMore = true;
    let totalCount: number | undefined;

    const localeInfo = options.locale ? ` (locale: ${options.locale})` : '';
    this.logger.info($t(messages.FETCHING_ENTRIES, { contentType }) + localeInfo);

    try {
      while (hasMore) {
        const queryOptions: any = { skip, limit, include_count: true, include_publish_details: true };

        // Add locale filter if specified
        if (options.locale) {
          queryOptions.locale = options.locale;
        }

        // Add any additional query filters
        if (options.query) {
          Object.assign(queryOptions, options.query);
        }

        const query = this.stack.contentType(contentType).entry().query(queryOptions);
        const response = await query.find();
        const entries = response.items || [];

        if (totalCount === undefined && response.count !== undefined) {
          totalCount = response.count;
        }

        allEntries.push(...entries);

        if (totalCount !== undefined) {
          hasMore = skip + limit < totalCount;
        } else {
          // Fallback
          hasMore = entries.length === limit;
        }

        skip += limit;

        this.logger.debug($t(messages.FETCHED_ENTRIES_BATCH, { count: entries.length, total: allEntries.length }));
      }

      this.logger.info($t(messages.FETCHED_TOTAL_ENTRIES, { total: allEntries.length, contentType }));

      return allEntries;
    } catch (error: any) {
      this.logger.error($t(messages.FETCH_ENTRIES_FAILED, { contentType }));
      throw error;
    }
  }

  /**
   * Fetch specific entries by UIDs
   */
  async fetchEntriesByUIDs(contentType: string, entryUIDs: string[], options: FetchOptions = {}): Promise<any[]> {
    if (entryUIDs.length === 0) return [];

    this.logger.info($t(messages.FETCHING_BY_UID, { count: entryUIDs.length, contentType }));

    try {
      const query = this.stack
        .contentType(contentType)
        .entry()
        .query({ uid: { $in: entryUIDs }, include_publish_details: true, ...options });

      const response = await query.find();
      const entries = response.items || [];

      this.logger.info($t(messages.FETCHED_BY_UID, { count: entries.length }));

      return entries;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Filter entries in draft workflow state
   * Only include entries that are in draft state (never published OR newer version exists)
   * EXCLUDES entries that are already published with the latest version
   * @param entries - Entries to filter
   * @param contentType - Content type UID
   * @param environmentUid - Environment UID to check against
   * @param locale - Locale to check (default: 'en-us')
   */
  async filterDraftEntries(
    entries: Entry[],
    contentType: string,
    environmentUid: string,
    locale: string = 'en-us'
  ): Promise<Entry[]> {
    const draftEntries = entries.filter((entry) => {
      if (!entry.publish_details || !Array.isArray(entry.publish_details) || entry.publish_details.length === 0) {
        // Never published, consider as draft
        return true;
      }

      // Find published version for the specified environment and locale
      const publishedEntry = entry.publish_details.find(
        (publishEnv: PublishDetails) => publishEnv.environment === environmentUid && publishEnv.locale === locale
      );

      // If not published to this environment/locale, it's a draft
      if (!publishedEntry) {
        return true;
      }

      // If current version is newer than published version, it's a draft
      if ((publishedEntry.version ?? 0) < entry._version) {
        return true;
      }

      // Already published with latest version - NOT a draft
      return false;
    });

    this.logger.debug(`Content type: ${contentType}`);
    this.logger.info($t(messages.FILTERED_DRAFT, { count: draftEntries.length, total: entries.length }));

    return draftEntries;
  }

  /**
   * Filter entries modified since source environment publish
   * Only includes entries where current version is newer than published version
   * EXCLUDES entries already published with the latest version
   * @param entries - Entries to filter
   * @param _contentType - Content type UID (not used in current implementation)
   * @param sourceEnv - Source environment UID
   */
  async filterModifiedEntries(entries: Entry[], _contentType: string, sourceEnv: string): Promise<Entry[]> {
    if (entries.length === 0) return [];

    this.logger.info($t(messages.COMPARING_WITH_SOURCE, { count: entries.length, sourceEnv }));

    try {
      const modifiedEntries: Entry[] = [];

      for (const entry of entries) {
        if (!entry.publish_details || !Array.isArray(entry.publish_details) || entry.publish_details.length === 0) {
          // Never published - not considered "modified"
          continue;
        }

        // Find published version for the specified environment
        const publishedToEnv = entry.publish_details.find(
          (publishEnv: PublishDetails) => publishEnv.environment === sourceEnv
        );

        if (!publishedToEnv) {
          // Not published to this environment - not considered "modified"
          continue;
        }

        // Check if current version is newer than published version
        const currentVersion = entry._version;
        const publishedVersion = publishedToEnv.version ?? 0;

        if (currentVersion > publishedVersion) {
          // Modified since last publish - include
          modifiedEntries.push(entry);
        }
        // If versions are equal, entry is already published with latest - exclude
      }

      this.logger.info($t(messages.FILTERED_MODIFIED, { count: modifiedEntries.length, total: entries.length }));

      return modifiedEntries;
    } catch (error: any) {
      this.logger.error($t(messages.FILTER_MODIFIED_ENTRIES_FAILED), error);
      throw error;
    }
  }

  /**
   * Filter entries not published to target environment
   * Only includes entries that have NEVER been published to the target environment
   * EXCLUDES entries already published (even if there's a newer version)
   */
  async filterUnpublishedEntries(entries: Entry[], targetEnv: string): Promise<Entry[]> {
    const unpublishedEntries = entries.filter((entry) => {
      // Validate entry has required fields
      if (!entry.uid || entry._version === undefined) {
        this.logger.warn(`Entry ${entry.uid || 'unknown'} missing required fields, skipping`);
        return false;
      }

      if (!entry.publish_details || !Array.isArray(entry.publish_details) || entry.publish_details.length === 0) {
        // Never published anywhere - include
        return true;
      }

      // Check if published to target environment
      const publishedToTarget = entry.publish_details.some((pd: PublishDetails) => pd.environment === targetEnv);

      // Only include if NOT published to target environment
      return !publishedToTarget;
    });

    this.logger.info($t(messages.FILTERED_UNPUBLISHED, { count: unpublishedEntries.length, total: entries.length }));

    return unpublishedEntries;
  }

  /**
   * Fetch published entries from a specific environment by UIDs
   */
  async fetchPublishedEntriesByUIDs(contentType: string, uids: string[], environment: string): Promise<any[]> {
    if (uids.length === 0) return [];

    try {
      const publishedEntries: any[] = [];
      if (this.deliveryStack) {
        this.logger.debug($t(messages.USING_DELIVERY_SDK_FETCH, { resourceType: 'published entries' }));

        const batchSize = 100;
        for (let i = 0; i < uids.length; i += batchSize) {
          const batchUids = uids.slice(i, i + batchSize);
          const query = this.deliveryStack.contentType(contentType).entry().query().containedIn('uid', batchUids);

          const response = await query.find();
          const entries = response.entries || [];
          publishedEntries.push(...entries);
        }
      }

      this.logger.debug(
        $t(messages.FETCHED_PUBLISHED_ENTRIES, {
          count: publishedEntries.length,
          contentType,
          environment,
        })
      );

      return publishedEntries;
    } catch (error: any) {
      this.logger.error($t(messages.FETCH_PUBLISHED_ENTRIES_FAILED, { environment }), error);
      throw error;
    }
  }

  /**
   * Fetch all entries across multiple content types and locales
   * @param contentTypes - Array of content type UIDs
   * @param options - Fetch options including locale, environment, etc.
   * @returns Array of all fetched entries
   */
  async fetchAllEntries(contentTypes: string[], options: FetchOptions = {}): Promise<any[]> {
    this.logger.info($t(messages.FETCHING_ALL_ENTRIES, { count: contentTypes.length }));

    const allEntries: any[] = [];

    for (const contentType of contentTypes) {
      try {
        const entries = await this.fetchEntriesByContentType(contentType, options);
        allEntries.push(...entries);
      } catch (error: any) {
        this.logger.warn($t(messages.FETCH_CONTENT_TYPE_FAILED, { contentType }), error);
        // Continue with other content types
      }
    }

    this.logger.info($t(messages.FETCHED_ALL_ENTRIES, { total: allEntries.length }));

    return allEntries;
  }

  /**
   * Fetch variants for a specific entry
   * Used when --include-variants flag is enabled
   * @param contentType - Content type UID
   * @param entryUid - Entry UID
   * @param locale - Locale (default: 'en-us')
   * @returns Array of variant UIDs
   */
  async fetchEntryVariants(
    contentType: string,
    entryUid: string,
    locale: string = 'en-us'
  ): Promise<Array<{ uid: string }>> {
    const allVariants: Array<{ uid: string }> = [];
    let skip = 0;
    const limit = 100;
    let hasMore = true;

    try {
      while (hasMore) {
        const variantQueryParams = {
          locale,
          include_count: true,
          skip,
          limit,
        };

        const response = (await this.stack
          .contentType(contentType)
          .entry(entryUid)
          .variants()
          .query(variantQueryParams)
          .find()) as any;

        const variants = (response.items || [])
          .map((entry: any) => ({
            uid: entry.variants?._variant?._uid,
          }))
          .filter((v: any) => v.uid); // Filter out any undefined UIDs

        allVariants.push(...variants);

        // Check if there are more variants to fetch
        hasMore = variants.length === limit;
        skip += limit;
      }

      return allVariants;
    } catch (error: any) {
      this.logger.debug(`Failed to fetch variants for entry ${entryUid}: ${error.message}`);
      return [];
    }
  }

  /**
   * Attach variants to entries
   * Used when --include-variants flag is enabled
   * @param entries - Entries to attach variants to
   * @param contentType - Content type UID
   * @param locale - Locale (default: 'en-us')
   * @returns Entries with variants attached
   */
  async attachVariantsToEntries(entries: any[], contentType: string, locale: string = 'en-us'): Promise<any[]> {
    this.logger.info($t(messages.FETCHING_VARIANTS, { count: entries.length }));

    const entriesWithVariants = [];

    for (const entry of entries) {
      const variants = await this.fetchEntryVariants(contentType, entry.uid, locale);

      if (variants.length > 0) {
        entriesWithVariants.push({
          ...entry,
          variants,
          variant_rules: {
            publish_latest_base: false,
            publish_latest_base_conditionally: true,
          },
        });
      } else {
        entriesWithVariants.push(entry);
      }
    }

    const variantCount = entriesWithVariants.filter((e) => e.variants?.length > 0).length;
    this.logger.info($t(messages.ATTACHED_VARIANTS, { count: variantCount, total: entries.length }));

    return entriesWithVariants;
  }

  /**
   * Fetch content type schema with global field schemas included
   * @param contentType - Content type UID
   * @returns Content type schema
   */
  async fetchContentTypeSchema(contentType: string): Promise<any> {
    if (!contentType || contentType.trim() === '') {
      throw new Error('Content type UID is required');
    }

    try {
      const schema = await this.stack.contentType(contentType).fetch({
        include_global_field_schema: true, // Important: includes nested global field schemas
      });
      return schema;
    } catch (error: any) {
      this.logger.error(`Failed to fetch schema for content type: ${contentType}`, error);
      throw error;
    }
  }

  /**
   * Get all languages/locales from stack with pagination
   * @private
   */
  private async getLanguages(skip: number = 0, allLanguages: any[] = []): Promise<any[]> {
    try {
      const limit = 100;
      const queryOptions: any = { skip, limit, include_count: true };

      if (skip > 0) {
        this.logger.debug(`Fetching languages with skip: ${skip}`);
      }
      this.logger.debug(`Query parameters: ${JSON.stringify(queryOptions)}`);

      const languagesFetchResponse = await this.stack.locale().query(queryOptions).find();

      this.logger.debug(
        `Fetched ${languagesFetchResponse?.items?.length || 0} languages out of ${languagesFetchResponse?.count}`
      );

      if (Array.isArray(languagesFetchResponse.items) && languagesFetchResponse.items.length > 0) {
        this.logger.debug(`Processing ${languagesFetchResponse.items.length} languages...`);

        // Add current batch to accumulated results
        allLanguages.push(...languagesFetchResponse.items);

        skip += limit;
        if (skip < languagesFetchResponse.count) {
          this.logger.debug(`Continuing to fetch languages with skip: ${skip}`);
          return await this.getLanguages(skip, allLanguages);
        } else {
          this.logger.debug('Completed fetching all languages.');
          return allLanguages;
        }
      } else {
        this.logger.debug('No languages found to process.');
        return allLanguages;
      }
    } catch (error: any) {
      this.logger.warn('Failed to fetch languages from stack:', error.message);
      return allLanguages;
    }
  }

  /**
   * Get master locale code
   */
  async getMasterLocale(): Promise<string> {
    return this.stack
      .locale()
      .query({ query: { fallback_locale: null } })
      .find()
      .then(({ items }: any) => {
        const masterLocale = items[0];
        this.logger.debug(`Found master locale: ${masterLocale?.code}`);
        return masterLocale?.code || 'en-us';
      })
      .catch((error: any) => {
        this.logger.warn('Failed to fetch master locale:', error.message);
        return 'en-us';
      });
  }

  /**
   * Fetch entry with specific locale and environment using Management API
   * @private
   */
  private async fetchEntryWithLocale(
    contentType: string,
    entryUid: string,
    locale: string,
    environment: string
  ): Promise<any> {
    try {
      const queryParams = {
        locale,
        environment,
        include_publish_details: true,
      };

      const entry = await this.stack.contentType(contentType).entry(entryUid).fetch(queryParams);

      return entry;
    } catch (error: any) {
      // Entry may not exist in this locale (error code 141)
      if (error.errorCode === 141) {
        return {};
      }
      this.logger.warn(`Failed to fetch entry ${entryUid} in locale ${locale}:`, error.message);
      return {};
    }
  }

  /**
   * Filter entries with non-localized field changes across locales
   * Replicates the old implementation logic: compares master locale vs all other locales within same environment
   * @param entries - Entries to filter
   * @param contentType - Content type UID
   * @param environment - Environment to check
   * @returns Entries with non-localized field changes
   */
  async filterNonLocalizedEntries(entries: Entry[], contentType: string, environment: string): Promise<Entry[]> {
    if (entries.length === 0) {
      return [];
    }

    try {
      // Step 1: Fetch content type schema with global field schemas
      const schema = await this.fetchContentTypeSchema(contentType);

      // Step 2: Check if schema has non-localized fields
      const hasNonLocalized = hasNonLocalizedFields(schema.schema);

      if (!hasNonLocalized) {
        this.logger.info(`Content type ${contentType} has no non-localized fields. Skipping filter.`);
        return [];
      }

      // Step 3: Get all languages from stack
      const languages = await this.getLanguages();

      if (languages.length === 0) {
        this.logger.debug('No languages found in stack, returning empty array');
        return [];
      }

      // Step 4: Determine master locale
      const masterLocale = await this.getMasterLocale();
      this.logger.debug(`Using master locale: ${masterLocale}`);

      // Step 5: Filter entries to only those published to source environment
      const sourceEnvEntries = entries.filter((entry) => {
        const isPublishedToSourceEnv = entry.publish_details?.some((detail: any) => detail.environment === environment);
        return isPublishedToSourceEnv;
      });

      if (sourceEnvEntries.length === 0) {
        this.logger.debug('No entries published to source environment, returning empty array');
        return [];
      }

      this.logger.debug(`Checking non-localized fields for content type: ${contentType}`);

      // Step 6: Filter entries with non-localized field changes
      const entriesWithChanges: Entry[] = [];

      for (const entry of sourceEnvEntries) {
        let hasChanges = false;

        try {
          // Fetch master locale entry via Management API
          const masterEntry = await this.fetchEntryWithLocale(contentType, entry.uid, masterLocale, environment);

          if (!masterEntry || !masterEntry.uid) {
            continue; // Skip if master entry doesn't exist
          }

          // Check against each locale (except master)
          for (const language of languages) {
            const locale = language.code;

            // Skip master locale
            if (locale === masterLocale) {
              continue;
            }

            // Fetch localized entry via Management API
            const localizedEntry = await this.fetchEntryWithLocale(contentType, entry.uid, locale, environment);

            // Compare non-localized fields (replicate old checkNonLocalizedFieldChanges logic)
            if (checkNonLocalizedFieldChanges(schema.schema, masterEntry, localizedEntry || {})) {
              hasChanges = true;
              this.logger.debug(
                `Non-localized field change detected: ${contentType}/${entry.uid} (master ${masterLocale} vs ${locale})`
              );
              break; // Found change, no need to check other locales
            }
          }

          if (hasChanges) {
            entriesWithChanges.push(entry);
          }
        } catch (error: any) {
          this.logger.warn(`Failed to process entry ${entry.uid}:`, error.message);
          continue;
        }
      }

      this.logger.info(
        `Filtered to ${entriesWithChanges.length} entries with non-localized field changes (out of ${entries.length})`
      );

      return entriesWithChanges;
    } catch (error: any) {
      this.logger.error('Failed to filter non-localized entries', error);
      throw error;
    }
  }
}
