import type { ManagementStack, TaxonomyPublishJobResponse, TaxonomyPublishPayload } from '../interfaces';
import { OperationType } from '../interfaces';

const DEFAULT_TAXONOMY_API_VERSION = '3.2';

type TaxonomyPublishWithBranch = (
  data: TaxonomyPublishPayload,
  apiVersion?: string,
  params?: { branch?: string }
) => Promise<TaxonomyPublishJobResponse>;

type TaxonomyOperationApi = {
  publish: TaxonomyPublishWithBranch;
  unpublish: TaxonomyPublishWithBranch;
};

export class TaxonomyService {
  constructor(private stack: ManagementStack) {}

  /**
   * Publish one or more taxonomies (initiates a publish job).
   */
  async publish(
    data: TaxonomyPublishPayload,
    apiVersion: string = DEFAULT_TAXONOMY_API_VERSION,
    branch?: string
  ): Promise<TaxonomyPublishJobResponse> {
    return this.submit(OperationType.PUBLISH, data, apiVersion, branch);
  }

  /**
   * Unpublish one or more taxonomies (initiates an unpublish job).
   */
  async unpublish(
    data: TaxonomyPublishPayload,
    apiVersion: string = DEFAULT_TAXONOMY_API_VERSION,
    branch?: string
  ): Promise<TaxonomyPublishJobResponse> {
    return this.submit(OperationType.UNPUBLISH, data, apiVersion, branch);
  }

  private async submit(
    operation: OperationType,
    data: TaxonomyPublishPayload,
    apiVersion: string,
    branch?: string
  ): Promise<TaxonomyPublishJobResponse> {
    const taxonomies = this.stack.taxonomy() as unknown as TaxonomyOperationApi;
    const params =
      branch && branch !== 'main'
        ? {
            branch,
          }
        : undefined;
    if (operation === OperationType.UNPUBLISH) {
      if (params) {
        return taxonomies.unpublish(data, apiVersion, params);
      }
      return taxonomies.unpublish(data, apiVersion);
    }

    if (params) {
      return taxonomies.publish(data, apiVersion, params);
    }
    return taxonomies.publish(data, apiVersion);
  }
}
