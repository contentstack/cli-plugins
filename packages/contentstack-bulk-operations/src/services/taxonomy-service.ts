import type { ManagementStack, TaxonomyPublishJobResponse, TaxonomyPublishPayload } from '../interfaces';
import { OperationType } from '../interfaces';

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

  async publish(data: TaxonomyPublishPayload, branch?: string): Promise<TaxonomyPublishJobResponse> {
    return this.submit(OperationType.PUBLISH, data, branch);
  }

  async unpublish(data: TaxonomyPublishPayload, branch?: string): Promise<TaxonomyPublishJobResponse> {
    return this.submit(OperationType.UNPUBLISH, data, branch);
  }

  private async submit(
    operation: OperationType,
    data: TaxonomyPublishPayload,
    branch?: string
  ): Promise<TaxonomyPublishJobResponse> {
    const taxonomyInstance = this.stack.taxonomy() as any;
    taxonomyInstance.addHeader('api_version', '3.2');
    const taxonomies = taxonomyInstance as unknown as TaxonomyOperationApi;

    const params = branch && branch !== 'main' ? { branch } : undefined;

    if (operation === OperationType.UNPUBLISH) {
      return params ? taxonomies.unpublish(data, undefined, params) : taxonomies.unpublish(data);
    }
    return params ? taxonomies.publish(data, undefined, params) : taxonomies.publish(data);
  }
}
