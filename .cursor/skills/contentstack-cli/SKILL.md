---
name: contentstack-cli
description: Contentstack CLI development patterns, OCLIF commands, API integration, and authentication/configuration workflows. Use when working with Contentstack CLI plugins, OCLIF commands, CLI commands, or Contentstack API integration.
---

# Contentstack CLI Development

## Quick Reference

For comprehensive patterns, see:
- **[Contentstack Patterns](./references/contentstack-patterns.md)** - Complete CLI commands, API integration, and configuration patterns
- **[Framework Patterns](../framework/references/framework-patterns.md)** - Utilities, configuration, and error handling

## Key Patterns Summary

### OCLIF Command Structure
- Extend plugin-specific `BaseCommand` or `Command` from `@contentstack/cli-command`
- Validate flags early: `if (!flags['stack-api-key']) this.error('Stack API key is required')`
- Delegate to services/modules: commands handle CLI, services handle business logic
- Show progress: `cliux.success('✅ Operation completed')`
- Include command examples: `static examples = ['$ csdx cm:stacks:import -k <api-key> -d ./data', '$ csdx cm:stacks:export -k <api-key>']`

### Command Topics
- CM topic commands: `cm:stacks:import`, `cm:stacks:export`, `cm:stacks:audit`, `cm:stacks:clone`, etc.
- File pattern: `src/commands/cm/stacks/import.ts` → command `cm:stacks:import`
- Plugin structure: Each package defines commands in `oclif.commands` pointing to `./lib/commands`

### Flag Patterns
```typescript
static flags: FlagInput = {
  username: flags.string({
    char: 'u',
    description: 'Email address',
    required: false
  }),
  oauth: flags.boolean({
    description: 'Enable SSO',
    default: false,
    exclusive: ['username', 'password']
  })
};
```

### Logging and Error Handling
- Use structured logging: `log.debug('Message', { context: 'data' })`
- Include contextDetails: `handleAndLogError(error, { ...this.contextDetails, module: 'auth-login' })`
- User feedback: `cliux.success()`, `cliux.error()`, `throw new CLIError()`

### I18N Messages
- Store user-facing strings in `messages/*.json` files
- Load with `messageHandler` from utilities
- Example: `messages/en.json` for English strings

## Command Base Class Pattern

Each plugin defines its own `BaseCommand` extending `@contentstack/cli-command`:

```typescript
export abstract class BaseCommand<T extends typeof Command> extends Command {
  protected sharedConfig = { basePath: process.cwd() };

  static baseFlags: FlagInput = {
    config: Flags.string({
      char: 'c',
      description: 'Path to config file',
    }),
    'data-dir': Flags.string({
      char: 'd',
      description: 'Data directory path',
    }),
  };

  async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      args: this.ctor.args,
    });
    this.args = args;
    this.flags = flags;
  }
}
```

Specialized base commands extend this for domain-specific concerns (e.g., `AuditBaseCommand` for audit operations).

## Plugin Development Patterns

### Import Plugin Example
```typescript
// packages/contentstack-import/src/commands/cm/stacks/import.ts
export default class ImportCommand extends BaseCommand {
  static id = 'cm:stacks:import';
  static description = 'Import content into a stack';
  
  static flags: FlagInput = {
    'stack-api-key': Flags.string({
      char: 'k',
      description: 'Stack API key',
      required: true,
    }),
    'data-dir': Flags.string({
      char: 'd',
      description: 'Directory with import data',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = this;
    const importService = new ImportService(flags);
    await importService.import();
    cliux.success('✅ Import completed');
  }
}
```

### Service Layer Pattern
Services encapsulate business logic separate from CLI concerns:

```typescript
export class ImportService {
  async import(): Promise<void> {
    await this.validateInput();
    await this.loadData();
    await this.importContent();
  }
}
```

### Module Pattern
Complex domains split work across modules:

```typescript
export class Entries {
  async import(entries: any[]): Promise<void> {
    for (const entry of entries) {
      await this.importEntry(entry);
    }
  }
}
```

## API Integration

### Management SDK Client
```typescript
import { managementSDKClient } from '@contentstack/cli-utilities';

const client = await managementSDKClient({ 
  host: this.cmaHost,
  skipTokenValidity: true 
});

const stack = client.stack({ api_key: stackApiKey });
const entries = await stack.entry().query().find();
```

### Error Handling for API Calls
```typescript
try {
  const result = await this.client.stack().entry().fetch();
} catch (error) {
  if (error.status === 401) {
    throw new CLIError('Authentication failed. Please login again.');
  } else if (error.status === 404) {
    throw new CLIError('Entry not found.');
  }
  handleAndLogError(error, { 
    module: 'entry-fetch',
    entryId: entryUid
  });
}
```

## Usage

Reference the comprehensive patterns guide above for detailed implementations, examples, and best practices for CLI command development, authentication flows, configuration management, and API integration.
