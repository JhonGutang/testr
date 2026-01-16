# Testr Mental Model

This document describes the mental model, architecture, and key concepts behind the Testr VS Code extension.

## Core Philosophy

Testr is built around three key principles:

1. **Unified Experience**: A single, consistent interface for all testing frameworks
2. **Adapter Pattern**: Pluggable framework support through well-defined interfaces
3. **VS Code Native Integration**: Deep integration with VS Code's Testing API

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         VS Code                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Test Explorer  │  │    Commands     │  │   Status Bar    │ │
│  │       UI        │  │                 │  │                 │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
└───────────┼────────────────────┼────────────────────┼──────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TestController                              │
│   The central coordination point for all test operations        │
└────────────────────────────────┬────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Discovery    │    │    Execution    │    │   Adapter       │
│     Manager     │    │     Manager     │    │   Registry      │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Framework Adapters                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │   Jest   │  │  Vitest  │  │  Mocha   │  │  Future  │        │
│  │ Adapter  │  │ Adapter  │  │ Adapter  │  │ Adapters │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. TestController

The **TestController** is VS Code's primary interface for test management. Testr creates a single controller instance named `testr` that:

- Receives discovery requests from VS Code
- Manages the test item tree
- Creates test runs for execution
- Reports results back to the UI

### 2. Discovery Manager

The **TestDiscoveryManager** is responsible for finding and parsing tests:

```
User opens workspace
        │
        ▼
  Detect Framework ──────────┐
        │                    │
        ▼                    ▼
   Find Test Folders    No framework?
        │                    │
        ▼                    ▼
   Parse Test Files       Return
        │
        ▼
  Build TestItem Tree
        │
        ▼
  Register with Controller
```

Key behaviors:
- Watches for file changes and auto-refreshes
- Parses test files to extract describe/it blocks
- Builds hierarchical TestItem structure
- Supports multiple test folder patterns

### 3. Execution Manager

The **TestExecutionManager** runs tests and reports results:

```
Run Request Received
        │
        ▼
  Collect TestItems
        │
        ▼
  Mark Tests as Running
        │
        ▼
  Delegate to Adapter ──────┐
        │                   │
        ▼                   ▼
  Receive Results      On Error
        │                   │
        ▼                   ▼
  Update TestItems     Mark Failed
        │
        ▼
  Update Status Bar
```

### 4. Adapter Registry

The **AdapterRegistry** manages framework adapters:

- Registers adapters during extension activation
- Detects which framework a project uses
- Routes operations to the correct adapter

---

## Data Flow

### Test Discovery Flow

```
1. Workspace Opens
        │
        ▼
2. Scan for Test Folders
   • /test
   • /tests
   • /__tests__
   • /src (for inline tests)
        │
        ▼
3. Find Test Files
   • *.test.ts/js
   • *.spec.ts/js
        │
        ▼
4. Parse Each File
   • Extract describe blocks
   • Extract it/test blocks
   • Build parent-child relationships
        │
        ▼
5. Create TestItem Tree
   • File-level items
   • Suite-level items
   • Test-level items
        │
        ▼
6. Display in Test Explorer
```

### Test Execution Flow

```
1. User Triggers Test Run
   • Click "Run" button
   • Run all tests command
   • Run file/suite/test
        │
        ▼
2. Build Test Request
   • Collect test IDs
   • Handle exclusions
        │
        ▼
3. Execute via Adapter
   • Spawn test process
   • Pass test patterns
   • Capture output
        │
        ▼
4. Parse Results
   • JSON output parsing
   • Map to TestItems
        │
        ▼
5. Report Results
   • Update TestItem states
   • Update status bar
   • Show error messages
```

---

## The Adapter Pattern

Each framework adapter implements the `TestFrameworkAdapter` interface:

```typescript
interface TestFrameworkAdapter {
    readonly framework: TestFramework;
    
    detectFramework(folder): Promise<boolean>;
    discoverTests(folder, testFolder): Promise<TestDiscoveryResult>;
    runTests(folder, testIds, token): Promise<TestRunResult>;
    parseTestFile(uri, content): TestSuite | undefined;
}
```

### Adding a New Framework

To add support for a new framework (e.g., Vitest):

1. Create adapter class implementing `TestFrameworkAdapter`
2. Implement framework detection (check for config files/dependencies)
3. Implement test file parsing (framework-specific syntax)
4. Implement test execution (spawn CLI, parse output)
5. Register adapter in `extension.ts`

---

## TestItem Hierarchy

Tests are organized hierarchically:

```
TestController
    │
    ├── example.test.ts (File)
    │       │
    │       ├── "Math operations" (Describe Suite)
    │       │       │
    │       │       ├── "should add numbers" (Test)
    │       │       └── "should subtract numbers" (Test)
    │       │
    │       └── "String operations" (Describe Suite)
    │               │
    │               └── "should concatenate" (Test)
    │
    └── helper.test.ts (File)
            │
            └── "should help" (Test)
```

Each TestItem has:
- **id**: Unique identifier (path-based)
- **label**: Display name
- **uri**: File location
- **range**: Line/column position
- **children**: Nested tests/suites

---

## Status Bar Integration

The status bar provides quick feedback:

| State | Icon | Text |
|-------|------|------|
| Idle | 🧪 | "Testr" |
| Running | ⟳ | "Running N tests..." |
| All Pass | ✓ | "N/N passed" |
| Some Fail | ✗ | "N/N failed" (red background) |
| Error | ✗ | "Test run failed" |

---

## File Watching

Testr watches for test file changes:

- **Create**: New test file → Add to tree
- **Delete**: Test file removed → Remove from tree
- **Modify**: Test content changed → Re-parse and update

Changes are debounced (500ms) to prevent excessive refreshes.

---

## Error Handling

The extension handles errors gracefully:

1. **Framework Detection Failure**: Show no tests, don't crash
2. **Parse Errors**: Skip malformed files, continue with others
3. **Execution Errors**: Mark tests as failed, show error message
4. **Process Crashes**: Report failure, update status bar

---

## Configuration

Currently, Testr uses convention over configuration:

| Setting | Default |
|---------|---------|
| Test Folders | `test`, `tests`, `__tests__`, `src` |
| Test Patterns | `*.test.ts/js`, `*.spec.ts/js` |
| Framework | Auto-detected from package.json |

Future versions may expose these as VS Code settings.
