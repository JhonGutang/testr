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

For PHPUnit, detection checks:
1. Presence of `phpunit.xml` or `phpunit.xml.dist`
2. Presence of `vendor/bin/phpunit`

### Step 3: Find Test Files

Using VS Code's `workspace.findFiles` with `node_modules` exclusion:

```typescript
const patterns = [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/*.test.js',
    '**/*.spec.js',
    '**/*Test.php'
];

const excludePattern = '**/node_modules/**';

for (const pattern of patterns) {
    const relativePattern = new RelativePattern(testFolder, pattern);
    const files = await workspace.findFiles(relativePattern, excludePattern);
    testFiles.push(...files);
}
```

> [!NOTE]
> The `node_modules` directory is explicitly excluded to prevent discovering tests in dependencies, which improves performance and avoids false positives.

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

Convert TestItem IDs to test name patterns with validation and filtering:

```typescript
function buildTestPatterns(testIds: string[]): string[] {
    if (testIds.length === 0) {
        return [];
    }
    
    return testIds.map(id => {
        // 'file_path::Suite::Test' → 'Suite Test'
        const parts = id.split('::');
        if (parts.length > 1) {
            return parts.slice(1).join(' ');
        }
        return '';
    }).filter(pattern => pattern.length > 0);  // Remove empty patterns
}
```

> [!IMPORTANT]
> Empty patterns are filtered out to prevent invalid Jest arguments. This handles edge cases where test IDs might not have the expected structure.

### Step 4: Spawn Process

Execute Jest with JSON output and shell-safe arguments:

```typescript
const args = ['--json', '--testLocationInResults'];

if (patterns.length > 0) {
    const pattern = patterns.join('|');
    // Quote the pattern for shell safety
    args.push('--testNamePattern', `"${pattern}"`);
}

const process = spawn(jestPath, args, {
    cwd: workspacePath,
    shell: true,  // Required for quoted arguments
    env: { ...process.env, CI: 'true' }
});
```

> [!WARNING]
> The test name pattern is wrapped in quotes to handle special characters and spaces in test names. The `shell: true` option is required for proper quote handling.

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

Match results to TestItems by ID with case-insensitive comparison:

```typescript
function findTestItem(testId: string): TestItem | undefined {
    // Normalize for case-insensitive comparison (Windows drive letters)
    const normalizedTestId = testId.toLowerCase();
    const parts = testId.split('::');
    let currentItems = testController.items;
    let result: TestItem | undefined;
    
    for (let i = 0; i < parts.length; i++) {
        const partialId = parts.slice(0, i + 1).join('::');
        const normalizedPartialId = partialId.toLowerCase();
        let foundItem: TestItem | undefined;
        
        currentItems.forEach(item => {
            // Case-insensitive comparison for Windows compatibility
            const normalizedItemId = item.id.toLowerCase();
            if (normalizedItemId === normalizedPartialId || 
                normalizedItemId === normalizedTestId) {
                foundItem = item;
            }
        });
        
        if (foundItem) {
            result = foundItem;
            if (foundItem.children.size > 0) {
                currentItems = foundItem.children;
            } else {
                return foundItem;
            }
        }
    }
    
    return result;
}
```

> [!IMPORTANT]
> **Windows Compatibility**: Test IDs are compared case-insensitively to handle Windows drive letter casing differences (e.g., `C:` vs `c:`). This prevents test result matching failures on Windows systems.

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

### Step 4: Log Detailed Results

The `OutputLogger` provides comprehensive test execution logging. The logging behavior adapts based on the scope of the test run:

1. **Run All Tests**: Logs details for every file and displays a summary of overall statistics at the end.
2. **Run Single Suite**: Logs details *only* for the targeted test file and suppresses the overall statistics to reduce noise.

```typescript
// Execution logging
outputLogger.logExecutionStart(testCount);

// For each test file:
if (isTargetFileOrRunAll) {
    outputLogger.logTestFile(filePath);
    // ... log individual test results ...
    outputLogger.logFileStats(filePath, total, passed, failed, skipped);
}

// Statistics logging (only for "Run All")
if (!isSingleSuiteRun) {
    outputLogger.logOverallStats(total, passed, failed, skipped, duration);
}
```

**Example Output (Run All):**
```
[Testr] 🚀 Running 8 tests...
[Testr] 📄 src/utils/math.test.ts
[Testr]   ✓ add() should sum two numbers (12ms)
...
[Testr]   Stats: 3 total (1 passed, 1 failed, 1 skipped)

[Testr] 📄 src/components/Button.test.tsx
...
[Testr]   Stats: 5 total (5 passed, 0 failed, 0 skipped)

[Testr] 📊 Overall: 8 total (6 passed, 1 failed, 1 skipped) in 156ms
```

**Example Output (Run Single Suite):**
```
[Testr] 🚀 Running 3 tests...
[Testr] 📄 src/utils/math.test.ts
[Testr]   ✓ add() should sum two numbers (12ms)
[Testr]   ✗ divide() should handle division by zero (8ms)
[Testr]     Error: Expected error to be thrown
[Testr]   ○ multiply() is pending

[Testr]   Stats for src/utils/math.test.ts:
[Testr]     Total: 3 | Passed: 1 | Failed: 1 | Skipped: 1
```

> [!TIP]
> The OutputLogger writes to the "Testr" output channel in VS Code. Users can view detailed test execution logs by opening the Output panel and selecting "Testr" from the dropdown.

### Step 5: Auto-Clear Passed Tests

Passed test results are automatically cleared after a delay:

```typescript
private readonly passedResultClearDelayMs = 5000; // 5 seconds
private clearResultsTimeout: ReturnType<typeof setTimeout> | undefined;

// After test run completes
if (passedItems.length > 0) {
    this.clearResultsTimeout = setTimeout(() => {
        this.invalidatePassedItems(passedItems);
    }, this.passedResultClearDelayMs);
}

private invalidatePassedItems(items: TestItem[]): void {
    // Create a new test run to clear the state of passed items
    const request = new TestRunRequest(items, undefined, undefined, false);
    const run = testController.createTestRun(request, undefined, false);
    // End immediately without setting any state - this clears the checkmarks
    run.end();
}
```

> [!NOTE]
> **UX Enhancement**: This feature keeps the test explorer clean by removing green checkmarks after 5 seconds, making it easier to spot which tests were just run. Failed tests remain visible until the next run.


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
