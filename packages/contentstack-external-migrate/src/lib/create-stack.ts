import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import axios from 'axios';
import { configHandler, authHandler } from '@contentstack/cli-utilities';

const AXIOS_TIMEOUT = 60 * 1000;
/** Shorter timeout for the post-import read/provision calls so a wrong host or
 * an unreachable region fails fast instead of stalling the run for a minute. */
const QUICK_TIMEOUT = 15 * 1000;
/** Hard cap on the csdx seed fallback so it can never hang indefinitely. */
const SEED_TIMEOUT = 10 * 60 * 1000;

const regionalApiHosts: Record<string, string> = {
  NA: 'api.contentstack.io',
  EU: 'eu-api.contentstack.com',
  AZURE_NA: 'azure-na-api.contentstack.com',
  AZURE_EU: 'azure-eu-api.contentstack.com',
  GCP_NA: 'gcp-na-api.contentstack.com',
  AU: 'au-api.contentstack.com',
  GCP_EU: 'gcp-eu-api.contentstack.com',
};

export interface CreateStackParams {
  orgUid: string;
  name: string;
  /** Contentstack master locale code, e.g. "en-us". */
  masterLocale: string;
  verbose?: boolean;
}

export interface CreatedStack {
  apiKey: string;
  /** Stack uid from the CMA. Undefined on the csdx fallback path (fetch separately). */
  uid?: string;
  /** How the stack was created — surfaced to the user. */
  via: 'cma' | 'csdx';
}

interface ResolvedSession {
  region: string;
  /** Contentstack Management API base URL for the logged-in region. */
  cma: string;
  /**
   * Auth headers for CMA calls. Supports BOTH csdx login modes:
   *   - BASIC (username/password) → { authtoken }
   *   - OAUTH (`csdx auth:login --oauth`) → { authorization: 'Bearer <token>' }
   */
  authHeaders: Record<string, string>;
}

/**
 * Build CMA auth headers from the csdx session, matching how the cli-utilities
 * SDK does it: `authorisationType` decides basic vs oauth. Falls back to
 * authtoken when the type is unset (legacy basic logins).
 */
function buildAuthHeaders(): Record<string, string> {
  const authType = configHandler.get('authorisationType') as string | undefined;
  if (authType === 'OAUTH') {
    const oauthToken = configHandler.get('oauthAccessToken') as string | undefined;
    if (!oauthToken) {
      throw new Error("Not logged in. Run 'csdx auth:login' (or 'csdx auth:login --oauth') first.");
    }
    return { authorization: `Bearer ${oauthToken}` };
  }
  // BASIC or unset → authtoken
  const token = configHandler.get('authtoken') as string | undefined;
  if (!token) {
    throw new Error("Not logged in. Run 'csdx auth:login' (or 'csdx auth:login --oauth') first.");
  }
  return { authtoken: token };
}

/**
 * Refresh the OAuth access token when it's expired (no-op for basic auth).
 * OAuth access tokens are short-lived; csdx's own commands refresh before each
 * request. Our raw CMA calls must do the same or they send a stale Bearer token
 * (which is why `--oauth` couldn't create a stack). Best-effort — a failed
 * refresh lets the subsequent call surface a clear auth error.
 */
export async function ensureFreshAuth(): Promise<void> {
  const authType = configHandler.get('authorisationType') as string | undefined;
  if (authType !== 'OAUTH') return;
  try {
    await authHandler.checkExpiryAndRefresh();
  } catch {
    // refresh failed — leave it; the CMA call will report the auth error
  }
}

/** Ensure the cma value is an absolute https URL with no trailing slash. */
function normalizeCma(raw: string): string {
  let v = raw.trim();
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v.replace(/\/+$/, '');
}

/**
 * Read the csdx session (`csdx auth:login`). The token gates stack creation and
 * is sent to the Contentstack Management API; the region's cma host is the API
 * base URL. Region MUST match the org's region.
 */
