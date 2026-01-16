# Test Orchestrator Deep Dive

This document provides a detailed explanation of how Testr orchestrates test discovery, execution, and result reporting.

---

## What is Test Orchestration?

Test orchestration is the coordination of:

1. **Discovery**: Finding and parsing test files
2. **Execution**: Running tests and capturing output
3. **Reporting**: Presenting results to developers

Testr acts as a **bridge** between VS Code's Testing UI and the underlying test frameworks (Jest, Vitest, Mocha, etc.).

---

## The Orchestration Pipeline

```
┌──────────────────────────────────────────────────────────────────────┐
│                        DISCOVERY PHASE                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│   │   Trigger   │───▶│   Detect    │───▶│    Find     │             │
│   │  Discovery  │    │  Framework  │    │ Test Files  │             │
│   └─────────────┘    └─────────────┘    └──────┬──────┘             │
│                                                 │                    │
│                                                 ▼                    │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│   │  Register   │◀───│   Build     │◀───│   Parse     │             │
│   │  TestItems  │    │    Tree     │    │   Files     │             │
│   └─────────────┘    └─────────────┘    └─────────────┘             │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        EXECUTION PHASE                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│   │   Receive   │───▶│   Collect   │───▶│   Build     │             │
│   │   Request   │    │  TestItems  │    │   Patterns  │             │
│   └─────────────┘    └─────────────┘    └──────┬──────┘             │
│                                                 │                    │
│                                                 ▼                    │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│   │   Parse     │◀───│   Capture   │◀───│   Spawn     │             │
│   │   Output    │    │   Output    │    │   Process   │             │
│   └─────────────┘    └─────────────┘    └─────────────┘             │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        REPORTING PHASE                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐             │
│   │    Map      │───▶│   Update    │───▶│   Update    │             │
│   │   Results   │    │  TestItems  │    │ Status Bar  │             │
│   └─────────────┘    └─────────────┘    └─────────────┘             │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Discovery

### Step 1: Trigger Discovery

Discovery is triggered by:
- Extension activation
- User clicking "Refresh" button
- File changes in test directories
- `resolveHandler` callback from VS Code

### Step 2: Detect Framework

The adapter registry iterates through registered adapters:

```typescript
async detectFramework(folder): Promise<TestFrameworkAdapter | undefined> {
    for (const adapter of this.adapters.values()) {
        if (await adapter.detectFramework(folder)) {
            return adapter;
        }
    }
    return undefined;
}
```

For Jest, detection checks:
1. `jest` in `dependencies` or `devDependencies`
2. Presence of `jest.config.js` or similar

### Step 3: Find Test Files

Using VS Code's `workspace.findFiles`:

```typescript
const patterns = [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/*.test.js',
    '**/*.spec.js'
];

