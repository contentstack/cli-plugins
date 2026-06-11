import fs from 'fs';
import path from 'path';
import https from 'https';
import mkdirp from 'mkdirp';
import type { ExportOptions, ExportResult } from '../types';
import contentfulValidator from './validator';
import {
  formatContentfulCliInvocation,
  spawnContentfulCli,
} from '../../lib/contentful-cli-spawn';

const EXPORT_FILENAME = 'export.json';

export function resolveContentfulManagementToken(
  flagToken?: string,
): string | undefined {
  return flagToken ?? process.env.CONTENTFUL_MANAGEMENT_TOKEN;
}

/** Build argv for `contentful space export` / `npx -y contentful-cli space export`. */
export function buildContentfulSpaceExportArgs(
  opts: ExportOptions & { spaceId: string },
  token: string,
): string[] {
  const exportDir = path.resolve(opts.outputDir);
  const args = [
    'space',
    'export',
    '--space-id',
    opts.spaceId,
    '--management-token',
    token,
    '--export-dir',
    exportDir,
    '--content-file',
    EXPORT_FILENAME,
  ];

  if (opts.environmentId) {
    args.push('--environment-id', opts.environmentId);
  }
  if (opts.includeDrafts) {
    args.push('--include-drafts');
  }
  if (opts.includeArchived) {
    args.push('--include-archived');
  }
  if (opts.downloadAssets) {
    args.push('--download-assets');
  }

  return args;
}

export async function exportContentful(
  opts: ExportOptions & { spaceId: string },
  spawnFn: typeof spawnContentfulCli = spawnContentfulCli,
): Promise<ExportResult> {
  const token = resolveContentfulManagementToken(opts.managementToken);
  if (!token) {
    throw new Error('Set CONTENTFUL_MANAGEMENT_TOKEN or pass --management-token');
  }

  const outputDir = path.resolve(opts.outputDir);
  const exportFile = path.join(outputDir, EXPORT_FILENAME);

  await mkdirp(outputDir);

  const args = buildContentfulSpaceExportArgs(opts, token);

  if (opts.verbose) {
    // eslint-disable-next-line no-console
    console.log(`Running: ${formatContentfulCliInvocation(args)}`);
  }

  const code = await spawnFn(args, { cwd: outputDir });
  if (code !== 0) {
    throw new Error(`Contentful export failed (exit ${code})`);
  }

  if (!fs.existsSync(exportFile)) {
    throw new Error(`Contentful export finished but ${exportFile} was not created`);
  }

  const raw = await fs.promises.readFile(exportFile, 'utf8');
  if (!contentfulValidator(raw)) {
    throw new Error('Export missing required Contentful keys');
  }

  const result: ExportResult = { exportFile };
  if (opts.downloadAssets) {
    result.assetsDir = outputDir;
  }

  return result;
}

/**
 * List the environments of a Contentful space (CMA GET /spaces/{id}/environments),
 * so each can be migrated into its own Contentstack branch. Uses node `https`
 * directly — axios stalls on this endpoint in some environments.
 */
export async function fetchContentfulEnvironments(
  spaceId: string,
  managementToken?: string,
  attempts = 3,
): Promise<string[]> {
  const token = resolveContentfulManagementToken(managementToken);
  if (!token) {
    throw new Error('Set CONTENTFUL_MANAGEMENT_TOKEN or pass --management-token');
  }
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchContentfulEnvironmentsOnce(spaceId, token);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastErr;
}

function fetchContentfulEnvironmentsOnce(spaceId: string, token: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.contentful.com',
        path: `/spaces/${spaceId}/environments`,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60_000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Contentful environments fetch failed (HTTP ${res.statusCode})`));
            return;
          }
          try {
            const items = JSON.parse(data)?.items;
            resolve(
              Array.isArray(items)
                ? items.map((e: any) => e?.sys?.id).filter((id: unknown): id is string => Boolean(id))
                : [],
            );
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('Contentful environments fetch timed out')));
    req.on('error', reject);
    req.end();
  });
}

/** Low-level GET against the Contentful Management API (node https + retry). */
function cfApiGet(apiPath: string, token: string, headers: Record<string, string> = {}, attempts = 3): Promise<any> {
  const once = () =>
    new Promise<any>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.contentful.com',
          path: apiPath,
          method: 'GET',
          headers: { Authorization: `Bearer ${token}`, ...headers },
          timeout: 60_000,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Contentful GET ${apiPath} failed (HTTP ${res.statusCode})`));
              return;
            }
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(err);
            }
          });
        },
      );
      req.on('timeout', () => req.destroy(new Error(`Contentful GET ${apiPath} timed out`)));
      req.on('error', reject);
      req.end();
    });
  return (async () => {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await once();
      } catch (err) {
        lastErr = err;
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, 2000));
      }
    }
    throw lastErr;
  })();
}