export function resolveSession(): ResolvedSession {
  const authHeaders = buildAuthHeaders(); // throws if neither basic nor oauth token present
  const regionRaw = configHandler.get('region') as
    | { name?: string; cma?: string }
    | string
    | undefined;
  const region = typeof regionRaw === 'string' ? regionRaw : regionRaw?.name || 'NA';
  const cmaFromConfig = regionRaw && typeof regionRaw === 'object' ? regionRaw.cma : undefined;
  const hostFromTable = regionalApiHosts[region];
  // Don't silently fall back to the NA host for an unknown region — that points
  // every CMA call at the wrong endpoint and they stall until the timeout. Fail
  // fast with an actionable message instead.
  if (!cmaFromConfig && !hostFromTable) {
    throw new Error(
      `Unknown region "${region}" and no CMA host found in config. ` +
        `Re-run 'csdx config:set:region' (or 'csdx auth:login') to set a valid region.`,
    );
  }
  const cma = normalizeCma(cmaFromConfig || `https://${hostFromTable}`);
  return { region, cma, authHeaders };
}

export interface OrganizationOption {
  uid: string;
  name: string;
}

/**
 * List the organizations the logged-in user belongs to (CMA
 * GET /v3/organizations), so the command can offer a pick-list when --org is
 * omitted. Uses the csdx session token + region host.
 */
export async function fetchOrganizations(): Promise<OrganizationOption[]> {
  await ensureFreshAuth();
  const session = resolveSession();
  const res = await axios.get(`${session.cma}/v3/organizations`, {
    timeout: AXIOS_TIMEOUT,
    headers: { ...session.authHeaders },
    params: { limit: 100 },
  });
  const orgs = res?.data?.organizations;
  if (!Array.isArray(orgs)) return [];
  return orgs
    .map((o: any) => ({ uid: o?.uid, name: o?.name }))
    .filter((o: OrganizationOption) => Boolean(o.uid));
}

/**
 * Create a destination stack in the given org and return its api_key.
 *
 * Primary: Contentstack Management API (POST /v3/stacks) with the csdx session
 * token — returns the new stack's api_key directly.
 *
 * Fallback: `csdx cm:stacks:seed` (the only csdx command that creates a stack),
 * scraping the api_key from output. Degraded — seed also pulls starter content.
 */
export async function createStack(params: CreateStackParams): Promise<CreatedStack> {
  await ensureFreshAuth();
  try {
    const { apiKey, uid } = await createStackViaCMA(params);
    return { apiKey, uid, via: 'cma' };
  } catch (cmaErr: any) {
    const cmaMsg = describeCmaError(cmaErr);
    try {
      const apiKey = await createStackViaCsdx(params);
      return { apiKey, via: 'csdx' };
    } catch (csdxErr: any) {
      throw new Error(
        `stack creation failed.\n` +
          `  CMA:  ${cmaMsg}\n` +
          `  csdx: ${csdxErr?.message || csdxErr}`,
      );
    }
  }
}

async function createStackViaCMA(params: CreateStackParams): Promise<{ apiKey: string; uid?: string }> {
  const { orgUid, name, masterLocale } = params;
  const session = resolveSession();
  const res = await axios.post(
    `${session.cma}/v3/stacks`,
    {
      stack: {
        name,
        description: 'Created by migrate CLI from a Contentful export',
        master_locale: masterLocale,
      },
    },
    {
      timeout: AXIOS_TIMEOUT,
      headers: {
        ...session.authHeaders,
        organization_uid: orgUid,
        'Content-Type': 'application/json',
      },
    },
  );

  const apiKey = res?.data?.stack?.api_key;
  if (!apiKey) {
    throw new Error('CMA response did not include stack.api_key');
  }
  return { apiKey, uid: res?.data?.stack?.uid };
}

/**
 * Fetch the stack uid for a given api_key (CMA GET /v3/stacks). Used on the csdx
 * fallback path, where stack creation only yields the api_key.
 */
export async function fetchStackUid(
  apiKey: string,
  timeoutMs: number = QUICK_TIMEOUT,
): Promise<string | undefined> {
  const session = resolveSession();
  const res = await axios.get(`${session.cma}/v3/stacks`, {
    timeout: timeoutMs,
    headers: { ...session.authHeaders, api_key: apiKey },
  });
  return res?.data?.stack?.uid;
}

