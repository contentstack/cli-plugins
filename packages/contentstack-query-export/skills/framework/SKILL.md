---
name: framework
description: Utilities, configuration, logging, and error patterns for @contentstack/cli-cm-export-query. Use when working in src/utils/, config, or shared helpers — align with @contentstack/cli-utilities where possible.
---

# Framework Patterns

Core utilities, configuration, logging, and error-handling patterns for **`@contentstack/cli-cm-export-query`** (and similar CLI plugins). Prefer matching patterns already in **`src/utils/`** and **`@contentstack/cli-utilities`** before introducing new abstractions.

## Configuration Management

```typescript
export interface AppConfig {
  contentstack: { apiKey: string; authToken: string; region: string; };
  batch: { defaultSize: number; maxConcurrency: number; retryAttempts: number; };
  logging: { level: string; format: string; };
}

export class ConfigBuilder {
  static build(): AppConfig {
    return {
      contentstack: { apiKey: process.env.CONTENTSTACK_API_KEY!, authToken: process.env.CONTENTSTACK_AUTH_TOKEN!, region: process.env.CONTENTSTACK_REGION || 'us' },
      batch: { defaultSize: parseInt(process.env.BATCH_SIZE || '10'), maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '3'), retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3') },
      logging: { level: process.env.LOG_LEVEL || 'info', format: process.env.LOG_FORMAT || 'json' }
    };
  }
  static validate(config: AppConfig): void {
    if (!config.contentstack.apiKey) throw new Error('CONTENTSTACK_API_KEY is required');
    if (!config.contentstack.authToken) throw new Error('CONTENTSTACK_AUTH_TOKEN is required');
  }
}
```

## Logging Framework

```typescript
export interface Logger { debug(message: string, meta?: object): void; info(message: string, meta?: object): void; warn(message: string, meta?: object): void; error(message: string, meta?: object): void; }

export class ConsoleLogger implements Logger {
  constructor(private level: string = 'info') {}
  debug(message: string, meta?: object): void { if (this.shouldLog('debug')) console.debug(this.format('DEBUG', message, meta)); }
  info(message: string, meta?: object): void { if (this.shouldLog('info')) console.info(this.format('INFO', message, meta)); }
  warn(message: string, meta?: object): void { if (this.shouldLog('warn')) console.warn(this.format('WARN', message, meta)); }
  error(message: string, meta?: object): void { if (this.shouldLog('error')) console.error(this.format('ERROR', message, meta)); }

  private shouldLog(level: string): boolean { const levels = ['debug', 'info', 'warn', 'error']; return levels.indexOf(level) >= levels.indexOf(this.level); }
  private format(level: string, message: string, meta?: object): string { return JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...meta }); }
}
```

## Error Handling Framework

```typescript
export abstract class BaseError extends Error {
  abstract readonly code: string; abstract readonly category: 'validation' | 'api' | 'system' | 'user';
  constructor(message: string, public readonly context?: Record<string, any>, public readonly cause?: Error) { super(message); this.name = this.constructor.name; }
}

export class ValidationError extends BaseError { readonly code = 'VALIDATION_ERROR'; readonly category = 'validation' as const; }

export class ApiError extends BaseError {
  readonly code = 'API_ERROR'; readonly category = 'api' as const;
  constructor(message: string, public readonly status?: number, context?: Record<string, any>, cause?: Error) { super(message, { ...context, status }, cause); }
}

export class ContentstackApiError extends ApiError {
  readonly code = 'CONTENTSTACK_API_ERROR';
  static fromResponse(response: any, context?: Record<string, any>): ContentstackApiError {
    return new ContentstackApiError(response.error_message || 'API request failed', response.error_code, { ...context, errorCode: response.error_code, details: response.errors });
  }
}
```

## Utility Classes

### Rate Limiter
```typescript
export class RateLimiter {
  private queue: Array<() => void> = []; private running = 0; private lastRequest = 0;
  constructor(private maxConcurrent: number = 1, private minInterval: number = 100) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try { await this.waitForInterval(); this.running++; const result = await operation(); resolve(result); }
        catch (error) { reject(error); } finally { this.running--; this.processQueue(); }
      });
      this.processQueue();
    });
  }

  private processQueue(): void { if (this.running < this.maxConcurrent && this.queue.length > 0) this.queue.shift()!(); }
  private async waitForInterval(): Promise<void> {
    const now = Date.now(); const elapsed = now - this.lastRequest;
    if (elapsed < this.minInterval) await new Promise(resolve => setTimeout(resolve, this.minInterval - elapsed));
    this.lastRequest = Date.now();
  }
}
```

