import * as fs from 'fs';
import { CLIError, handleAndLogError } from '@contentstack/cli-utilities';
import { QueryExportConfig } from '../types';

export class QueryParser {
  private config: QueryExportConfig;

  constructor(config: QueryExportConfig) {
    this.config = config;
  }

  async parse(queryInput: string): Promise<any> {
    let query: any;

    // Check if it's a file path
    if (queryInput.endsWith('.json') && fs.existsSync(queryInput)) {
      query = this.parseFromFile(queryInput);
    } else {
      query = this.parseFromString(queryInput);
    }

    this.validate(query);
    return query;
  }

  private parseFromFile(filePath: string): any {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      handleAndLogError(error, this.config.context, 'Failed to parse the query file');
    }
  }

  private parseFromString(queryString: string): any {
    try {
      return JSON.parse(queryString);
    } catch (error) {
      handleAndLogError(error, this.config.context, 'Invalid JSON query');
      throw new CLIError('Invalid JSON query');
    }
  }

  private validate(query: any): void {
    if (!query || typeof query !== 'object') {
      throw new CLIError('The query must be a valid JSON object.');
    }

    if (!query.modules || typeof query.modules !== 'object') {
      throw new CLIError('The query must contain a "modules" object.');
    }

    const modules = Object.keys(query.modules);
    if (modules.length === 0) {
      throw new CLIError('The query must contain at least one module.');
    }

    // Validate supported modules
    const queryableModules = this.config.modules.queryable;
    for (const module of modules) {
      if (!queryableModules.includes(module as any)) {
        throw new CLIError(`Module "${module}" is not queryable. Supported modules: ${queryableModules.join(', ')}`);
      }
    }
  }
}