/**
 * List environment names in a stack (CMA GET /v3/environments). The import step
 * creates these from the bundle, so call AFTER import. A delivery token must be
 * scoped to environments that already exist.
 */
export async function fetchStackEnvironments(
  apiKey: string,
  timeoutMs: number = QUICK_TIMEOUT,
): Promise<string[]> {
  const session = resolveSession();
  const res = await axios.get(`${session.cma}/v3/environments`, {
    timeout: timeoutMs,
    headers: { ...session.authHeaders, api_key: apiKey },
  });
  const envs = res?.data?.environments;
  if (!Array.isArray(envs)) return [];
  return envs.map((e: any) => e?.name).filter((n: unknown): n is string => Boolean(n));
}

/**
 * List branch uids in a stack (CMA GET /v3/stacks/branches). Stacks are
 * branch-enabled by default (a `main` branch), and the delivery-token API
 * rejects a scope that omits branches on such stacks — so we scope to these.
 */
export async function fetchStackBranches(
  apiKey: string,
  timeoutMs: number = QUICK_TIMEOUT,
): Promise<string[]> {
  const session = resolveSession();
  const res = await axios.get(`${session.cma}/v3/stacks/branches`, {
    timeout: timeoutMs,
    headers: { ...session.authHeaders, api_key: apiKey },
  });
  const branches = res?.data?.branches;
  if (!Array.isArray(branches)) return [];
  return branches.map((b: any) => b?.uid).filter((u: unknown): u is string => Boolean(u));
}

/** Map of role name → role uid for a stack (CMA GET /v3/roles). */
export async function fetchStackRoles(
  apiKey: string,
  timeoutMs: number = QUICK_TIMEOUT,
): Promise<Record<string, string>> {
  await ensureFreshAuth();
  const session = resolveSession();
  const res = await axios.get(`${session.cma}/v3/roles?include_rules=false`, {
    timeout: timeoutMs,
    headers: { ...session.authHeaders, api_key: apiKey },
  });
  const map: Record<string, string> = {};
  for (const r of res?.data?.roles ?? []) {
    if (r?.name && r?.uid) map[r.name] = r.uid;
  }
  return map;
}

export interface StackInvite {
  email: string;
  roleUids: string[];
}

/**
 * Share a stack with users, assigning EXACTLY the given role uids per email
 * (CMA POST /v3/stacks/share). The per-email roles map is authoritative — an
 * invitee receives only those roles, no default/extra access. Invites with an
 * empty role list are skipped by the caller (never invite into a default role).
 * Best-effort per email; returns which succeeded/failed.
 */
export async function shareStackWithUsers(
  apiKey: string,
  invites: StackInvite[],
  timeoutMs: number = QUICK_TIMEOUT,
): Promise<{ invited: string[]; failed: Array<{ email: string; error: string }> }> {
  const result = { invited: [] as string[], failed: [] as Array<{ email: string; error: string }> };
  const valid = invites.filter((i) => i.email && i.roleUids.length);
  if (!valid.length) return result;
  await ensureFreshAuth();
  const session = resolveSession();
  const headers = { ...session.authHeaders, api_key: apiKey, 'Content-Type': 'application/json' };
  // Invite per-email so one bad address doesn't fail the whole batch.
  for (const inv of valid) {
    try {
      await axios.post(
        `${session.cma}/v3/stacks/share`,
        { emails: [inv.email], roles: { [inv.email]: inv.roleUids } },
        { timeout: timeoutMs, headers },
      );
      result.invited.push(inv.email);
    } catch (err: any) {
      const detail =
        err?.response?.data?.error_message ||
        (err?.response?.data?.errors && JSON.stringify(err.response.data.errors)) ||
        err?.message ||
        'unknown error';
      result.failed.push({ email: inv.email, error: typeof detail === 'string' ? detail : JSON.stringify(detail) });
    }
  }
  return result;
}

export interface DeliveryTokenResult {
  /** The read-scoped delivery token value. */
  token: string;
  /** Delivery-token uid — needed to create the associated preview token. */
  uid?: string;
  /** The single publishing environment the token is bound to. */
  environment: string;
}

