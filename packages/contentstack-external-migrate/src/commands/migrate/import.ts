import fs from 'fs';
import path from 'path';
import { Command } from '@contentstack/cli-command';
import { cliux, flags, FlagInput } from '@contentstack/cli-utilities';
import { assertBundleDir } from '../../lib/bundle';
import { inferWorkspace, patchManifest, stackApiKeyPrefix, toWorkspaceRelative } from '../../lib/manifest';
import { spawnCsdx } from '../../lib/csdx-spawn';
import {
  createStack,
  ensureWebhooks,
  fetchOrganizations,
  fetchStackBranches,
  provisionStackCredentials,
  resolveSession,
} from '../../lib/create-stack';
import { parseJsonLoose } from '../../lib/parse-json-loose';
import {
  readConversionSummary,
  renderConversionSummary,
  renderContentTypeFieldSummary,
} from '../../lib/conversion-summary';
import { clearStaleImportState } from '../../lib/clear-import-state';
import { localDateStamp } from '../../lib/local-date';

export interface ImportFlags {
  yes?: boolean;
  'skip-audit'?: boolean;
  module?: string;
  branch?: string;
}

/** Build argv for `csdx cm:stacks:import` from migrate:import flags. */
export function buildStacksImportArgs(stackApiKey: string, dataDir: string, flags: ImportFlags): string[] {
  const args = ['cm:stacks:import', '--stack-api-key', stackApiKey, '--data-dir', dataDir];

  if (flags.yes !== false) {
    args.push('--yes');
  }
  if (flags['skip-audit']) {
    args.push('--skip-audit');
  }
  if (flags.module) {
    args.push('--module', flags.module);
  }
  if (flags.branch) {
    args.push('--branch', flags.branch);
  }

  return args;
}

export default class MigrateImport extends Command {
  static description =
    'Import a Contentstack bundle — into an existing stack (--stack-api-key) or a new one created in an organization (--org)';

