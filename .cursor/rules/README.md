# Cursor Rules

Context-aware rules that load automatically based on the files you're editing, optimized for this CLI plugins monorepo.

## Rule Files

| File | Scope | Always Applied | Purpose |
|------|-------|----------------|---------|
| `dev-workflow.md` | `**/*.ts`, `**/*.js`, `**/*.json` | Yes | Monorepo TDD workflow, pnpm workspace patterns (12 plugin packages) |
| `typescript.mdc` | `**/*.ts`, `**/*.tsx` | No | TypeScript configurations and naming conventions |
| `testing.mdc` | `**/test/**/*.ts`, `**/test/**/*.js`, `**/__tests__/**/*.ts`, `**/*.spec.ts`, `**/*.test.ts` | Yes | Mocha, Chai test patterns and test structure |
| `oclif-commands.mdc` | `**/commands/**/*.ts`, `**/base-command.ts` | No | OCLIF command patterns and CLI validation |
| `contentstack-plugin.mdc` | `packages/contentstack-*/src/**/*.ts`, `packages/contentstack-*/src/**/*.js` | No | CLI plugin package patterns, commands, services, and inter-plugin dependencies |

## Commands

| File | Trigger | Purpose |
|------|---------|---------|
| `execute-tests.md` | `/execute-tests` | Run tests by scope, package, or module with monorepo awareness |
| `code-review.md` | `/code-review` | Automated PR review with CLI-specific checklist |

## Loading Behaviour

### File Type Mapping
- **TypeScript files** → `typescript.mdc` + `dev-workflow.md`
- **Command files** (`packages/*/src/commands/**/*.ts`) → `oclif-commands.mdc` + `typescript.mdc` + `dev-workflow.md`
- **Base command files** (`packages/*/src/base-command.ts`, `packages/*/*base-command.ts`) → `oclif-commands.mdc` + `typescript.mdc` + `dev-workflow.md`
- **Plugin package files** (`packages/contentstack-*/src/**/*.ts`) → `contentstack-plugin.mdc` + `typescript.mdc` + `dev-workflow.md`
- **Test files** (`packages/*/test/**/*.{ts,js}`) → `testing.mdc` + `dev-workflow.md`
- **Utility files** (`packages/*/src/utils/**/*.ts`) → `typescript.mdc` + `dev-workflow.md`

### Package-Specific Loading
- **Plugin packages** (with `oclif.commands`) → Full command and utility rules
- **Library packages** → TypeScript and utility rules only

## Repository-Specific Features

### Monorepo Structure

This is a **CLI plugins** monorepo with 12 plugin packages under `packages/`:
- `contentstack-audit` - Stack audit and fix operations
- `contentstack-bootstrap` - Seed/bootstrap stacks with content
- `contentstack-branches` - Git-based branch management for stacks
- `contentstack-bulk-publish` - Bulk publish operations for entries/assets
- `contentstack-clone` - Clone/duplicate stacks
- `contentstack-export` - Export stack content to filesystem
- `contentstack-export-to-csv` - Export stack data to CSV format
- `contentstack-import` - Import content into stacks
- `contentstack-import-setup` - Setup and validation for imports
- `contentstack-migration` - Content migration workflows
- `contentstack-seed` - Seed stacks with generated data
- `contentstack-variants` - Manage content variants

All plugins depend on:
- `@contentstack/cli-command` - Base Command class
- `@contentstack/cli-utilities` - Shared utilities and helpers
- Optionally on each other (e.g., `contentstack-import` depends on `@contentstack/cli-audit`)

### Build Configuration
- **pnpm workspaces** configuration (all 12 plugins under `packages/`)
- **Shared dependencies**: Each plugin depends on `@contentstack/cli-command` and `@contentstack/cli-utilities`
- **Inter-plugin dependencies**: Some plugins depend on others (e.g., import → audit)
- **Build process**: TypeScript compilation → `lib/` directories
- **OCLIF manifest** generation per plugin for command discovery

### Actual Patterns Detected
- **Testing**: Mocha + Chai (consistent across all plugins)
- **TypeScript**: Strict mode for type safety
- **Commands**: Extend `@contentstack/cli-command` Command class with plugin-specific base-commands
- **Topics**: All commands under `cm:` topic (content management)
- **Services/Modules**: Domain-specific business logic organized by concern
- **Build artifacts**: `lib/` directories (excluded from rules)

## Performance Benefits

- **Lightweight loading** - Only relevant rules activate based on file patterns
- **Precise glob patterns** - Avoid loading rules for build artifacts
- **Context-aware** - Rules load based on actual file structure

## Design Principles

### Validated Against Codebase
- Rules reflect **actual patterns** found in repository
- Glob patterns match **real file structure**
- Examples use **actual dependencies** and APIs

### Lightweight and Focused
- Each rule has **single responsibility**
- Package-specific variations acknowledged
- `alwaysApply: true` only for truly universal patterns

## Quick Reference

For detailed patterns:
- **Testing**: See `testing.mdc` for Mocha/Chai test structure
- **Commands**: See `oclif-commands.mdc` for command development
- **Plugins**: See `contentstack-plugin.mdc` for plugin architecture and patterns
- **Development**: See `dev-workflow.md` for TDD and monorepo workflow
- **TypeScript**: See `typescript.mdc` for type safety patterns
