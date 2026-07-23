import type { ManagementStack, TaxonomyPublishJobResponse, TaxonomyPublishPayload } from '../interfaces';
import { OperationType } from '../interfaces';

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

    const params = branch && branch !== 'main' ? { branch } : undefined;

    if (operation === OperationType.UNPUBLISH) {
      return params ? taxonomyInstance.unpublish(data, undefined, params) : taxonomyInstance.unpublish(data);
    }
    return params ? taxonomyInstance.publish(data, undefined, params) : taxonomyInstance.publish(data);
  }
}
