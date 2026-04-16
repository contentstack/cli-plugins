import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { log } from '@contentstack/cli-utilities';

export interface ImportRecoveryInfo {
  stateFileExists: boolean;
  stateFilePath: string;
  mappingCounts: {
    assets: number;
    folders: number;
    urls: number;
  };
  lastUpdated?: number;
  canResume: boolean;
  estimatedProgress?: number;
}

export interface RecoveryRecommendation {
  action: 'resume' | 'restart' | 'investigate';
  reason: string;
  commands?: string[];
  warnings?: string[];
}

export class ImportRecoveryManager {
  private backupDir: string;
  private context: Record<string, any>;

  constructor(backupDir: string, context: Record<string, any> = {}) {
    this.backupDir = backupDir;
    this.context = context;
  }

  /**
   * Analyze the current import state and provide recovery information
   */
  analyzeImportState(): ImportRecoveryInfo {
    const stateFilePath = join(this.backupDir, '.import-state.json');
    const stateFileExists = existsSync(stateFilePath);

    const info: ImportRecoveryInfo = {
      stateFileExists,
      stateFilePath,
      mappingCounts: { assets: 0, folders: 0, urls: 0 },
      canResume: false
    };

    if (stateFileExists) {
      try {
        const stateContent = readFileSync(stateFilePath, 'utf8');
        const state = JSON.parse(stateContent);

        info.mappingCounts = {
          assets: Object.keys(state.assets || {}).length,
          folders: Object.keys(state.folders || {}).length,
          urls: Object.keys(state.urls || {}).length
        };

        info.lastUpdated = state.lastUpdated;
        info.canResume = info.mappingCounts.assets > 0 || info.mappingCounts.folders > 0;

        // Estimate progress if we have asset count
        if (info.mappingCounts.assets > 0) {
          // This is a rough estimate - in reality we'd need to know total asset count
          info.estimatedProgress = Math.min(95, (info.mappingCounts.assets / 100) * 10); // Very rough estimate
        }

        log.debug(`Import state analysis: ${info.mappingCounts.assets} assets, ${info.mappingCounts.folders} folders processed`, this.context);
      } catch (error) {
        log.warn(`Failed to parse import state file: ${error}`, this.context);
        info.canResume = false;
      }
    }

    return info;
  }

  /**
   * Provide recovery recommendations based on the current state
   */
  getRecoveryRecommendation(info?: ImportRecoveryInfo): RecoveryRecommendation {
    if (!info) {
      info = this.analyzeImportState();
    }

    // No state file - fresh start
    if (!info.stateFileExists) {
      return {
        action: 'restart',
        reason: 'No previous import state found. Starting fresh import.',
        commands: ['csdx cm:stacks:import --data-dir <path> --stack-api-key <key>']
      };
    }

    // State file exists but no mappings - likely failed early
    if (info.mappingCounts.assets === 0 && info.mappingCounts.folders === 0) {
      return {
        action: 'restart',
        reason: 'Import state file exists but no assets or folders were processed. Likely failed during initialization.',
        commands: ['csdx cm:stacks:import --data-dir <path> --stack-api-key <key>'],
        warnings: ['Previous state file will be overwritten']
      };
    }

    // Significant progress made - recommend resume
    if (info.mappingCounts.assets > 10 || info.mappingCounts.folders > 5) {
      return {
        action: 'resume',
        reason: `Significant progress detected (${info.mappingCounts.assets} assets, ${info.mappingCounts.folders} folders processed). Resuming will skip already imported items.`,
        commands: [
          'csdx cm:stacks:import --data-dir <path> --stack-api-key <key>',
          '# The import will automatically detect and resume from existing state'
        ]
      };
    }

    // Some progress but not much - could go either way
    if (info.mappingCounts.assets > 0 || info.mappingCounts.folders > 0) {
      return {
        action: 'resume',
        reason: `Some progress detected (${info.mappingCounts.assets} assets, ${info.mappingCounts.folders} folders processed). You can resume or restart.`,
        commands: [
          '# To resume:',
          'csdx cm:stacks:import --data-dir <path> --stack-api-key <key>',
          '',
          '# To restart (will overwrite existing state):',
          'rm .import-state.json',
          'csdx cm:stacks:import --data-dir <path> --stack-api-key <key>'
        ],
        warnings: ['If restarting, previously imported assets may be duplicated unless using --replace-existing']
      };
    }

    // Fallback
    return {
      action: 'investigate',
      reason: 'Import state is unclear. Manual investigation recommended.',
      commands: [
        'cat .import-state.json | jq .',
        'ls -la <backup-dir>/',
        'csdx cm:stacks:import --help'
      ]
    };
  }

  /**
   * Clean up import state (for fresh restart)
   */
  cleanImportState(): boolean {
    const stateFilePath = join(this.backupDir, '.import-state.json');
    const backupPath = `${stateFilePath}.backup`;

    try {
      if (existsSync(stateFilePath)) {
        // Create backup before removing
        const stateContent = readFileSync(stateFilePath, 'utf8');
        require('fs').writeFileSync(backupPath, stateContent);
        
        require('fs').unlinkSync(stateFilePath);
        log.info(`Import state cleared. Backup saved to: ${backupPath}`, this.context);
        return true;
      }
    } catch (error) {
      log.error(`Failed to clean import state: ${error}`, this.context);
      return false;
    }

    return true;
  }

  /**
   * Generate a recovery report for debugging
   */
  generateRecoveryReport(): string {
    const info = this.analyzeImportState();
    const recommendation = this.getRecoveryRecommendation(info);

    const report = [
      '=== Contentstack Import Recovery Report ===',
      '',
      `Backup Directory: ${this.backupDir}`,
      `State File: ${info.stateFilePath}`,
      `State File Exists: ${info.stateFileExists}`,
      '',
      'Progress Summary:',
      `  Assets Processed: ${info.mappingCounts.assets}`,
      `  Folders Processed: ${info.mappingCounts.folders}`,
      `  URL Mappings: ${info.mappingCounts.urls}`,
      '',
      info.lastUpdated ? `Last Updated: ${new Date(info.lastUpdated).toISOString()}` : 'Last Updated: Unknown',
      info.estimatedProgress ? `Estimated Progress: ${info.estimatedProgress}%` : '',
      '',
      `Can Resume: ${info.canResume}`,
      '',
      'Recommendation:',
      `  Action: ${recommendation.action.toUpperCase()}`,
      `  Reason: ${recommendation.reason}`,
      '',
      'Commands:',
      ...(recommendation.commands || []).map(cmd => `  ${cmd}`),
      '',
      ...(recommendation.warnings ? [
        'Warnings:',
        ...recommendation.warnings.map(warning => `  ⚠️  ${warning}`),
        ''
      ] : []),
      '=== End Report ===',
    ];

    return report.join('\n');
  }

  /**
   * Create a recovery manager for a given backup directory
   */
  static create(backupDir: string, context: Record<string, any> = {}): ImportRecoveryManager {
    return new ImportRecoveryManager(backupDir, context);
  }
}