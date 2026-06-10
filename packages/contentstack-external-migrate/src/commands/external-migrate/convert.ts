import { Command } from '@contentstack/cli-command';
import { cliux, flags, FlagInput } from '@contentstack/cli-utilities';
import { getAdapter } from '../../adapters/registry';
import { inferWorkspace, patchManifest, toWorkspaceRelative } from '../../lib/manifest';

export default class MigrateConvert extends Command {
  static description = 'Convert a legacy CMS export to a Contentstack import bundle';

  static examples = [
    '$ csdx migrate:convert --legacy contentful --input ./export.json --output ./contentstack-import',
    '$ csdx migrate:convert -l contentful -i ../references/contentful-export-*.json -o ./contentstack-import -m en-US',
  ];
  static hidden = true;
  static flags: FlagInput = {
    legacy: flags.string({
      char: 'l',
      description: 'Legacy CMS source (contentful)',
      required: true,
      options: ['contentful'],
    }),
    input: flags.string({
      char: 'i',
      description: 'Path to legacy export JSON (e.g. Contentful export)',
    }),
    output: flags.string({
      char: 'o',
      description: 'Parent output directory; bundle written to <output>/bundle',
      default: './contentstack-import',
    }),
    'master-locale': flags.string({
      char: 'm',
      description: 'Destination master locale code',
    }),
    affix: flags.string({
      char: 'a',
      description: 'Content-type UID prefix',
      default: '',
    }),
    verbose: flags.boolean({
      char: 'v',
      description: 'Verbose conversion logs',
      default: false,
    }),
    workspace: flags.string({
      char: 'w',
      description: 'Migration workspace root for migration-manifest.json',
    }),
    org: flags.string({
      description:
        'Organization UID for migrating marketplace `app` fields (e.g. Cloudinary). ' +
        'Optional: defaults to your csdx org, or prompts when you belong to several.',
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MigrateConvert);

    try {
      const adapter = getAdapter(flags.legacy);
      const input = flags.input ?? (await cliux.prompt('Path to Contentful export JSON'));

      const result = await adapter.convert({
        input,
        outputDir: flags.output,
        masterLocale: flags['master-locale'],
        affix: flags.affix,
        verbose: flags.verbose,
        orgUid: flags.org,
      });

      const workspace = inferWorkspace({
        workspace: flags.workspace,
        output: flags.output,
        input,
      });

      await patchManifest(
        workspace,
        {
          legacy: flags.legacy,
          convert: {
            completedAt: new Date().toISOString(),
            bundleDir: toWorkspaceRelative(workspace, result.bundleDir),
            masterLocale: flags['master-locale'],
            affix: flags.affix || undefined,
            stats: result.stats,
          },
        },
        { legacy: flags.legacy },
      );

      this.log(`✓ Bundle ready: ${result.bundleDir}`);
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error), { exit: 1 });
    }
  }
}
