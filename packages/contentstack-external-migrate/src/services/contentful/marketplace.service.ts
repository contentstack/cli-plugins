// Marketplace app manifest builder — ported from migration-v2/api/src/services/marketplace.service.ts.
// Plugin adaptations:
//   - auth comes from cli-utilities' configHandler (csdx session) instead of lowdb
//   - SINGLE writer of marketplace_apps.json. Two modes:
//       * online  (csdx session + org available): fetch each app's full manifest from
//         Developer Hub and build rich ui_location.locations.
//       * offline (no auth/org, or fetch failed): synthesize a minimal-but-valid manifest
//         from the static app catalog + extension-mapper.json. Crucially this still
//         populates ui_location.locations with the custom_field extension_uid, so csdx
//         import can remap the content-type's extension_uid reference and the extension
//         actually gets created. (An empty locations array installs the app but never
//         creates the extension → content-type import fails with "extension does not exist".)
//   - early-returns when bundle has no extension-mapper.json (no `app` widget fields).

/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { configHandler } from '@contentstack/cli-utilities';
import { MIGRATION_DATA_CONFIG, KEYTOREMOVE } from './constants';
import { getAppManifestAndAppConfig } from './market-app.utils';
import appMeta from './app/index.json';

const { EXTENSIONS_MAPPER_DIR_NAME, MARKETPLACE_APPS_DIR_NAME, MARKETPLACE_APPS_FILE_NAME } =
  MIGRATION_DATA_CONFIG;

const groupByAppUid = (data: any[]): Record<string, string[]> =>
  data?.reduce?.((acc: any, item: any) => {
    if (!item?.appUid) return acc;
    if (!acc[item.appUid]) acc[item.appUid] = [];
    acc[item.appUid].push(item.extensionUid);
    return acc;
  }, {} as Record<string, string[]>);

const removeKeys = (obj: any, keysToRemove: string[]) =>
  Object.fromEntries(Object.entries(obj).filter(([key]) => !keysToRemove.includes(key)));

// extension-mapper stores "<extensionUid>-<uiLocationType>", e.g.
// "blt5307633e8c63d59d-cs.cm.stack.custom_field". Split on the FIRST hyphen only —
// the uid never contains one, and the type may (defensive).
const parseExt = (ext: string): { extUid: string; type: string } => {
  const i = ext?.indexOf?.('-') ?? -1;
  if (i === -1) return { extUid: ext, type: '' };
  return { extUid: ext.slice(0, i), type: ext.slice(i + 1) };
};

/**
 * Build the ui_location.locations array binding each extension_uid to its location type.
 * When a fetched manifest is supplied (online), its matching location supplies the rich
 * meta template; offline we emit a minimal meta carrying just the extension_uid.
 */
const buildLocations = (extUids: string[], fetchedLocations: any[] | null): any[] => {
  const locations: any[] = [];
  for (const ext of new Set(extUids)) {
    const { extUid, type } = parseExt(ext);
    if (!type) continue;
    if (locations.some((l) => l.type === type && l.meta?.[0]?.extension_uid === extUid)) continue;
    const tpl = (fetchedLocations ?? []).find((l: any) => l?.type === type);
    locations.push({ type, meta: [{ ...(tpl?.meta?.[0] || {}), extension_uid: extUid }] });
  }
  const cfgTpl = (fetchedLocations ?? []).find((l: any) => l?.type === 'cs.cm.stack.config');
  if (cfgTpl) {
    locations.push({
      type: cfgTpl.type,
      meta: [{ ...(cfgTpl?.meta?.[0] || {}), name: 'Config', extension_uid: uuidv4() }],
    });
  }
  return locations;
};

const writeManifestFile = async ({ destinationStackId, appManifest }: any) => {
  const dirPath = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MARKETPLACE_APPS_DIR_NAME);
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
    await fs.promises.writeFile(
      path.join(dirPath, MARKETPLACE_APPS_FILE_NAME),
      JSON.stringify(appManifest, null, 2),
    );
  } catch (writeErr) {
    console.error('marketplace fs.writeFile failed:', writeErr);
  }
};