/**
 * Create a read-only delivery token (CMA POST /v3/stacks/delivery_tokens).
 * A Contentstack delivery token binds to exactly ONE publishing environment
 * (the UI is single-select), but can be scoped to multiple branches.
 */
export async function createDeliveryToken(
  apiKey: string,
  environment: string,
  opts: { name?: string; timeoutMs?: number; branches?: string[] } = {},
): Promise<DeliveryTokenResult> {
  const session = resolveSession();
  const scope: Array<Record<string, unknown>> = [
    {
      module: 'environment',
      environments: [environment],
      acl: { read: true },
    },
  ];
  // Branch-enabled stacks (the default) reject a token whose scope omits
  // branches, so include a branch scope when the stack has any.
  if (opts.branches && opts.branches.length > 0) {
    scope.push({
      module: 'branch',
      branches: opts.branches,
      acl: { read: true },
    });
  }
  const res = await axios.post(
    `${session.cma}/v3/stacks/delivery_tokens`,
    {
      token: {
        name: opts.name || 'Migration delivery token',
        description: 'Created by migrate CLI',
        scope,
      },
    },
    {
      timeout: opts.timeoutMs ?? QUICK_TIMEOUT,
      headers: {
        ...session.authHeaders,
        api_key: apiKey,
        'Content-Type': 'application/json',
      },
    },
  );
  const token = res?.data?.token?.token;
  if (!token) {
    throw new Error('CMA response did not include token.token');
  }
  return { token, uid: res?.data?.token?.uid, environment };
}

/**
 * Create the preview token associated with an existing delivery token
 * (CMA POST /v3/stacks/delivery_tokens/{uid}/preview_token). Independent of
 * branches — the scope is inherited from the delivery token. Returns the
 * preview token value.
 */
export async function createPreviewToken(
  apiKey: string,
  deliveryTokenUid: string,
  timeoutMs: number = QUICK_TIMEOUT,
): Promise<string> {
  const session = resolveSession();
  const res = await axios.post(
    `${session.cma}/v3/stacks/delivery_tokens/${deliveryTokenUid}/preview_token`,
    {},
    {
      timeout: timeoutMs,
      headers: {
        ...session.authHeaders,
        api_key: apiKey,
        'Content-Type': 'application/json',
      },
    },
  );
  const preview = res?.data?.token?.preview_token;
  if (!preview) {
    throw new Error('CMA response did not include token.preview_token');
  }
  return preview;
}

/**
 * Turn on Live Preview for the stack (CMA POST /v3/stacks/settings), pointing it
 * at the given environment + preview token. Best-effort.
 */
export async function enableLivePreview(
  apiKey: string,
  environment: string,
  previewToken: string,
  timeoutMs: number = QUICK_TIMEOUT,
): Promise<void> {
  const session = resolveSession();
  await axios.post(
    `${session.cma}/v3/stacks/settings`,
    {
      stack_settings: {
        live_preview: {
          enabled: true,
          'default-env': environment,
          'preview-token': previewToken,
        },
      },
    },
    {
      timeout: timeoutMs,
      headers: { ...session.authHeaders, api_key: apiKey, 'Content-Type': 'application/json' },
    },
  );
}

/**
 * The Contentstack "app" API host (app.contentstack.com/api), where the entry
 * Discussions/Comments endpoints live — distinct from the CMA host. Derived from
 * the session's CMA host so it follows the region.
 */
function appApiBase(): string {
  const session = resolveSession();
  const host = session.cma.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  // NA is the special case (api.contentstack.io → app.contentstack.com); every
  // other region is <region>-api.contentstack.com → <region>-app.contentstack.com.
  const appHost = host === 'api.contentstack.io' ? 'app.contentstack.com' : host.replace('api', 'app');
  return `https://${appHost}/api/v3`;
}

/**
 * Create an entry Discussion attached to a field (Contentstack allows ONE active
 * discussion per field), returning its uid. Entry comments are the home for
 * migrated Contentful entry Tasks. Uses the app API host + session auth.
 */
