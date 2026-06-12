import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import type { ConvertOptions, ConvertResult } from '../types';
import contentfulValidator from './validator';
import { initContentfulMigrateConfig } from '../../services/contentful/config';
import { pickMasterLocale } from '../../services/contentful/prompts/master-locale';
import { writeMapper, type MapperBundle } from '../../services/contentful/mapper/write';
import {
  done,
  logStageFail,
  logStageOk,
  logSummary,
} from '../../lib/log';
import { parseJsonLoose } from '../../lib/parse-json-loose';

const BUNDLE_ID = 'bundle';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  extractLocale,
  extractContentTypes,
  extractTaxonomy,
  createInitialMapper,
} = require('../../services/contentful/migration-contentful');

export async function convertContentfulExport(opts: ConvertOptions): Promise<ConvertResult> {
  const startedAt = Date.now();
  const input = path.resolve(opts.input);
  const outputDir = path.resolve(opts.outputDir);
  const affix = opts.affix ?? '';

  initContentfulMigrateConfig({ outputDir, verbose: !!opts.verbose });

  if (!fs.existsSync(input)) {
    throw new Error(`Export file not found: ${input}`);
  }

  const rawExport = await fs.promises.readFile(input, 'utf8');
  if (!contentfulValidator(rawExport)) {
    throw new Error('Export is missing required Contentful keys');
  }
  logStageOk('validate', path.basename(input));

  let initialMapper: { contentTypes: unknown[] };
  let locales: string[] = [];
  let taxonomies: unknown[] = [];

  try {
    locales = (await extractLocale(input)) || [];
    await extractContentTypes(input, affix);
    initialMapper = await createInitialMapper(input, affix);
    await extractTaxonomy(input);

    const taxonomyPath = path.join(
      process.cwd(),
      'contentfulMigrationData',
      'taxonomySchema',
      'taxonomySchema.json',
    );
    if (fs.existsSync(taxonomyPath)) {
      taxonomies = parseJsonLoose(await fs.promises.readFile(taxonomyPath, 'utf8')) || [];
    }
    logStageOk(
      'extract',
      `${locales.length} locales · ${initialMapper?.contentTypes?.length ?? 0} types`,
    );
  } catch (err) {
    logStageFail('extract', err instanceof Error ? err.message : String(err));
    throw err;
  }

  const { contentfulService } = await import('../../services/contentful/contentful.service');
  const { contenTypeMaker } = await import('../../services/contentful/content-type-creator');
  const { extensionService } = await import('../../services/contentful/extension.service');
  const { marketPlaceAppService } = await import('../../services/contentful/marketplace.service');
  const { createCustomRoles } = await import('../../services/contentful/contentful/roles');

  const projectId = 'migrate';
  const destinationStackId = BUNDLE_ID;
  const bundleRoot = path.join(outputDir, destinationStackId);

  if (fs.existsSync(bundleRoot)) {
    fs.rmSync(bundleRoot, { recursive: true, force: true });
  }

  let cfDefaultLocale: string | undefined;
  try {
    const parsedForLocale = parseJsonLoose(rawExport);
    const defaultLocale = (parsedForLocale?.locales ?? []).find((l: any) => l?.default === true);
    cfDefaultLocale = defaultLocale?.code;
  } catch {
    // best-effort; fall through to the prompt
  }
  let pickedMaster: string;
  try {
    pickedMaster = await pickMasterLocale(locales, opts.masterLocale ?? cfDefaultLocale);
  } catch (err) {
    logStageFail('locale', err instanceof Error ? err.message : String(err));
    throw err;
  }

  const masterLocaleCode = pickedMaster.toLowerCase();
  const masterLocaleMap: Record<string, string> = { [masterLocaleCode]: pickedMaster };
  const nonMasterLocaleMap: Record<string, string> = {};
  for (const code of locales) {
    if (code === pickedMaster) continue;
    nonMasterLocaleMap[code.toLowerCase()] = code;
  }

  const project = {
    master_locale: masterLocaleMap,
    locales: nonMasterLocaleMap,
    stackDetails: { master_locale: masterLocaleCode },
    mapperKeys: {},
  };

  const contentTypes = initialMapper?.contentTypes ?? [];
  const mapperKeys: Record<string, unknown> = {};

  const entryCountsByCt: Record<string, number> = {};
  const pageContentTypeIds = new Set<string>();
  try {
    const parsedExport = parseJsonLoose(rawExport);
    for (const e of parsedExport?.entries ?? []) {
      const ctId = e?.sys?.contentType?.sys?.id;
      if (!ctId) continue;
      entryCountsByCt[ctId] = (entryCountsByCt[ctId] ?? 0) + 1;
    }
    const URL_LIKE_FIELD_IDS = new Set(['url', 'slug', 'path', 'permalink']);
    for (const ct of parsedExport?.contentTypes ?? []) {
      const ctId = ct?.sys?.id;
      if (!ctId) continue;
      for (const f of ct?.fields ?? []) {
        const fid = String(f?.id ?? '').toLowerCase();
        if (URL_LIKE_FIELD_IDS.has(fid)) { pageContentTypeIds.add(ctId); break; }
        if (f?.type === 'RichText') { pageContentTypeIds.add(ctId); break; }
      }
    }
  } catch {
    // best-effort; singleton/is_page detection will fall back to defaults
  }

  try {
    for (const contentType of contentTypes) {
      await contenTypeMaker({
        contentType,
        destinationStackId,
        projectId,
        newStack: true,
        keyMapper: mapperKeys,
        region: 'NA',
        user_id: 'migrate',
        is_sso: false,
        entryCountsByCt,
        pageContentTypeIds,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logStageFail('transform', `content-type-maker: ${msg}`);
    throw err;
  }

  try {
    await contentfulService.createLocale(input, destinationStackId, projectId, project);
    enforceLocaleFallbacks(bundleRoot, masterLocaleCode);
    await contentfulService.createRefrence(input, destinationStackId, projectId);
    const webhookStats = await contentfulService.createWebhooks(input, destinationStackId, projectId);
    if (webhookStats && webhookStats.total) {
      const manual = webhookStats.needsSecretReentry ?? [];
      logStageOk(
        'webhooks',
        manual.length
          ? `${webhookStats.total} migrated · ${manual.length} need manual secret re-entry`
          : `${webhookStats.total} migrated`,
      );
      if (opts.verbose && manual.length) {
        for (const name of manual) {
          process.stdout.write(`             ⚠ secret re-entry: ${name}\n`);
        }
      }
    }
    await contentfulService.createEnvironment(input, destinationStackId, projectId);
    // isTest=false — reference passed true, which slice(0,10) caps processed assets (dev-only)
    await contentfulService.createAssets(input, destinationStackId, projectId, false);
    await contentfulService.createTaxonomy(input, destinationStackId, projectId);
    await contentfulService.createEntry(
      input,
      destinationStackId,
      projectId,
      contentTypes,
      mapperKeys,
      masterLocaleCode,
      project,
    );
    // Build the marketplace_apps manifest (only when content-type-creator wrote
    // extension-mapper.json for `app` widget fields). No-ops gracefully when csdx
    // session/org is missing — convert still succeeds.
    try {
      await marketPlaceAppService.createAppManifest({ destinationStackId, orgUid: opts.orgUid });
    } catch (mpErr) {
      logStageFail('marketplace', mpErr instanceof Error ? mpErr.message : String(mpErr));
    }
    await extensionService.createExtension({ destinationStackId });

    // Roles & permissions: Contentful roles → Contentstack custom-roles bundle
    // (built-in names map to existing roles; the rest become custom roles).
    try {
      const ctMap: Record<string, string> = {};
      for (const ct of contentTypes as any[]) {
        if (ct?.otherCmsUid && ct?.contentstackUid) ctMap[ct.otherCmsUid] = ct.contentstackUid;
      }
      const roleMapping = createCustomRoles(input, destinationStackId, ctMap);
      if (roleMapping.length) {
        const builtIns = roleMapping.filter((m) => m.kind === 'built-in');
        const customs = roleMapping.filter((m) => m.kind === 'custom');
        logStageOk(
          'roles',
          `${customs.length} custom · ${builtIns.length} → built-in`,
        );
        if (opts.verbose) {
          for (const m of roleMapping) {
            process.stdout.write(`             ${m.source} → ${m.target} (${m.kind})\n`);
          }
        }
      }
    } catch (roleErr) {
      logStageFail('roles', roleErr instanceof Error ? roleErr.message : String(roleErr));
    }

    await contentfulService.createVersionFile(destinationStackId, projectId);

    await mkdirp(bundleRoot);
    const mapper: MapperBundle = {
      contentTypes,
      taxonomies,
      locales,
    };
    const mapperPath = await writeMapper(bundleRoot, mapper);

    const entriesDir = path.join(bundleRoot, 'entries');
    const ctCount = fs.existsSync(entriesDir) ? fs.readdirSync(entriesDir).length : 0;
    const sourceEntries = parseJsonLoose(rawExport)?.entries;
    const entryCount = Array.isArray(sourceEntries) ? sourceEntries.length : 0;

    const relBundle = path.relative(process.cwd(), bundleRoot) || bundleRoot;
    logStageOk('transform', `${entryCount} entries · ${ctCount} types  →  ${relBundle}`);
    if (opts.verbose) {
      process.stdout.write(
        `             mapper: ${path.relative(process.cwd(), mapperPath) || mapperPath}\n`,
      );
    }

    try {
      const stagingDir = path.join(process.cwd(), 'contentfulMigrationData');
      if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
    } catch {
      // best-effort
    }

    logSummary({ bundleDir: bundleRoot, entryCount, contentTypeCount: contentTypes.length });

    // Per-module conversion summary (source vs converted, with pass/fail) —
    // written into the bundle so migrate:create / migrate:import can show it
    // before touching a stack, and printed here for the standalone convert.
    try {
      const {
        computeConversionSummary,
        computeContentTypeFieldSummary,
        writeConversionSummary,
        renderConversionSummary,
        renderContentTypeFieldSummary,
      } = await import('../../lib/conversion-summary');
      const parsedForSummary = parseJsonLoose(rawExport);
      const summary = computeConversionSummary(parsedForSummary, bundleRoot);
      summary.contentTypeFields = computeContentTypeFieldSummary(parsedForSummary, bundleRoot);
      writeConversionSummary(bundleRoot, summary);
      process.stdout.write(`\n${renderConversionSummary(summary)}\n`);
      process.stdout.write(`\n${renderContentTypeFieldSummary(summary.contentTypeFields)}\n`);
    } catch {
      // best-effort — never fail convert over the summary
    }

    done(Date.now() - startedAt);

    return {
      bundleDir: bundleRoot,
      mapperPath,
      stats: {
        locales: locales.length,
        contentTypes: contentTypes.length,
        entries: entryCount,
      },
    };
  } catch (err) {
    logStageFail('transform', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

function enforceLocaleFallbacks(bundleRoot: string, masterCode: string): void {
  const localesDir = path.join(bundleRoot, 'locales');
  const masterFile = path.join(localesDir, 'master-locale.json');
  const localesFile = path.join(localesDir, 'locales.json');
  const languageFile = path.join(localesDir, 'language.json');

  const patch = (file: string, isMaster: boolean) => {
    if (!fs.existsSync(file)) return;
    const data = parseJsonLoose(fs.readFileSync(file, 'utf8'));
    for (const k of Object.keys(data || {})) {
      if (!data[k]) continue;
      if (isMaster || data[k].code === masterCode) {
        data[k].fallback_locale = '';
      } else {
        data[k].fallback_locale = masterCode;
      }
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  };

  patch(masterFile, true);
  patch(localesFile, false);
  patch(languageFile, false);
}
