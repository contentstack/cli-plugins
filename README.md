# Contentstack CLI - Plugin Packages

This repository contains business functionality plugins for the Contentstack CLI, including export, import, clone, audit, and variants functionality.

## Packages

- **@contentstack/cli-cm-export** - Content export functionality
- **@contentstack/cli-cm-import** - Content import functionality
- **@contentstack/cli-cm-clone** - Stack cloning functionality
- **@contentstack/cli-audit** - Content auditing functionality
- **@contentstack/cli-variants** - Variants management

## Development Setup

### Standalone Development (Within this repo only)

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Clean build artifacts
pnpm clean
```

### Cross-Repository Development (With cli-core)

For local development with the `cli-core` repository, you should work from the parent workspace:

```bash
# Navigate to parent workspace
cd ..

# Install all dependencies (links both repos)
pnpm install

# Build all packages
pnpm build:all

# Test a plugin directly
pnpm dev:export cm:stacks:export --help
pnpm dev:import cm:stacks:import --help

# Or test through the main CLI
pnpm dev:cli cm:stacks:export --help
```

See the [parent workspace README](../README.md) for more details on cross-repository development.

## Project Structure

```
cli-plugins/
├── packages/
│   ├── contentstack-export/    # Export functionality
│   ├── contentstack-import/    # Import functionality
│   ├── contentstack-clone/     # Clone functionality
│   ├── contentstack-audit/     # Audit functionality
│   └── contentstack-variants/  # Variants functionality
├── scripts/
│   └── prepare-publish.js      # Publishing helper
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Making Changes

1. Make your changes in the relevant package under `packages/`
2. Build the package: `cd packages/[package-name] && pnpm build`
3. Test your changes:
   - Direct test: `./bin/run.js [command]`
   - Through main CLI: Test from parent workspace
4. If you need to modify core dependencies, work from the parent workspace

## Testing Plugins

### Test a Plugin Directly

```bash
cd packages/contentstack-export
pnpm build
./bin/run.js cm:stacks:export --help
```

### Test Through Main CLI

From the parent workspace:

```bash
cd ..
pnpm dev:cli cm:stacks:export --help
```

This tests the plugin as it would be used in production.

## Publishing

Before publishing, workspace protocol dependencies need to be resolved to actual versions:

```bash
# Prepare packages for publishing (converts workspace:* to actual versions)
pnpm prepare-publish

# Publish all packages
pnpm publish:packages

# After publishing, restore workspace protocol
git restore packages/*/package.json
```

## Git Workflow

This repository is independent of the `cli-core` repository. Commit and push changes normally:

```bash
git add .
git commit -m "feat: your changes"
git push
```

## Dependencies

### Core Dependencies

Plugin packages depend on core packages from the `cli-core` repository:

- `@contentstack/cli-command` - Base command framework
- `@contentstack/cli-utilities` - Shared utilities
- `@contentstack/cli-auth` - Authentication (dev dependency)
- `@contentstack/cli-config` - Configuration (dev dependency)

### Local Development

When developing locally with the parent workspace, these dependencies are automatically linked using the `workspace:*` protocol.

### Published Versions

When published to npm, workspace protocol is replaced with specific version ranges (e.g., `~1.7.1`).

## CI/CD

Each package in this repository can be published independently or as a batch. The publishing workflow:

1. Ensure cli-core packages are published first (if they have changes)
2. Update plugin package versions as needed
3. Run `pnpm prepare-publish` to resolve workspace dependencies
4. Run `pnpm publish -r` to publish all packages
5. Restore workspace protocol with `git restore packages/*/package.json`

## License

MIT