export async function createEntryDiscussion(
  apiKey: string,
  opts: { contentTypeUid: string; entryUid: string; locale: string; fieldUid: string; title: string; branch?: string },
  timeoutMs: number = QUICK_TIMEOUT,
): Promise<string> {
  await ensureFreshAuth();
  const session = resolveSession();
  const headers = { ...session.authHeaders, api_key: apiKey, 'Content-Type': 'application/json', ...(opts.branch ? { branch: opts.branch } : {}) };
  const base = `${appApiBase()}/content_types/${opts.contentTypeUid}/entries/${opts.entryUid}/discussion`;
  const created = await axios.post(
    `${base}?locale=${encodeURIComponent(opts.locale)}`,
    { discussion: { title: opts.title, field: { uid: opts.fieldUid, path: opts.fieldUid, og_path: opts.fieldUid } } },
    { timeout: timeoutMs, headers },
  );
  const duid = created?.data?.discussion?.uid;
  if (!duid) throw new Error('discussion create returned no uid');
  return duid;
}

/** Post a comment/message into an existing entry Discussion. */
export async function addEntryDiscussionMessage(
  apiKey: string,
  opts: { contentTypeUid: string; entryUid: string; discussionUid: string; message: string; branch?: string },
  timeoutMs: number = QUICK_TIMEOUT,
): Promise<void> {
  await ensureFreshAuth();
  const session = resolveSession();
  const headers = { ...session.authHeaders, api_key: apiKey, 'Content-Type': 'application/json', ...(opts.branch ? { branch: opts.branch } : {}) };
  const base = `${appApiBase()}/content_types/${opts.contentTypeUid}/entries/${opts.entryUid}/discussion`;
  await axios.post(
    `${base}/${opts.discussionUid}/message`,
    { conversation: { discussion_uid: opts.discussionUid, message: opts.message } },
    { timeout: timeoutMs, headers },
  );
}

/**
 * Schedule an entry (or asset) to publish/unpublish at a future time
 * (CMA POST /v3/content_types/{ct}/entries/{uid}/publish | unpublish with
 * `scheduled_at`). Best-effort — throws on API error so the caller can record it.
 */
export async function scheduleEntryAction(
  apiKey: string,
  opts: {
    contentTypeUid: string;
    entryUid: string;
    action: 'publish' | 'unpublish';
    environment: string;
    locale: string;
    scheduledAt: string; // ISO datetime
    branch?: string;
  },
  timeoutMs: number = QUICK_TIMEOUT,
): Promise<void> {
  await ensureFreshAuth();
  const session = resolveSession();
  const headers = { ...session.authHeaders, api_key: apiKey, 'Content-Type': 'application/json', ...(opts.branch ? { branch: opts.branch } : {}) };
  const isAsset = opts.contentTypeUid === 'sys_assets';
  const url = isAsset
    ? `${session.cma}/v3/assets/${opts.entryUid}/${opts.action}`
    : `${session.cma}/v3/content_types/${opts.contentTypeUid}/entries/${opts.entryUid}/${opts.action}`;
  await axios.post(
    url,
    {
      entry: { environments: [opts.environment], locales: [opts.locale] },
      scheduled_at: opts.scheduledAt,
    },
    { timeout: timeoutMs, headers },
  );
}

export interface ReleaseItem {
  uid: string;
  content_type_uid: string;
  action: string; // 'publish'
  locale: string;
}

/**
 * Create a Contentstack Release and add its items (CMA POST /v3/releases then
 * POST /v3/releases/{uid}/items). The release is created but NOT deployed —
 * recreating the Contentful release's grouping without auto-publishing; the
 * operator deploys it from the UI. Returns the new release uid.
 */
export async function createReleaseWithItems(
  apiKey: string,
  release: { name: string; description?: string; locale: string; items: ReleaseItem[]; branch?: string },
  timeoutMs: number = QUICK_TIMEOUT,
): Promise<{ uid: string; itemsAdded: number }> {
  await ensureFreshAuth();
  const session = resolveSession();
  const headers = { ...session.authHeaders, api_key: apiKey, 'Content-Type': 'application/json', ...(release.branch ? { branch: release.branch } : {}) };

  const created = await axios.post(
    `${session.cma}/v3/releases`,
    { release: { name: release.name, description: release.description || '', locale: release.locale } },
    { timeout: timeoutMs, headers },
  );
  const uid = created?.data?.release?.uid;
  if (!uid) throw new Error('CMA response did not include release.uid');

  let itemsAdded = 0;
  if (release.items.length) {
    await axios.post(
      `${session.cma}/v3/releases/${uid}/items`,
      { items: release.items },
      { timeout: timeoutMs, headers },
    );
    itemsAdded = release.items.length;
  }
  return { uid, itemsAdded };
}

