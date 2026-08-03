import { createWriteStream } from 'node:fs';
import { authHandler, authenticationHandler, configHandler } from '@contentstack/cli-utilities';

export interface SecuredAssetAuth {
  /** OAuth: header to attach to the download fetch (value is already "Bearer <token>"). */
  headers?: Record<string, string>;
  /** Basic auth: token to append as ?authtoken= (existing behavior). */
  authtoken?: string;
}

/**
 * Terminal auth failure for secured asset downloads: the server kept rejecting the token even
 * after a forced refresh. Download loops throw this to abort the whole phase instead of failing
 * every remaining asset individually.
 */
export class SecuredAssetAuthError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(
      `Secured asset download authentication failed (HTTP ${status}) even after refreshing credentials. ` +
        'Please log in again (csdx auth:login) and re-run the export.',
    );
    this.name = 'SecuredAssetAuthError';
    this.status = status;
  }
}

/**
 * Resolve auth for secured asset binary downloads.
 * OAuth → Authorization: Bearer header (getAuthDetails handles proactive expiry refresh).
 * Basic → authtoken query param (existing behavior).
 *
 * Pass `forceRefresh` after a 401: the server rejected a token that is still inside its local
 * expiry window (revoked/invalidated), so force a refresh — concurrent callers are deduped by
 * authHandler's in-flight refresh promise. No-op for basic auth, which cannot be refreshed.
 */
export async function getSecuredAssetAuth(forceRefresh = false): Promise<SecuredAssetAuth> {
  if (forceRefresh && authenticationHandler.isOauthEnabled) {
    await authHandler.compareOAuthExpiry(true);
  }
  await authenticationHandler.getAuthDetails();
  if (authenticationHandler.isOauthEnabled) {
    return { headers: { authorization: authenticationHandler.accessToken } };
  }
  const authtoken = configHandler.get('authtoken');
  return authtoken ? { authtoken } : {};
}

export function getArrayFromResponse(data: unknown, arrayKey: string): unknown[] {
  if (Array.isArray(data)) return data;
  if (data != null && typeof data === 'object' && arrayKey in data) {
    const arr = (data as Record<string, unknown>)[arrayKey];
    return Array.isArray(arr) ? arr : [];
  }
  return [];
}

export function getAssetItems(
  assetsData: unknown,
): Array<{ uid?: string; _uid?: string; url?: string; filename?: string; file_name?: string }> {
  if (Array.isArray(assetsData)) return assetsData;
  const data = assetsData as Record<string, unknown>;
  const items = data?.items ?? data?.assets ?? data?.results;
  return Array.isArray(items) ? items : [];
}

export function getReadableStreamFromDownloadResponse(
  response: { data?: NodeJS.ReadableStream } | NodeJS.ReadableStream | null,
): NodeJS.ReadableStream | null {
  if (!response) return null;
  const withData = response as { data?: NodeJS.ReadableStream };
  if (withData?.data != null) return withData.data;
  const stream = response as NodeJS.ReadableStream;
  return typeof stream?.pipe === 'function' ? stream : null;
}

export function writeStreamToFile(stream: NodeJS.ReadableStream, filePath: string): Promise<void> {
  const writer = createWriteStream(filePath);
  stream.pipe(writer);
  return new Promise<void>((resolve, reject) => {
    writer.on('finish', () => resolve());
    writer.on('error', reject);
  });
}
