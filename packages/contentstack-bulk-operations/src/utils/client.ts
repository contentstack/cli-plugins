import contentstack, { StackConfig as DeliveryStackConfig } from '@contentstack/delivery-sdk';
import { managementSDKClient, ContentstackClient } from '@contentstack/cli-utilities';
import { StackConfig, Clients, ManagementStack, DeliveryStack } from '../interfaces';
import { $t, messages } from './index';

/**
 * Get Contentstack stack clients (Management & Delivery SDK)
 * @param config - Stack configuration
 * @returns Object containing both management and delivery SDK clients
 *          - managementStack: Used for all CMS operations (publish, unpublish)
 *          - deliveryStack: Used to fetch only published content (null if no delivery token provided)
 */
export async function getStacks(config: StackConfig = {}): Promise<Clients> {
  try {
    const sdkConfig: any = {
      host: config.host || 'api.contentstack.io',
    };

    const stackApiKey = config.apiKey;

    if (!stackApiKey) {
      throw new Error($t(messages.STACK_API_KEY_NOT_FOUND));
    }

    if (config.managementToken) {
      sdkConfig.management_token = config.managementToken;
    }
    sdkConfig.api_key = stackApiKey;

    const managementAPIClient: ContentstackClient = await managementSDKClient(sdkConfig);

    const managementStack: ManagementStack = managementAPIClient.stack(sdkConfig) as unknown as ManagementStack;
    let deliveryStack: DeliveryStack | null = null;

    if (config.deliveryToken && config.environment) {
      const deliveryConfig: DeliveryStackConfig = {
        apiKey: stackApiKey,
        deliveryToken: config.deliveryToken,
        environment: config.environment,
        host: config.cda || 'cdn.contentstack.io',
      };

      // Add branch if specified
      if (config.branch) {
        deliveryConfig.branch = config.branch;
      }

      deliveryStack = contentstack.stack(deliveryConfig);
    }

    return {
      managementStack,
      deliveryStack,
    };
  } catch (error: any) {
    throw error;
  }
}
