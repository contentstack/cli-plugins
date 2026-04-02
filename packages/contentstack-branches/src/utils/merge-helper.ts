import { cliux, managementSDKClient } from '@contentstack/cli-utilities';
import camelCase from 'lodash/camelCase';
import startCase from 'lodash/startCase';
import path from 'path';

import { BranchDiffPayload, MergeSummary } from '../interfaces';
import {
  askBaseBranch,
  askCompareBranch,
  askStackAPIKey,
  branchDiffUtility as branchDiff,
  executeMergeRequest,
  getMergeQueueStatus,
  getbranchConfig,
  readFile,
  writeFile,
} from './';

export const prepareMergeRequestPayload = (options) => {
  return {
    base_branch: options.baseBranch, // UID of the base branch, where the changes will be merged into
    compare_branch: options.compareBranch, // UID of the branch to merge
    default_merge_strategy: options.strategy,
    item_merge_strategies: options.itemMergeStrategies,
    merge_comment: options.mergeComment,
    no_revert: options.noRevert,
  };
};

function validateMergeSummary(mergeSummary: MergeSummary) {
  if (!mergeSummary) {
    cliux.error(`Error: Invalid merge summary`, { color: 'red' });
    process.exit(1);
  } else if (!mergeSummary.requestPayload) {
    cliux.print(`Error: Invalid merge summary, required 'requestPayload'`, { color: 'red' });
    process.exit(1);
  } else if (!mergeSummary.requestPayload.base_branch) {
    cliux.print(`Error: Invalid merge summary, required 'requestPayload.base_branch'`, { color: 'red' });
    process.exit(1);
  } else if (!mergeSummary.requestPayload.compare_branch) {
    cliux.print(`Error: Invalid merge summary, required 'requestPayload.compare_branch'`, { color: 'red' });
    process.exit(1);
  } else if (!mergeSummary.requestPayload.default_merge_strategy) {
    cliux.print(`Error: Invalid merge summary, required 'requestPayload.default_merge_strategy'`, { color: 'red' });
    process.exit(1);
  } else if (!mergeSummary.requestPayload.default_merge_strategy) {
    cliux.print(`Error: Invalid merge summary, required 'requestPayload.default_merge_strategy'`, { color: 'red' });
    process.exit(1);
  }
}

export const setupMergeInputs = async (mergeFlags) => {
  if (mergeFlags['use-merge-summary']) {
    const mergeSummary: MergeSummary = (await readFile(mergeFlags['use-merge-summary'])) as MergeSummary;
    validateMergeSummary(mergeSummary);
    mergeFlags.mergeSummary = mergeSummary;
  }

  const { requestPayload: { base_branch = null, compare_branch = null } = {} } = mergeFlags.mergeSummary || {};

  if (!mergeFlags['stack-api-key']) {
    mergeFlags['stack-api-key'] = await askStackAPIKey();
  }
  if (!mergeFlags['base-branch']) {
    if (!base_branch) {
      mergeFlags['base-branch'] = getbranchConfig(mergeFlags['stack-api-key']);
      if (!mergeFlags['base-branch']) {
        mergeFlags['base-branch'] = await askBaseBranch();
      } else {
        cliux.print(`\nBase branch: ${mergeFlags['base-branch']}\n`, { color: 'grey' });
      }
    } else {
      mergeFlags['base-branch'] = base_branch;
    }
  }
  if (!mergeFlags['compare-branch']) {
    if (!compare_branch) {
      mergeFlags['compare-branch'] = await askCompareBranch();
    } else {
      mergeFlags['compare-branch'] = compare_branch;
    }
  }

  return mergeFlags;
};

export const displayBranchStatus = async (options) => {
  const spinner = cliux.loaderV2('Loading branch differences...');
  const payload: BranchDiffPayload = {
    apiKey: options.stackAPIKey,
    baseBranch: options.baseBranch,
    compareBranch: options.compareBranch,
    host: options.host,
    module: '',
  };

  payload.spinner = spinner;
  const branchDiffData = await branchDiff.fetchBranchesDiff(payload);
  const diffData = branchDiff.filterBranchDiffDataByModule(branchDiffData);
  cliux.loaderV2('', spinner);

  const parsedResponse = {};
  for (const module in diffData) {
    const branchModuleData = diffData[module];
    payload.module = module;
    cliux.print(' ');
    cliux.print(`${startCase(camelCase(module))} Summary:`, { color: 'yellow' });
    const diffSummary = branchDiff.parseSummary(branchModuleData, options.baseBranch, options.compareBranch);
    branchDiff.printSummary(diffSummary);
    const spinner1 = cliux.loaderV2('Loading branch differences...');
    if (options.format === 'compact-text') {
      const branchTextRes = branchDiff.parseCompactText(branchModuleData);
      cliux.loaderV2('', spinner1);
      branchDiff.printCompactTextView(branchTextRes);
      parsedResponse[module] = branchTextRes;
    } else if (options.format === 'detailed-text') {
      const verboseRes = await branchDiff.parseVerbose(branchModuleData, payload);
      cliux.loaderV2('', spinner1);
      branchDiff.printVerboseTextView(verboseRes);
      parsedResponse[module] = verboseRes;
    }
  }
  return parsedResponse;
};

