---
name: testing
description: Mocha/Chai/Sinon testing and TDD for @contentstack/cli-cm-export-query. Use when writing or debugging tests in test/unit/ or adjusting coverage.
---

# Testing Patterns

Testing best practices and TDD workflow for **`@contentstack/cli-cm-export-query`**.

**RED → GREEN → REFACTOR** for behavior changes; pure refactors / docs-only may skip new tests when behavior is unchanged.

## Test Structure Standards

### Basic Test Template
```typescript
describe('[ComponentName]', () => {
  beforeEach(() => {
    // Setup mocks and test data
    sinon.stub(ExternalService.prototype, 'method').resolves(mockData);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should [expected behavior] when [condition]', () => {
    // Arrange
    const input = { /* test data */ };
    
    // Act
    const result = component.method(input);
    
    // Assert
    expect(result).to.equal(expectedOutput);
  });
});
```

### Command testing example
```typescript
describe('ExportQueryCommand', () => {
  beforeEach(() => {
    sinon.stub(ContentstackClient.prototype, 'stack').returns(mockStack);
  });

  it('should run export when query and auth are valid', async () => {
    // Stub parse, setupQueryExportConfig, QueryExporter.prototype.execute, etc.
  });
});
```

## Key Testing Rules

### Coverage
- **~80%** (lines, branches, functions) is **aspirational**, not a hard gate
- Test both success and failure paths
- Include edge cases and error scenarios

### Mocking Standards
- **Use sinon** for API responses and external dependencies
- **Never make real API calls** in tests
- **Mock at module boundaries** (SDK, `fsUtil`), not irrelevant internals
- Restore mocks in `afterEach()` to prevent test pollution

### Test Patterns
- Use descriptive test names: "should [behavior] when [condition]"
- Keep test setup minimal and focused
- Prefer synchronous patterns when possible
- Group related tests in `describe` blocks

## Common Mock Patterns

### API Mocking
```typescript
// Mock Contentstack API
sinon.stub(ContentstackClient.prototype, 'fetch').resolves(mockData);

// Mock with specific responses
sinon.stub(client, 'getEntry')
  .withArgs('entry1').resolves(mockEntry1)
  .withArgs('entry2').resolves(mockEntry2);
```

### Service Mocking
```typescript
// Mock rate limiter
sinon.stub(RateLimiter.prototype, 'wait').resolves();

// Mock file operations
sinon.stub(fsUtil, 'writeFile').returns(true);
sinon.stub(fsUtil, 'readFile').resolves(JSON.stringify(mockData));
```

### Error Simulation
```typescript
// Mock API errors
const apiError = new Error('API Error');
apiError.status = 500;
sinon.stub(client, 'fetch').rejects(apiError);

// Mock rate limiting
const rateLimitError = new Error('Rate limited');
rateLimitError.status = 429;
sinon.stub(client, 'fetch').rejects(rateLimitError);
```

## Error Testing Patterns

### Rate Limit Handling
```typescript
it('should handle rate limit errors', () => {
  const error = new Error('Rate limited');
  error.status = 429;
  
  sinon.stub(client, 'fetch').rejects(error);
  
  expect(service.performOperation()).to.eventually.be.fulfilled;
});
```

### Validation Error Testing
```typescript
it('should throw validation error for invalid input', () => {
  const invalidInput = { /* invalid data */ };
  
  expect(() => service.validate(invalidInput))
    .to.throw('Validation failed');
});
```

### Async Error Handling
```typescript
it('should handle async operation failures', async () => {
  sinon.stub(service, 'performAsync').rejects(new Error('Operation failed'));
  
  try {
    await service.execute();
    expect.fail('Should have thrown error');
  } catch (error) {
    expect(error.message).to.include('Operation failed');
  }
});
```

## Test Organization

### File Structure
- Mirror modules under `test/unit/`: e.g. `test/unit/query-executor.test.ts`, `test/unit/query-parser-simple.test.ts`
- Use consistent naming: `[module-name].test.ts`
- Group integration tests: `test/integration/`

### Test Data Management
- Create mock data factories: `test/fixtures/mock-factory.ts`
- Use realistic test data that matches API responses
- Share common mocks across test files

### Test Configuration
```javascript
// .mocharc.json
{
  "require": ["ts-node/register"],
  "extensions": ["ts"],
  "spec": "test/**/*.test.ts",
  "timeout": 5000,
  "forbid-only": true
}
```

## Coverage and Quality

### Coverage Enforcement
```json
// package.json nyc configuration
"nyc": {
  "check-coverage": true,
  "lines": 80,
  "functions": 80,
  "branches": 80,
  "statements": 80
}
```

### Quality Checklist
- [ ] All public methods tested
- [ ] Error paths covered
- [ ] Edge cases included
- [ ] Mocks properly restored
- [ ] No real API calls
- [ ] Descriptive test names
- [ ] Minimal test setup
- [ ] Fast execution (< 5s per test)

## Development workflow

### TDD workflow (recommended)

For **new behavior or bug fixes**, prefer:

1. **RED** → Failing test (or extended test)
2. **GREEN** → Minimal code to pass
3. **REFACTOR** → Improve while tests stay green

**Exceptions:** pure refactors, documentation-only edits, and trivial non-behavior changes may skip new tests.

## Guidelines

- Prefer **clear tests** over async-heavy setup when you can
- **NO test.skip or .only** in commits
- **~80% coverage** (lines, branches, functions) is **aspirational**, not a CI gate
- **TypeScript** — explicit return types where practical; avoid `any`

## File structure (this repo)

- **Commands**: `src/commands/cm/stacks/`
- **Core**: `src/core/` (`QueryExporter`, `ModuleExporter`, …)
- **Utils**: `src/utils/`
- **Tests**: `test/unit/` — `*.test.ts` per module (e.g. `query-executor.test.ts`)

## Naming conventions

- **Files**: `kebab-case.ts` / `kebab-case.test.ts`
- **Classes**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Test descriptions**: "should [behavior] when [condition]"

## Code quality standards

### TypeScript
- Explicit return types for all functions
- No `any` type usage
- Strict null checks enabled
- No unused variables or imports

### Error handling
- Use custom error classes where the codebase already does
- Include error context and cause
- Never swallow errors silently

### Import organization
1. Node.js built-ins
2. External libraries
3. Internal modules (relative imports last)

## Testing

### Coverage
- Aim high; **~80%** is a guideline
- Test success and failure paths for behavior you touch
- Mock external dependencies (SDK, `fsUtil`, etc.)

### Test structure
```typescript
describe('[ComponentName]', () => {
  beforeEach(() => {
    sinon.stub(ExternalService.prototype, 'method').resolves(mockData);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should [expected behavior] when [condition]', () => {
    const input = { /* test data */ };
    const result = component.method(input);
    expect(result).to.equal(expectedOutput);
  });
});
```

### Mocking standards
- Use sinon for API response mocking
- Never make real API calls in tests
- Mock at module boundaries (SDK, `fsUtil`, etc.), not irrelevant internals

## Commit suggestions

- Conventional commits are optional: `feat(scope): description`
- Include tests when you change behavior
- Run lint and tests before pushing
- No debugging code (`console.log`, `debugger`) left in

## Development process

1. **Understand** → Read relevant patterns before coding
2. **Plan** → Break down into testable units
3. **Test first** → When adding behavior, prefer failing test then implementation
4. **Validate** → `npm run lint`, `npm run test`, `npm run test:report` if you need LCOV
5. **Review** → Self-review against the code review checklist
