import isEmpty from 'lodash/isEmpty';
import { log } from '@contentstack/cli-utilities';
import { ApiOptions } from '../import/modules/base-class';
import type { Context } from '../types';
import { fsUtil, fileExistsSync } from './file-helper';

/**
 * Reads source env UID → destination stack env UID map produced during environments import.
 */
export function readEnvUidMapperSync(envUidMapperPath: string, context: Context): Record<string, string> {
  if (!fileExistsSync(envUidMapperPath)) {
    log.debug(`Environment UID mapper not found at ${envUidMapperPath}`, context);
    return {};
  }

  try {
    const raw = fsUtil.readFile(envUidMapperPath, true) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw || {})) {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        out[k] = String(v);
      }
    }
    return out;
  } catch {
    log.debug('Failed to read environment UID mapper', context);
    return {};
  }
}

export function warnIfEnvMapperEmpty(envUidMapper: Record<string, string>, context: Context): void {
  if (isEmpty(envUidMapper)) {
    log.warn(
      'Environment UID mapper is empty; taxonomy publishing is skipped. Import environments first or ensure mapper/environments/uid-mapping.json exists.',
      context,
    );
  }
}

/**
 * Builds taxonomy publish payload: destination env UIDs from mapper, locales from taxonomy.locale, items: [{ uid }].
 */
export function serializePublishTaxonomies(
  apiOptions: ApiOptions,
  envUidMapper: Record<string, string>,
): ApiOptions {
  const job = apiOptions.apiData as { taxonomy?: Record<string, any> };
  const taxonomy = job?.taxonomy;

  if (!taxonomy?.publish_details?.length || !taxonomy?.locale) {
    apiOptions.apiData = undefined;
    return apiOptions;
  }

  const environments: string[] = [];
  for (const pub of taxonomy.publish_details as any[]) {
    const sourceEnvUid = pub?.environment;
    if (!sourceEnvUid) continue;
    const destUid = envUidMapper[String(sourceEnvUid)];
    if (destUid && !environments.includes(destUid)) {
      environments.push(destUid);
    }
  }

  if (environments.length === 0) {
    apiOptions.apiData = undefined;
    return apiOptions;
  }

  const locales = [String(taxonomy.locale)];
  apiOptions.apiData = {
    environments,
    locales,
    items: [{ uid: taxonomy.uid }],
  };

  return apiOptions;
}