export interface EnsureWebhooksResult {
  total: number;
  created: string[];
  skipped: string[];
  failed: Array<{ name: string; error: string }>;
}

/**
 * Create any webhooks from the bundle that are missing on the stack, via CMA
 * (POST /v3/webhooks). Works around a csdx cm:stacks:import bug where its
 * webhooks module imports only the first `concurrency` (5) webhooks and then
 * falsely skips the rest as "already exists" — so a bundle with >5 webhooks
 * silently loses all but 5. We diff the bundle against the stack's live
 * webhooks (by name) and POST whatever is absent. Idempotent and safe to run
 * after every import. Best-effort: never throws (returns a report).
 */
export async function ensureWebhooks(
  apiKey: string,
  bundleDir: string,
  opts: { timeoutMs?: number } = {},
): Promise<EnsureWebhooksResult> {
  const result: EnsureWebhooksResult = { total: 0, created: [], skipped: [], failed: [] };
  let bundleWebhooks: Record<string, any> = {};
  try {
    const raw = fs.readFileSync(path.join(bundleDir, 'webhooks', 'webhooks.json'), 'utf8');
    bundleWebhooks = JSON.parse(raw) as Record<string, any>;
  } catch {
    return result; // no webhooks in bundle
  }
  const entries = Object.values(bundleWebhooks);
  result.total = entries.length;
  if (entries.length === 0) return result;

  await ensureFreshAuth();
  const session = resolveSession();
  const timeout = opts.timeoutMs ?? QUICK_TIMEOUT;
  const headers = { ...session.authHeaders, api_key: apiKey, 'Content-Type': 'application/json' };

  // Live webhook names on the stack (paginated; webhooks are stack-global).
  const existing = new Set<string>();
  try {
    let skip = 0;
    for (;;) {
      const res = await axios.get(`${session.cma}/v3/webhooks`, {
        timeout,
        headers,
        params: { limit: 100, skip, include_count: true },
      });
      const page: any[] = res?.data?.webhooks ?? [];
      for (const w of page) if (w?.name) existing.add(w.name);
      skip += page.length;
      const count = res?.data?.count ?? skip;
      if (page.length === 0 || skip >= count) break;
    }
  } catch {
    // if listing fails, fall through and attempt creates (duplicates are rejected)
  }

  for (const web of entries) {
    const name = web?.name;
    if (!name) continue;
    if (existing.has(name)) {
      result.skipped.push(name);
      continue;
    }
    // CMA create accepts name/channels/destinations/retry_policy/concise_payload/
    // disabled; strip bundle-only fields (urlPath, unhealthy). Keep disabled.
    const { urlPath, unhealthy, ...rest } = web;
    const payload = { ...rest, disabled: true };
    try {
      await axios.post(`${session.cma}/v3/webhooks`, { webhook: payload }, { timeout, headers });
      result.created.push(name);
    } catch (err: any) {
      const detail =
        err?.response?.data?.error_message ||
        err?.response?.data?.errors ||
        err?.message ||
        'unknown error';
      // A 4xx "already exists" just means csdx did create it — treat as skipped.
      if (/already exist/i.test(JSON.stringify(detail))) {
        result.skipped.push(name);
      } else {
        result.failed.push({ name, error: typeof detail === 'string' ? detail : JSON.stringify(detail) });
      }
    }
  }
  return result;
}

