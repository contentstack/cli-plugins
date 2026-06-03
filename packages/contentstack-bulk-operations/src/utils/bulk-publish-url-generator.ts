import { configHandler } from '@contentstack/cli-utilities';

/**
 * Get the appropriate app URL based on the host
 * Uses the configured region from configHandler to get the uiHost
 * @param host - The host URL
 * @returns The app URL
 */
function getAppUrlFromHost(): string {
  // Get the current region from configHandler
  const currentRegion = configHandler.get('region');
  if (currentRegion && currentRegion.uiHost) {
    return currentRegion.uiHost;
  }
  // Default to NA region if no region is configured
  return 'https://app.contentstack.com';
}

/**
 * Generate the bulk publish status URL based on stack configuration
 * @param apiKey - Stack API key
 * @param branch - Branch name (optional)
 * @returns The status URL or null if apiKey is not available
 */
export function generateBulkPublishStatusUrl(apiKey?: string, branch?: string): string | null {
  if (!apiKey) {
    return null;
  }

  const appUrl = getAppUrlFromHost();

  // Only include branch parameter if branch is not empty and not 'main'
  const branchParam = branch && branch !== 'main' ? `?branch=${branch}` : '';
  return `${appUrl}/#!/stack/${apiKey}/publish-queue${branchParam}`;
}

/**
 * Generate the CS Assets bulk task queue URL for checking job status
 * @param spaceUid - CS Assets space UID
 * @returns The CS Assets job status URL or null if spaceUid is not available
 */
export function generateCsAssetsJobStatusUrl(spaceUid?: string): string | null {
  if (!spaceUid) {
    return null;
  }

  const appUrl = getAppUrlFromHost();
  return `${appUrl}/#!/asset-management/spaces/${spaceUid}/space-settings/bulk-task-queue`;
}
