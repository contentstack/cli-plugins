---
name: code-review
description: Automated PR review using comprehensive checklist tailored for modularized Contentstack CLI
---

# Code Review Command

## Usage Patterns

### Scope-Based Reviews
- `/code-review` - Review all current changes with full checklist
- `/code-review --scope typescript` - Focus on TypeScript configuration and patterns
- `/code-review --scope testing` - Focus on Mocha/Chai test patterns
- `/code-review --scope oclif` - Focus on command structure and OCLIF patterns
- `/code-review --scope packages` - Focus on package structure and organization

### Severity Filtering
- `/code-review --severity critical` - Show only critical issues (security, breaking changes)
- `/code-review --severity high` - Show high and critical issues
- `/code-review --severity all` - Show all issues including suggestions

### Package-Aware Reviews
- `/code-review --package contentstack-import` - Review changes in import package
- `/code-review --package contentstack-export` - Review changes in export package
- `/code-review --package-type plugin` - Review all plugin packages (all 11 packages are plugins)
- `/code-review --package-scope cm` - Review CM (content management) related packages

### File Type Focus
- `/code-review --files commands` - Review command files only
- `/code-review --files tests` - Review test files only
- `/code-review --files utils` - Review utility files

## Comprehensive Review Checklist

### Monorepo Structure Compliance
- **Package organization**: 11 plugin packages under `packages/contentstack-*`
- **pnpm workspace**: Correct `pnpm-workspace.yaml` configuration
- **Build artifacts**: No `lib/` directories committed to version control
- **Dependencies**: Proper use of shared utilities (`@contentstack/cli-command`, `@contentstack/cli-utilities`)
- **Scripts**: Consistent build, test, and lint scripts across packages

### Package-Specific Structure
- **All packages are plugins**: Each has `oclif.commands` configuration pointing to `./lib/commands`
- **Plugin topics**: All commands under `cm:` topic (content management)
- **Base commands**: Each plugin defines its own `BaseCommand` extending `@contentstack/cli-command` Command
- **Inter-plugin dependencies**: Some plugins depend on others (e.g., import depends on audit)
- **Dependency versions**: Using consistent versions across plugins

### TypeScript Standards
- **Configuration compliance**: Follows package TypeScript config (`strict: false`, `target: es2017`)
- **Naming conventions**: kebab-case files, PascalCase classes, camelCase functions
- **Import patterns**: ES modules with proper default/named exports
- **Type safety**: No unnecessary `any` types in production code

### OCLIF Command Patterns
- **Base class usage**: Extends plugin-specific `BaseCommand` or `@contentstack/cli-command` Command
- **Command structure**: Proper `static id`, `static description`, `static examples`, `static flags`
- **Topic organization**: Uses `cm:stacks:*` structure (`cm:stacks:import`, `cm:stacks:export`, `cm:stacks:audit`)
- **Error handling**: Uses `handleAndLogError` from utilities with context
- **Flag validation**: Early validation and user-friendly error messages
- **Service delegation**: Commands are thin, services handle business logic

### Testing Excellence (Mocha/Chai Stack)
- **Framework compliance**: Uses Mocha + Chai (not Jest)
- **File patterns**: Follows `*.test.ts` naming convention
- **Directory structure**: Proper placement in `test/unit/`
- **Test organization**: Arrange-Act-Assert pattern consistently used
- **Isolation**: Proper setup/teardown with beforeEach/afterEach
- **No real API calls**: All external dependencies properly mocked

### Error Handling Standards
- **Consistent patterns**: Use `handleAndLogError` from utilities
- **User-friendly messages**: Clear error descriptions for end users
- **Logging**: Proper use of `log.debug` for diagnostic information
- **Status messages**: Use `cliux` for user feedback (success, error, info)

### Build and Compilation
- **TypeScript compilation**: Clean compilation with no errors
- **OCLIF manifest**: Generated for command discovery
- **README generation**: Commands documented in package README
- **Source maps**: Properly configured for debugging
- **No build artifacts in commit**: `.gitignore` excludes `lib/` directories

### Testing Coverage
- **Test structure**: Tests in `test/unit/` with descriptive names
- **Command testing**: Uses @oclif/test for command validation
- **Error scenarios**: Tests for both success and failure paths
- **Mocking**: All dependencies properly mocked

### Package.json Compliance
- **Correct metadata**: name, description, version, author
- **Script definitions**: build, compile, test, lint scripts present
- **Dependencies**: Correct versions of shared packages
- **Main/types**: Properly configured for library packages
- **OCLIF config**: Present for plugin packages

### Security and Best Practices
- **No secrets**: No API keys or tokens in code or tests
- **Input validation**: Proper validation of user inputs and flags
- **Process management**: Appropriate use of error codes
- **File operations**: Safe handling of file system operations

### Code Quality
- **Naming consistency**: Follow established conventions
- **Comments**: Only for non-obvious logic (no "narration" comments)
- **Error messages**: Clear, actionable messages for users
- **Module organization**: Proper separation of concerns

## Review Execution

### Automated Checks
1. **Lint compliance**: ESLint checks for code style
2. **TypeScript compiler**: Successful compilation to `lib/` directories
3. **Test execution**: All tests pass successfully
4. **Build verification**: Build scripts complete without errors

### Manual Review Focus Areas
1. **Command usability**: Clear help text and realistic examples
2. **Error handling**: Appropriate error messages and recovery options
3. **Test quality**: Comprehensive test coverage for critical paths
4. **Monorepo consistency**: Consistent patterns across all packages
5. **Flag design**: Intuitive flag names and combinations

### Common Issues to Flag
- **Inconsistent TypeScript settings**: Mixed strict mode without reason
- **Real API calls in tests**: Unmocked external dependencies
- **Missing error handling**: Commands that fail silently
- **Poor test organization**: Tests without clear Arrange-Act-Assert
- **Build artifacts committed**: `lib/` directories in version control
- **Unclear error messages**: Non-actionable error descriptions
- **Inconsistent flag naming**: Similar flags with different names
- **Missing command examples**: Examples not showing actual usage

## Repository-Specific Checklist

### For Modularized CLI
- [ ] Command properly extends `@contentstack/cli-command` Command
- [ ] Flags defined with proper types from `@contentstack/cli-utilities`
- [ ] Error handling uses `handleAndLogError` utility
- [ ] User feedback uses `cliux` utilities
- [ ] Tests use Mocha + Chai pattern with mocked dependencies
- [ ] Package.json has correct scripts (build, compile, test, lint)
- [ ] TypeScript compiles with no errors
- [ ] Tests pass: `pnpm test`
- [ ] No `.only` or `.skip` in test files
- [ ] Build succeeds: `pnpm run build`
- [ ] OCLIF manifest generated successfully

### Before Merge
- [ ] All review items addressed
- [ ] No build artifacts in commit
- [ ] Tests added for new functionality
- [ ] Documentation updated if needed
- [ ] No console.log() statements (use log.debug instead)
- [ ] Error messages are user-friendly
- [ ] No secrets or credentials in code
