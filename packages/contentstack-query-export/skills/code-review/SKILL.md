---
name: code-review
description: PR review checklist for this repo and similar CLI plugins. Use when reviewing changes to export-query, core, or utils.
---

# Code Review Skill

Use the **Quick checklist template** for a short PR paste. Numbered sections **1**–**7** and **Review checklist summary** below are the full deep review for **`@contentstack/cli-cm-export-query`** and related CLI work.

## Quick checklist template

```markdown
## Security Review
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] Error handling secure

## Correctness Review  
- [ ] Logic correctly implemented
- [ ] Edge cases handled
- [ ] Error scenarios covered

## Architecture Review
- [ ] Proper code organization
- [ ] Design patterns followed
- [ ] Good modularity

## Performance Review
- [ ] Efficient implementation
- [ ] Resource management
- [ ] Appropriate concurrency

## Testing Review
- [ ] Adequate tests for behavior changed
- [ ] Quality tests
- [ ] Test-first used where practical for new behavior

## Code Conventions
- [ ] TypeScript standards
- [ ] Code style consistent
- [ ] Documentation adequate
```

## 1. Security Review

### Authentication & Authorization
- [ ] No hardcoded API keys, tokens, or credentials
- [ ] Sensitive data not logged to console or files
- [ ] Proper token validation and expiration handling
- [ ] Environment variables used for secrets

### Input Validation
- [ ] All user inputs validated and sanitized
- [ ] Command flags properly validated
- [ ] File paths sanitized to prevent directory traversal
- [ ] API responses validated before processing

### Error Handling
- [ ] Errors don't expose sensitive information
- [ ] Stack traces filtered in production
- [ ] Proper error logging without secrets

## 2. Correctness Review

### Logic Validation
- [ ] Business logic correctly implemented
- [ ] Edge cases handled appropriately
- [ ] Null/undefined checks in place
- [ ] Async operations properly awaited

### Error Scenarios
- [ ] Network failures handled gracefully
- [ ] Rate limiting respected and handled
- [ ] Partial failures in batch operations managed
- [ ] Retry logic implemented correctly

### Data Integrity
- [ ] Data transformations are reversible where needed
- [ ] Batch operations maintain consistency
- [ ] Rollback mechanisms for critical operations
- [ ] Proper validation before destructive operations

## 3. Architecture Review

### Code Organization
- [ ] Proper separation of concerns (Commands → Services → Utils)
- [ ] Single responsibility principle followed
- [ ] Dependencies injected, not hardcoded
- [ ] Interfaces used for abstractions

### Design Patterns
- [ ] Consistent error handling patterns
- [ ] Proper use of async/await
- [ ] Service layer properly abstracted
- [ ] Configuration management centralized

### Modularity
- [ ] Functions are focused and testable
- [ ] Classes have clear responsibilities
- [ ] Modules are loosely coupled
- [ ] Common functionality extracted to utilities

## 4. Performance Review

### Efficiency
- [ ] Unnecessary API calls eliminated
- [ ] Export/query work batched or paginated where the Management API requires it
- [ ] Proper pagination implemented when listing large result sets
- [ ] Rate limiting respected

### Resource Management
- [ ] Memory usage optimized for large datasets
- [ ] File handles properly closed
- [ ] Network connections cleaned up
- [ ] No memory leaks in long-running operations

### Concurrency
- [ ] Appropriate concurrency limits set
- [ ] Race conditions avoided
- [ ] Deadlocks prevented
- [ ] Resource contention minimized

## 5. Testing Review

### Test Coverage
- [ ] All new/modified code has tests
- [ ] Both success and failure paths tested
- [ ] Edge cases covered
- [ ] Integration tests for complex workflows

### Test Quality
- [ ] Tests are focused and readable
- [ ] Proper mocking of external dependencies
- [ ] No real API calls in tests
- [ ] Test data is realistic and maintainable

### TDD / test discipline
- [ ] New behavior covered by tests where practical (test-first preferred, not mandatory for refactors/docs)
- [ ] Tests fail appropriately when code is broken
- [ ] Tests are independent and can run in any order
- [ ] No test.skip or .only in committed code

## 6. CLI-Specific Review

### OCLIF Command Structure
- [ ] Extends appropriate base command class
- [ ] Proper flag definitions with validation
- [ ] Clear command description and examples
- [ ] Appropriate error handling with user-friendly messages

### User Experience
- [ ] Progress indicators for long operations
- [ ] Clear success/failure messaging
- [ ] Proper use of colors and formatting
- [ ] Confirmation prompts for destructive actions

### Command patterns
- [ ] Input validation before processing
- [ ] Heavy logic delegated to `src/core/` and `src/utils/` (not the command class)
- [ ] Proper logging for debugging
- [ ] Graceful handling of interruptions

## 7. Contentstack Integration Review

### API Usage
- [ ] Proper authentication using CLI utilities
- [ ] Rate limiting respected (10 req/sec for Management API)
- [ ] Appropriate error handling for API-specific errors
- [ ] Retry logic for transient failures

### Query export behavior
- [ ] Query parsing and flags behave as documented
- [ ] Dependency / reference / asset handling respects `skip-*` flags
- [ ] Failures surface clearly to the user (no silent drops)
- [ ] Logging useful for support without leaking secrets

### Environment Management
- [ ] Environment validation before operations
- [ ] Cross-environment operations handled safely
- [ ] Proper handling of environment-specific configurations
- [ ] Content type validation

## Review Checklist Summary

### Before Approving
- [ ] All critical issues resolved
- [ ] Tests pass; coverage reasonable for the change (~80% repo-wide is aspirational)
- [ ] Security concerns addressed
- [ ] Performance implications considered
- [ ] Documentation updated if needed
- [ ] Breaking changes properly communicated

### Review Quality
- [ ] Code thoroughly examined, not just skimmed
- [ ] Constructive feedback provided
- [ ] Questions asked for unclear implementations
- [ ] Best practices enforced consistently
- [ ] Knowledge shared through comments

### Post-Review
- [ ] Appropriate merge strategy selected
- [ ] Deployment considerations discussed
- [ ] Team notified of significant changes
- [ ] Follow-up tasks created if needed