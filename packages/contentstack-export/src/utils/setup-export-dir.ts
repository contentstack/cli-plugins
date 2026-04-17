import { ExportConfig } from '../types';
import { makeDirectory } from './file-helper';

export default async function setupExportDir(exportConfig: ExportConfig) {
  makeDirectory(exportConfig.exportDir);
  // Single-branch export: content goes directly under exportDir; no per-branch subdirs.
}
