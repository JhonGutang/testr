# Testr: A Comprehensive Conceptual Guide

## Table of Contents
1. [The Big Picture](#the-big-picture)
2. [Core Concepts](#core-concepts)
3. [The Mental Model](#the-mental-model)
4. [How It Works: The Complete Journey](#how-it-works-the-complete-journey)
5. [Architectural Patterns](#architectural-patterns)
6. [Scaling Considerations](#scaling-considerations)

---

## The Big Picture

### What Problem Does Testr Solve?

Imagine you're a developer working on a large project with hundreds or thousands of tests spread across multiple files. You need to run tests frequently, but you face several challenges:

- **Fragmentation**: Different testing frameworks (Jest, Vitest, Mocha) have different CLIs and workflows
- **Context Switching**: You must leave your editor to run tests in the terminal
- **Poor Visibility**: Terminal output is linear and hard to navigate when you have many tests
- **Manual Work**: You must remember which tests to run and type commands repeatedly

Testr solves these problems by creating a **unified test orchestration layer** that sits between VS Code and your testing frameworks. It provides a single, consistent interface for discovering, running, and viewing test results, regardless of which framework you use.

### The Vision: Cross-Language Test Orchestration

While Testr currently supports Jest, its architecture is designed for **multi-framework, multi-language test orchestration**. The vision is to create a platform where you can:

- Run Python pytest tests alongside JavaScript Jest tests
- Execute Go tests in the same interface as TypeScript tests
- View all test results in one unified tree, regardless of language or framework

This is achieved through the **adapter pattern**, which we'll explore in depth later.

---

## Core Concepts

### 1. Test Discovery vs. Test Execution

Testr separates two fundamental operations:

**Test Discovery** is the process of finding and understanding your tests. When you open a workspace, Testr scans your project to answer questions like:
- Where are the test files?
- What test suites exist in each file?
- What individual tests are inside each suite?
- How are they organized hierarchically?

**Test Execution** is the process of actually running tests and collecting results. When you click "Run", Testr:
- Spawns the appropriate test framework's CLI
- Passes the correct test patterns
- Captures the output
- Parses results and maps them back to the discovered tests

This separation is crucial because discovery happens once (or when files change), while execution happens frequently. By caching the discovery results, Testr can provide instant feedback when you navigate tests, even in large codebases.

### 2. The TestItem Hierarchy

VS Code's Testing API uses a tree structure called **TestItems**. Think of this as a file system for tests:

```
Workspace Root (TestController)
├── math.test.ts (File-level TestItem)
│   ├── "Addition Tests" (Suite-level TestItem)
│   │   ├── "should add positive numbers" (Test-level TestItem)
│   │   └── "should add negative numbers" (Test-level TestItem)
│   └── "Subtraction Tests" (Suite-level TestItem)
│       └── "should subtract numbers" (Test-level TestItem)
└── string.test.ts (File-level TestItem)
    └── "should concatenate strings" (Test-level TestItem)
```

Each TestItem has:
- **ID**: A unique identifier (e.g., `math_test_ts::Addition Tests::should add positive numbers`)
- **Label**: What you see in the UI (e.g., `"should add positive numbers"`)
- **URI**: The file location
- **Range**: The line and column where the test is defined
- **Children**: Nested TestItems (for suites)

This hierarchy is what you see in VS Code's Test Explorer. When you click a test, VS Code uses the URI and Range to jump to that exact line in your code.

### 3. The Adapter Pattern

The adapter pattern is the key to Testr's extensibility. Here's the mental model:

Imagine Testr as a **universal translator** between VS Code and testing frameworks. VS Code speaks one language (the Testing API), and each framework speaks its own language (Jest CLI, Vitest API, Mocha runner, etc.).

An **adapter** is a translator that knows both languages. It implements a standard interface that Testr understands:

```typescript
interface TestFrameworkAdapter {
    detectFramework(): Promise<boolean>;     // "Can I handle this project?"
    discoverTests(): Promise<TestDiscoveryResult>;  // "Here are all the tests"
    runTests(): Promise<TestRunResult>;      // "Here are the results"
    parseTestFile(): TestSuite | undefined;  // "Here's what's in this file"
}
```

When you add support for a new framework, you create a new adapter that implements these four methods. Testr doesn't need to change—it just uses the adapter through this interface.

This is similar to how electrical outlets work: different countries have different plug shapes, but a universal adapter lets you plug in any device. Testr is the universal adapter for test frameworks.

### 4. The Registry Pattern

The **AdapterRegistry** is like a phone book for adapters. When Testr needs to work with a project, it asks the registry: "Which adapter can handle this workspace?"

The registry iterates through all registered adapters, asking each one: "Can you handle this?" The first adapter that says "yes" wins.

This happens through **framework detection**. For Jest, the adapter checks:
1. Is `jest` in `package.json` dependencies?
2. Does a `jest.config.js` file exist?

If either is true, the Jest adapter claims the workspace.

This pattern allows Testr to support multiple frameworks simultaneously. If you have a monorepo with both Jest and Vitest projects, Testr can detect and use the appropriate adapter for each workspace folder.

---

## The Mental Model

### Think of Testr as a Three-Layer Cake

**Layer 1: The UI Layer (What You See)**
- The Test Explorer tree in VS Code's sidebar
- The status bar showing test results
- The "Run" buttons next to each test

**Layer 2: The Orchestration Layer (The Brain)**
- TestController: The central coordinator
- TestDiscoveryManager: Finds and organizes tests
- TestExecutionManager: Runs tests and reports results
- AdapterRegistry: Routes operations to the right adapter

**Layer 3: The Adapter Layer (The Translators)**
- JestAdapter: Speaks Jest's language
- Future adapters: VitestAdapter, MochaAdapter, etc.

When you click "Run All Tests", here's what happens:

1. **UI Layer** receives your click and creates a TestRunRequest
2. **Orchestration Layer** (TestExecutionManager) receives the request
3. **Orchestration Layer** asks the AdapterRegistry: "Which adapter should handle this?"
4. **Adapter Layer** (JestAdapter) receives the request and spawns `jest --json`
5. **Adapter Layer** parses Jest's JSON output into TestExecutionResults
6. **Orchestration Layer** maps results back to TestItems
7. **UI Layer** updates the tree with green checkmarks and red X's

### The Data Flow: From Files to UI

Let's trace how a test file becomes a clickable item in your UI:

**Step 1: File Discovery**
```
Workspace opens → TestFileWatcher detects *.test.ts files → Triggers discovery
```

**Step 2: File Parsing**
```
JestParser reads file content → Extracts describe() and it() blocks → Builds TestSuite tree
```

**Step 3: TestItem Creation**
```
TestDiscoveryManager receives TestSuite → Creates TestItem hierarchy → Registers with TestController
```

**Step 4: UI Rendering**
```
VS Code reads TestController.items → Renders Test Explorer tree → You see clickable tests
```

**Step 5: Test Execution**
```
You click Run → TestExecutionManager spawns Jest → Captures output → Updates TestItems → UI shows results
```

### The ID System: How Testr Tracks Tests

Every test needs a unique ID so Testr can track it across discovery and execution. The ID system works like a file path:

```
file_path::Suite Name::Test Name
```

For example:
```
src_math_test_ts::Addition Tests::should add positive numbers
```

This ID serves multiple purposes:

1. **Uniqueness**: No two tests have the same ID
2. **Hierarchy**: The `::` separator shows parent-child relationships
3. **Mapping**: When Jest returns results, Testr uses IDs to find the corresponding TestItem
4. **Navigation**: VS Code uses IDs to track which tests you've selected

When you run a specific test, Testr:
1. Takes the TestItem's ID
2. Splits it by `::`
3. Extracts the test name parts
4. Passes them to Jest as `--testNamePattern "Addition Tests should add positive numbers"`

---

## How It Works: The Complete Journey

### Scenario: Opening a Project with Tests

Let's walk through what happens when you open a project in VS Code.

**T+0ms: Extension Activation**

VS Code detects test files in your workspace and activates Testr. The `activate()` function in `extension.ts` runs:

```typescript
// Create the central coordinator
testController = vscode.tests.createTestController('testr', 'Testr');

// Create the adapter registry and register Jest
adapterRegistry = new AdapterRegistry();
adapterRegistry.registerAdapter(new JestAdapter());

// Create the discovery manager
discoveryManager = new TestDiscoveryManager(testController, adapterRegistry);

// Start discovering tests
discoveryManager.discoverAllTests();
```

**T+50ms: Framework Detection**

The discovery manager asks: "What framework is this project using?"

```typescript
// For each workspace folder
const adapter = await adapterRegistry.detectFramework(workspaceFolder);

// JestAdapter checks package.json
const packageJson = JSON.parse(await readFile('package.json'));
const hasJest = packageJson.devDependencies?.jest !== undefined;
// Returns true → Jest adapter selected
```

**T+100ms: Finding Test Folders**

Testr looks for common test folder patterns:

```typescript
const testFolders = ['test', 'tests', '__tests__', 'src'];
// Checks which folders exist
// Finds: /project/test and /project/src
```

**T+150ms: Finding Test Files**

For each folder, Testr searches for test file patterns:

```typescript
const patterns = ['**/*.test.ts', '**/*.spec.ts', '**/*.test.js', ...];
// Uses VS Code's workspace.findFiles()
// Finds: math.test.ts, string.test.ts, utils.spec.ts
```

**T+200ms: Parsing Test Files**

For each file, JestParser extracts test structure:

```typescript
// Reads math.test.ts line by line
// Finds: describe('Addition Tests', () => {
//          it('should add positive numbers', () => { ... });
//        });
// Creates: TestSuite with TestCase children
```

**T+250ms: Building TestItem Tree**

TestDiscoveryManager converts TestSuites into TestItems:

```typescript
const testItem = testController.createTestItem(
    'math_test_ts::Addition Tests::should add positive numbers',
    'should add positive numbers',
    Uri.file('/project/test/math.test.ts')
);
testItem.range = new Range(line 15, col 0);
```

**T+300ms: Rendering UI**

VS Code reads the TestItems and renders the Test Explorer. You now see a tree of clickable tests.

### Scenario: Running a Single Test

You click the "Run" button next to "should add positive numbers". Here's the journey:

**T+0ms: Creating Test Run**

```typescript
// VS Code creates a TestRunRequest
const request = new TestRunRequest([testItem]);

// TestExecutionManager receives it
const run = testController.createTestRun(request);
run.started(testItem);  // UI shows spinning icon
```

**T+10ms: Building Test Pattern**

```typescript
// Extract test name from ID
const id = 'math_test_ts::Addition Tests::should add positive numbers';
const parts = id.split('::');  // ['math_test_ts', 'Addition Tests', 'should add positive numbers']
const pattern = parts.slice(1).join(' ');  // 'Addition Tests should add positive numbers'
```

**T+20ms: Spawning Jest Process**

```typescript
// JestRunner spawns Jest
const process = spawn('jest', [
    '--json',
    '--testNamePattern', 'Addition Tests should add positive numbers'
], { cwd: workspacePath });
```

**T+500ms: Jest Runs**

Jest executes the test and outputs JSON:

```json
{
    "numPassedTests": 1,
    "numFailedTests": 0,
    "testResults": [{
        "testFilePath": "/project/test/math.test.ts",
        "testResults": [{
            "ancestorTitles": ["Addition Tests"],
            "title": "should add positive numbers",
            "status": "passed",
            "duration": 5
        }]
    }]
}
```

**T+550ms: Parsing Results**

```typescript
// JestRunner parses the JSON
const result = {
    testId: 'math_test_ts::Addition Tests::should add positive numbers',
    status: TestStatus.Passed,
    duration: 5,
    errorMessage: undefined
};
```

**T+560ms: Updating UI**

```typescript
// TestExecutionManager finds the TestItem by ID
const testItem = findTestItem(result.testId);

// Reports success
run.passed(testItem, 5);  // UI shows green checkmark
run.end();
```

**T+570ms: Status Bar Update**

```typescript
statusBar.showResults(1, 0, 0);  // "✓ 1/1 passed"
```

### Scenario: File Change Detection

You modify a test file. Here's how Testr responds:

**T+0ms: File System Event**

```typescript
// TestFileWatcher receives change event
watcher.onDidChange((uri) => {
    // Debounce to avoid excessive refreshes
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        discoveryManager.discoverAllTests();
    }, 500);
});
```

**T+500ms: Re-discovery**

Testr re-parses the changed file, updates the TestItem tree, and the UI reflects the new test structure.

---

## Architectural Patterns

### 1. Separation of Concerns

Each component has a single, well-defined responsibility:

- **TestController**: Owns the TestItem tree, creates test runs
- **TestDiscoveryManager**: Finds and parses tests
- **TestExecutionManager**: Runs tests and reports results
- **AdapterRegistry**: Routes operations to adapters
- **JestAdapter**: Translates between Testr and Jest
- **StatusBarManager**: Updates the status bar

This separation makes the codebase maintainable. If you need to change how results are displayed, you only touch StatusBarManager. If you need to support a new framework, you only create a new adapter.

### 2. Dependency Injection

Components receive their dependencies through constructors:

```typescript
const discoveryManager = new TestDiscoveryManager(
    testController,      // Injected dependency
    adapterRegistry      // Injected dependency
);
```

This makes testing easier (you can inject mocks) and makes dependencies explicit.

### 3. Observer Pattern

TestFileWatcher uses the observer pattern:

```typescript
// TestFileWatcher observes file system changes
watcher.onDidChange(() => {
    // Notifies callback
    onChangeCallback();
});

// TestDiscoveryManager subscribes to changes
new TestFileWatcher(() => {
    this.discoverAllTests();  // Re-discover when files change
});
```

This decouples the watcher from the discovery manager. The watcher doesn't know what happens when files change—it just notifies subscribers.

### 4. Strategy Pattern

The adapter pattern is actually a form of the strategy pattern. The "strategy" (how to discover/run tests) varies based on the framework, but the interface remains the same.

### 5. Weak References for Metadata

Testr uses WeakMap to store metadata about TestItems:

```typescript
private readonly testDataMap: WeakMap<vscode.TestItem, TestItemData> = new WeakMap();
```

This prevents memory leaks. When a TestItem is deleted, its metadata is automatically garbage collected.

---

## Scaling Considerations

### How Testr Handles Large Codebases

**1. Lazy Loading**

VS Code's Testing API supports lazy loading through `resolveHandler`:

```typescript
testController.resolveHandler = async (item) => {
    if (!item) {
        // Load top-level items
        await discoverAllTests();
    } else {
        // Load children of specific item
        await discoverTestsForItem(item);
    }
};
```

For a project with 10,000 tests, Testr can initially load only file-level items, then load suite/test details when you expand a file.

**2. Debouncing**

File changes are debounced to prevent excessive re-discovery:

```typescript
// If you save 5 files in 500ms, only one discovery happens
setTimeout(() => discoverAllTests(), 500);
```

**3. Incremental Updates**

When a single file changes, Testr could be optimized to only re-parse that file instead of the entire workspace. This is a future enhancement.

**4. Parallel Execution**

Jest runs tests in parallel by default. Testr doesn't interfere with this—it just spawns Jest and lets it handle parallelization.

### Multi-Framework Support at Scale

Imagine a monorepo with:
- 50 JavaScript packages using Jest
- 30 TypeScript packages using Vitest
- 20 Python packages using pytest

Testr's architecture handles this elegantly:

1. **Per-Workspace Detection**: Each workspace folder gets its own adapter
2. **Unified Tree**: All tests appear in one Test Explorer tree
3. **Correct Routing**: When you run tests, each adapter handles its own tests

The AdapterRegistry ensures the right adapter is used for each workspace, and the TestController aggregates all TestItems into one tree.

---

## Conclusion

Testr is fundamentally a **bridge** between VS Code's Testing API and the diverse world of testing frameworks. Its power comes from:

1. **Clear Separation**: Discovery, execution, and UI are separate concerns
2. **Extensibility**: The adapter pattern makes adding frameworks trivial
3. **Efficiency**: Caching, debouncing, and lazy loading keep it fast
4. **Simplicity**: A consistent interface hides framework complexity

The mental model is simple: **Testr discovers tests once, runs them many times, and always presents a unified view**. Everything else is implementation detail.

As you work with Testr, remember this hierarchy:

```
VS Code Testing API
    ↓
TestController (The Coordinator)
    ↓
Managers (Discovery & Execution)
    ↓
Adapters (Framework-Specific Logic)
    ↓
Test Frameworks (Jest, Vitest, etc.)
```

Each layer has a clear responsibility, and data flows smoothly from bottom to top (discovery) and top to bottom (execution). This architecture is what makes Testr scalable, maintainable, and extensible.
