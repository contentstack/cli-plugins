import * as fs from 'fs';
import * as path from 'path';
import { LogPaths, LogEntry, BulkModeLogEntry, SingleModeLogEntry } from '../interfaces';
import { $t, messages } from './index';

const DEFAULT_LOG_FOLDER = 'bulk-operation';

/**
 * Get absolute log folder path
 * @param folderPath - The folder path (relative or absolute)
 * @returns Absolute path to log folder
 */
export function getLogFolderPath(folderPath?: string): string {
  const folder = folderPath || DEFAULT_LOG_FOLDER;
  return path.isAbsolute(folder) ? folder : path.join(process.cwd(), folder);
}

/**
 * Get log file paths for a bulk operation folder
 * Segregates bulk and single mode logs for better scalability
 * @param folderPath - The base folder path for logs (optional, defaults to ./bulk-operation)
 * @returns Object containing paths to all log files
 */
export function getLogPaths(folderPath?: string): LogPaths {
  const folder = getLogFolderPath(folderPath);
  return {
    folder,
    // Bulk mode logs (contains job_id)
    bulkSuccess: path.join(folder, 'bulk-success.json'),
    bulkFailed: path.join(folder, 'bulk-failed.json'),
    // Single mode logs (individual items)
    singleSuccess: path.join(folder, 'single-success.json'),
    singleFailed: path.join(folder, 'single-failed.json'),
  };
}

/**
 * Ensure the log folder exists
 * @param folderPath - The folder path (optional, defaults to ./bulk-operation)
 */
export function ensureLogFolder(folderPath?: string): string {
  const folder = getLogFolderPath(folderPath);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  return folder;
}

/**
 * Read bulk mode success logs
 * @param folderPath - The base folder path for logs (optional)
 * @returns Array of bulk mode success log entries
 */
export function readBulkSuccessLog(folderPath?: string): BulkModeLogEntry[] {
  const paths = getLogPaths(folderPath);

  if (!fs.existsSync(paths.bulkSuccess)) {
    return [];
  }

  try {
    const content = fs.readFileSync(paths.bulkSuccess, 'utf-8');
    return JSON.parse(content) as BulkModeLogEntry[];
  } catch (error) {
    console.error($t(messages.ERROR_READING_LOG, { logType: 'bulk success', path: paths.bulkSuccess }), error);
    return [];
  }
}

/**
 * Read bulk mode failed logs
 * @param folderPath - The base folder path for logs (optional)
 * @returns Array of bulk mode failed log entries
 */
export function readBulkFailedLog(folderPath?: string): BulkModeLogEntry[] {
  const paths = getLogPaths(folderPath);

  if (!fs.existsSync(paths.bulkFailed)) {
    return [];
  }

  try {
    const content = fs.readFileSync(paths.bulkFailed, 'utf-8');
    return JSON.parse(content) as BulkModeLogEntry[];
  } catch (error) {
    console.error($t(messages.ERROR_READING_LOG, { logType: 'bulk failed', path: paths.bulkFailed }), error);
    return [];
  }
}

/**
 * Read single mode success logs
 * @param folderPath - The base folder path for logs (optional)
 * @returns Array of single mode success log entries
 */
export function readSingleSuccessLog(folderPath?: string): SingleModeLogEntry[] {
  const paths = getLogPaths(folderPath);

  if (!fs.existsSync(paths.singleSuccess)) {
    return [];
  }

  try {
    const content = fs.readFileSync(paths.singleSuccess, 'utf-8');
    return JSON.parse(content) as SingleModeLogEntry[];
  } catch (error) {
    console.error($t(messages.ERROR_READING_LOG, { logType: 'single success', path: paths.singleSuccess }), error);
    return [];
  }
}

/**
 * Read single mode failed logs
 * @param folderPath - The base folder path for logs (optional)
 * @returns Array of single mode failed log entries
 */
export function readSingleFailedLog(folderPath?: string): SingleModeLogEntry[] {
  const paths = getLogPaths(folderPath);

  if (!fs.existsSync(paths.singleFailed)) {
    return [];
  }

  try {
    const content = fs.readFileSync(paths.singleFailed, 'utf-8');
    return JSON.parse(content) as SingleModeLogEntry[];
  } catch (error) {
    console.error($t(messages.ERROR_READING_LOG, { logType: 'single failed', path: paths.singleFailed }), error);
    return [];
  }
}

/**
 * Read all success logs (both bulk and single)
 *
 * @param folderPath - The base folder path for logs (optional)
 * @returns Combined array of all success log entries
 */
export function readSuccessLog(folderPath?: string): LogEntry[] {
  const bulkLogs = readBulkSuccessLog(folderPath);
  const singleLogs = readSingleSuccessLog(folderPath);
  return [...bulkLogs, ...singleLogs];
}

/**
 * Read all failed logs (both bulk and single)
 * @param folderPath - The base folder path for logs (optional)
 * @returns Combined array of all failed log entries
 */
