import * as path from 'path';
import { copy } from 'fs-extra';
import { statSync, readdirSync, createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { cliux, sanitizePath, log } from '@contentstack/cli-utilities';

import { fileHelper } from './index';
import { ImportConfig } from '../types';

/**
 * Calculate directory size in bytes
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  
  try {
    const items = readdirSync(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      
      if (item.isDirectory()) {
        totalSize += await getDirectorySize(fullPath);
      } else if (item.isFile()) {
        const stats = statSync(fullPath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    log.warn(`Error calculating directory size for ${dirPath}: ${error}`, {});
  }
  
  return totalSize;
}

/**
 * Stream-based file copy for large files
 */
async function streamCopyFile(src: string, dest: string): Promise<void> {
  const readStream = createReadStream(src);
  const writeStream = createWriteStream(dest);
  
  await pipeline(readStream, writeStream);
}

/**
 * Memory-efficient recursive directory copy
 */
async function streamCopyDirectory(src: string, dest: string, context: Record<string, any> = {}): Promise<void> {
  try {
    // Create destination directory
    mkdirSync(dest, { recursive: true });
    
    const items = readdirSync(src, { withFileTypes: true });
    
    for (const item of items) {
      const srcPath = path.join(src, item.name);
      const destPath = path.join(dest, item.name);
      
      if (item.isDirectory()) {
        await streamCopyDirectory(srcPath, destPath, context);
      } else if (item.isFile()) {
        const stats = statSync(srcPath);
        
        // Use streaming for files larger than 10MB
        if (stats.size > 10 * 1024 * 1024) {
          log.debug(`Streaming large file: ${item.name} (${Math.round(stats.size / 1024 / 1024)}MB)`, context);
          await streamCopyFile(srcPath, destPath);
        } else {
          // Use regular copy for smaller files
          await copy(srcPath, destPath);
        }
      }
    }
  } catch (error) {
    log.error(`Error during stream copy: ${error}`, context);
    throw error;
  }
}

export default async function backupHandler(importConfig: ImportConfig): Promise<string> {
  log.debug('Starting backup handler process', importConfig.context);

  if (importConfig.hasOwnProperty('useBackedupDir')) {
    log.debug(`Using existing backup directory: ${importConfig.useBackedupDir}`, importConfig.context);
    return importConfig.useBackedupDir;
  }

  const sourceDir = importConfig.branchDir || importConfig.contentDir;
  log.debug(
    `Using source directory for backup: ${sourceDir} (branchDir: ${importConfig.branchDir}, contentDir: ${importConfig.contentDir})`,
    importConfig.context
  );

  // Check if backup should be skipped for large datasets
  const skipBackupThresholdGB = importConfig.modules?.assets?.backupSkipThresholdGB || 1;
  const skipBackupThresholdBytes = skipBackupThresholdGB * 1024 * 1024 * 1024;

  // Calculate source directory size
  log.debug('Calculating source directory size...', importConfig.context);
  const sourceSize = await getDirectorySize(sourceDir);
  const sourceSizeGB = sourceSize / (1024 * 1024 * 1024);
  
  log.debug(`Source directory size: ${sourceSizeGB.toFixed(2)}GB (${sourceSize} bytes)`, importConfig.context);

  // Check if we should skip backup for large datasets
  if (sourceSize > skipBackupThresholdBytes && !importConfig.forceBackup) {
    const skipBackupMessage = `Large dataset detected (${sourceSizeGB.toFixed(2)}GB > ${skipBackupThresholdGB}GB threshold). Skipping backup creation for memory optimization. Use --force-backup to override.`;
    
    log.warn(skipBackupMessage, importConfig.context);
    cliux.print(skipBackupMessage, { color: 'yellow' });
    
    // Return the source directory as the "backup" directory
    return sourceDir;
  }

  let backupDirPath: string;
  const subDir = isSubDirectory(importConfig, sourceDir);

  if (subDir) {
    backupDirPath = path.resolve(sanitizePath(sourceDir), '..', '_backup_' + Math.floor(Math.random() * 1000));
    log.debug(`Detected subdirectory configuration, creating backup at: ${backupDirPath}`, importConfig.context);

    if (importConfig.createBackupDir) {
      cliux.print(
        `Warning!!! Provided backup directory path is a sub directory of the content directory, Cannot copy to a sub directory. Hence new backup directory created - ${backupDirPath}`,
        {
          color: 'yellow',
        },
      );
    }
  } else {
    // NOTE: If the backup folder's directory is provided, create it at that location; otherwise, the default path (working directory).
    backupDirPath = path.join(process.cwd(), '_backup_' + Math.floor(Math.random() * 1000));
    log.debug(`Using default backup directory: ${backupDirPath}`, importConfig.context);

    if (importConfig.createBackupDir) {
      log.debug(`Custom backup directory specified: ${importConfig.createBackupDir}`, importConfig.context);

      if (fileHelper.fileExistsSync(importConfig.createBackupDir)) {
        log.debug(`Removing existing backup directory: ${importConfig.createBackupDir}`, importConfig.context);
        fileHelper.removeDirSync(importConfig.createBackupDir);
      }

      log.debug(`Creating backup directory: ${importConfig.createBackupDir}`, importConfig.context);
      fileHelper.makeDirectory(importConfig.createBackupDir);
      backupDirPath = importConfig.createBackupDir;
    }
  }

  if (backupDirPath) {
    log.debug(`Starting content copy to backup directory: ${backupDirPath}`, importConfig.context);
    log.info('Copying content to the backup directory...', importConfig.context);

    // Use streaming copy for large datasets
    const useStreamingCopy = sourceSizeGB > 0.5; // Use streaming for datasets > 500MB

    if (useStreamingCopy) {
      log.debug(`Using streaming copy for large dataset (${sourceSizeGB.toFixed(2)}GB)`, importConfig.context);
      
      try {
        await streamCopyDirectory(sourceDir, backupDirPath, importConfig.context);
        log.debug(`Successfully created backup at: ${backupDirPath}`, importConfig.context);
        return backupDirPath;
      } catch (error) {
        log.error(`Streaming copy failed, falling back to regular copy: ${error}`, importConfig.context);
        // Fall through to regular copy
      }
    }

    // Regular copy (fallback or for smaller datasets)
    return new Promise((resolve, reject) => {
      return copy(sourceDir, backupDirPath, (error: any) => {
        if (error) {
          return reject(error);
        }
        
        log.debug(`Successfully created backup at: ${backupDirPath}`, importConfig.context);
        resolve(backupDirPath);
      });
    });
  }

  // Should not reach here, but return sourceDir as fallback
  return sourceDir;
}

/**
 * Check whether provided backup directory path is sub directory or not
 * @param importConfig
 * @returns
 */
function isSubDirectory(importConfig: ImportConfig, sourceDir: string) {
  log.debug('Checking if backup directory is a subdirectory');

  const parent = sourceDir;
  const child = importConfig.createBackupDir ? importConfig.createBackupDir : process.cwd();
  const relative = path.relative(parent, child);

  log.debug(`Parent directory: ${parent}, Child directory: ${child}, Relative path: ${relative}`);

  if (relative) {
    const isSubDir = !relative.startsWith('..') && !path.isAbsolute(relative);
    log.debug(`Is subdirectory: ${isSubDir}`);
    return isSubDir;
  }

  // true if both parent and child have same path
  log.debug('Parent and child directories are the same');
  return true;
}
