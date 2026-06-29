import { Command } from '@contentstack/cli-command';
import { cliux, flags, FlagInput } from '@contentstack/cli-utilities';
import { assertBundleDir } from '../../lib/bundle';
import { inferWorkspace, patchManifest, toWorkspaceRelative } from '../../lib/manifest';
import { spawnCsdx } from '../../lib/csdx-spawn';

export interface AuditFlags {
  'data-dir'?: string;
  'report-path'?: string;
  modules?: string;
  csv?: boolean;
}

/** Build argv for `csdx cm:stacks:audit` from migrate:audit flags. */
export function buildStacksAuditArgs(dataDir: string, flags: AuditFlags): string[] {
  const args = ['cm:stacks:audit', '--data-dir', dataDir];
  if (flags['report-path']) args.push('--report-path', flags['report-path']);
  if (flags.modules) args.push('--modules', flags.modules);
  if (flags.csv) args.push('--csv');
  return args;
}

export default class MigrateAudit extends Command {
  static description = 'Audit a Contentstack import bundle (wraps csdx cm:stacks:audit)';

  static examples = [
    '$ csdx migrate:audit --data-dir ./contentstack-import/bundle',
    '$ csdx migrate:audit -d ./contentstack-import/bundle --report-path ./audit-reports',
    '$ csdx migrate:audit -d ./bundle --modules content-types,entries,assets --csv',
  ];
  static hidden = true;
  static flags: FlagInput = {
    'data-dir': flags.string({
      char: 'd',
      description: 'Path to convert output bundle directory',
    }),
    'report-path': flags.string({
      description: 'Directory for audit reports',
    }),
    modules: flags.string({
      description: 'Comma-separated audit modules (e.g. content-types,entries,assets)',
    }),
    csv: flags.boolean({
      description: 'Export audit report as CSV',
      default: false,
    }),
    workspace: flags.string({
      char: 'w',
      description: 'Migration workspace root for migration-manifest.json',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MigrateAudit);

    try {
      const dataDir = flags['data-dir'] ?? (await cliux.prompt('Path to convert output bundle directory'));

      assertBundleDir(dataDir);

      const args = buildStacksAuditArgs(dataDir, {
        'report-path': flags['report-path'],
        modules: flags.modules,
        csv: flags.csv,
      });
      this.log(`Running: csdx ${args.join(' ')}`);

      const code = await spawnCsdx(args);
      if (code !== 0) {
        this.error(`Audit failed (exit ${code})`, { exit: code });
      }

      const workspace = inferWorkspace({ workspace: flags.workspace, dataDir });
      await patchManifest(workspace, {
        audit: {
          lastRunAt: new Date().toISOString(),
          reportPath: flags['report-path'] ? toWorkspaceRelative(workspace, flags['report-path']) : undefined,
        },
      });

      this.log('✓ Audit complete');
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error), { exit: 1 });
    }
  }
}
