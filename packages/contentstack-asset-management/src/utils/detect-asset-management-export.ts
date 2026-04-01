import * as path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { configHandler } from '@contentstack/cli-utilities';

import type { AssetManagementExportFlags } from '../types/asset-management-export-flags';

/** Stack `settings.json` field that marks Asset Management usage (CMA contract). */
const STACK_SETTINGS_ASSET_MANAGEMENT_KEY = 'am_v2' as const;

/**
 * Detects Asset Management export layout: `spaces/` + `stack/settings.json` with linked AM settings,
 * and optionally reads `source_stack` from `branches.json` (content dir or parent).
 */
export function detectAssetManagementExportFromContentDir(contentDir: string): AssetManagementExportFlags {
  const result: AssetManagementExportFlags = { assetManagementEnabled: false };
  const spacesDir = path.join(contentDir, 'spaces');
  const stackSettingsPath = path.join(contentDir, 'stack', 'settings.json');

  if (!existsSync(spacesDir) || !existsSync(stackSettingsPath)) {
    return result;
  }

  try {
    const stackSettings = JSON.parse(readFileSync(stackSettingsPath, 'utf8')) as Record<string, unknown>;
    if (!stackSettings?.[STACK_SETTINGS_ASSET_MANAGEMENT_KEY]) {
      return result;
    }

    result.assetManagementEnabled = true;
    const region = configHandler.get('region') as { assetManagementUrl?: string } | undefined;
    result.assetManagementUrl = region?.assetManagementUrl;

    const branchesJsonCandidates = [
      path.join(contentDir, 'branches.json'),
      path.join(contentDir, '..', 'branches.json'),
    ];
    for (const branchesJsonPath of branchesJsonCandidates) {
      if (!existsSync(branchesJsonPath)) {
        continue;
      }
      try {
        const branches = JSON.parse(readFileSync(branchesJsonPath, 'utf8')) as Array<{
          stackHeaders?: { api_key?: string };
        }>;
        const apiKey = branches?.[0]?.stackHeaders?.api_key;
        if (apiKey) {
          result.source_stack = apiKey;
        }
      } catch {
        // branches.json unreadable — URL mapping will be skipped
      }
      break;
    }
  } catch {
    // stack settings unreadable — not an Asset Management export we can process
  }

  return result;
}
