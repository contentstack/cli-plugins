import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import chunk from 'lodash/chunk';
import { HttpClient, log, authenticationHandler, handleAndLogError } from '@contentstack/cli-utilities';

import { withRetry, RetryableHttpError, isRetryableStatus, parseRetryAfterMs } from './retry';
import { FALLBACK_AM_API_FETCH_CONCURRENCY, FALLBACK_AM_API_PAGE_SIZE } from '../constants/index';

import type {
  CSAssetsAPIConfig,
  AssetTypesResponse,
  BulkDeleteAssetsPayload,
  BulkDeleteAssetsResponse,
  BulkMoveAssetsPayload,
  BulkMoveAssetsResponse,
  CreateAssetMetadata,
  CreateAssetTypePayload,
  CreateFieldPayload,
  CreateFolderPayload,
  CreateSpacePayload,
  FieldsResponse,
  ICSAssetsAdapter,
  SearchAssetsParams,
  SearchAssetsResponse,
  Space,
  SpaceResponse,
  SpacesListResponse,
} from '../types/cs-assets-api';

/** Default fields requested from POST /api/search for asset export. */
export const DEFAULT_SEARCH_ASSET_FIELDS = [
  'asset_id',
  'uid',
  'title',
  'file_name',
  'description',
  'parent_uid',
  'is_dir',
  'dimensions',
  'file_size',
  'content_type',
  'asset_type',
  'url',
  'tags',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'path',
  'locale',
  'space_uid',
  'version',
  'publish_details',
  'ACL',
  '_asset_scan_status',
] as const;

/**
 * Concurrency model ported from the legacy `contentstack-export` package
 * (`src/export/modules/base-class.ts`). `makeConcurrentCall` runs work in
 * batches of `concurrencyLimit`, settling each batch before the next and
 * throttling between batches. Transport differs from legacy: `makeAPICall`
 * dispatches to this adapter's HttpClient (`getSpaceLevel`) instead of the SDK.
 */
export type ApiModuleType = 'paginated-collection';

export type ApiOptions = {
  uid?: string;
  url?: string;
  module: ApiModuleType;
  queryParam?: Record<string, unknown>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  additionalInfo?: Record<string, any>;
};

export type EnvType = {
  module: string;
  /** Pre-chunked work: each inner array runs in parallel, the outer array runs sequentially. */
  apiBatches: any[][];
  apiParams?: ApiOptions;
};

export type CustomPromiseHandlerInput = {
  index: number;
  batchIndex: number;
  element?: any;
  apiParams?: ApiOptions;
  isLastRequest: boolean;
};

export type CustomPromiseHandler = (input: CustomPromiseHandlerInput) => Promise<any>;

export class CSAssetsAdapter implements ICSAssetsAdapter {
  private readonly config: CSAssetsAPIConfig;
  private readonly apiClient: HttpClient;

  constructor(config: CSAssetsAPIConfig) {
    this.config = config;
    this.apiClient = new HttpClient();
    const baseURL = config.baseURL?.replace(/\/$/, '') ?? '';
    this.apiClient.baseUrl(baseURL);
    const defaultHeaders = { Accept: 'application/json', 'x-cs-api-version': '4' };
    this.apiClient.headers(config.headers ? { ...defaultHeaders, ...config.headers } : defaultHeaders);
    log.debug('CSAssetsAdapter initialized', config.context);
  }

  /**
   * Build query string from params. Supports string and string[] values.
   * Returns empty string when params are empty so we never append "?" with no keys.
   */
  private buildQueryString(params: Record<string, string | string[]>): string {
    const entries = Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && (typeof v === 'string' || Array.isArray(v)),
    );
    if (entries.length === 0) return '';
    const parts: string[] = [];
    for (const [key, value] of entries) {
      if (Array.isArray(value)) {
        for (const v of value) {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
        }
      } else {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    }
    return '?' + parts.join('&');
  }

  /**
   * Format response body or payload for error logging. Safely stringifies and truncates.
   */
  private formatResponseBodyForError(data: unknown, maxLen: number = 500): string {
    if (data === null || data === undefined) return '';
    try {
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
    } catch {
      return '';
    }
  }

