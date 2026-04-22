import { cliux } from '@contentstack/cli-utilities';

import { getMergeQueueStatus } from './';

/**
 * Maps merge status to a user-friendly message with visual indicator.
 * @param status - The merge status (complete, in_progress, failed, or unknown)
 * @returns User-friendly status message
 */
export const getMergeStatusMessage = (status: string): string => {
  switch (status) {
    case 'complete':
      return '✅ Merge completed successfully';
    case 'in_progress':
    case 'in-progress':
      return '⏳ Merge is still processing';
    case 'failed':
      return '❌ Merge failed';
    default:
      return '⚠️ Unknown status';
  }
};

/**
 * Formats and displays merge status details in a user-friendly format.
 * Shows merge metadata, summary statistics, and errors if present.
 * @param mergeResponse - The merge response object containing status details
 */
export const displayMergeStatusDetails = (mergeResponse: any): void => {
  if (!mergeResponse) {
    cliux.print('No merge information available', { color: 'yellow' });
    return;
  }

  const { errors = [], merge_details = {}, merge_summary = {}, uid } = mergeResponse;
  const status = merge_details.status || 'unknown';
  const statusMessage = getMergeStatusMessage(status);

  const statusColor = getStatusColor(status);

  cliux.print(' ');
  cliux.print(`${statusMessage}`, { color: statusColor });

  cliux.print(' ');
  cliux.print('Merge Details:', { color: 'cyan' });
  cliux.print(`   ├─ Merge UID: ${uid}`, { color: 'grey' });

  if (merge_details.created_at) {
    cliux.print(`   ├─ Created: ${merge_details.created_at}`, { color: 'grey' });
  }

  if (merge_details.updated_at) {
    cliux.print(`   ├─ Updated: ${merge_details.updated_at}`, { color: 'grey' });
  }

  if (merge_details.completed_at && status === 'complete') {
    cliux.print(`   ├─ Completed: ${merge_details.completed_at}`, { color: 'grey' });
  }

  if (merge_details.completion_percentage !== undefined && status === 'in_progress') {
    cliux.print(`   ├─ Progress: ${merge_details.completion_percentage}%`, { color: 'grey' });
  }

  const statusIndicator = status === 'complete' ? ' ✓' : '';
  cliux.print(`   └─ Status: ${status}${statusIndicator}`, { color: 'grey' });

  displayMergeSummary(merge_summary);
  displayMergeErrors(errors);

  cliux.print(' ');
};

/**
 * Gets the appropriate color for the status message
 * @param status - The merge status
 * @returns The color name (green, red, or yellow)
 */
const getStatusColor = (status: string): 'green' | 'red' | 'yellow' => {
  if (status === 'complete') return 'green';
  if (status === 'failed') return 'red';
  return 'yellow';
};

/**
 * Displays the merge summary statistics
 * @param merge_summary - The merge summary object containing content types and global fields stats
 */
const displayMergeSummary = (merge_summary: any): void => {
  if (!merge_summary || (!merge_summary.content_types && !merge_summary.global_fields)) {
    return;
  }

  cliux.print(' ');
  cliux.print('Summary:', { color: 'cyan' });

  if (merge_summary.content_types) {
    const ct = merge_summary.content_types;
    const added = ct.added || 0;
    const modified = ct.modified || 0;
    const deleted = ct.deleted || 0;
    cliux.print(`   ├─ Content Types: +${added}, ~${modified}, -${deleted}`, { color: 'grey' });
  }

  if (merge_summary.global_fields) {
    const gf = merge_summary.global_fields;
    const added = gf.added || 0;
    const modified = gf.modified || 0;
    const deleted = gf.deleted || 0;
    cliux.print(`   └─ Global Fields: +${added}, ~${modified}, -${deleted}`, { color: 'grey' });
  }
};

/**
 * Displays merge errors if any exist
 * @param errors - Array of error objects to display
 */
const displayMergeErrors = (errors: any[]): void => {
  if (!errors || errors.length === 0) {
    return;
  }

  cliux.print(' ');
  cliux.print('Errors:', { color: 'red' });
  errors.forEach((error, index) => {
    const isLast = index === errors.length - 1;
    const prefix = isLast ? '└─' : '├─';
    cliux.print(`   ${prefix} ${error.message || error}`, { color: 'grey' });
  });
};

/**
 * Fetches merge status and extracts content type data for script generation.
 * Validates that the merge status is 'complete' before returning content type data.
 * @param stackAPIClient - The stack API client for making requests
 * @param mergeUID - The merge job UID
 * @returns Promise<any> - Merge status response with content type data or error
 */
export const getMergeStatusWithContentTypes = async (
  stackAPIClient,
  mergeUID: string
): Promise<any> => {
  try {
    const mergeStatusResponse = await getMergeQueueStatus(stackAPIClient, { uid: mergeUID });

    if (!mergeStatusResponse?.queue?.length) {
      throw new Error(`No merge job found with UID: ${mergeUID}`);
    }

    const mergeRequestStatusResponse = mergeStatusResponse.queue[0];
    const mergeStatus = mergeRequestStatusResponse.merge_details?.status;

    if (mergeStatus !== 'complete') {
      return {
        error: `Merge job is not complete. Current status: ${mergeStatus}`,
        merge_details: mergeRequestStatusResponse.merge_details,
        status: mergeStatus,
        uid: mergeUID,
      };
    }

    return mergeRequestStatusResponse;
  } catch (error) {
    throw new Error(`Failed to fetch merge status: ${error.message || error}`);
  }
};
