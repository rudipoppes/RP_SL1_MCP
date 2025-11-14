# Software Development Standards

## Core Principles

### 1. No Hacking - Only Engineering
- **Never rush into implementation** without understanding requirements
- **Always plan before coding** - design, structure, then implement
- **Refactor constantly** - clean code is maintainable code
- **Test early, test often** - TDD approach when possible
- **Code reviews matter** - every change should be reviewable
- **Architect for the future** - always consider the future, am I maintainable, upgradable, extensible
- **STAY ON TASK** - Only implement what was explicitly requested
- **DO NOT OVER-ENGINEER** - Simple solutions are preferred unless complexity is justified
- **NEVER GO OFF-TRACK** - Stick to the specific requirements given

### 2. Requirements First
- Understand the problem completely before writing any code
- Ask clarifying questions when requirements are ambiguous
- Document assumptions and get confirmation
- Define success criteria before starting
- **REQUIREMENTS ARE SACRED** - Never deviate from what was explicitly asked
- **SCOPE CREEP IS FORBIDDEN** - Do not add features or functionality that wasn't requested

### 3. Design Matters
- Think about scalability, maintainability, and extensibility
- Choose appropriate data structures and algorithms
- Consider error handling and edge cases upfront
- Follow SOLID principles

## Code Quality Standards

### Readability
- **Self-documenting code** - the code should explain itself
- **Consistent naming conventions** - be predictable
- **Meaningful variable and function names**
- **Avoid clever tricks** - clarity over cleverness
- **Keep functions small** - single responsibility principle

### Structure
- **Modular design** - separate concerns
- **Dependency injection** - avoid tight coupling
- **Interface segregation** - small, focused interfaces
- **Don't repeat yourself** - DRY principle
- **Composition over inheritance**

### Error Handling
- **Handle errors gracefully** - never let exceptions crash
- **Log appropriately** - debug info, warnings, errors using Logger class
- **Validate inputs** - fail fast, fail clearly
- **Provide meaningful error messages**
- **Clean up resources** - proper disposal
- **Never use console.log** in production code - always use proper logging with context

## Testing Standards

### Test Coverage
- **Unit tests** for all business logic
- **Integration tests** for component interactions
- **End-to-end tests** for critical user flows
- **Edge cases** must be tested
- **Performance tests** for bottlenecks

### Testing Practices
- **Test-driven development** when possible
- **Arrange, Act, Assert** pattern
- **Independent tests** - no test dependencies
- **Fast feedback** - tests should run quickly
- **Maintainable tests** - treat test code as production code

## Security Standards

### Input Validation
- **Never trust user input**
- **Sanitize all data** coming from external sources
- **Validate types, ranges, and formats**
- **Prevent injection attacks** (SQL, XSS, etc.)
- **Implement rate limiting**

### Data Protection
- **Never commit secrets** (API keys, passwords, tokens)
- **Use environment variables** for configuration
- **Encrypt sensitive data** at rest and in transit
- **Principle of least privilege**
- **Audit sensitive operations**

## Performance Standards

### Efficiency
- **Choose the right algorithm** for the problem
- **Avoid premature optimization** but avoid premature de-optimization
- **Measure before optimizing** - use profiling tools
- **Consider memory usage** - prevent leaks and excessive allocation
- **Cache strategically** - don't over-cache

### Scalability
- **Design for growth** - horizontal and vertical scaling
- **Database optimization** - proper indexing and queries
- **Asynchronous operations** for long-running tasks
- **Load testing** before deployment
- **Monitoring and alerting** for production issues

## Development Workflow

### Code Reviews
- **Every PR must be reviewed** - no exceptions
- **Review for functionality, readability, and performance**
- **Check for security vulnerabilities**
- **Ensure tests pass and coverage is adequate**
- **Document changes clearly**

### Version Control
- **Atomic commits** - one logical change per commit
- **Clear commit messages** - what and why, not just what
- **Feature branches** - never work directly on main
- **Pull requests** for all changes
- **Regular merges** - avoid long-lived branches

### Documentation
- **Code should be self-documenting** when possible
- **Document complex algorithms and business rules**
- **API documentation** must be comprehensive
- **README files** for setup and usage
- **Architectural decisions** should be recorded

## Language-Specific Best Practices

### Python
- Follow **PEP 8** style guide strictly
- Use **type hints** for better code documentation
- Prefer **list comprehensions** over map/filter
- Use **context managers** for resource management
- **Virtual environments** for dependency isolation

### JavaScript/React
- **ESLint and Prettier** for consistent formatting
- **Functional components** with hooks over classes
- **Props validation** with PropTypes or TypeScript
- **Avoid mutable state** - use immutable patterns
- **Performance optimization** with memoization

### General
- **Consistent code style** across the project
- **Avoid global variables** and mutable global state
- **Error boundaries** for graceful degradation
- **Logging** for debugging and monitoring
- **Configuration management** for different environments

## Before Writing Code Checklist

- [ ] Do I fully understand the requirements?
- [ ] Have I considered edge cases and error conditions?
- [ ] Is there existing code I can reuse or extend?
- [ ] What tests do I need to write?
- [ ] How will this impact performance and security?
- [ ] Is this following project conventions and patterns?
- [ ] Have I planned the implementation approach?
- [ ] Do I need to recommend a new git branch?
- [ ] If a new Branch recommended, ask user for permission and make sure git is in a stable state.
- [ ] **STAY ON TRACK** - Only implement what was requested, do not go off-task
- [ ] **NO HACKING** - Follow engineering principles, never rush into implementation

## Code Review Checklist

- [ ] Does the code solve the intended problem?
- [ ] Is the code readable and maintainable?
- [ ] Are there any security vulnerabilities?
- [ ] Are tests comprehensive and passing?
- [ ] Is error handling appropriate?
- [ ] Does it follow project coding standards?
- [ ] Is documentation clear and accurate?
- [ ] Do I need to rebuild / restart frontend and/or backend?

## Post-Development Testing Requirements

### **MANDATORY: Run Tests After All Code Changes**
- [ ] **Run unit tests**: `npm run test -- --forceExit`
- [ ] **All 41 tests must pass** (4/4 test suites)
- [ ] **Fix any test failures** before considering work complete
- [ ] **Add new tests** for any new functionality added
- [ ] **Update existing tests** if behavior changes

### **Why Testing Is Required:**
- **Prevents regressions** - ensures new code doesn't break existing functionality
- **Validates implementation** - proves your code actually works as intended
- **Quality assurance** - maintains 41 passing tests baseline
- **Professional standards** - follows industry best practices

### **Test Execution Results:**
- **Expected**: `Test Suites: 4 passed, 4 total` and `Tests: 41 passed, 41 total`
- **Failure**: Fix failing tests before work is considered complete
- **New functionality**: Add corresponding tests to maintain coverage

**NOTE: Code changes without passing tests are NOT considered complete work.**

## Remember
> "Perfection is achieved not when there is nothing more to add, but rather when there is nothing left to take away." - Antoine de Saint-Exupéry

**Quality code is an investment that pays continuous dividends.**