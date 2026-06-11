import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fetchContentfulWorkflows } from '../../adapters/contentful/export';

/** Default stage colors (cycled) — Contentstack requires a color per stage. */
const STAGE_COLORS = ['#2196f3', '#74ba76', '#e0a948', '#ec5b56', '#9c27b0', '#00bcd4'];

/** Contentful content-type id → Contentstack content-type uid (snake_case + affix). */
function ctUid(cfId: string, affix = ''): string {
  const snake = String(cfId || '')
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return affix ? `${affix}_${snake}` : snake;
}

/** Pull the content-type ids a Contentful workflow definition applies to. */
function appliesToContentTypes(def: any): string[] {
  const ids: string[] = [];
  for (const a of def?.appliesTo ?? []) {
    for (const v of a?.validations ?? []) {
      for (const id of v?.linkContentType ?? []) if (id) ids.push(id);
    }
  }
  return ids;
}

/**
 * Map Contentful workflow definitions → a Contentstack workflows bundle
 * (`<bundle>/workflows/workflows.json`, the shape csdx import consumes).
 *
 * Each Contentful workflow `step` becomes a Contentstack `workflow_stage`. Stage
 * access is opened to all users ($all) — Contentful step-level user/role
 * assignments don't map 1:1 and are reviewed post-migration. The workflow
 * applies to the mapped content types (or $all when unscoped).
 */
export function mapContentfulWorkflows(
  definitions: any[],
  affix = '',
): Record<string, any> {
  const workflows: Record<string, any> = {};
  for (const def of definitions ?? []) {
    const name = def?.name;
    if (!name) continue;
    const steps: any[] = Array.isArray(def?.steps) ? def.steps : [];
    if (!steps.length) continue;

    const workflow_stages = steps.map((step: any, i: number) => ({
      color: STAGE_COLORS[i % STAGE_COLORS.length],
      SYS_ACL: {
        roles: { uids: [] },
        users: { uids: ['$all'] },
        others: {},
      },
      next_available_stages: ['$all'],
      allStages: true,
      allUsers: true,
      specificStages: false,
      specificUsers: false,
      entry_lock: '$none',
      name: String(step?.name || `Stage ${i + 1}`),
    }));

    const cfCts = appliesToContentTypes(def);
    const content_types = cfCts.length ? cfCts.map((id) => ctUid(id, affix)) : ['$all'];

    const uid = uuidv4().replace(/-/g, '').slice(0, 24);
    workflows[uid] = {
      name,
      enabled: true,
      branches: ['main'],
      admin_users: { users: [] },
      content_types,
      workflow_stages,
    };
  }
  return workflows;
}

export interface WorkflowMigrationResult {
  total: number;
  workflows: string[];
}

/**
 * Fetch a Contentful environment's workflows (live API) and write them into the
 * bundle as `<bundleDir>/workflows/workflows.json` so the standard csdx
 * workflows import module creates them. Best-effort; returns what was written.
 *
 * Workflows are not in the static export, so this only does anything when a
 * space id + token are available (the `--space-id` path).
 */
export async function buildWorkflowsBundle(opts: {
  spaceId: string;
  environmentId: string;
  managementToken?: string;
  bundleDir: string;
  affix?: string;
}): Promise<WorkflowMigrationResult> {
  const definitions = await fetchContentfulWorkflows(
    opts.spaceId,
    opts.environmentId,
    opts.managementToken,
  );
  const workflows = mapContentfulWorkflows(definitions, opts.affix);
  const names = Object.values(workflows).map((w: any) => w.name);
  if (!names.length) return { total: 0, workflows: [] };

  const dir = path.join(opts.bundleDir, 'workflows');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'workflows.json'), `${JSON.stringify(workflows, null, 2)}\n`, 'utf8');
  return { total: names.length, workflows: names };
}