export function readFailedLog(folderPath?: string): LogEntry[] {
  const bulkLogs = readBulkFailedLog(folderPath);
  const singleLogs = readSingleFailedLog(folderPath);
  return [...bulkLogs, ...singleLogs];
}

/**
 * Write bulk mode success log
 * @param entry - Bulk mode log entry to write
 * @param folderPath - The base folder path for logs (optional)
 */
export function writeBulkSuccessLog(entry: BulkModeLogEntry, folderPath?: string): void {
  ensureLogFolder(folderPath);
  const paths = getLogPaths(folderPath);

  try {
    // Read existing logs if any
    let existingLogs: BulkModeLogEntry[] = [];
    if (fs.existsSync(paths.bulkSuccess)) {
      const content = fs.readFileSync(paths.bulkSuccess, 'utf-8');
      existingLogs = JSON.parse(content) as BulkModeLogEntry[];
    }

    // Append new entry
    existingLogs.push(entry);

    // Write back to file
    fs.writeFileSync(paths.bulkSuccess, JSON.stringify(existingLogs, null, 2), 'utf-8');
  } catch (error) {
    console.error($t(messages.ERROR_WRITING_LOG, { logType: 'bulk success', path: paths.bulkSuccess }), error);
  }
}

/**
 * Write bulk mode failed log
 * @param entry - Bulk mode log entry to write
 * @param folderPath - The base folder path for logs (optional)
 */
export function writeBulkFailedLog(entry: BulkModeLogEntry, folderPath?: string): void {
  ensureLogFolder(folderPath);
  const paths = getLogPaths(folderPath);

  try {
    // Read existing logs if any
    let existingLogs: BulkModeLogEntry[] = [];
    if (fs.existsSync(paths.bulkFailed)) {
      const content = fs.readFileSync(paths.bulkFailed, 'utf-8');
      existingLogs = JSON.parse(content) as BulkModeLogEntry[];
    }

    // Append new entry
    existingLogs.push(entry);

    // Write back to file
    fs.writeFileSync(paths.bulkFailed, JSON.stringify(existingLogs, null, 2), 'utf-8');
  } catch (error) {
    console.error($t(messages.ERROR_WRITING_LOG, { logType: 'bulk failed', path: paths.bulkFailed }), error);
  }
}

/**
 * Write single mode success log
 * @param entry - Single mode log entry to write
 * @param folderPath - The base folder path for logs (optional)
 */
export function writeSingleSuccessLog(entry: SingleModeLogEntry, folderPath?: string): void {
  ensureLogFolder(folderPath);
  const paths = getLogPaths(folderPath);

  try {
    // Read existing logs if any
    let existingLogs: SingleModeLogEntry[] = [];
    if (fs.existsSync(paths.singleSuccess)) {
      const content = fs.readFileSync(paths.singleSuccess, 'utf-8');
      existingLogs = JSON.parse(content) as SingleModeLogEntry[];
    }

    // Append new entry
    existingLogs.push(entry);

    // Write back to file
    fs.writeFileSync(paths.singleSuccess, JSON.stringify(existingLogs, null, 2), 'utf-8');
  } catch (error) {
    console.error($t(messages.ERROR_WRITING_LOG, { logType: 'single success', path: paths.singleSuccess }), error);
  }
}

/**
 * Write single mode failed log
 * @param entry - Single mode log entry to write
 * @param folderPath - The base folder path for logs (optional)
 */
export function writeSingleFailedLog(entry: SingleModeLogEntry, folderPath?: string): void {
  ensureLogFolder(folderPath);
  const paths = getLogPaths(folderPath);

  try {
    // Read existing logs if any
    let existingLogs: SingleModeLogEntry[] = [];
    if (fs.existsSync(paths.singleFailed)) {
      const content = fs.readFileSync(paths.singleFailed, 'utf-8');
      existingLogs = JSON.parse(content) as SingleModeLogEntry[];
    }

    // Append new entry
    existingLogs.push(entry);

    // Write back to file
    fs.writeFileSync(paths.singleFailed, JSON.stringify(existingLogs, null, 2), 'utf-8');
  } catch (error) {
    console.error($t(messages.ERROR_WRITING_LOG, { logType: 'single failed', path: paths.singleFailed }), error);
  }
}

/**
 * Clear all log files in the folder (overwrite with empty arrays)
 * This is called when starting a NEW operation to ensure only the latest operation's data can be reverted
 * @param folderPath - The base folder path for logs (optional)
 */
export function clearLogs(folderPath?: string): void {
  ensureLogFolder(folderPath);
  const paths = getLogPaths(folderPath);

  try {
    // Overwrite all log files with empty arrays
    fs.writeFileSync(paths.bulkSuccess, '[]', 'utf-8');
    fs.writeFileSync(paths.bulkFailed, '[]', 'utf-8');
    fs.writeFileSync(paths.singleSuccess, '[]', 'utf-8');
    fs.writeFileSync(paths.singleFailed, '[]', 'utf-8');
  } catch (error) {
    console.error($t(messages.ERROR_CLEARING_LOGS, { path: paths.folder }), error);
  }
}