  /**
   * Normalize CS Assets API failures into a consistent error message with optional cause and body snippet.
   */
  private normalizeAmGetFailure(details: {
    path: string;
    fullPath: string;
    status?: number;
    cause?: unknown;
    bodySnippet?: string;
  }): Error {
    const { path, status, cause, bodySnippet } = details;
    let message = `CS Assets API GET failed: path ${path}`;
    if (status) message += ` (status ${status})`;
    if (cause && cause instanceof Error) {
      message += ` - ${cause.message}`;
    } else if (cause) {
      message += ` - ${String(cause)}`;
    }
    if (bodySnippet) message += `\nResponse: ${bodySnippet}`;
    return new Error(message);
  }

  /**
   * GET a space-level endpoint (e.g. /api/spaces/{uid}). Builds path + query string and performs the request.
   */
  private async getSpaceLevel<T = unknown>(
    _spaceUid: string,
    path: string,
    queryParams: Record<string, unknown> = {},
  ): Promise<T> {
    await this.init();
    const safeParams: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(queryParams)) {
      let value: string | string[] | undefined;
      if (typeof v === 'string') value = v;
      else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) value = v;
      else value = undefined;
      if (value !== undefined) safeParams[k] = value;
    }
    const queryString = this.buildQueryString(safeParams);
    const fullPath = path + queryString;
    log.debug(`GET ${fullPath}`, this.config.context);

    try {
      // GETs are idempotent, so retry transient failures (network / 429 / 5xx) with backoff.
      return await withRetry<T>(
        async () => {
          let response: Awaited<ReturnType<HttpClient['get']>>;
          try {
            response = await this.apiClient.get<T>(fullPath);
          } catch (netErr) {
            // Transport-level rejection (connection reset, timeout, DNS) — transient.
            throw new RetryableHttpError(`network error: ${(netErr as Error)?.message ?? String(netErr)}`);
          }
          if (response.status < 200 || response.status >= 300) {
            if (isRetryableStatus(response.status)) {
              const retryAfter = parseRetryAfterMs((response as { headers?: Record<string, string> })?.headers?.['retry-after']);
              throw new RetryableHttpError(`GET ${fullPath} → ${response.status}`, response.status, retryAfter);
            }
            // Terminal (e.g. 4xx): normalize and propagate without retrying.
            const bodySnippet = this.formatResponseBodyForError(response.data);
            throw this.normalizeAmGetFailure({ path, fullPath, status: response.status, bodySnippet: bodySnippet || undefined });
          }
          return response.data as T;
        },
        { retries: this.config.retries, baseDelayMs: this.config.retryBaseDelayMs, context: this.config.context, label: `GET ${path}` },
      );
    } catch (error) {
      if (error instanceof RetryableHttpError) {
        // Retries exhausted on a transient failure — surface a normalized error to the caller.
        throw this.normalizeAmGetFailure({ path, fullPath, status: error.status, cause: error });
      }
      if (error instanceof Error && error.message.includes('CS Assets API GET failed')) {
        throw error;
      }
      throw this.normalizeAmGetFailure({ path, fullPath, cause: error });
    }
  }

  async init(): Promise<void> {
    try {
      log.debug('Initializing Contentstack Assets adapter...', this.config.context);
      await authenticationHandler.getAuthDetails();
      const token = authenticationHandler.accessToken;
      log.debug(
        `Authentication type: ${authenticationHandler.isOauthEnabled ? 'OAuth' : 'Token'}`,
        this.config.context,
      );
      const authHeader = authenticationHandler.isOauthEnabled ? { authorization: token } : { access_token: token };
      this.apiClient.headers(this.config.headers ? { ...authHeader, ...this.config.headers } : authHeader);
      log.debug('Contentstack Assets adapter initialization completed', this.config.context);
    } catch (error: unknown) {
      handleAndLogError(
        error as Error,
        this.config.context ? { ...(this.config.context as Record<string, unknown>) } : {},
        'Contentstack Assets adapter initialization failed',
      );
      throw error;
    }
  }

  async listSpaces(pageSize = FALLBACK_AM_API_PAGE_SIZE, fetchConcurrency = FALLBACK_AM_API_FETCH_CONCURRENCY): Promise<SpacesListResponse> {
    log.debug('Fetching all spaces in org', this.config.context);
    const items = await this.fetchAllPages(
      '',
      '/api/spaces',
      'spaces',
      pageSize,
      fetchConcurrency,
    );
    log.debug(`Fetched ${items.length} space(s)`, this.config.context);
    return { spaces: items as Space[], count: items.length };
  }

  async getSpace(spaceUid: string): Promise<SpaceResponse> {
    log.debug(`Fetching space: ${spaceUid}`, this.config.context);
    const path = `/api/spaces/${spaceUid}`;
    const queryParams: Record<string, unknown> = {
      addl_fields: ['meta_info', 'users'],
    };
    const result = await this.getSpaceLevel<SpaceResponse>(spaceUid, path, queryParams);
    log.debug(`Fetched space: ${spaceUid}`, this.config.context);
    return result;
  }

  async getWorkspaceFields(
    spaceUid: string,
    pageSize = FALLBACK_AM_API_PAGE_SIZE,
    fetchConcurrency = FALLBACK_AM_API_FETCH_CONCURRENCY,
  ): Promise<FieldsResponse> {
    log.debug(`Fetching fields for space: ${spaceUid}`, this.config.context);
    const items = await this.fetchAllPages(spaceUid, '/api/fields', 'fields', pageSize, fetchConcurrency, {});
    log.debug(`Fetched fields (count: ${items.length})`, this.config.context);
    return { fields: items, count: items.length } as FieldsResponse;
  }

  /**
   * GET a workspace collection (assets or folders), log count, and return result.
   */
  private async getWorkspaceCollection(
    spaceUid: string,
    path: string,
    logLabel: string,
    queryParams: Record<string, unknown> = {},
  ): Promise<unknown> {
    log.debug(`Fetching ${logLabel} for space: ${spaceUid}`, this.config.context);
    const result = await this.getSpaceLevel<unknown>(spaceUid, path, queryParams);
    const count = (result as { count?: number })?.count ?? (Array.isArray(result) ? result.length : '?');
    log.debug(`Fetched ${logLabel} (count: ${count})`, this.config.context);
    return result;
  }


  /**
   * Core pagination: read the total `count` from page 0, then drive the remaining pages through
   * {@link makeConcurrentCall}. Every page (including page 0) is handed to `onPage` — writes are
   * serialized through a promise chain so a streaming sink (e.g. FsUtility) is never called
   * reentrantly while pages fetch concurrently. Returns the number of items seen.
   *
   * Peak memory is bounded by the sink: the array wrapper holds everything, but a disk-writing
   * sink keeps only the in-flight pages (~concurrency × pageSize).
   */
  private async paginate(
    spaceUid: string,
    path: string,
    itemsKey: string,
    pageSize: number,
    concurrency: number,
    baseParams: Record<string, unknown>,
    onPage: (items: unknown[]) => void | Promise<void>,
  ): Promise<number> {
    const first = await this.getSpaceLevel<Record<string, unknown>>(spaceUid, path, {
      ...baseParams, limit: String(pageSize), skip: '0',
    });

    const total: number = Number(first?.count ?? 0);
    const firstItems: unknown[] = Array.isArray(first?.[itemsKey]) ? (first[itemsKey] as unknown[]) : [];

    let collected = 0;
    let writeFailures = 0;
    let writeChain: Promise<void> = Promise.resolve();
    const enqueue = (items: unknown[]) => {
      collected += items.length;
      // Each link catches its own error so a single failed sink write doesn't skip the queued ones.
      writeChain = writeChain.then(async () => {
        try {
          await onPage(items);
        } catch (e) {
          writeFailures += 1;
          log.warn(`Failed to persist a page of ${itemsKey} (${path}): ${(e as Error)?.message ?? e}`, this.config.context);
        }
      });
    };

    enqueue(firstItems);

    if (firstItems.length < total) {
      // Remaining skip offsets (page 0 already fetched), pre-chunked into batches of `concurrency`.
      const skips: string[] = Array.from(
        { length: Math.ceil(total / pageSize) - 1 },
        (_, i) => String((i + 1) * pageSize),
      );
      const apiBatches = chunk(skips, concurrency);

      let failedPages = 0;
      const onSuccess = ({ response }: any) => {
        const items = Array.isArray(response?.[itemsKey]) ? (response[itemsKey] as unknown[]) : [];
        enqueue(items);
      };
      const onReject = ({ error }: any) => {
        // A failed page is skipped (Promise.allSettled); surface it loudly rather than silently dropping data.
        failedPages += 1;
        log.warn(`Failed to fetch a page of ${itemsKey} (${path}): ${error?.message ?? error}`, this.config.context);
      };

      await this.makeConcurrentCall({
        module: itemsKey,
        apiBatches,
        apiParams: {
          module: 'paginated-collection',
          resolve: onSuccess,
          reject: onReject,
          queryParam: { ...baseParams, limit: String(pageSize) },
          additionalInfo: { spaceUid, path, itemsKey },
        },
      });

      // Completeness check: the export "succeeding" with silently-missing pages is the worst failure
      // mode for a backup/migration, so reconcile what we saw against the server's reported total.
      if (collected !== total) {
        log.warn(
          `Incomplete pagination for ${itemsKey} (${path}): expected ${total}, collected ${collected}` +
            (failedPages > 0 ? ` — ${failedPages} page request(s) failed.` : '.'),
          this.config.context,
        );
      }
    }

    await writeChain; // flush any queued sink writes before returning
    if (writeFailures > 0) {
      log.warn(
        `${writeFailures} page(s) of ${itemsKey} (${path}) failed to persist — output may be incomplete.`,
        this.config.context,
      );
    }
    return collected;
  }

  /**
   * Fetch all pages of a paginated collection into an in-memory array. Use for small collections
   * (spaces/folders/fields/asset-types); for potentially large asset sets prefer
   * {@link streamWorkspaceAssets}, which streams to a sink instead of accumulating.
   */
  private async fetchAllPages(
    spaceUid: string,
    path: string,
    itemsKey: string,
    pageSize: number,
    concurrency: number,
    baseParams: Record<string, unknown> = {},
  ): Promise<unknown[]> {
    const out: unknown[] = [];
    await this.paginate(spaceUid, path, itemsKey, pageSize, concurrency, baseParams, (items) => {
      out.push(...items);
    });
    return out;
  }

  /**
   * Stream a workspace's assets page-by-page to `onPage` (e.g. an incremental chunked-JSON writer)
   * instead of buffering the whole set. Returns the number of asset records streamed.
   */
  async streamWorkspaceAssets(
    spaceUid: string,
    workspaceUid: string | undefined,
    onPage: (items: unknown[]) => void | Promise<void>,
    pageSize = FALLBACK_AM_API_PAGE_SIZE,
    fetchConcurrency = FALLBACK_AM_API_FETCH_CONCURRENCY,
  ): Promise<number> {
    const baseParams: Record<string, unknown> = workspaceUid ? { workspace: workspaceUid } : {};
    return this.paginate(
      spaceUid,
      `/api/spaces/${encodeURIComponent(spaceUid)}/assets`,
      'assets',
      pageSize,
      fetchConcurrency,
      baseParams,
      onPage,
    );
  }

  /**
   * Run pre-batched API work with bounded concurrency: each inner array of `apiBatches`
   * runs in parallel (`Promise.allSettled`), and batches run sequentially. Either invokes a
   * `promisifyHandler` per element, or — for paginated GETs — injects each element as `skip`
   * and dispatches through {@link makeAPICall}. Adapted from legacy export's `makeConcurrentCall`.
   *
   * Callers pre-chunk the work (`chunk(items, concurrency)`), so this never derives batches itself.
   */
  async makeConcurrentCall(env: EnvType, promisifyHandler?: CustomPromiseHandler): Promise<void> {
    const { module, apiBatches, apiParams } = env;
    if (!apiBatches?.length) return;

    for (let batchIndex = 0; batchIndex < apiBatches.length; batchIndex++) {
      const currentBatch = apiBatches[batchIndex];
      const allPromise: Array<Promise<unknown>> = [];

      for (let index = 0; index < currentBatch.length; index++) {
        const element = currentBatch[index];
        const isLastRequest = batchIndex === apiBatches.length - 1 && index === currentBatch.length - 1;

        if (promisifyHandler) {
          allPromise.push(promisifyHandler({ apiParams, element, isLastRequest, index, batchIndex }));
        } else if (apiParams?.queryParam) {
          // Mutated in place per iteration; makeAPICall snapshots it synchronously (see below).
          apiParams.queryParam.skip = element;
          allPromise.push(this.makeAPICall(apiParams, isLastRequest));
        }
      }

      await Promise.allSettled(allPromise);
      log.debug(`Batch ${batchIndex + 1}/${apiBatches.length} of ${module} complete`, this.config.context);
    }
  }

  /**
   * Dispatch a single API call for {@link makeConcurrentCall}. Transport adapted from
   * legacy's SDK calls to this adapter's HttpClient. `queryParam` is snapshotted
   * synchronously (the caller mutates `skip` in place between iterations).
   */
  makeAPICall(
    { module: moduleName, reject, resolve, additionalInfo, queryParam = {} }: ApiOptions,
    isLastRequest = false,
  ): Promise<any> {
    switch (moduleName) {
      case 'paginated-collection': {
        const { spaceUid = '', path = '' } = (additionalInfo ?? {}) as { spaceUid?: string; path?: string };
        const params = { ...queryParam };
        return this.getSpaceLevel<Record<string, unknown>>(spaceUid, path, params)
          .then((response: any) => resolve({ response, isLastRequest, additionalInfo }))
          .catch((error: Error) => reject({ error, isLastRequest, additionalInfo }));
      }
      default:
        return Promise.resolve();
    }
  }

  async getWorkspaceAssets(spaceUid: string, workspaceUid?: string, pageSize = FALLBACK_AM_API_PAGE_SIZE, fetchConcurrency = FALLBACK_AM_API_FETCH_CONCURRENCY): Promise<unknown> {
    const baseParams: Record<string, unknown> = workspaceUid ? { workspace: workspaceUid } : {};
    const items = await this.fetchAllPages(
      spaceUid,
      `/api/spaces/${encodeURIComponent(spaceUid)}/assets`,
      'assets',
      pageSize,
      fetchConcurrency,
      baseParams,
    );
    return { assets: items, count: items.length };
  }

  async getWorkspaceFolders(spaceUid: string, workspaceUid?: string, pageSize = FALLBACK_AM_API_PAGE_SIZE, fetchConcurrency = FALLBACK_AM_API_FETCH_CONCURRENCY): Promise<unknown> {
    const baseParams: Record<string, unknown> = workspaceUid ? { workspace: workspaceUid } : {};
    const items = await this.fetchAllPages(
      spaceUid,
      `/api/spaces/${encodeURIComponent(spaceUid)}/folders`,
      'folders',
      pageSize,
      fetchConcurrency,
      baseParams,
    );
    return { folders: items, count: items.length };
  }

  async getWorkspaceAssetTypes(
    spaceUid: string,
    pageSize = FALLBACK_AM_API_PAGE_SIZE,
    fetchConcurrency = FALLBACK_AM_API_FETCH_CONCURRENCY,
  ): Promise<AssetTypesResponse> {
    log.debug(`Fetching asset types for space: ${spaceUid}`, this.config.context);
    const items = await this.fetchAllPages(spaceUid, '/api/asset_types', 'asset_types', pageSize, fetchConcurrency, {
      include_fields: 'true',
    });
    log.debug(`Fetched asset types (count: ${items.length})`, this.config.context);
    return { asset_types: items, count: items.length } as AssetTypesResponse;
  }

  /**
   * POST /api/search — query assets by UID within linked spaces (Contentstack Assets query export).
   */
  async searchAssets(params: SearchAssetsParams): Promise<SearchAssetsResponse> {
    await this.init();
    const { assetUIDs, spaces, skip = 0, limit = 50 } = params;
    if (!assetUIDs.length) {
      return { count: 0, assets: [] };
    }
    const body = {
      query: {
        $and: [{ uid: { $in: assetUIDs } }],
      },
      skip,
      limit,
      desc: 'updated_at',
      search_text: '',
      search_field: 'all',
      object_type: 'asset',
      search_terms_operator: 'or',
      fields: [...DEFAULT_SEARCH_ASSET_FIELDS],
      spaces,
    };
    log.debug(
      `Searching assets (skip=${skip}, limit=${limit}, uids=${assetUIDs.length}, spaces=${spaces.length})`,
      this.config.context,
    );
    // Search is a read — safe to retry transient failures.
    return this.postJson<SearchAssetsResponse>('/api/search', body, {}, { retry: true });
  }

  // ---------------------------------------------------------------------------
  // POST helpers
  // ---------------------------------------------------------------------------

  /**
   * Build headers for outgoing POST requests.
   */
  private async getPostHeaders(extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
    await authenticationHandler.getAuthDetails();
    const token = authenticationHandler.accessToken;
    const authHeader: Record<string, string> = authenticationHandler.isOauthEnabled
      ? { authorization: token }
      : { access_token: token };
    return {
      Accept: 'application/json',
      'x-cs-api-version': '4',
      ...(this.config.headers ?? {}),
      ...authHeader,
      ...extraHeaders,
    };
  }

  /**
   * POST a JSON body. Pass `{ retry: true }` ONLY for idempotent reads (e.g. /api/search) — never
   * for writes (create/bulk), which could double-apply on retry.
   */
  private async postJson<T>(
    path: string,
    body: unknown,
    extraHeaders: Record<string, string> = {},
    opts: { retry?: boolean } = {},
  ): Promise<T> {
    const baseUrl = this.config.baseURL?.replace(/\/$/, '') ?? '';
    const headers = await this.getPostHeaders({ 'Content-Type': 'application/json', ...extraHeaders });
    log.debug(`POST ${path}`, this.config.context);

    const doPost = async (): Promise<T> => {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
      } catch (netErr) {
        if (opts.retry) throw new RetryableHttpError(`POST ${path} network error: ${(netErr as Error)?.message ?? String(netErr)}`);
        throw netErr;
      }
      if (!response.ok) {
        if (opts.retry && isRetryableStatus(response.status)) {
          throw new RetryableHttpError(`POST ${path} → ${response.status}`, response.status, parseRetryAfterMs(response.headers.get('retry-after')));
        }
        const text = await response.text().catch(() => '');
        const bodySnippet = this.formatResponseBodyForError(text);
        throw new Error(
          `CS Assets API POST failed: status ${response.status} path ${path}${
            bodySnippet ? `\nResponse: ${bodySnippet}` : ''
          }`,
        );
      }
      return response.json() as Promise<T>;
    };

    try {
      return opts.retry
        ? await withRetry(doPost, {
            retries: this.config.retries,
            baseDelayMs: this.config.retryBaseDelayMs,
            context: this.config.context,
            label: `POST ${path}`,
          })
        : await doPost();
    } catch (error) {
      if (error instanceof RetryableHttpError) {
        throw new Error(`CS Assets API POST failed: path ${path} (status ${error.status ?? 'network'}) - ${error.message}`);
      }
      if (error instanceof Error && error.message.includes('CS Assets API POST failed')) {
        throw error;
      }
      throw new Error(`CS Assets API POST failed: path ${path} - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async postMultipart<T>(path: string, form: FormData, extraHeaders: Record<string, string> = {}): Promise<T> {
    const baseUrl = this.config.baseURL?.replace(/\/$/, '') ?? '';
    const headers = await this.getPostHeaders(extraHeaders);
    log.debug(`POST (multipart) ${path}`, this.config.context);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: form,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const bodySnippet = this.formatResponseBodyForError(text);
        throw new Error(
          `CS Assets API multipart POST failed: status ${response.status} path ${path}${
            bodySnippet ? `\nResponse: ${bodySnippet}` : ''
          }`,
        );
      }
      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof Error && error.message.includes('CS Assets API multipart POST failed')) {
        throw error;
      }
      throw new Error(
        `CS Assets API multipart POST failed: path ${path} - ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Import API methods
  // ---------------------------------------------------------------------------

  /**
   * POST /api/spaces — creates a new space in the target org.
   */
  async createSpace(payload: CreateSpacePayload): Promise<{ space: Space }> {
    const orgUid = (this.config.headers as Record<string, string> | undefined)?.organization_uid ?? '';
    return this.postJson<{ space: Space }>('/api/spaces', payload, {
      'x-organization-uid': orgUid,
    });
  }

  /**
   * POST /api/spaces/{spaceUid}/folders — creates a folder inside a space.
   */
  async createFolder(spaceUid: string, payload: CreateFolderPayload): Promise<{ folder: { uid: string } }> {
    return this.postJson<{ folder: { uid: string } }>(`/api/spaces/${encodeURIComponent(spaceUid)}/folders`, payload, {
      space_key: spaceUid,
    });
  }

  /**
   * POST /api/spaces/{spaceUid}/assets — uploads an asset file as multipart form-data.
   */
  async uploadAsset(
    spaceUid: string,
    filePath: string,
    metadata: CreateAssetMetadata,
  ): Promise<{ asset: { uid: string; url: string } }> {
    const filename = basename(filePath);
    const fileBuffer = readFileSync(filePath);
    const blob = new Blob([fileBuffer]);
    const form = new FormData();
    form.append('file', blob, filename);
    if (metadata.title) form.append('title', metadata.title);
    if (metadata.description) form.append('description', metadata.description);
    if (metadata.parent_uid) form.append('parent_uid', metadata.parent_uid);
    return this.postMultipart<{ asset: { uid: string; url: string } }>(
      `/api/spaces/${encodeURIComponent(spaceUid)}/assets`,
      form,
      { space_key: spaceUid },
    );
  }

  /**
   * POST /api/fields — creates a shared field.
   */
  async createField(payload: CreateFieldPayload): Promise<{ field: { uid: string } }> {
    return this.postJson<{ field: { uid: string } }>('/api/fields', payload);
  }

  /**
   * POST /api/asset_types — creates a shared asset type.
   */
  async createAssetType(payload: CreateAssetTypePayload): Promise<{ asset_type: { uid: string } }> {
    return this.postJson<{ asset_type: { uid: string } }>('/api/asset_types', payload);
  }

  /**
   * POST /api/spaces/{spaceUid}/assets/bulk/delete — bulk delete assets (per locale entries).
   */
  async bulkDeleteAssets(
    spaceUid: string,
    workspaceUid: string = 'main',
    payload: BulkDeleteAssetsPayload,
  ): Promise<BulkDeleteAssetsResponse> {
    const path = `/api/spaces/${encodeURIComponent(spaceUid)}/assets/bulk/delete?workspace=${encodeURIComponent(workspaceUid)}`;
    return this.postJson<BulkDeleteAssetsResponse>(path, payload, { space_key: spaceUid });
  }

  /**
   * POST /api/spaces/{spaceUid}/assets/bulk-move — move assets into a folder.
   */
  async bulkMoveAssets(
    spaceUid: string,
    workspaceUid: string = 'main',
    payload: BulkMoveAssetsPayload,
  ): Promise<BulkMoveAssetsResponse> {
    const path = `/api/spaces/${encodeURIComponent(spaceUid)}/assets/bulk-move?workspace=${encodeURIComponent(workspaceUid)}`;
    return this.postJson<BulkMoveAssetsResponse>(path, payload, { space_key: spaceUid });
  }
}
