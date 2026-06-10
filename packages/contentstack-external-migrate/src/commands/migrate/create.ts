import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';
import { Command } from '@contentstack/cli-command';
import { cliux, flags, FlagInput } from '@contentstack/cli-utilities';
import { getAdapter } from '../../adapters/registry';
import {
  createBranch,
  createStack,
  ensureWebhooks,
  fetchOrganizations,
  fetchStackBranches,
  provisionStackCredentials,
  resolveSession,
  sanitizeBranchUid,
} from '../../lib/create-stack';
import {
  fetchContentfulEnvironments,
  fetchContentfulOrgName,
  fetchContentfulSpaces,
} from '../../adapters/contentful/export';
import { spawnCsdx } from '../../lib/csdx-spawn';
import { buildStacksImportArgs } from './import';
import { parseJsonLoose } from '../../lib/parse-json-loose';
import { clearStaleImportState } from '../../lib/clear-import-state';
import { localDateStamp } from '../../lib/local-date';
import { inferWorkspace, patchManifest, stackApiKeyPrefix, toWorkspaceRelative } from '../../lib/manifest';

export default class MigrateCreate extends Command {
  static description = 'Convert a legacy export, create a new stack in an organization, and import into it';

  static examples = [
    '$ csdx migrate:create --legacy contentful --input ./export.json --org bltOrgUid',
    '$ csdx migrate:create -l contentful -i ./export.json --org bltOrgUid --stack-name "My Site"',
    '$ CONTENTFUL_MANAGEMENT_TOKEN=... csdx migrate:create -l contentful --space-id SPACE_ID --org bltOrgUid',
  ];

