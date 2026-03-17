import { ExportConfig } from '../types';

/**
 * Returns the base path under which module content should be exported.
 * Content is always written directly under this path (no branch subfolder).
 */
export function getExportBasePath(exportConfig: ExportConfig): string {
  return exportConfig.branchDir ?? exportConfig.exportDir;
}
