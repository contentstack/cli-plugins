// Marketplace SDK helpers — ported from migration-v2/api/src/utils/market-app.utils.ts.
// Adapted for the csdx plugin: pure functions that take an explicit authtoken/region/org;
// the caller (marketplace.service.ts) resolves those from cli-utilities' configHandler.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { client } from '@contentstack/marketplace-sdk';
import { DEVURLS } from './constants';

const buildMarketplaceClient = ({
  authtoken,
  region,
}: {
  authtoken?: string;
  region?: string;
}) => {
  const host = (DEVURLS as any)?.[region as string] ?? (DEVURLS as any)?.NA;
  if (typeof authtoken === 'string' && authtoken.startsWith('Bearer ')) {
    return client({ authorization: authtoken, host } as any);
  }
  return client({ authtoken, host } as any);
};

export const getAllApps = async ({ organizationUid, authtoken, region }: any) => {
  try {
    const c = buildMarketplaceClient({ authtoken, region });
    const data: any = await c.marketplace(organizationUid).findAllApps();
    return data?.items;
  } catch (err) {
    console.info('getAllApps error:', err);
  }
};

export const getAppManifestAndAppConfig = async ({
  organizationUid,
  authtoken,
  region,
  manifestUid,
}: any) => {
  try {
    const c = buildMarketplaceClient({ authtoken, region });
    return await c.marketplace(organizationUid).app(manifestUid).fetch();
  } catch (err) {
    console.info('getAppManifestAndAppConfig error:', err);
  }
};

type InstallationTarget = { uid?: string; type?: string };

function installationTargetsStack(
  inst: { target?: InstallationTarget },
  stackUid: string,
): boolean {
  const t = inst?.target;
  const uidOk =
    typeof t?.uid === 'string' && t.uid.toLowerCase() === stackUid.trim().toLowerCase();
  const typeOk = String(t?.type ?? '').toLowerCase() === 'stack';
  return Boolean(uidOk && typeOk);
}

export const fetchMarketplaceInstallationsForStack = async ({
  organizationUid,
  stackUid,
  authtoken,
  region,
}: {
  organizationUid: string;
  stackUid: string;
  authtoken: string;
  region: string;
}) => {
  try {
    const c = buildMarketplaceClient({ authtoken, region });
    const instApi = c.marketplace(organizationUid).installation();

    let all: Record<string, unknown>[] = [];
    try {
      const limit = 100;
      let skip = 0;
      while (skip < 10_000) {
        const raw: any = await instApi.fetchAll({ skip, limit } as any);
        const items: Record<string, unknown>[] = raw?.items ?? [];
        all.push(...items);
        if (items.length < limit) break;
        skip += limit;
      }
    } catch {
      const raw: any = await instApi.fetchAll();
      all = raw?.items ?? [];
    }

    const normalizedUid = stackUid.trim();
    return all.filter((inst) =>
      installationTargetsStack(inst as { target?: InstallationTarget }, normalizedUid),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.info('fetchMarketplaceInstallationsForStack error:', msg);
    return [];
  }
};