/**
 * Fetch a Contentful environment's workflow definitions from the LIVE Management
 * API (workflows are NOT in the static `contentful space export`). Returns the
 * raw definitions; mapping to Contentstack workflows happens in the service.
 * Best-effort: returns [] if the space has no workflows or the feature is off.
 */
export async function fetchContentfulWorkflows(
  spaceId: string,
  environmentId: string,
  managementToken?: string,
): Promise<any[]> {
  const token = resolveContentfulManagementToken(managementToken);
  if (!token) return [];
  const env = environmentId || 'master';
  // Workflows is an alpha/app feature — the alpha header is required, and the
  // call may 404/403 on spaces without it; treat any failure as "no workflows".
  const alpha = { 'X-Contentful-Enable-Alpha-Feature': 'workflows' };
  const paths = [
    `/spaces/${spaceId}/environments/${env}/workflow_definitions`,
    `/spaces/${spaceId}/workflow_definitions`,
  ];
  for (const p of paths) {
    try {
      const page = await cfApiGet(`${p}?limit=100`, token, alpha);
      if (Array.isArray(page?.items)) return page.items;
    } catch {
      // try the next path / give up
    }
  }
  return [];
}

/**
 * Fetch a Contentful environment's Releases from the LIVE Management API
 * (Releases are NOT in the static export; it's an alpha/app feature). Each
 * release carries its `entities.items` (links to entries/assets). Best-effort:
 * returns [] when the space has no releases or the feature is off.
 */
export async function fetchContentfulReleases(
  spaceId: string,
  environmentId: string,
  managementToken?: string,
): Promise<any[]> {
  const token = resolveContentfulManagementToken(managementToken);
  if (!token) return [];
  const env = environmentId || 'master';
  const alpha = { 'X-Contentful-Enable-Alpha-Feature': 'releases' };
  try {
    const page = await cfApiGet(
      `/spaces/${spaceId}/environments/${env}/releases?limit=100`,
      token,
      alpha,
    );
    return Array.isArray(page?.items) ? page.items : [];
  } catch {
    return [];
  }
}

/**
 * Fetch a Contentful environment's pending Scheduled Actions from the LIVE
 * Management API (not in the static export). Best-effort: [] on error/none.
 */
export async function fetchContentfulScheduledActions(
  spaceId: string,
  environmentId: string,
  managementToken?: string,
): Promise<any[]> {
  const token = resolveContentfulManagementToken(managementToken);
  if (!token) return [];
  const env = environmentId || 'master';
  try {
    const page = await cfApiGet(
      `/spaces/${spaceId}/environments/${env}/scheduled_actions?filter[environment.sys.id]=${env}&filter[sys.status]=scheduled&limit=100`,
      token,
    );
    return Array.isArray(page?.items) ? page.items : [];
  } catch {
    return [];
  }
}

/**
 * Fetch the Tasks on a single Contentful entry from the LIVE Management API
 * (tasks are per-entry to-dos, not in the static export). Best-effort: [].
 */
export async function fetchContentfulEntryTasks(
  spaceId: string,
  environmentId: string,
  entryId: string,
  managementToken?: string,
): Promise<any[]> {
  const token = resolveContentfulManagementToken(managementToken);
  if (!token) return [];
  const env = environmentId || 'master';
  try {
    const page = await cfApiGet(
      `/spaces/${spaceId}/environments/${env}/entries/${entryId}/tasks?limit=100`,
      token,
    );
    return Array.isArray(page?.items) ? page.items : [];
  } catch {
    return [];
  }
}

export interface ContentfulSpace {
  id: string;
  name: string;
}

/**
 * List the spaces a Contentful org has (CMA GET /spaces, filtered by
 * sys.organization). Lets `migrate:create --cf-org-id` migrate every space the
 * token can access in that org, one stack per space.
 */
