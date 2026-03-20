import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { HttpClient, log, authenticationHandler } from '@contentstack/cli-utilities';

import type {
  AssetManagementAPIConfig,
  AssetTypesResponse,
  CreateAssetMetadata,
  CreateAssetTypePayload,
  CreateFieldPayload,
  CreateFolderPayload,
  CreateSpacePayload,
  FieldsResponse,
  IAssetManagementAdapter,
  Space,
  SpaceResponse,
  SpacesListResponse,
} from '../types/asset-management-api';

export class AssetManagementAdapter implements IAssetManagementAdapter {
  private readonly config: AssetManagementAPIConfig;
  private readonly apiClient: HttpClient;

  constructor(config: AssetManagementAPIConfig) {
    this.config = config;
    this.apiClient = new HttpClient();
    const baseURL = config.baseURL?.replace(/\/$/, '') ?? '';
    this.apiClient.baseUrl(baseURL);
    const defaultHeaders = { Accept: 'application/json', 'x-cs-api-version': '4' };
    this.apiClient.headers(config.headers ? { ...defaultHeaders, ...config.headers } : defaultHeaders);
    log.debug('AssetManagementAdapter initialized', config.context);
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
    const response = await this.apiClient.get<T>(fullPath);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Asset Management API error: status ${response.status}, path ${path}`);
    }
    return response.data as T;
  }

  async init(): Promise<void> {
    try {
      log.debug('Initializing Asset Management adapter...', this.config.context);
      await authenticationHandler.getAuthDetails();
      const token = authenticationHandler.accessToken;
      log.debug(
        `Authentication type: ${authenticationHandler.isOauthEnabled ? 'OAuth' : 'Token'}`,
        this.config.context,
      );
      const authHeader = authenticationHandler.isOauthEnabled ? { authorization: token } : { access_token: token };
      this.apiClient.headers(this.config.headers ? { ...authHeader, ...this.config.headers } : authHeader);
      log.debug('Asset Management adapter initialization completed', this.config.context);
    } catch (error: unknown) {
      log.debug(`Asset Management adapter initialization failed: ${error}`, this.config.context);
      throw error;
    }
  }

  async listSpaces(): Promise<SpacesListResponse> {
    log.debug('Fetching all spaces in org', this.config.context);
    const result = await this.getSpaceLevel<SpacesListResponse>('', '/api/spaces', {});
    log.debug(`Fetched ${result?.count ?? result?.spaces?.length ?? '?'} space(s)`, this.config.context);
    return result;
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

  async getWorkspaceFields(spaceUid: string): Promise<FieldsResponse> {
    log.debug(`Fetching fields for space: ${spaceUid}`, this.config.context);
    const result = await this.getSpaceLevel<FieldsResponse>(spaceUid, '/api/fields', {});
    log.debug(`Fetched fields (count: ${result?.count ?? '?'})`, this.config.context);
    return result;
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

  async getWorkspaceAssets(spaceUid: string, workspaceUid?: string): Promise<unknown> {
    return this.getWorkspaceCollection(
      spaceUid,
      `/api/spaces/${encodeURIComponent(spaceUid)}/assets`,
      'assets',
      workspaceUid ? { workspace: workspaceUid } : {},
    );
  }

  async getWorkspaceFolders(spaceUid: string, workspaceUid?: string): Promise<unknown> {
    return this.getWorkspaceCollection(
      spaceUid,
      `/api/spaces/${encodeURIComponent(spaceUid)}/folders`,
      'folders',
      workspaceUid ? { workspace: workspaceUid } : {},
    );
  }

  async getWorkspaceAssetTypes(spaceUid: string): Promise<AssetTypesResponse> {
    log.debug(`Fetching asset types for space: ${spaceUid}`, this.config.context);
    const result = await this.getSpaceLevel<AssetTypesResponse>(spaceUid, '/api/asset_types', {
      include_fields: 'true',
    });
    log.debug(`Fetched asset types (count: ${result?.count ?? '?'})`, this.config.context);
    return result;
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

  private async postJson<T>(path: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
    const baseUrl = this.config.baseURL?.replace(/\/$/, '') ?? '';
    const headers = await this.getPostHeaders({ 'Content-Type': 'application/json', ...extraHeaders });
    log.debug(`POST ${path}`, this.config.context);
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`AM API POST error: status ${response.status}, path ${path}, body: ${text}`);
    }
    return response.json() as Promise<T>;
  }

  private async postMultipart<T>(path: string, form: FormData, extraHeaders: Record<string, string> = {}): Promise<T> {
    const baseUrl = this.config.baseURL?.replace(/\/$/, '') ?? '';
    const headers = await this.getPostHeaders(extraHeaders);
    log.debug(`POST (multipart) ${path}`, this.config.context);
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: form,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`AM API multipart POST error: status ${response.status}, path ${path}, body: ${text}`);
    }
    return response.json() as Promise<T>;
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
}