// Resolve auth + org + region from csdx's active session (set by `csdx auth:login`).
// A raw `authtoken` (basic auth) works with the marketplace SDK just as well as a
// Bearer OAuth token; the org is an explicit input (the `--org` flag), falling back
// to the active OAuth org when present. Returns null when auth or org can't be found.
const resolveSession = (
  orgUid?: string,
): { authtoken: string; region: string; orgId: string } | null => {
  const oauth = configHandler.get('oauthAccessToken');
  const basic = configHandler.get('authtoken');
  const authtoken = oauth ? `Bearer ${oauth}` : basic;
  const orgId = orgUid ?? configHandler.get('oauthOrgUid');
  if (!authtoken) {
    console.info('marketplace: no csdx auth token found (run `csdx auth:login`); skipping app manifest build');
    return null;
  }
  if (!orgId) {
    console.info(
      'marketplace: no organization uid (pass `--org <uid>` or log in with OAuth); skipping app manifest build',
    );
    return null;
  }
  const regionObj: any = configHandler.get('region');
  const region = regionObj?.name ?? 'NA';
  return { authtoken, region, orgId };
};

// Online: full manifest from Developer Hub with rich locations.
const buildOnlineManifest = async (
  appUid: string,
  extUids: string[],
  session: { authtoken: string; region: string; orgId: string },
  destinationStackId: string,
): Promise<any | null> => {
  const data: any = await getAppManifestAndAppConfig({
    organizationUid: session.orgId,
    authtoken: session.authtoken,
    region: session.region,
    manifestUid: appUid,
  });
  if (!data) return null;
  data.manifest = removeKeys(data, KEYTOREMOVE);
  data.ui_location = data.ui_location ?? {};
  data.ui_location.locations = buildLocations(extUids, data.ui_location.locations ?? []);
  data.status = 'installed';
  data.target = { type: 'stack', uid: destinationStackId };
  data.installation_uid = data?.uid;
  data.configuration = '';
  data.server_configuration = '';
  return removeKeys(data, KEYTOREMOVE);
};

// Offline: minimal manifest from the static catalog + extension-mapper, still binding the
// extension_uid so the custom-field extension is created on import.
const buildOfflineManifest = (
  appUid: string,
  extUids: string[],
  destinationStackId: string,
): any => {
  const meta = (appMeta as any)?.entries?.find((e: any) => e?.app_uid === appUid);
  const name = meta?.title ?? 'Custom App';
  const uid = uuidv4();
  return {
    uid,
    manifest: { uid: appUid, name },
    title: name,
    configuration: {},
    server_configuration: {},
    ui_location: { locations: buildLocations(extUids, null) },
    status: 'installed',
    installation_uid: uid,
    target: { type: 'stack', uid: destinationStackId },
  };
};

const createAppManifest = async ({
  destinationStackId,
  orgUid,
}: {
  destinationStackId: string;
  orgUid?: string;
}) => {
  // Trigger gate: only run when content-type-creator wrote {appUid, extensionUid} pairs
  // (i.e. the export referenced Contentful `app` widget fields). No mapper → no work.
  const mapperPath = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, EXTENSIONS_MAPPER_DIR_NAME);
  const mapperRaw: string | undefined = await fs.promises
    .readFile(mapperPath, 'utf-8')
    .catch(() => undefined);
  if (mapperRaw === undefined) return;

  let mapperRows: any[];
  try {
    mapperRows = JSON.parse(mapperRaw);
  } catch (err) {
    console.error('marketplace: extension-mapper.json is not valid JSON, skipping:', err);
    return;
  }
  if (!Array.isArray(mapperRows) || mapperRows.length === 0) return;

  const groups = groupByAppUid(mapperRows);
  const session = resolveSession(orgUid);
  if (!session) {
    console.info(
      'marketplace: building OFFLINE app manifest — app/extension binding will NOT resolve at import. ' +
        'Re-run with `--org <uid>` (and `csdx auth:login`) so the real app manifest can be fetched.',
    );
  }

  const appManifest: any[] = [];
  for (const [appUid, extUids] of Object.entries(groups)) {
    let manifest: any | null = null;
    if (session) {
      manifest = await buildOnlineManifest(appUid, extUids, session, destinationStackId).catch(() => null);
    }
    if (!manifest) {
      manifest = buildOfflineManifest(appUid, extUids, destinationStackId);
    }
    appManifest.push(manifest);
  }

  if (appManifest.length > 0) {
    await writeManifestFile({ destinationStackId, appManifest });
  }
};

export const marketPlaceAppService = {
  createAppManifest,
};