for (const pattern of patterns) {
    const files = await workspace.findFiles(
        new RelativePattern(testFolder, pattern)
    );
    testFiles.push(...files);
}
```

### Step 4: Parse Files

The parser extracts test structure using regex:

```typescript
// Find describe blocks
const describeMatch = /describe\s*\(\s*(['"`])(.+?)\1/.exec(line);

// Find test/it blocks
const testMatch = /(?:test|it)\s*\(\s*(['"`])(.+?)\1/.exec(line);
```

### Step 5: Build Tree

Tests are organized hierarchically:

```typescript
const suite: TestSuite = {
    id: 'file_path::DescribeName',
    name: 'DescribeName',
    children: [
        { id: 'file_path::DescribeName::TestName', name: 'TestName', ... }
    ]
};
```

### Step 6: Register TestItems

TestItems are created and added to the controller:

```typescript
const testItem = testController.createTestItem(
    suite.id,      // Unique ID
    suite.name,    // Display label
    uri            // File location
);
testItem.range = new Range(line, 0, line, 0);
testController.items.add(testItem);
```

---

## Phase 2: Execution

### Step 1: Receive Request

When the user clicks "Run", VS Code creates a `TestRunRequest`:

```typescript
const runProfile = testController.createRunProfile(
    'Run Tests',
    TestRunProfileKind.Run,
    async (request, token) => {
        await executionManager.runTests(request, token);
    }
);
```

### Step 2: Collect TestItems

Flatten the request into runnable tests:

```typescript
function collectTestItems(request: TestRunRequest): TestItem[] {
    const items: TestItem[] = [];
    
    if (request.include) {
        // Run specific tests
        for (const item of request.include) {
            collectItemsRecursively(item, items);
        }
    } else {
        // Run all tests
        testController.items.forEach(item => {
            collectItemsRecursively(item, items);
        });
    }
    
    return items;
}
```

### Step 3: Build Patterns

Convert TestItem IDs to test name patterns:

```typescript
function buildTestPatterns(testIds: string[]): string[] {
    return testIds.map(id => {
        // 'file_path::Suite::Test' → 'Suite Test'
        const parts = id.split('::');
        return parts.slice(1).join(' ');
    });
}
```

### Step 4: Spawn Process

Execute Jest with JSON output:

```typescript
const process = spawn(jestPath, [
    '--json',
    '--testLocationInResults',
    '--testNamePattern', patterns.join('|')
], {
    cwd: workspacePath,
    env: { ...process.env, CI: 'true' }
});
```

### Step 5: Capture Output

Collect stdout for parsing:

```typescript
let stdout = '';
process.stdout.on('data', (data) => {
    stdout += data.toString();
});
```

### Step 6: Parse Output

Convert Jest JSON to our result format:

```typescript
const jestOutput = JSON.parse(stdout) as JestJsonOutput;

for (const suiteResult of jestOutput.testResults) {
    for (const testResult of suiteResult.testResults) {
        results.push({
            testId: buildTestId(
                suiteResult.testFilePath,
                testResult.ancestorTitles,
                testResult.title
            ),
            status: mapJestStatus(testResult.status),
            duration: testResult.duration ?? 0,
            errorMessage: testResult.failureMessages[0]
        });
    }
}
```

---

## Phase 3: Reporting

### Step 1: Map Results

Match results to TestItems by ID:

```typescript
function findTestItem(testId: string): TestItem | undefined {
    // Navigate the TestItem tree using ID parts
    const parts = testId.split('::');
    let current = testController.items;
    
    for (const part of parts) {
        const item = current.get(part);
        if (item) {
            current = item.children;
        }
    }
    
    return foundItem;
}
```

### Step 2: Update TestItems

Report status through the TestRun:

```typescript
switch (result.status) {
    case TestStatus.Passed:
        run.passed(testItem, result.duration);
        break;
    case TestStatus.Failed:
        run.failed(testItem, new TestMessage(result.errorMessage));
        break;
    case TestStatus.Skipped:
        run.skipped(testItem);
        break;
}
```

### Step 3: Update Status Bar

Show summary in the status bar:

```typescript
statusBar.showResults(
    result.passed,   // 5
    result.failed,   // 1
    result.skipped   // 0
);
// Shows: "✗ 1/6 failed" with red background
```

---

## Cancellation Handling

Tests can be cancelled mid-run:

```typescript
const cancelHandler = token.onCancellationRequested(() => {
    process.kill();  // Kill Jest process
    run.end();       // End the test run
});

process.on('close', () => {
    cancelHandler.dispose();
});
```

---

## Error Recovery

The orchestrator handles errors at each phase:

| Phase | Error Type | Recovery |
|-------|------------|----------|
| Discovery | File read error | Skip file, continue |
| Discovery | Parse error | Skip file, continue |
| Execution | Process spawn error | Report all as failed |
| Execution | Process timeout | Kill and report failed |
| Execution | JSON parse error | Report all as failed |
| Reporting | TestItem not found | Log warning, skip |

---

## Performance Considerations

### Debouncing

File changes are debounced to prevent excessive refreshes:

```typescript
private triggerRefresh(): void {
    if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
        this.onChangeCallback();
    }, 500);  // 500ms debounce
}
```

### Lazy Loading

Test children are resolved on-demand:

```typescript
testController.resolveHandler = async (item) => {
    if (!item) {
        // Discover all tests
        await discoveryManager.discoverAllTests();
    } else {
        // Discover children of specific item
        await discoveryManager.discoverTestsForItem(item);
    }
};
```

### Parallel Execution

Multiple test files run in parallel (handled by Jest):

```bash
jest --json --maxWorkers=50%
```

---

## Sequence Diagram: Complete Flow

```
┌──────┐     ┌───────────┐     ┌──────────┐     ┌────────┐     ┌──────┐
│ User │     │  VS Code  │     │  Testr   │     │  Jest  │     │ Files│
└──┬───┘     └─────┬─────┘     └────┬─────┘     └───┬────┘     └──┬───┘
   │               │                │               │             │
   │  Open Folder  │                │               │             │
   │──────────────▶│                │               │             │
   │               │  Activate      │               │             │
   │               │───────────────▶│               │             │
   │               │                │  Find Tests   │             │
   │               │                │─────────────────────────────▶│
   │               │                │  Test Files   │             │
   │               │                │◀─────────────────────────────│
   │               │                │  Parse        │             │
   │               │                │─────────────────────────────▶│
   │               │                │  Content      │             │
   │               │                │◀─────────────────────────────│
   │               │  TestItems     │               │             │
   │               │◀───────────────│               │             │
   │  Show Tests   │                │               │             │
   │◀──────────────│                │               │             │
   │               │                │               │             │
   │  Click Run    │                │               │             │
   │──────────────▶│                │               │             │
   │               │  Run Request   │               │             │
   │               │───────────────▶│               │             │
   │               │                │  Execute      │             │
   │               │                │──────────────▶│             │
   │               │                │               │  Run Tests  │
   │               │                │               │────────────▶│
   │               │                │               │  Results    │
   │               │                │               │◀────────────│
   │               │                │  JSON Output  │             │
   │               │                │◀──────────────│             │
   │               │  Update Items  │               │             │
   │               │◀───────────────│               │             │
   │  Show Results │                │               │             │
   │◀──────────────│                │               │             │
   │               │                │               │             │
```

---

## Summary

Testr's test orchestrator:

1. **Discovers** tests by parsing source files
2. **Executes** tests by spawning framework CLIs
3. **Reports** results through VS Code's Testing API

The adapter pattern enables this same flow to work with any test framework, making Testr a truly **cross-language test orchestration platform**.