### Retry Strategy
```typescript
export interface RetryOptions { maxAttempts: number; initialDelay: number; maxDelay: number; backoffFactor: number; retryCondition?: (error: any) => boolean; }

export class RetryStrategy {
  constructor(private options: RetryOptions) {}
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any; let delay = this.options.initialDelay;
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try { return await operation(); }
      catch (error) {
        lastError = error; if (this.options.retryCondition && !this.options.retryCondition(error)) throw error;
        if (attempt === this.options.maxAttempts) break; await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * this.options.backoffFactor, this.options.maxDelay);
      }
    }
    throw lastError;
  }

  static forContentstack(): RetryStrategy {
    return new RetryStrategy({ maxAttempts: 3, initialDelay: 1000, maxDelay: 10000, backoffFactor: 2, retryCondition: (error) => error.status === 429 || (error.status >= 500 && error.status < 600) });
  }
}
```

### Batch Processor
```typescript
export interface BatchOptions<T> { batchSize: number; concurrency: number; processor: (item: T) => Promise<any>; onProgress?: (completed: number, total: number) => void; }

export class BatchProcessor {
  static async process<T>(items: T[], options: BatchOptions<T>): Promise<any[]> {
    const batches = this.chunk(items, options.batchSize); const allResults: any[] = []; let completed = 0;
    const processBatch = async (batch: T[]): Promise<void> => {
      const results = await Promise.allSettled(batch.map(options.processor)); allResults.push(...results); completed += batch.length; options.onProgress?.(completed, items.length);
    };
    const semaphore = new Semaphore(options.concurrency); await Promise.all(batches.map(batch => semaphore.acquire(() => processBatch(batch)))); return allResults;
  }
  private static chunk<T>(array: T[], size: number): T[][] { const chunks: T[][] = []; for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size)); return chunks; }
}

class Semaphore {
  private permits: number; private waiting: Array<() => void> = [];
  constructor(permits: number) { this.permits = permits; }
  async acquire<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const tryAcquire = () => {
        if (this.permits > 0) { this.permits--; task().then(resolve).catch(reject).finally(() => { this.permits++; if (this.waiting.length > 0) this.waiting.shift()!(); }); }
        else this.waiting.push(tryAcquire);
      };
      tryAcquire();
    });
  }
}
```

## File System & Validation Utilities

```typescript
export class FileUtil {
  static async writeJson(filePath: string, data: any): Promise<void> {
    try { const dir = path.dirname(filePath); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(filePath, JSON.stringify(data, null, 2)); }
    catch (error) { throw new Error(`Failed to write file ${filePath}: ${error.message}`); }
  }
  static async readJson<T>(filePath: string): Promise<T> {
    try { const content = await fs.readFile(filePath, 'utf-8'); return JSON.parse(content); }
    catch (error) { if (error.code === 'ENOENT') throw new Error(`File not found: ${filePath}`); throw new Error(`Failed to read file ${filePath}: ${error.message}`); }
  }
  static async exists(filePath: string): Promise<boolean> { try { await fs.access(filePath); return true; } catch { return false; } }
}

export class Validator {
  static required(value: any, fieldName: string): void { if (value === null || value === undefined || value === '') throw new ValidationError(`${fieldName} is required`); }
  static isArray(value: any, fieldName: string): void { if (!Array.isArray(value)) throw new ValidationError(`${fieldName} must be an array`); }
  static isString(value: any, fieldName: string): void { if (typeof value !== 'string') throw new ValidationError(`${fieldName} must be a string`); }
  static validateEnvironment(env: string): void { this.required(env, 'environment'); this.isString(env, 'environment'); }
  static validateBatchSize(size: number): void { this.required(size, 'batchSize'); if (size < 1 || size > 100) throw new ValidationError('batchSize must be between 1 and 100'); }
}
```

## Dependency Injection

```typescript
export class Container {
  private services = new Map<string, any>(); private factories = new Map<string, () => any>();
  register<T>(name: string, factory: () => T): void { this.factories.set(name, factory); }
  get<T>(name: string): T {
    if (this.services.has(name)) return this.services.get(name); const factory = this.factories.get(name); if (!factory) throw new Error(`Service not registered: ${name}`);
    const instance = factory(); this.services.set(name, instance); return instance;
  }
  static setup(): Container {
    const container = new Container(); container.register('config', () => ConfigBuilder.build()); container.register('logger', () => new ConsoleLogger());
    container.register('rateLimiter', () => new RateLimiter(3, 100)); container.register('retryStrategy', () => RetryStrategy.forContentstack()); return container;
  }
}
```