  static flags: FlagInput = {
    source: flags.string({
      char: 'l',
      description: 'Legacy CMS source (contentful)',
      required: true,
      options: ['contentful'],
    }),
    'space-id': flags.string({
      description: 'Contentful space ID — export from Contentful first (use this OR --input)',
    }),
    'source-token': flags.string({
      description: 'Sorce CMA token (prefer CONTENTFUL_MANAGEMENT_TOKEN env)',
    }),
    'download-assets': flags.boolean({
      description: 'Download asset binaries during export (with --space-id)',
      default: false,
    }),
    'include-drafts': flags.boolean({
      description: 'Include draft entries in export (with --space-id)',
      default: false,
    }),
    'include-archived': flags.boolean({
      description: 'Include archived entries in export (with --space-id)',
      default: false,
    }),
    'org-uid': flags.string({
      description: 'Contentstack organization uid — a new stack is created here (prompts with a list if omitted)',
    }),
    output: flags.string({
      description: 'Parent output directory; bundle written to <output>/bundle',
      default: './output-dir',
    }),
    affix: flags.string({
      description: 'Content-type UID prefix',
      default: 'CS',
    }),
    'invite-users': flags.boolean({
      description:
        'Invite Contentful space members into the new stack with their mapped roles (sends invite emails). On by default; pass --no-invite-users to only write the users-mapping.json report.',
      default: true,
      allowNo: true,
    }),
    yes: flags.boolean({
      char: 'y',
      description: 'Skip import confirmation prompts',
      default: true,
      allowNo: true,
    }),
    workspace: flags.string({
      description: 'Migration workspace root for migration-manifest.json',
      default: './output-dir',
    }),
    input: flags.string({
      char: 'i',
      description: 'Path to legacy export JSON (use this OR --space-id)',
      hidden: true,
    }),
    'cf-org-id': flags.string({
      description:
        'Contentful ORG id — migrate EVERY space the token can access in that org (one stack per space). Ignored if --space-id is given.',
      hidden: true,
    }),
    'stack-name': flags.string({
      description: 'New stack name (default: "Contentful Migration <date>")',
      hidden: true,
    }),
    branch: flags.string({
      description: 'Branch alias for branch-aware import',
      hidden: true,
    }),
    verbose: flags.boolean({
      description: 'Verbose logs',
      default: false,
      hidden: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MigrateCreate);

    try {
      const adapter = getAdapter(flags.legacy);

      // Destination Contentstack org (shared across every migrated space).
      let orgUid = flags.org;
      if (!orgUid) {
        const orgs = await fetchOrganizations();
        if (!orgs.length) {
          this.error('No organizations found for your account. Pass --org <uid>.', { exit: 1 });
        }
        orgUid = await cliux.inquire<string>({
          type: 'list',
          name: 'org',
          message: 'Select the destination organization',
          choices: orgs.map((o) => ({ name: `${o.name} (${o.uid})`, value: o.uid })),
        });
      }

      // --input: a single local export JSON (no Contentful live API).
      if (flags.input || (!flags['space-id'] && !flags['cf-org-id'])) {
        let input = flags.input;
        if (!input) input = await cliux.prompt('Path to Contentful export JSON');
        await this.migrateSpace({ adapter, flags, orgUid, input, outputRoot: flags.output });
        return;
      }

      // Resolve the Contentful management token (shared) for live-API discovery.
      let managementToken =
        flags['management-token'] ?? process.env.CONTENTFUL_MANAGEMENT_TOKEN ?? readContentfulCliToken();
      if (!managementToken) {
        managementToken = await cliux.prompt(
          'Contentful management token (not found in --management-token, CONTENTFUL_MANAGEMENT_TOKEN, or contentful login)',
        );
      }

      // Build the list of spaces to migrate. --space-id takes precedence over
      // --cf-org-id (which migrates EVERY space the token can access in that org).
      let spaces: Array<{ id: string; name: string }>;
      if (flags['space-id']) {
        if (flags['cf-org-id']) {
          this.log('ℹ Both --space-id and --cf-org-id given — using --space-id only.');
        }
        const name = await fetchContentfulSpaceName(flags['space-id'], managementToken);
        spaces = [{ id: flags['space-id'], name: name || flags['space-id'] }];
      } else {
        const orgId = flags['cf-org-id'] as string;
        const orgName = await fetchContentfulOrgName(orgId, managementToken);
        spaces = await fetchContentfulSpaces(orgId, managementToken);
        this.log(`Contentful Org name: ${orgName || orgId}`);
        this.log(`Total space count: ${spaces.length}`);
        if (!spaces.length) {
          this.error(`No spaces found in Contentful org ${orgId} for this token.`, { exit: 1 });
        }
        this.log(`Spaces: ${spaces.map((s) => s.name).join(', ')}`);
      }

      // Migrate each space into its own stack, one after another. A failure in
      // one space does NOT stop the rest — record it and continue, then print a
      // roll-up at the end.
      const multiSpace = spaces.length > 1;
      const results: Array<{ space: string; ok: boolean; stackName?: string; apiKey?: string; error?: string }> = [];
      let idx = 0;
      for (const sp of spaces) {
        idx += 1;
        this.log(
          `\n═══ Migrating space "${sp.name}" (${sp.id})${multiSpace ? ` · ${idx} of ${spaces.length}` : ''} ═══`,
        );
        // Each space gets its own output subdir + uses the space name as the
        // stack name; --stack-name is honored only for a single target.
        const outputRoot = multiSpace ? path.join(flags.output, sanitizeBranchUid(sp.name) || sp.id) : flags.output;
        try {
          const res = await this.migrateSpace({
            adapter,
            flags,
            orgUid,
            spaceId: sp.id,
            spaceName: sp.name,
            managementToken,
            outputRoot,
            stackNameOverride: multiSpace ? undefined : flags['stack-name'],
          });
          results.push({ space: sp.name, ok: true, stackName: res.stackName, apiKey: res.apiKey });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.log(`✗ Space "${sp.name}" failed: ${msg}`);
          results.push({ space: sp.name, ok: false, error: msg });
          if (!multiSpace) {
            // Single target — surface the failure as a non-zero exit.
            this.error(msg, { exit: 1 });
          }
        }
      }

      // Roll-up across all spaces (only meaningful for multi-space org runs).
      if (multiSpace) {
        const ok = results.filter((r) => r.ok);
        this.log(`\n═══ Org migration summary — ${ok.length}/${results.length} spaces succeeded ═══`);
        for (const r of results) {
          this.log(r.ok ? `  ✓ ${r.space} → ${r.stackName} (${r.apiKey})` : `  ✗ ${r.space} — ${r.error}`);
        }
        if (ok.length < results.length) {
          this.error(`${results.length - ok.length} space(s) failed to migrate.`, { exit: 1 });
        }
      }
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error), { exit: 1 });
    }
  }

  /**
   * Migrate ONE source (a Contentful space, or a local --input export) into a
   * new Contentstack stack: export envs → convert (with summary) → create stack
   * → branches → import (workflows + webhooks) → tokens → users → manifest.
   */
  private async migrateSpace(opts: {
    adapter: ReturnType<typeof getAdapter>;
    flags: any;
    orgUid: string;
    outputRoot: string;
    spaceId?: string;
    spaceName?: string;
    managementToken?: string;
    input?: string;
    stackNameOverride?: string;
  }): Promise<{ stackName: string; apiKey: string }> {
    const { adapter, flags, orgUid, outputRoot } = opts;
    const cfSpaceId = opts.spaceId;
    const cfManagementToken = opts.managementToken;

    // ── Build jobs: one per Contentful environment (space mode), or a single
    // job from the local --input file. master → main; other envs → branches.
    const jobs: Array<{ exportFile: string; env?: string; branch?: string }> = [];
    if (cfSpaceId) {
      let envs: string[] = [];
      try {
        envs = await fetchContentfulEnvironments(cfSpaceId, cfManagementToken);
      } catch (err) {
        throw new Error(
          `Could not list Contentful environments for space ${cfSpaceId}: ${
            err instanceof Error ? err.message : String(err)
          }. Re-run, or check your network/token.`,
        );
      }
      if (!envs.length) envs = ['master'];
      this.log(`Contentful environments: ${envs.join(', ')}`);
      for (const env of envs) {
        const branch = env === 'master' ? 'main' : sanitizeBranchUid(env);
        const exportResult = await adapter.export({
          outputDir: path.join(outputRoot, sanitizeBranchUid(env)),
          spaceId: cfSpaceId,
          managementToken: cfManagementToken,
          environmentId: env,
          downloadAssets: flags['download-assets'],
          includeDrafts: flags['include-drafts'],
          includeArchived: flags['include-archived'],
          verbose: flags.verbose,
        });
        this.log(`✓ Exported env "${env}" → branch "${branch}"`);
        jobs.push({ exportFile: exportResult.exportFile, env, branch });
      }
    } else {
      jobs.push({ exportFile: opts.input as string, branch: flags.branch });
    }

    for (const j of jobs) {
      if (!fs.existsSync(j.exportFile)) {
        throw new Error(`Export file not found: ${j.exportFile}`);
      }
    }

    // Master locale comes from the main-branch (master) job; the new stack is
    // created with it and every convert uses the same so locales align.
    const masterJob = jobs.find((j) => (j.branch ?? 'main') === 'main') ?? jobs[0];
    const masterLocale = detectMasterLocale(masterJob.exportFile);

    // 1. Convert EVERY job first (no stack needed). convert prints each bundle's
    // per-module conversion summary, so the operator sees what converted BEFORE
    // any stack is created.
    const multi = jobs.length > 1;
    const converted: Array<{
      job: { exportFile: string; env?: string; branch?: string };
      branch: string;
      bundleDir: string;
    }> = [];
    const stats = { locales: 0, contentTypes: 0, entries: 0 };
    for (const j of jobs) {
      const branch = j.branch ?? 'main';
      const outDir = multi ? path.join(outputRoot, branch) : outputRoot;
      const result = await adapter.convert({
        input: j.exportFile,
        outputDir: outDir,
        masterLocale,
        affix: flags.affix,
        verbose: flags.verbose,
        orgUid,
      });
      converted.push({ job: j, branch, bundleDir: result.bundleDir });
      stats.contentTypes += result.stats.contentTypes;
      stats.entries += result.stats.entries;
      stats.locales = Math.max(stats.locales, result.stats.locales);
    }

    // 2. Create the destination stack (empty main branch).
    const stackName = opts.stackNameOverride || opts.spaceName || `Contentful Migration ${localDateStamp()}`;
    const created = await createStack({
      orgUid,
      name: stackName,
      masterLocale: masterLocale.toLowerCase(),
      verbose: flags.verbose,
    });
    let region = '';
    try {
      region = resolveSession().region;
    } catch {
      // cosmetic
    }
    this.log(`✓ Stack created · via ${created.via}`);
    this.printStackSummary(stackName, created.apiKey, region);

    // 3. Branch handling depends on whether the org has the Branches feature.
    // A branch-enabled stack has a `main` branch; a branch-disabled one has no
    // branches at all (the classic single workspace, addressed without --branch).
    const stackBranches = await fetchStackBranches(created.apiKey).catch(() => [] as string[]);
    const branchesEnabled = stackBranches.includes('main');

    const extraBranches = [
      ...new Set(jobs.map((j) => j.branch).filter((b): b is string => Boolean(b) && b !== 'main')),
    ];

    // Decide which converted bundles actually get imported. Branch-disabled
    // stacks have no place to isolate non-master environments, so we migrate
    // ONLY the master environment (default workspace) and skip the rest.
    let toImport = converted;
    if (!branchesEnabled) {
      toImport = converted.filter((c) => c.job === masterJob);
      const skipped = converted
        .filter((c) => c.job !== masterJob)
        .map((c) => c.job.env)
        .filter(Boolean);
      if (skipped.length) {
        this.log(
          `⚠ Branches not enabled on this org — migrating ONLY the master environment ` +
            `into the default workspace. Skipping: ${skipped.join(', ')}. ` +
            `Enable the Branches feature to migrate every environment into its own branch.`,
        );
      } else {
        this.log('ℹ Branches not enabled on this org — importing into the default workspace (no branch).');
      }
    } else {
      // Create the non-main branches from the EMPTY main, before any import.
      for (const b of extraBranches) {
        this.log(`Creating branch "${b}" from main…`);
        await createBranch(created.apiKey, b, 'main');
        this.log(`✓ Branch "${b}" ready`);
      }
    }

    // 4. Import each pre-converted bundle into its branch (master → main).
    let lastBundleDir = '';
    for (const c of toImport) {
      lastBundleDir = c.bundleDir;

      // Workflows: not in the static export → fetch this env's workflow
      // definitions from the live CF API and write them into the bundle so the
      // csdx workflows module imports them (after content-types + roles).
      if (cfSpaceId) {
        try {
          const { buildWorkflowsBundle } = await import('../../services/contentful/workflows');
          const wf = await buildWorkflowsBundle({
            spaceId: cfSpaceId,
            environmentId: c.job.env ?? 'master',
            managementToken: cfManagementToken,
            bundleDir: c.bundleDir,
            affix: flags.affix,
          });
          if (wf.total) this.log(`✓ Workflows mapped — ${wf.total}: ${wf.workflows.join(', ')}`);
        } catch (err) {
          this.log(`⚠ Workflow mapping skipped: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // On a branch-disabled stack there is no `main`/branch to target — omit
      // --branch so csdx imports into the default workspace.
      const targetBranch = branchesEnabled ? c.job.branch : undefined;
      const branchLabel = branchesEnabled ? c.branch : 'default (no branch)';
      const args = buildStacksImportArgs(created.apiKey, c.bundleDir, {
        yes: flags.yes,
        branch: targetBranch,
      });
      // Wipe csdx's stale import state so each branch import starts clean and
      // never falsely skips webhooks/custom-roles from a previous run's mapper.
      clearStaleImportState(c.bundleDir);

      this.log(`─── import → ${branchLabel} ──────────────────────`);
      this.log(`Running: csdx ${args.join(' ')}`);
      const code = await spawnCsdx(args);
      this.log('────────────────────────────────────────────────────────');
      if (code !== 0) {
        throw new Error(`Import failed for ${branchLabel} (exit ${code})`);
      }

      // csdx's webhooks module imports only the first 5 (concurrency bug) and
      // falsely skips the rest — backfill any missing ones via CMA.
      try {
        const wh = await ensureWebhooks(created.apiKey, c.bundleDir);
        if (wh.created.length) {
          this.log(`✓ Webhooks backfilled via CMA — ${wh.created.length} created (csdx imported ${wh.skipped.length})`);
        }
        if (wh.failed.length) {
          this.log(`⚠ ${wh.failed.length} webhook(s) failed: ${wh.failed.map((f) => f.name).join(', ')}`);
        }
      } catch (err) {
        this.log(`⚠ Webhook backfill skipped: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Per-branch live-API objects (Releases, Scheduled actions, Tasks): for
      // THIS Contentful env → THIS Contentstack branch. Read this import's
      // id→uid remap from its backup (before the next branch wipes it),
      // translate, and create them in this branch (branch header). Skip-safe.
      if (cfSpaceId) {
        await this.migrateBranchLiveObjects({
          spaceId: cfSpaceId,
          managementToken: cfManagementToken,
          apiKey: created.apiKey,
          env: c.job.env ?? 'master',
          branch: branchesEnabled ? (c.job.branch ?? 'main') : undefined,
          bundleDir: c.bundleDir,
          locale: masterLocale.toLowerCase(),
        });
      }
    }

    // Write metadata/credentials into the MAIN branch's bundle (the master
    // job), not whichever branch happened to import last.
    const mainBundleDir = converted.find((c) => c.job === masterJob)?.bundleDir ?? lastBundleDir;

    // 4. Provision ONE delivery + preview token across ALL environments, write metadata.
    const creds = await provisionStackCredentials({
      apiKey: created.apiKey,
      uid: created.uid,
      bundleDir: mainBundleDir,
      tokenName: `${stackName} delivery token`,
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
      org_id: orgUid,
      stack_id: creds.stackUid ?? created.apiKey,
      branches: creds.branches, // main first; empty on branch-disabled stacks
      environment: creds.environment,
      delivery_token: creds.deliveryToken,
      preview_token: creds.previewToken,
    };
    const metadataPath = path.join(mainBundleDir, 'metadata.json');
    fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    this.log(`✓ Bundle metadata written: ${metadataPath}`);

    // 4b. Users: map Contentful space members → Contentstack stack users with
    // their EXACT mapped roles (live CF Management API; needs --space-id). The
    // stack roles exist now (imported above). Writes a report always; only
    // sends invite emails with --invite-users.
    if (cfSpaceId) {
      try {
        const { migrateUsers } = await import('../../services/contentful/users');
        const res = await migrateUsers({
          spaceId: cfSpaceId,
          managementToken: cfManagementToken,
          apiKey: created.apiKey,
          bundleDir: mainBundleDir,
          invite: flags['invite-users'],
        });
        const reportPath = path.join(mainBundleDir, 'users', 'users-mapping.json');
        if (flags['invite-users']) {
          this.log(
            `✓ Users invited — ${res.invited?.length ?? 0} sent${
              res.failed?.length ? `, ${res.failed.length} failed` : ''
            }${res.skipped.length ? `, ${res.skipped.length} skipped (no mapped role)` : ''}`,
          );
          for (const f of res.failed ?? []) this.log(`   ⚠ ${f.email}: ${f.error}`);
          // Strict-SSO orgs reject email invites — users must come through the
          // IdP. Surface that hint instead of leaving a raw API error.
          const ssoBlocked = (res.failed ?? []).some((f) =>
            /sso|strict|identity provider|not allowed|forbidden/i.test(f.error),
          );
          if (ssoBlocked) {
            this.log(
              '   ℹ This org appears to enforce SSO. Invited users must be provisioned through your ' +
                'identity provider (SAML/SCIM); the role mapping is recorded in users-mapping.json for that.',
            );
          }
        } else {
          this.log(
            `✓ Users mapped — ${res.invitable.length} invitable, ${res.skipped.length} skipped (no mapped role). ` +
              `Report: ${reportPath}. Re-run with --invite-users to send invites.`,
          );
        }
      } catch (err) {
        this.log(`⚠ User migration skipped: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 5. Record progress.
    const workspace = inferWorkspace({
      workspace: flags.workspace,
      output: outputRoot,
      input: masterJob.exportFile,
    });
    await patchManifest(
      workspace,
      {
        legacy: flags.legacy,
        convert: {
          completedAt: new Date().toISOString(),
          bundleDir: toWorkspaceRelative(workspace, mainBundleDir),
          masterLocale,
          affix: flags.affix || undefined,
          stats,
        },
        import: {
          completedAt: new Date().toISOString(),
          stackApiKeyPrefix: stackApiKeyPrefix(created.apiKey),
          status: 'completed',
        },
      },
      { legacy: flags.legacy },
    );

    this.log(`✓ Migration complete`);
    this.printStackSummary(stackName, created.apiKey, region);
    return { stackName, apiKey: created.apiKey };
  }

  /** Boxed summary of the created stack — shown after creation and at the end. */
  /**
   * Per-branch live-API objects: Releases, Scheduled actions, Tasks. Run right
   * after a branch's import (entries exist + its uid-remap backup is fresh) for
   * THIS Contentful env → THIS Contentstack branch. All best-effort + skip-safe.
   */
  private async migrateBranchLiveObjects(opts: {
    spaceId: string;
    managementToken?: string;
    apiKey: string;
    env: string;
    branch?: string;
    bundleDir: string;
    locale: string;
  }): Promise<void> {
    const { migrateReleases, buildEntryContentTypeMap, readImportUidMaps } =
      await import('../../services/contentful/releases');
    // This branch's import id→uid remap (newest _backup_*, before the next
    // branch's clearStaleImportState removes it).
    let uidMaps: { entryUidMap: Record<string, string>; assetUidMap: Record<string, string> } = {
      entryUidMap: {},
      assetUidMap: {},
    };
    try {
      const backups = fs
        .readdirSync(process.cwd())
        .filter((n) => /^_backup_\d+$/.test(n))
        .map((n) => ({ n, t: fs.statSync(n).mtimeMs }))
        .sort((a, b) => b.t - a.t);
      if (backups.length) uidMaps = readImportUidMaps(backups[0].n);
    } catch {
      // best-effort — items that can't be translated are skipped
    }
    const entryCtUid = buildEntryContentTypeMap(opts.bundleDir);
    const where = opts.branch ? `branch "${opts.branch}"` : 'default workspace';

    // Releases
    try {
      const rel = await migrateReleases({
        spaceId: opts.spaceId,
        environmentId: opts.env,
        managementToken: opts.managementToken,
        apiKey: opts.apiKey,
        bundleDir: opts.bundleDir,
        entryUidMap: uidMaps.entryUidMap,
        assetUidMap: uidMaps.assetUidMap,
        locale: opts.locale,
        branch: opts.branch,
      });
      if (rel.total) {
        const items = rel.created.reduce((n, r) => n + r.items, 0);
        this.log(
          `✓ Releases → ${where} — ${rel.created.length}/${rel.total} created (${items} items); deploy from the UI`,
        );
        for (const f of rel.failed) this.log(`   ⚠ release "${f.name}": ${f.error}`);
      }
    } catch (err) {
      this.log(`⚠ Release migration skipped (${where}): ${err instanceof Error ? err.message : String(err)}`);
    }

    // Scheduled actions
    try {
      const { migrateScheduledActions } = await import('../../services/contentful/scheduled');
      const sch = await migrateScheduledActions({
        spaceId: opts.spaceId,
        environmentId: opts.env,
        managementToken: opts.managementToken,
        apiKey: opts.apiKey,
        entryUidMap: uidMaps.entryUidMap,
        assetUidMap: uidMaps.assetUidMap,
        entryCtUid,
        environment: 'master',
        locale: opts.locale,
        branch: opts.branch,
      });
      if (sch.total) {
        this.log(
          `✓ Scheduled actions → ${where} — ${sch.scheduled} scheduled${
            sch.skipped ? `, ${sch.skipped} skipped (past / not migrated)` : ''
          }${sch.failed.length ? `, ${sch.failed.length} failed` : ''}`,
        );
      }
    } catch (err) {
      this.log(`⚠ Scheduled-actions migration skipped (${where}): ${err instanceof Error ? err.message : String(err)}`);
    }

    // Tasks → entry comments
    try {
      const { migrateTasks } = await import('../../services/contentful/tasks');
      const tk = await migrateTasks({
        spaceId: opts.spaceId,
        environmentId: opts.env,
        managementToken: opts.managementToken,
        apiKey: opts.apiKey,
        entryUidMap: uidMaps.entryUidMap,
        entryCtUid,
        locale: opts.locale,
        branch: opts.branch,
      });
      if (tk.entriesWithTasks || tk.commentsCreated || tk.skipped) {
        this.log(
          `✓ Tasks → entry comments (${where}) — ${tk.commentsCreated} comment(s) on ${tk.entriesWithTasks} entr${
            tk.entriesWithTasks === 1 ? 'y' : 'ies'
          }${tk.skipped ? `, ${tk.skipped} skipped (entry not migrated)` : ''}${tk.failed ? `, ${tk.failed} failed` : ''}`,
        );
      }
    } catch (err) {
      this.log(`⚠ Task migration skipped (${where}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

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
 * Best-effort fetch of the Contentful space's name (Management API), used as the
 * default Contentstack stack name. Silent on ANY failure (bad token, network,
 * EU residency host, etc.) — the caller falls back to the dated name, so the
 * user never sees an error from this lookup.
 */
async function fetchContentfulSpaceName(spaceId?: string, token?: string): Promise<string | undefined> {
  if (!spaceId || !token) return undefined;
  try {
    const res = await axios.get(`https://api.contentful.com/spaces/${spaceId}`, {
      timeout: 30000,
      headers: { Authorization: `Bearer ${token}` },
    });
    const name = res?.data?.name;
    return typeof name === 'string' && name.trim() ? name.trim() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reuse the CMA token saved by `contentful login` (~/.contentfulrc.json), so a
 * logged-in user need not pass --management-token. Returns undefined if absent.
 */
function readContentfulCliToken(): string | undefined {
  try {
    const rc = path.join(os.homedir(), '.contentfulrc.json');
    if (!fs.existsSync(rc)) return undefined;
    const data = JSON.parse(fs.readFileSync(rc, 'utf8'));
    return data?.managementToken || data?.cmaToken || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Pick the Contentful default locale code from the export (the locale object
 * with `default: true`). Falls back to the first locale. Throws if there are none.
 */
function detectMasterLocale(input: string): string {
  const raw = fs.readFileSync(input, 'utf8');
  let locales: Array<{ code?: string; default?: boolean }> = [];
  try {
    locales = parseJsonLoose(raw)?.locales ?? [];
  } catch {
    // fall through
  }
  const def = locales.find((l) => l?.default === true)?.code;
  if (def) return def;
  if (locales[0]?.code) return locales[0].code as string;
  throw new Error('Source export has no locales — cannot determine master locale.');
}
