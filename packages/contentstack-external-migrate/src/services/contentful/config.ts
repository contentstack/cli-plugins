export interface ContentfulMigrateConfig {
  outputDir: string;
  verbose: boolean;
}

let activeConfig: ContentfulMigrateConfig | null = null;

export function initContentfulMigrateConfig(cfg: ContentfulMigrateConfig): void {
  activeConfig = cfg;
  process.env.CLI_OUT_DIR = cfg.outputDir;
  if (cfg.verbose) {
    process.env.CLI_VERBOSE = '1';
  } else {
    delete process.env.CLI_VERBOSE;
  }
}

export function getOutputDir(): string {
  if (!activeConfig) {
    throw new Error('Contentful migrate config not initialized');
  }
  return activeConfig.outputDir;
}