/** Environment names from a bundle's environments/environments.json (fallback). */
function readBundleEnvironments(bundleDir: string): string[] {
  try {
    const raw = fs.readFileSync(path.join(bundleDir, 'environments', 'environments.json'), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, { name?: string }>;
    return Object.values(parsed)
      .map((e) => e?.name)
      .filter((n): n is string => Boolean(n));
  } catch {
    return [];
  }
}

/** Retry an async op a few times with a fixed delay — absorbs eventual consistency. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 2000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

/** Order branch uids with `main` first (callers want it as the default/head). */
export function orderBranchesMainFirst(branches: string[]): string[] {
  const uniq = [...new Set(branches.filter(Boolean))];
  const rest = uniq.filter((b) => b !== 'main');
  return uniq.includes('main') ? ['main', ...rest] : rest;
}

export interface StackCredentials {
  stackUid?: string;
  /** The token's single publishing environment (master when present). */
  environment: string;
  /** All branches the token is scoped to (main first). */
  branches: string[];
  /** Empty string when token creation failed (best-effort). */
  deliveryToken: string;
  previewToken: string;
  /** Why the delivery token couldn't be created — set only on failure. */
  deliveryTokenError?: string;
  /** Whether Live Preview was turned on for the stack. */
  livePreviewEnabled: boolean;
}

/**
 * Provision delivery + preview credentials for a freshly imported stack.
 * Resolves the stack uid, ALL environments (now existing), and ALL branches,
 * then creates ONE read delivery token (+ preview token) scoped to every
 * environment. Best-effort: token failures yield empty strings rather than
 * throwing. Call AFTER all imports (environments only exist once import runs).
 */
export async function provisionStackCredentials(opts: {
  apiKey: string;
  uid?: string;
  bundleDir: string;
  tokenName?: string;
}): Promise<StackCredentials> {
  const { apiKey, uid, bundleDir, tokenName } = opts;
  await ensureFreshAuth();
  const [stackUid, stackEnvs, branches] = await Promise.all([
    uid ? Promise.resolve(uid) : fetchStackUid(apiKey).catch(() => undefined),
    fetchStackEnvironments(apiKey).catch(() => [] as string[]),
    fetchStackBranches(apiKey).catch(() => [] as string[]),
  ]);
  // A Contentstack delivery token binds to ONE publishing environment — pick
  // 'master' when present (else the first env). Branches stay multi (main first).
  const bundleEnvs = readBundleEnvironments(bundleDir);
  const resolved = stackEnvs.length ? stackEnvs : bundleEnvs.length ? bundleEnvs : ['master'];
  const environment = resolved.includes('master') ? 'master' : resolved[0];
  const orderedBranches = orderBranchesMainFirst(branches);

  let deliveryToken = '';
  let previewToken = '';
  let deliveryTokenError: string | undefined;
  try {
    const dt = await withRetry(() =>
      createDeliveryToken(apiKey, environment, {
        name: tokenName || 'Migration delivery token',
        branches: orderedBranches,
      }),
    );
    deliveryToken = dt.token;
    // Preview token is a separate call on the delivery token (works for both
    // branch-enabled and branch-disabled stacks). Best-effort.
    if (dt.uid) {
      try {
        previewToken = await withRetry(() => createPreviewToken(apiKey, dt.uid as string));
      } catch {
        // preview token couldn't be created — leave empty
      }
    }
  } catch (err: any) {
    // Surface WHY (not silent) so the operator can act — e.g. environment
    // missing because import failed, or branch scope rejected.
    deliveryTokenError =
      err?.response?.data?.error_message ||
      (err?.response?.data?.errors && JSON.stringify(err.response.data.errors)) ||
      err?.message ||
      'unknown error';
  }

  // Turn on Live Preview (needs the preview token + environment). Best-effort.
  let livePreviewEnabled = false;
  if (previewToken) {
    try {
      await withRetry(() => enableLivePreview(apiKey, environment, previewToken));
      livePreviewEnabled = true;
    } catch {
      // leave disabled — user can enable in the UI
    }
  }

  return {
    stackUid,
    environment,
    branches: orderedBranches,
    deliveryToken,
    previewToken,
    deliveryTokenError,
    livePreviewEnabled,
  };
}

// ─────────────────────────── branches ───────────────────────────

/**
 * Contentstack branch uids: lowercase alphanumeric + underscore only, must start
 * with an alphanumeric, max 15 characters. (Hyphens and other chars are not
 * allowed — e.g. `master-2022-02-09` → `master_2022_02`.)
 */
export function sanitizeBranchUid(name: string): string {
  let s = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_') // invalid → underscore
    .replace(/_+/g, '_') // collapse repeats
    .replace(/^[^a-z0-9]+/, ''); // must start alphanumeric
  s = s.slice(0, 15).replace(/_+$/, ''); // cap length, trim trailing underscore
  return s || 'branch';
}

/**
 * Create a branch cloned from `source` and wait until it's ready. No-op if the
 * branch already exists. Branch creation is async, so we poll until live.
 */
export async function createBranch(
  apiKey: string,
  uid: string,
  source = 'main',
): Promise<void> {
  await ensureFreshAuth();
  const session = resolveSession();
  try {
    await axios.post(
      `${session.cma}/v3/stacks/branches`,
      { branch: { uid, source } },
      {
        timeout: QUICK_TIMEOUT,
        headers: { ...session.authHeaders, api_key: apiKey, 'Content-Type': 'application/json' },
      },
    );
  } catch (err: any) {
    // 409 / already-exists → fine; surface anything else with its API detail.
    const status = err?.response?.status;
    const data = err?.response?.data;
    const msg = JSON.stringify(data ?? '');
    if (status !== 409 && !/already exists/i.test(msg)) {
      const detail = data?.error_message || msg || err?.message;
      throw new Error(`Branch "${uid}" creation failed: ${detail}`);
    }
  }
  await waitForBranch(apiKey, uid);
}

/** Poll a branch until it reports a live/ready state (or times out). */
async function waitForBranch(
  apiKey: string,
  uid: string,
  attempts = 30,
  delayMs = 2000,
): Promise<void> {
  const session = resolveSession();
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await axios.get(`${session.cma}/v3/stacks/branches/${uid}`, {
        timeout: QUICK_TIMEOUT,
        headers: { ...session.authHeaders, api_key: apiKey },
      });
      const status = res?.data?.branch?.status;
      // Treat a fetchable branch with no in-progress status as ready.
      if (!status || /live|success|ready/i.test(String(status))) return;
    } catch {
      // not visible yet — keep polling
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

function createStackViaCsdx(params: CreateStackParams): Promise<string> {
  const { orgUid, name, masterLocale, verbose } = params;
  return new Promise((resolve, reject) => {
    const args = [
      'cm:stacks:seed',
      '--org', orgUid,
      '--stack-name', name,
      '--locale', masterLocale,
      '--yes', 'true',
    ];
    const child = spawn('csdx', args);

    // Hard kill: seed waits on stdin if a prompt slips through despite --yes,
    // which would hang the migration forever. Bound it.
    let timedOut = false;
    const killTimer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, SEED_TIMEOUT);

    let buffer = '';
    const capture = (chunk: Buffer) => {
      const text = chunk.toString();
      buffer += text;
      if (verbose) process.stdout.write(text);
    };
    child.stdout?.on('data', capture);
    child.stderr?.on('data', capture);

    child.on('error', (err: any) => {
      clearTimeout(killTimer);
      if (err?.code === 'ENOENT') {
        reject(new Error('csdx not found on PATH. Install: npm i -g @contentstack/cli'));
      } else {
        reject(err);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(killTimer);
      if (timedOut) {
        reject(
          new Error(`csdx cm:stacks:seed timed out after ${SEED_TIMEOUT / 1000}s and was killed`),
        );
        return;
      }
      if (code !== 0) {
        reject(new Error(`csdx cm:stacks:seed exited with code ${code}`));
        return;
      }
      const apiKey = scrapeApiKey(buffer);
      if (!apiKey) {
        reject(new Error('could not determine the new stack api_key from csdx output'));
        return;
      }
      resolve(apiKey);
    });
  });
}

/** Contentstack stack api keys look like `blt` + 16 hex chars. */
function scrapeApiKey(text: string): string | undefined {
  return text.match(/blt[0-9a-f]{16}/i)?.[0];
}

function describeCmaError(err: any): string {
  if (err?.response) {
    const status = err.response.status;
    const apiMsg =
      err.response.data?.error_message ||
      err.response.data?.message ||
      JSON.stringify(err.response.data);
    return `${status} ${apiMsg}`;
  }
  return err?.message || String(err);
}
