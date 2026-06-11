import { Command } from '@contentstack/cli-command';
import { flags, FlagInput } from '@contentstack/cli-utilities';
import { formatMigrationStatus, inferWorkspace, MANIFEST_FILENAME, readManifest } from '../../lib/manifest';

export default class MigrateStatus extends Command {
  static description = 'Show migration manifest and step status';

  static examples = ['$ csdx migrate:status --workspace ./migration-workspace', '$ csdx migrate:status -w .'];
  static hidden = true;
  static flags: FlagInput = {
    workspace: flags.string({
      char: 'w',
      description: 'Migration workspace root (contains migration-manifest.json)',
      default: './migration-workspace',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MigrateStatus);
    const workspace = inferWorkspace({ workspace: flags.workspace });
    const manifest = await readManifest(workspace);

    if (!manifest) {
      this.error(`No ${MANIFEST_FILENAME} found in ${workspace}. Run migrate:export or pass --workspace.`, { exit: 1 });
    }

    for (const line of formatMigrationStatus(manifest, workspace)) {
      this.log(line);
    }
  }
}
