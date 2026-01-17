# Testr Test Suite Documentation

This document describes the test coverage for Testr and maps tests to the architectural components documented in [concepts.md](file:///c:/Users/jhonb/Documents/VS%20Code%20extension/Testr/docs/concepts.md) and [test-orchestrator.md](file:///c:/Users/jhonb/Documents/VS%20Code%20extension/Testr/docs/test-orchestrator.md).

---

## Overview

The test suite validates the core components of Testr's three-layer architecture:

| Layer | Components | Test Coverage |
|-------|------------|---------------|
| Orchestration | AdapterRegistry | ✅ 9 tests |
| Adapter | JestParser, JestRunner | ✅ 27 tests |
| Types & Config | Types, Constants | ✅ 26 tests |

**Total: 62 tests across 5 test suites**

---

## Architecture Alignment

### 1. The Adapter Pattern (concepts.md §3)

> *"An adapter is a translator that knows both languages. It implements a standard interface that Testr understands."*

**Tested Components:**

| Component | Tests | Documentation Reference |
|-----------|-------|-------------------------|
| `AdapterRegistry.registerAdapter` | Registration and retrieval | concepts.md §4: Registry Pattern |
| `AdapterRegistry.getAdapter` | Returns correct adapter by framework | concepts.md §4: Registry Pattern |
| `AdapterRegistry.detectFramework` | First matching adapter wins | concepts.md §4: Registry Pattern |

**Test File:** [AdapterRegistry.test.ts](file:///c:/Users/jhonb/Documents/VS%20Code%20extension/Testr/src/adapters/AdapterRegistry.test.ts)

---

### 2. Discovery Phase (test-orchestrator.md §Phase 1)

> *"Parse Files: The parser extracts test structure using regex."*

**Tested Components:**

| Component | Tests | Documentation Reference |
|-----------|-------|-------------------------|
| `JestParser.parseTestFile` | Parses describe/it blocks | test-orchestrator.md: Step 4 |
| Quote style handling | Single, double, backtick quotes | test-orchestrator.md: Line 131-134 |
| Modifier support | `.only`, `.skip` variations | Jest-specific feature |
| Line/column numbers | Location tracking | test-orchestrator.md: Build Tree |

**Test File:** [JestParser.test.ts](file:///c:/Users/jhonb/Documents/VS%20Code%20extension/Testr/src/adapters/jest/JestParser.test.ts)

---

### 3. Execution Phase (test-orchestrator.md §Phase 2)

> *"Build Patterns: Convert TestItem IDs to test name patterns"*

**Tested Components:**

| Component | Tests | Documentation Reference |
|-----------|-------|-------------------------|
| `JestRunner.buildTestPatterns` | ID splitting, pattern extraction | test-orchestrator.md: Step 3 |
| `JestRunner.buildJestArgs` | `--json`, `--testNamePattern` | test-orchestrator.md: Step 4 |
| `JestRunner.parseJestOutput` | JSON to TestExecutionResult | test-orchestrator.md: Step 6 |
| `JestRunner.buildTestId` | File + ancestors + title → ID | test-orchestrator.md: §Reporting |
| `JestRunner.mapJestStatus` | Jest status to TestStatus enum | test-orchestrator.md: Step 6 |

**Test File:** [JestRunner.test.ts](file:///c:/Users/jhonb/Documents/VS%20Code%20extension/Testr/src/adapters/jest/JestRunner.test.ts)

---

### 4. Type Guards and Enums (concepts.md §2)

> *"Each TestItem has: ID, Label, URI, Range, Children"*

**Tested Components:**

| Component | Tests | Documentation Reference |
|-----------|-------|-------------------------|
| `isTestSuite` | Distinguishes suites from tests | concepts.md: TestItem Hierarchy |
| `TestFramework` enum | Jest, Vitest, Mocha | concepts.md: Multi-framework vision |
| `TestStatus` enum | Pending, Running, Passed, Failed, Skipped | test-orchestrator.md: Reporting |

**Test File:** [index.test.ts](file:///c:/Users/jhonb/Documents/VS%20Code%20extension/Testr/src/types/index.test.ts)

---

### 5. Configuration Constants (test-orchestrator.md §Discovery)

> *"For Jest, detection checks: `jest` in dependencies, `jest.config.js` existence"*

**Tested Components:**

| Component | Tests | Documentation Reference |
|-----------|-------|-------------------------|
| `JEST_CONFIG_FILES` | 5 config file patterns | test-orchestrator.md: Step 2 |
| `JEST_TEST_PATTERNS` | 8 test file patterns | test-orchestrator.md: Step 3 |
| `JEST_BIN_PATHS` | Unix, Windows, fallback | test-orchestrator.md: Spawn Process |
| `JEST_CLI_ARGS` | `--json`, `--testNamePattern` | test-orchestrator.md: Step 4 |

**Test File:** [jest-config.test.ts](file:///c:/Users/jhonb/Documents/VS%20Code%20extension/Testr/src/config/jest-config.test.ts)

---

## Current Gaps

The following documented features are not yet unit tested:

| Feature | Documentation | Reason |
|---------|---------------|--------|
| `TestDiscoveryManager` | concepts.md §2 | Depends on VS Code TestController |
| `TestExecutionManager` | test-orchestrator.md §Phase 2 | Requires integration tests |
| `StatusBarManager` | test-orchestrator.md §Step 3 | Depends on VS Code StatusBarItem |
| `OutputLogger` | test-orchestrator.md §Step 4 | Depends on VS Code OutputChannel |
| File watching | concepts.md §4 | Requires file system integration |
| Cancellation | test-orchestrator.md §Cancellation | Requires process spawning |

> [!NOTE]
> These gaps require integration tests with VS Code APIs or end-to-end tests. The current suite focuses on unit testing pure functions that can be tested without the VS Code runtime.

---

## Running Tests

```bash
cd "c:\Users\jhonb\Documents\VS Code extension\Testr"
npm test
```

**Expected Output:**
```
Test Suites: 5 passed, 5 total
Tests:       62 passed, 62 total
```
