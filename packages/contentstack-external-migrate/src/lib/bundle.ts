import fs from 'fs';
import path from 'path';

const REQUIRED_ENTRIES = ['content_types', 'locales', 'export-info.json'] as const;

/**
 * Fail fast when a path is not a valid convert output bundle.
 */
export function assertBundleDir(bundleDir: string): void {
  for (const entry of REQUIRED_ENTRIES) {
    if (!fs.existsSync(path.join(bundleDir, entry))) {
      throw new Error(
        `Invalid bundle at ${bundleDir}: missing ${entry}. Run migrate:convert first.`,
      );
    }
  }
}
