import { Command } from '@contentstack/cli-command';
import {
  flags,
  FlagInput,
  sanitizePath,
  managementSDKClient,
  ContentstackClient,
  log,
  handleAndLogError,
  messageHandler,
  loadChalk,
} from '@contentstack/cli-utilities';
import { QueryExporter } from '../../../core/query-executor';
import { QueryExportConfig } from '../../../types';
import { setupQueryExportConfig, setupBranches, createLogContext } from '../../../utils';

export default class ExportQueryCommand extends Command {
  static description = 'Export content from a stack using query-based filtering';
  private exportDir: string;

  static examples = [
    'csdx cm:stacks:export-query --query \'{"modules":{"content-types":{"title":{"$in":["Blog","Author"]}}}}\'',
    'csdx cm:stacks:export-query --query ./ct-query.json --skip-references',
    'csdx cm:stacks:export-query --alias <alias> --query \'{"modules":{"entries":{"content_type_uid":"blog"}}}\'',
    'csdx cm:stacks:export-query --query \'{"modules":{"assets":{"title":{"$regex":"image"}}}}\'',
  ];

  static usage = 'cm:stacks:export-query --query <value> [options]';

  static flags: FlagInput = {
    config: flags.string({
      char: 'c',
      description: 'Path to the configuration file',
    }),
    'stack-api-key': flags.string({
      char: 'k',
      description: 'Stack API key',
    }),
    'data-dir': flags.string({
      char: 'd',
      description: 'Path to store exported content',
    }),
    alias: flags.string({
      char: 'a',
      description: 'Management token alias',
    }),
    branch: flags.string({
      description: 'Branch name to export from',
      exclusive: ['branch-alias'],
    }),
    'branch-alias': flags.string({
      description: 'Alias of Branch to export from',
      exclusive: ['branch'],
    }),
    query: flags.string({
      required: true,
      description: 'Query as JSON string or file path',
    }),
    'skip-references': flags.boolean({
      description: 'Skip referenced content types',
    }),
    'skip-dependencies': flags.boolean({
      description: 'Skip dependent modules (global-fields, extensions, taxonomies)',
    }),
    'secured-assets': flags.boolean({
      description: 'Export secured assets',
    }),
    yes: flags.boolean({
      char: 'y',
      description: 'Skip confirmation prompts',
    }),
  };

  async run(): Promise<void> {
    await loadChalk();
    try {
      const { flags } = await this.parse(ExportQueryCommand);
      this.initializeMessageHandler();

      // Setup export configuration
      const exportQueryConfig = await setupQueryExportConfig(flags);
      exportQueryConfig.host = this.cmaHost;
      exportQueryConfig.region = this.region;

      if (this.developerHubUrl) {
        exportQueryConfig.developerHubBaseUrl = this.developerHubUrl;
      }

      this.exportDir = sanitizePath(exportQueryConfig.exportDir);
      // Create base context without module name - module field is set dynamically during each module export
      exportQueryConfig.context = createLogContext(exportQueryConfig);
      log.debug('Export configuration setup completed', exportQueryConfig.context);

      // Initialize management API client
      const managementAPIClient: ContentstackClient = await managementSDKClient(exportQueryConfig);

      // Setup and validate branch configuration
      const stackAPIClient = managementAPIClient.stack({
        api_key: exportQueryConfig.stackApiKey,
        management_token: exportQueryConfig.managementToken,
      });

      // Setup branches (validate branch or set default to 'main')
      await setupBranches(exportQueryConfig, stackAPIClient);
      log.debug('Branch configuration setup completed', exportQueryConfig.context);

      // Initialize and run query export
      log.debug('Starting query exporter', exportQueryConfig.context);
      const queryExporter = new QueryExporter(managementAPIClient, exportQueryConfig);
      await queryExporter.execute();
      log.debug('Query exporter completed successfully', exportQueryConfig.context);

      log.success('Query-based export completed successfully!', exportQueryConfig.context);
      log.info(`Export files saved to: ${this.exportDir}`, exportQueryConfig.context);
    } catch (error) {
      handleAndLogError(error);
    }
  }

  initializeMessageHandler(): void {
    messageHandler.init(this.context);
  }
}