export const displayMergeSummary = (options) => {
  cliux.print(' ');
  cliux.print(`Merge Summary:`, { color: 'yellow' });
  for (const module in options.compareData) {
    if (options.format === 'compact-text') {
      branchDiff.printCompactTextView(options.compareData[module]);
    } else if (options.format === 'detailed-text') {
      branchDiff.printVerboseTextView(options.compareData[module]);
    }
  }
  cliux.print(' ');
};

/**
 * Executes a merge request and waits for completion with limited polling.
 * If the merge is in_progress, polls for status with max 10 retries and exponential backoff.
 * Returns immediately if merge is complete, throws error if failed.
 *
 * @param apiKey - Stack API key
 * @param mergePayload - Merge request payload
 * @param host - API host
 * @returns Promise<any> - Merge response with status and details
 */
export const executeMerge = async (apiKey, mergePayload, host): Promise<any> => {
  const stackAPIClient = await (await managementSDKClient({ host })).stack({ api_key: apiKey });
  const mergeResponse = await executeMergeRequest(stackAPIClient, { params: mergePayload });
  if (mergeResponse.merge_details?.status === 'in_progress') {
    // TBD call the queue with the id
    return await fetchMergeStatus(stackAPIClient, { uid: mergeResponse.uid });
  } else if (mergeResponse.merge_details?.status === 'complete') {
    // return the merge id success
    return mergeResponse;
  }
};

/**
 * Fetches merge status with retry-limited polling (max 10 attempts) and exponential backoff.
 * Returns a structured response on polling timeout instead of throwing an error.
 *
 * @param stackAPIClient - The stack API client for making requests
 * @param mergePayload - The merge payload containing the UID
 * @param initialDelay - Initial delay between retries in milliseconds (default: 5000ms)
 * @param maxRetries - Maximum number of retry attempts (default: 10)
 * @returns Promise<any> - Merge response object with optional pollingTimeout flag
 */
export const fetchMergeStatus = async (
  stackAPIClient,
  mergePayload,
  initialDelay = 5000,
  maxRetries = 10000, // Temporary making infinite polling to unblock the users
): Promise<any> => {
  let delayMs = initialDelay;
  const maxDelayMs = 60000; // Cap delay at 60 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const mergeStatusResponse = await getMergeQueueStatus(stackAPIClient, { uid: mergePayload.uid });

    if (mergeStatusResponse?.queue?.length >= 1) {
      const mergeRequestStatusResponse = mergeStatusResponse.queue[0];
      const mergeStatus = mergeRequestStatusResponse.merge_details?.status;

      if (mergeStatus === 'complete') {
        return mergeRequestStatusResponse;
      } else if (mergeStatus === 'in-progress' || mergeStatus === 'in_progress') {
        if (attempt < maxRetries) {
          cliux.print(`Merge in progress... (Attempt ${attempt}/${maxRetries})`, { color: 'grey' });
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs = Math.min(delayMs + 1000, maxDelayMs);
        } else {
          // Polling timeout: return structured response instead of throwing
          cliux.print(`Merge in progress... (Attempt ${attempt}/${maxRetries})`, { color: 'grey' });
          return {
            merge_details: mergeRequestStatusResponse.merge_details,
            pollingTimeout: true,
            status: 'in_progress',
            uid: mergePayload.uid,
          };
        }
      } else if (mergeStatus === 'failed') {
        if (mergeRequestStatusResponse?.errors?.length > 0) {
          const errorPath = path.join(process.cwd(), 'merge-error.log');
          await writeFile(errorPath, mergeRequestStatusResponse.errors);
          cliux.print(`\nComplete error log can be found in ${path.resolve(errorPath)}`, { color: 'grey' });
        }
        throw new Error(`merge uid: ${mergePayload.uid}`);
      } else {
        throw new Error(`Invalid merge status found with merge ID ${mergePayload.uid}`);
      }
    } else {
      throw new Error(`No queue found with merge ID ${mergePayload.uid}`);
    }
  }
};
