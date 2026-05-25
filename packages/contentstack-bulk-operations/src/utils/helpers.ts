import chalk from 'chalk';
import { getLogPath } from '@contentstack/cli-utilities';
import { $t, messages } from './index';
import { AssetPublishData, EntryPublishData, BulkOperationResult, BulkJobResult } from '../interfaces';

export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export function getUniqueEnvironments(items: Array<EntryPublishData | AssetPublishData>): string[] {
  const envSet = new Set<string>();
  for (const item of items) {
    if (item.publish_details && Array.isArray(item.publish_details)) {
      for (const pd of item.publish_details) {
        envSet.add(pd.environment);
      }
    }
  }
  return Array.from(envSet);
}

export function getUniqueLocales(items: Array<EntryPublishData | AssetPublishData>): string[] {
  const localeSet = new Set<string>();
  for (const item of items) {
    localeSet.add(item.locale);
  }
  return Array.from(localeSet);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatDuration(milliseconds: number): string {
  return (milliseconds / 1000).toFixed(2);
}

export function formatCompletionMessage(
  mode: string,
  duration: number,
  success: number,
  failed: number,
  total: number,
  additionalInfo?: string
): string {
  let message = `\nOperation completed in ${formatDuration(duration)}s\n`;
  message += `   Mode: ${mode}\n`;

  if (additionalInfo) {
    message += `   ${additionalInfo}\n`;
  }

  message += `   Success: ${success} items\n`;
  message += `   Failed: ${failed} items\n`;
  message += `   Total: ${total} items`;

  return message;
}

export function isRateLimitError(error: any): boolean {
  return error?.errorCode === 429 || error?.status === 429;
}

export function getErrorCode(error: any): string | number {
  return error?.errorCode || error?.status || error?.code || 'Unknown';
}

export function aggregateBatchResults(batchResults: Map<string, BulkJobResult>): {
  totalSuccess: number;
  totalFailed: number;
  total: number;
} {
  const results = Array.from(batchResults.values());
  const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const total = totalSuccess + totalFailed;

  return { totalSuccess, totalFailed, total };
}

export function createOperationResult(
  success: number,
  failed: number,
  total: number,
  duration: number,
  retried: number = 0
): BulkOperationResult {
  return {
    success,
    failed,
    total,
    retried,
    duration,
  };
}

/**
 * Log operation summary with success, failure, and log file information
 * @param result - The bulk operation result containing success/failure counts and log files
 */
export function logSummary(result: any): void {
  console.log('\n' + chalk.green($t(messages.OPERATION_SUMMARY)));
  console.log(chalk.gray('─'.repeat(50)));

  console.log(chalk.green('  ' + $t(messages.SUCCESSFUL, { count: result.success || result.successCount || 0 })));

  if (result.failed || result.failureCount) {
    console.log(chalk.red('  ' + $t(messages.FAILED, { count: result.failed || result.failureCount || 0 })));
  }

  if (result.skipped) {
    console.log(chalk.yellow('  ' + $t(messages.SKIPPED, { count: result.skipped })));
  }

  console.log(chalk.gray('─'.repeat(50)));
  const logFile = getLogPath();
  console.log(chalk.cyan($t(messages.LOG_FILES, { path: logFile })));

  console.log('');
}
