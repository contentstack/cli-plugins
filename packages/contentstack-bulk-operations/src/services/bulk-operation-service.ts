import config from '../config';
import { $t, messages, sleep } from '../utils';
import {
  EntryPublishData,
  AssetPublishData,
  OperationType,
  BulkJobResult,
  BulkJobDetails,
  ResourceType,
  ManagementStack,
} from '../interfaces';

export class BulkOperationService {
  private apiVersion: string;

  constructor(
    private stack: ManagementStack,
    private logger: any,
    apiVersion: string = '3.2'
  ) {
    this.logger = logger || {
      info: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };
    this.apiVersion = apiVersion;
  }

  /**
   * Execute bulk publish operation for a SINGLE batch - API Layer
   *
   * This is the LOW-LEVEL API handler that:
   * 1. Submits a single batch to Contentstack Bulk API
   * 2. Returns job ID immediately (polling disabled due to auth limitations)
   *
   * IMPORTANT: Partial failure logging limitation
   * - When a bulk job is submitted, only submission-level failures are logged
   * - Individual item failures within a successful job submission are NOT logged
   * - Users must check the bulk publish status URL for detailed job results
   * - retry-failed will only work for jobs that failed at submission time
   *
   * @param items - Single batch of items to process
   * @param operation - publish or unpublish
   * @returns Result for this specific batch
   */
  async executeBulkPublish(
    items: Array<EntryPublishData | AssetPublishData>,
    operation: OperationType,
    resourceType: ResourceType,
    environments?: string[],
    locales?: string[]
  ): Promise<BulkJobResult> {
    this.logger.info($t(messages.SUBMITTING_BULK_JOB, { operation, count: items.length }));

    try {
      // Step 1: Submit bulk job
      const jobId = await this.submitBulkJob(items, operation, resourceType, environments, locales);
      this.logger.debug($t(messages.BULK_JOB_CREATED, { jobId }));

      // Return immediate result after job submission
      // URL will be printed once at the end by the calling command
      // NOTE: Polling is disabled - use bulk publish status URL to check results
      return {
        jobId,
        status: 'submitted',
        success: 0,
        failed: 0,
        items: [],
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Submit bulk job to Contentstack Bulk API
   * Uses SDK's bulkOperation().publish() or unpublish() methods
   */
  private async submitBulkJob(
    items: Array<EntryPublishData | AssetPublishData>,
    operation: OperationType,
    resourceType: ResourceType,
    environments?: string[],
    locales?: string[]
  ): Promise<any> {
    try {
      const payload = this.prepareBulkPayload(items, operation, resourceType, environments, locales);
      let response: any;
      switch (operation) {
        case OperationType.PUBLISH:
          response = await this.stack.bulkOperation().publish({
            details: payload,
            skip_workflow_stage: payload.skip_workflow_stage_check || true,
            approvals: payload.approvals || false,
            is_nested: false,
            api_version: this.apiVersion,
            publishAllLocalized: payload.publish_all_localized || false,
          });
          break;

        case OperationType.UNPUBLISH:
          response = await this.stack.bulkOperation().unpublish({
            details: payload,
            skip_workflow_stage: payload.skip_workflow_stage_check || false,
            approvals: payload.approvals || false,
            is_nested: false,
            api_version: this.apiVersion,
            unpublishAllLocalized: payload.unpublish_all_localized || false,
          });
          break;

        default:
          throw new Error($t(messages.UNSUPPORTED_OPERATION, { operation }));
      }

      return response.job_id;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Poll job status until completion
   * Implements polling logic with enhanced status display
   * Returns job details including success/failure counts
   *
   * NOTE: Currently disabled due to authentication errors during long polling operations
   * Use the bulk publish status URL to check job status instead
   */
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Method will be used when query flag is implemented

  private async pollJobStatus(jobId: any, pollInterval: number = 2000): Promise<BulkJobDetails> {
    const maxPolls = config.maxPolls || 300;
    let pollCount = 0;

    this.logger.info($t(messages.POLLING_JOB_STATUS, { jobId }));

    while (pollCount < maxPolls) {
      try {
        const response = (await this.stack.bulkOperation().jobStatus({
          job_id: jobId,
          api_version: this.apiVersion,
        })) as any;

        const status = response?.status;

        this.logger.debug($t(messages.JOB_STATUS_UPDATE, { jobId, status }));

        if (status === 'complete' || status === 'failed') {
          const jobDetails = this.formatJobDetails(jobId, response);
          this.logger.debug($t(messages.JOB_DETAILS_LABEL), jobDetails);

          return jobDetails;
        }

        await sleep(pollInterval);
        pollCount++;
      } catch (error: any) {
        this.logger.warn($t(messages.POLL_ERROR, { error: error?.errorMessage || error?.message }));
        await sleep(pollInterval);
        pollCount++;
      }
    }

    const timeout = (maxPolls * pollInterval) / 1000;
    throw new Error($t(messages.BULK_JOB_TIMEOUT, { timeout, jobId }));
  }

  /**
   * Fetch results from completed bulk job
   * Uses the same SDK method as pollJobStatus() - just checking final state
   */
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - Method will be used when query flag is implemented

  private async fetchJobResults(jobId: string): Promise<BulkJobResult> {
    try {
      this.logger.debug($t(messages.FETCHING_JOB_RESULTS, { jobId }));

      // Use correct SDK method - same as pollJobStatus()
      // const response: any = await this.stack.bulkOperation().jobStatus({
      //   job_id: jobId as any,
      //   api_version: this.apiVersion,
      // });
      //TODO - Implementation pending in SDK
      // Use API instead of SDK:- https://www.contentstack.com/docs/developers/apis/content-management-api#get-job-items-status
      const response: any = {};

      // Parse results
      const successCount = response.succeeded || 0;
      const failedCount = response.failed || 0;

      return {
        jobId,
        status: response.status,
        success: successCount,
        failed: failedCount,
        items: response.items || [],
      };
    } catch (error: any) {
      throw error;
    }
  }

  private prepareBulkPayload(
    items: Array<EntryPublishData | AssetPublishData>,
    operation: OperationType,
    resourceType: ResourceType,
    environments?: string[],
    locales?: string[]
  ): any {
    if (resourceType === ResourceType.ENTRY) {
      return this.prepareEntryBulkPayload(items as EntryPublishData[], operation, environments, locales);
    } else {
      return this.prepareAssetBulkPayload(items as AssetPublishData[], operation, environments, locales);
    }
  }

  private prepareEntryBulkPayload(
    items: EntryPublishData[],
    operation: OperationType,
    batchEnvironments?: string[],
    batchLocales?: string[]
  ): any {
    const entries = items.map((item) => {
      const entry: any = {
        uid: item.uid,
        content_type: item.content_type,
        locale: item.locale,
        version: item.version,
      };

      // Add variants if present
      if (item.variants && item.variants.length > 0) {
        entry.variants = item.variants;
        entry.variant_rules = item.variant_rules || {
          publish_latest_base: false,
          publish_latest_base_conditionally: true,
        };
      }

      return entry;
    });

    const environments = batchEnvironments?.length
      ? batchEnvironments
      : items[0]?.publish_details?.map((pd) => pd.environment) || [];
    const locales = batchLocales?.length ? batchLocales : Array.from(new Set(items.map((item) => item.locale)));

    if (!environments.length) {
      throw new Error('No environments for bulk publish. Ensure entries have publish_details with environment data.');
    }
    if (!locales.length) {
      throw new Error('No locales for bulk publish. Ensure entries have a locale field.');
    }

    return {
      entries,
      environments,
      locales,
      operation,
    };
  }

  private prepareAssetBulkPayload(
    items: AssetPublishData[],
    operation: OperationType,
    batchEnvironments?: string[],
    batchLocales?: string[]
  ): any {
    const assets = items.map((item) => ({
      uid: item.uid,
      version: item.version,
    }));

    const environments = batchEnvironments?.length
      ? batchEnvironments
      : items[0]?.publish_details?.map((pd) => pd.environment) || [];
    const locales = batchLocales?.length ? batchLocales : items[0]?.publish_details?.map((pd) => pd.locale) || [];

    if (!environments.length) {
      throw new Error('No environments for bulk publish. Ensure assets have publish_details with environment data.');
    }
    if (!locales.length) {
      throw new Error('No locales for bulk publish. Ensure assets have publish_details with locale data.');
    }

    return {
      assets,
      environments,
      locales,
      operation,
    };
  }

  private formatJobDetails(jobId: string, response: any): BulkJobDetails {
    const total = response.total_count || response.items?.length || 0;
    const succeeded = response.succeeded_count || response.succeeded || 0;
    const failed = response.failed_count || response.failed || 0;
    const inProgress = response.in_progress_count || 0;

    const errors = [];
    if (response.errors && Array.isArray(response.errors)) {
      for (const error of response.errors) {
        errors.push({
          uid: error?.uid || error.entry?.uid || 'unknown',
          error: error?.error_message || error?.message || 'Unknown error',
          details: error?.error_details,
        });
      }
    }

    return {
      jobId,
      status: response.status,
      totalItems: total,
      succeeded,
      failed,
      inProgress,
      createdAt: response.created_at,
      completedAt: response.completed_at,
      errors,
    };
  }
}
