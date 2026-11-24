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
  isMergeJobNotRegistered,
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
 * Executes a merge request and waits for completion by polling the merge queue.
 * Returns immediately if the merge is already complete; otherwise polls (see fetchMergeStatus).
 *
 * @param apiKey - Stack API key
 * @param mergePayload - Merge request payload
 * @param host - API host
 * @returns Promise<any> - Merge response with status and details
 */
export const executeMerge = async (apiKey, mergePayload, host): Promise<any> => {
  const stackAPIClient = await (await managementSDKClient({ host })).stack({ api_key: apiKey });
  const mergeResponse = await executeMergeRequest(stackAPIClient, { params: mergePayload });
  const status = mergeResponse?.merge_details?.status;
  if (status === 'complete') {
    return mergeResponse;
  }
  if (status === 'in_progress' || mergeResponse?.uid) {
    // in_progress, or any other not-yet-final status: follow the job in the merge queue
    return await fetchMergeStatus(stackAPIClient, { uid: mergeResponse?.uid });
  }
  throw new Error(`The merge request returned an unexpected response (status: ${status ?? 'none'}).`);
};

/** How many times to re-check a merge job that the queue does not know yet, and the base wait. */
export const MERGE_JOB_REGISTRATION_RETRIES = 5;
export const MERGE_JOB_REGISTRATION_DELAY_MS = 1000;

/**
 * Polls the merge queue until the merge job completes or fails.
 *
 * Right after a merge is submitted, the queue can answer 404 "Invalid merge job UID" (or an
 * empty queue) until the merge worker has registered the job. Those answers are retried with a
 * short linear backoff. If the status still cannot be determined (or the status check fails for
 * any other reason), a structured response with `statusUnknown: true` and the merge UID is
 * returned instead of an error, because the merge may still complete in the background.
 *
 * @param stackAPIClient - The stack API client for making requests
 * @param mergePayload - The merge payload containing the UID
 * @param initialDelay - Delay between in-progress polls in milliseconds (default: 5000ms, +1s per poll, max 60s)
 * @param maxRetries - Maximum number of in-progress polls
 * @param registrationDelay - Base delay for "job not registered yet" retries in milliseconds
 * @returns Promise<any> - Merge response object, optionally with pollingTimeout / statusUnknown flags
 */
export const fetchMergeStatus = async (
  stackAPIClient,
  mergePayload,
  initialDelay = 5000,
  maxRetries = 10000, // Temporary making infinite polling to unblock the users
  registrationDelay = MERGE_JOB_REGISTRATION_DELAY_MS,
): Promise<any> => {
  let delayMs = initialDelay;
  const maxDelayMs = 60000; // Cap delay at 60 seconds
  let registrationAttempts = 0;

  const statusUnknown = (reason: string) => ({
    pollingTimeout: true,
    reason,
    status: 'unknown',
    statusUnknown: true,
    uid: mergePayload.uid,
  });

  // Returns true when the caller should poll again, false when retries are used up.
  const waitForRegistration = async (): Promise<boolean> => {
    if (registrationAttempts >= MERGE_JOB_REGISTRATION_RETRIES) return false;
    registrationAttempts++;
    cliux.print(`Waiting for the merge job to be registered... (Retry ${registrationAttempts}/${MERGE_JOB_REGISTRATION_RETRIES})`, {
      color: 'grey',
    });
    await new Promise((resolve) => setTimeout(resolve, registrationDelay * registrationAttempts));
    return true;
  };

  let attempt = 0; // in-progress polls; "not registered yet" retries are counted separately
  while (attempt < maxRetries) {
    let mergeStatusResponse;
    try {
      mergeStatusResponse = await getMergeQueueStatus(stackAPIClient, { uid: mergePayload.uid });
    } catch (error) {
      const notRegistered = isMergeJobNotRegistered(error);
      if (notRegistered && (await waitForRegistration())) continue;
      const message = error?.errorMessage || error?.message || 'unknown error';
      return statusUnknown(notRegistered ? `the merge queue does not list the job yet (${message})` : message);
    }

    if (!mergeStatusResponse?.queue?.length) {
      if (await waitForRegistration()) continue;
      return statusUnknown('the merge queue does not list the job yet');
    }

    attempt++;
    const mergeRequestStatusResponse = mergeStatusResponse.queue[0];
    const mergeStatus = mergeRequestStatusResponse.merge_details?.status;

    if (mergeStatus === 'complete') {
      return mergeRequestStatusResponse;
    } else if (mergeStatus === 'in-progress' || mergeStatus === 'in_progress') {
      cliux.print(`Merge in progress... (Attempt ${attempt}/${maxRetries})`, { color: 'grey' });
      if (attempt >= maxRetries) {
        // Polling timeout: return structured response instead of throwing
        return {
          merge_details: mergeRequestStatusResponse.merge_details,
          pollingTimeout: true,
          status: 'in_progress',
          uid: mergePayload.uid,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs + 1000, maxDelayMs);
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
  }
};