  static examples = [
    '$ csdx migrate:import --stack-api-key bltXXXX --data-dir ./contentstack-import/bundle',
    '$ csdx migrate:import --org bltOrgUid --data-dir ./contentstack-import/bundle',
    '$ csdx migrate:import -d ./contentstack-import/bundle   # prompts for org, creates a stack',
  ];
  static hidden = true;
  static flags: FlagInput = {
    'stack-api-key': flags.string({
      char: 'k',
      description: 'Destination stack API key (import into an EXISTING stack)',
    }),
    org: flags.string({
      description:
        'Destination organization uid — create a new stack here and import into it (used when --stack-api-key is omitted; prompts with a list if omitted)',
    }),
    'stack-name': flags.string({
      description: 'Name for the new stack (default: "Contentful Migration <date>")',
    }),
    'data-dir': flags.string({
      char: 'd',
      description: 'Path to convert output bundle directory',
    }),
    yes: flags.boolean({
      char: 'y',
      description: 'Skip import confirmation prompts',
      default: true,
      allowNo: true,
    }),
    'skip-audit': flags.boolean({
      description: 'Skip audit-fix before import',
      default: false,
    }),
    module: flags.string({
      description: 'Import only a module (e.g. entries)',
    }),
    branch: flags.string({
      description: 'Branch alias for branch-aware import',
    }),
    workspace: flags.string({
      char: 'w',
      description: 'Migration workspace root for migration-manifest.json',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MigrateImport);

    try {
      const dataDir = flags['data-dir'] ?? (await cliux.prompt('Path to convert output bundle directory'));

      assertBundleDir(dataDir);

      // Show the per-module conversion summary (written by convert) BEFORE we
      // create/touch a stack, so the operator sees what will be imported.
      const summary = readConversionSummary(dataDir);
      if (summary) {
        this.log(`\n${renderConversionSummary(summary, 'Conversion summary (to be imported)')}\n`);
        if (summary.contentTypeFields?.length) {
          this.log(`\n${renderContentTypeFieldSummary(summary.contentTypeFields)}\n`);
        }
      }

      // Target stack: import into an existing one (--stack-api-key) OR create a
      // fresh stack in an organization (--org / prompt) and import into that.
      let stackKey = flags['stack-api-key'];
      let createdStackName: string | undefined;
      let createdStackUid: string | undefined;
      let createdOrgUid: string | undefined;
      let region = '';

      if (!stackKey) {
        let orgUid = flags.org;
        if (!orgUid) {
          const orgs = await fetchOrganizations();
          if (!orgs.length) {
            this.error('No organizations found for your account. Pass --org <uid> or --stack-api-key <key>.', {
              exit: 1,
            });
          }
          orgUid = await cliux.inquire<string>({
            type: 'list',
            name: 'org',
            message: 'Select the destination organization (a new stack is created here)',
            choices: orgs.map((o) => ({ name: `${o.name} (${o.uid})`, value: o.uid })),
          });
        }

        const masterLocale = detectMasterLocaleFromBundle(dataDir);
        const stackName = flags['stack-name'] || `Contentful Migration ${localDateStamp()}`;
        const created = await createStack({
          orgUid,
          name: stackName,
          masterLocale,
          verbose: false,
        });
        stackKey = created.apiKey;
        createdStackName = stackName;
        createdStackUid = created.uid;
        createdOrgUid = orgUid;
        try {
          region = resolveSession().region;
        } catch {
          // cosmetic
        }
        this.log(`✓ Stack created · via ${created.via}`);
        this.printStackSummary(stackName, stackKey, region);
      }

      // Guard a user-passed --branch: if that branch doesn't exist on the stack
      // (e.g. --branch main on a Branches-disabled org), csdx import would fail.
      // Drop it and import into the default workspace instead.
      let effectiveBranch = flags.branch;
      if (effectiveBranch) {
        const stackBranches = await fetchStackBranches(stackKey).catch(() => [] as string[]);
        if (!stackBranches.includes(effectiveBranch)) {
          this.log(
            `⚠ Branch "${effectiveBranch}" not found on the stack ` +
              `(${stackBranches.length ? `available: ${stackBranches.join(', ')}` : 'Branches not enabled'}). ` +
              `Importing into the default workspace.`,
          );
          effectiveBranch = undefined;
        }
      }

      const args = buildStacksImportArgs(stackKey, dataDir, {
        yes: flags.yes,
        'skip-audit': flags['skip-audit'],
        module: flags.module,
        branch: effectiveBranch,
      });

      // Wipe csdx's stale import state so a re-import never falsely skips
      // webhooks/custom-roles recorded in a previous run's mapper.
      clearStaleImportState(dataDir);

      this.log('─── csdx cm:stacks:import ──────────────────────────────');
      this.log(`Running: csdx ${args.join(' ')}`);

      const code = await spawnCsdx(args);
      this.log('────────────────────────────────────────────────────────');

      if (code !== 0) {
        this.error(`Import failed (exit ${code})`, { exit: code });
      }

      // csdx's webhooks module only imports the first 5 (concurrency bug) and
      // falsely skips the rest — backfill any missing ones via CMA.
      if (!flags.module || flags.module === 'webhooks') {
        await this.backfillWebhooks(stackKey, dataDir);
      }

      const workspace = inferWorkspace({ workspace: flags.workspace, dataDir });
      await patchManifest(workspace, {
        import: {
          completedAt: new Date().toISOString(),
          stackApiKeyPrefix: stackApiKeyPrefix(stackKey),
          status: 'completed',
        },
        convert: {
          bundleDir: toWorkspaceRelative(workspace, dataDir),
        },
      });

      this.log(`✓ Import complete — ${stackApiKeyPrefix(stackKey)}`);

      // When we created the stack, provision delivery + preview tokens (the
      // environment exists only now) and write bundle metadata.json. Best-effort.
      if (createdStackName) {
        const creds = await provisionStackCredentials({
          apiKey: stackKey,
          uid: createdStackUid,
          bundleDir: dataDir,
          tokenName: `${createdStackName} delivery token`,
        });
        if (creds.deliveryToken) {
          this.log(
            `✓ Delivery token created — publishing environment "${creds.environment}"${
              creds.branches.length ? `, branches: ${creds.branches.join(', ')}` : ''
            }`,
          );
        } else {
          this.log(
            `⚠ Could not create delivery token${
              creds.deliveryTokenError ? `: ${creds.deliveryTokenError}` : ''
            } (create it in the UI).`,
          );
        }
        if (creds.previewToken) {
          this.log('✓ Preview token created');
        }
        if (creds.livePreviewEnabled) {
          this.log('✓ Live Preview enabled');
        }
        const metadata = {
          org_id: createdOrgUid,
          stack_id: creds.stackUid ?? stackKey,
          branches: creds.branches, // main first; empty on branch-disabled stacks
          environment: creds.environment,
          delivery_token: creds.deliveryToken,
          preview_token: creds.previewToken,
        };
        const metadataPath = path.join(dataDir, 'metadata.json');
        fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
        this.log(`✓ Bundle metadata written: ${metadataPath}`);

        this.printStackSummary(createdStackName, stackKey, region);
      }
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error), { exit: 1 });
    }
  }

  /**
   * Backfill webhooks csdx's import dropped (its module imports only the first 5
   * and falsely skips the rest). Creates the missing ones directly via CMA.
   */
  private async backfillWebhooks(stackKey: string, dataDir: string): Promise<void> {
    try {
      const wh = await ensureWebhooks(stackKey, dataDir);
      if (wh.total === 0) return;
      if (wh.created.length) {
        this.log(`✓ Webhooks backfilled via CMA — ${wh.created.length} created (csdx imported ${wh.skipped.length})`);
      }
      if (wh.failed.length) {
        this.log(`⚠ ${wh.failed.length} webhook(s) failed to create: ${wh.failed.map((f) => f.name).join(', ')}`);
      }
    } catch (err) {
      this.log(`⚠ Webhook backfill skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Boxed summary of the created stack — shown after creation and at the end. */
  private printStackSummary(stackName: string, apiKey: string, region: string): void {
    const line = '──────────────────────────────────────';
    this.log(line);
    this.log(`  Stack name : ${stackName}`);
    this.log(`  Stack key  : ${apiKey}`);
    if (region) this.log(`  Region     : ${region}`);
    this.log(line);
  }
}

/**
 * Read the master locale code from a converted bundle's
 * locales/master-locale.json (the master is the locale with no fallback).
 * Used to create the destination stack with the matching master language.
 */
function detectMasterLocaleFromBundle(dataDir: string): string {
  try {
    const p = path.join(dataDir, 'locales', 'master-locale.json');
    const data = parseJsonLoose(fs.readFileSync(p, 'utf8'));
    const locales = Object.values(data || {}) as Array<{ code?: string; fallback_locale?: string }>;
    const master = locales.find((l) => l && l.fallback_locale === '') || locales[0];
    if (master?.code) return String(master.code).toLowerCase();
  } catch {
    // fall through to default
  }
  return 'en-us';
}