export async function fetchContentfulSpaces(
  orgId: string,
  managementToken?: string,
): Promise<ContentfulSpace[]> {
  const token = resolveContentfulManagementToken(managementToken);
  if (!token) {
    throw new Error('Set CONTENTFUL_MANAGEMENT_TOKEN or pass --management-token');
  }
  const out: ContentfulSpace[] = [];
  let skip = 0;
  for (;;) {
    const page = await cfApiGet(`/spaces?limit=100&skip=${skip}`, token);
    const items: any[] = Array.isArray(page?.items) ? page.items : [];
    for (const s of items) {
      if (s?.sys?.organization?.sys?.id === orgId && s?.sys?.id) {
        out.push({ id: s.sys.id, name: s?.name || s.sys.id });
      }
    }
    skip += items.length;
    const total = typeof page?.total === 'number' ? page.total : skip;
    if (items.length === 0 || skip >= total) break;
  }
  return out;
}

/** Resolve a Contentful organization's display name (CMA GET /organizations). */
export async function fetchContentfulOrgName(
  orgId: string,
  managementToken?: string,
): Promise<string | undefined> {
  const token = resolveContentfulManagementToken(managementToken);
  if (!token) return undefined;
  try {
    const page = await cfApiGet('/organizations?limit=100', token);
    const org = (page?.items ?? []).find((o: any) => o?.sys?.id === orgId);
    return org?.name;
  } catch {
    return undefined;
  }
}

/** Fetch all pages of a Contentful collection endpoint (skip/limit). */
async function cfApiGetAll(basePath: string, token: string): Promise<any[]> {
  const items: any[] = [];
  let skip = 0;
  for (;;) {
    const sep = basePath.includes('?') ? '&' : '?';
    const page = await cfApiGet(`${basePath}${sep}limit=100&skip=${skip}`, token);
    const batch: any[] = Array.isArray(page?.items) ? page.items : [];
    items.push(...batch);
    skip += batch.length;
    const total = typeof page?.total === 'number' ? page.total : skip;
    if (batch.length === 0 || skip >= total) break;
  }
  return items;
}

export interface ContentfulMember {
  email: string;
  firstName?: string;
  lastName?: string;
  /** Space admin in Contentful → maps to the Contentstack Admin role. */
  admin: boolean;
  /** Contentful role NAMES held by this member (empty for admins). */
  roleNames: string[];
}

/**
 * Fetch a Contentful space's members with their roles, from the LIVE Management
 * API (space memberships are NOT in the static `contentful space export`).
 * Joins space_memberships (user→roles + admin) with users (emails) and roles
 * (id→name) so each member is returned with its human-readable role names.
 */
export async function fetchContentfulMembers(
  spaceId: string,
  managementToken?: string,
): Promise<ContentfulMember[]> {
  const token = resolveContentfulManagementToken(managementToken);
  if (!token) {
    throw new Error('Set CONTENTFUL_MANAGEMENT_TOKEN or pass --management-token');
  }
  const [memberships, users, roles] = await Promise.all([
    cfApiGetAll(`/spaces/${spaceId}/space_memberships`, token),
    cfApiGetAll(`/spaces/${spaceId}/users`, token),
    cfApiGetAll(`/spaces/${spaceId}/roles`, token),
  ]);
  const emailByUserId: Record<string, any> = {};
  for (const u of users) if (u?.sys?.id) emailByUserId[u.sys.id] = u;
  const roleNameById: Record<string, string> = {};
  for (const r of roles) if (r?.sys?.id) roleNameById[r.sys.id] = r?.name || r.sys.id;

  const members: ContentfulMember[] = [];
  for (const m of memberships) {
    const userId = m?.sys?.user?.sys?.id || m?.user?.sys?.id;
    const user = userId ? emailByUserId[userId] : undefined;
    const email = user?.email || m?.email;
    if (!email) continue; // can't invite without an email
    const roleNames = Array.isArray(m?.roles)
      ? m.roles.map((r: any) => roleNameById[r?.sys?.id]).filter((n: any): n is string => Boolean(n))
      : [];
    members.push({
      email,
      firstName: user?.firstName,
      lastName: user?.lastName,
      admin: Boolean(m?.admin),
      roleNames,
    });
  }
  return members;
}
