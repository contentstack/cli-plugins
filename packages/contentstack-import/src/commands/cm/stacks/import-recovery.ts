import { Command } from '@contentstack/cli-command';
import { flags, FlagInput, cliux, log } from '@contentstack/cli-utilities';
import { ImportRecoveryManager } from '../../../utils';

export default class ImportRecoveryCommand extends Command {
  static description = 'Analyze and recover from failed import operations';

  static examples: string[] = [
    'csdx cm:stacks:import-recovery --data-dir <path>',
    'csdx cm:stacks:import-recovery --data-dir <path> --clean',
    'csdx cm:stacks:import-recovery --data-dir <path> --report'
  ];

  static flags: FlagInput = {
    'data-dir': flags.string({
      char: 'd',
      description: 'The path to the directory containing the import data and state files',
      required: true,
    }),
    clean: flags.boolean({
      description: 'Clean the import state to start fresh (creates backup)',
      default: false,
    }),
    report: flags.boolean({
      description: 'Generate a detailed recovery report',
      default: false,
    }),
    'output-file': flags.string({
      description: 'Save the recovery report to a file',
    }),
  };

  static usage: string = 'cm:stacks:import-recovery --data-dir <value> [--clean] [--report] [--output-file <value>]';

  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(ImportRecoveryCommand);
      
      const recoveryManager = ImportRecoveryManager.create(flags['data-dir']);
      
      if (flags.clean) {
        await this.cleanImportState(recoveryManager);
        return;
      }
      
      if (flags.report) {
        await this.generateReport(recoveryManager, flags['output-file']);
        return;
      }
      
      // Default: analyze and provide recommendations
      await this.analyzeAndRecommend(recoveryManager);
      
    } catch (error) {
      log.error(`Recovery command failed: ${error}`);
      cliux.print(`Error: ${error}`, { color: 'red' });
    }
  }

  private async analyzeAndRecommend(recoveryManager: ImportRecoveryManager): Promise<void> {
    cliux.print('\n🔍 Analyzing import state...', { color: 'blue' });
    
    const info = recoveryManager.analyzeImportState();
    const recommendation = recoveryManager.getRecoveryRecommendation(info);
    
    // Display state information
    cliux.print('\n📊 Import State Summary:', { color: 'cyan' });
    cliux.print(`   State File: ${info.stateFileExists ? '✅ Found' : '❌ Not Found'}`);
    cliux.print(`   Assets Processed: ${info.mappingCounts.assets}`);
    cliux.print(`   Folders Processed: ${info.mappingCounts.folders}`);
    cliux.print(`   URL Mappings: ${info.mappingCounts.urls}`);
    
    if (info.lastUpdated) {
      const lastUpdated = new Date(info.lastUpdated);
      cliux.print(`   Last Updated: ${lastUpdated.toLocaleString()}`);
    }
    
    if (info.estimatedProgress) {
      cliux.print(`   Estimated Progress: ~${info.estimatedProgress}%`);
    }
    
    // Display recommendation
    cliux.print(`\n💡 Recommendation: ${recommendation.action.toUpperCase()}`, { 
      color: recommendation.action === 'resume' ? 'green' : 
             recommendation.action === 'restart' ? 'yellow' : 'red' 
    });
    cliux.print(`   ${recommendation.reason}`);
    
    if (recommendation.commands && recommendation.commands.length > 0) {
      cliux.print('\n📋 Commands:', { color: 'cyan' });
      recommendation.commands.forEach(cmd => {
        if (cmd.startsWith('#')) {
          cliux.print(`   ${cmd}`, { color: 'gray' });
        } else if (cmd.trim() === '') {
          cliux.print('');
        } else {
          cliux.print(`   ${cmd}`, { color: 'white' });
        }
      });
    }
    
    if (recommendation.warnings && recommendation.warnings.length > 0) {
      cliux.print('\n⚠️  Warnings:', { color: 'yellow' });
      recommendation.warnings.forEach(warning => {
        cliux.print(`   ${warning}`);
      });
    }
    
    cliux.print('\n💡 Tip: Use --report flag for a detailed analysis or --clean to start fresh\n');
  }

  private async cleanImportState(recoveryManager: ImportRecoveryManager): Promise<void> {
    cliux.print('\n🧹 Cleaning import state...', { color: 'yellow' });
    
    const info = recoveryManager.analyzeImportState();
    
    if (!info.stateFileExists) {
      cliux.print('✅ No import state found. Nothing to clean.', { color: 'green' });
      return;
    }
    
    if (info.mappingCounts.assets > 0 || info.mappingCounts.folders > 0) {
      cliux.print(`⚠️  Warning: This will remove progress for ${info.mappingCounts.assets} assets and ${info.mappingCounts.folders} folders.`, { color: 'yellow' });
      
      const confirm = await cliux.confirm('Are you sure you want to clean the import state? (y/N)');
      if (!confirm) {
        cliux.print('❌ Operation cancelled.', { color: 'red' });
        return;
      }
    }
    
    const success = recoveryManager.cleanImportState();
    
    if (success) {
      cliux.print('✅ Import state cleaned successfully. You can now start a fresh import.', { color: 'green' });
      cliux.print('💡 A backup of the previous state has been created.', { color: 'blue' });
    } else {
      cliux.print('❌ Failed to clean import state. Check the logs for details.', { color: 'red' });
    }
  }

  private async generateReport(recoveryManager: ImportRecoveryManager, outputFile?: string): Promise<void> {
    cliux.print('\n📄 Generating recovery report...', { color: 'blue' });
    
    const report = recoveryManager.generateRecoveryReport();
    
    if (outputFile) {
      try {
        const fs = require('fs');
        fs.writeFileSync(outputFile, report);
        cliux.print(`✅ Recovery report saved to: ${outputFile}`, { color: 'green' });
      } catch (error) {
        cliux.print(`❌ Failed to save report to file: ${error}`, { color: 'red' });
        cliux.print('\n📄 Recovery Report:', { color: 'cyan' });
        cliux.print(report);
      }
    } else {
      cliux.print('\n📄 Recovery Report:', { color: 'cyan' });
      cliux.print(report);
    }
  }
}