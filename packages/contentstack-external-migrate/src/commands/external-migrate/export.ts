import { Command } from '@contentstack/cli-command';
import { cliux, flags, FlagInput } from '@contentstack/cli-utilities';
import { getAdapter } from '../../adapters/registry';
import { inferWorkspace, patchManifest, toWorkspaceRelative } from '../../lib/manifest';

export default class MigrateExport extends Command {
  static description = 'Export content from a legacy CMS (e.g. Contentful)';

  static examples = [
    '$ csdx migrate:export --legacy contentful --space-id YOUR_SPACE --output ./migration-workspace',
    '$ CONTENTFUL_MANAGEMENT_TOKEN=... csdx migrate:export -l contentful --space-id YOUR_SPACE -o ./migration-workspace',
    '$ csdx migrate:export -l contentful --space-id YOUR_SPACE --download-assets --include-drafts',
  ];
  static hidden = true;
  static flags: FlagInput = {
    legacy: flags.string({
      char: 'l',
      description: 'Legacy CMS source (contentful)',
      required: true,
      options: ['contentful'],
    }),
    'space-id': flags.string({
      description: 'Contentful space ID',
    }),
    'management-token': flags.string({
      description: 'Contentful CMA token (prefer CONTENTFUL_MANAGEMENT_TOKEN env)',
    }),
    output: flags.string({
      char: 'o',
      description: 'Migration workspace root (writes export.json here)',
      default: './migration-workspace',
    }),
    'download-assets': flags.boolean({
      description: 'Download asset binaries via Contentful CLI',
      default: false,
    }),
    'include-drafts': flags.boolean({
      description: 'Include draft entries in export',
      default: false,
    }),
    'include-archived': flags.boolean({
      description: 'Include archived entries in export',
      default: false,
    }),
    verbose: flags.boolean({
      char: 'v',
      description: 'Verbose export logs',
      default: false,
    }),
    workspace: flags.string({
      char: 'w',
      description: 'Migration workspace root for migration-manifest.json (defaults to --output)',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MigrateExport);

    try {
      const adapter = getAdapter(flags.legacy);

      const spaceId = flags['space-id'] ?? (await cliux.prompt('Contentful space ID'));

      const managementToken =
        flags['management-token'] ??
        process.env.CONTENTFUL_MANAGEMENT_TOKEN ??
        (await cliux.prompt('Contentful management token (prefer CONTENTFUL_MANAGEMENT_TOKEN env)'));

      const result = await adapter.export({
        outputDir: flags.output,
        spaceId,
        managementToken,
        downloadAssets: flags['download-assets'],
        includeDrafts: flags['include-drafts'],
        includeArchived: flags['include-archived'],
        verbose: flags.verbose,
      });

      const workspace = inferWorkspace({ workspace: flags.workspace, output: flags.output });

      await patchManifest(
        workspace,
        {
          legacy: flags.legacy,
          source: {
            spaceId,
            exportedAt: new Date().toISOString(),
            exportFile: toWorkspaceRelative(workspace, result.exportFile),
          },
        },
        { legacy: flags.legacy },
      );

      this.log(`✓ Export ready: ${result.exportFile}`);
      if (result.assetsDir) {
        this.log(`  Assets downloaded under: ${result.assetsDir}`);
      }
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error), { exit: 1 });
    }
  }
}
