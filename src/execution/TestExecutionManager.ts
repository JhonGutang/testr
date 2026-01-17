import * as vscode from 'vscode';
import { AdapterRegistry } from '../adapters/AdapterRegistry';
import { StatusBarManager } from '../ui/StatusBarManager';
import { OutputLogger } from '../ui/OutputLogger';
import { TestStatus, TestExecutionResult } from '../types';

export class TestExecutionManager {
    private readonly testController: vscode.TestController;
    private readonly adapterRegistry: AdapterRegistry;
    private readonly statusBar: StatusBarManager;
    private readonly outputLogger: OutputLogger;
    private readonly passedResultClearDelayMs = 5000; // 5 seconds
    private clearResultsTimeout: ReturnType<typeof setTimeout> | undefined;

    constructor(
        testController: vscode.TestController,
        adapterRegistry: AdapterRegistry,
        statusBar: StatusBarManager,
        outputLogger: OutputLogger
    ) {
        this.testController = testController;
        this.adapterRegistry = adapterRegistry;
        this.statusBar = statusBar;
        this.outputLogger = outputLogger;
    }

    async runTests(
        request: vscode.TestRunRequest,
        token: vscode.CancellationToken
    ): Promise<void> {
        console.log('[TestExecutionManager] runTests called');
        
        // Clear any pending timeout from previous run
        if (this.clearResultsTimeout) {
            clearTimeout(this.clearResultsTimeout);
            this.clearResultsTimeout = undefined;
        }

        const run = this.testController.createTestRun(request);
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.log('[TestExecutionManager] No workspace folders found');
            run.end();
            return;
        }

        const testItems = this.collectTestItems(request);
        const testIds = testItems.map(item => item.id);
        const passedItems: vscode.TestItem[] = [];

        // Determine if this is a single test suite run or run all
        // A single test suite run is when request.include is specified and all tests belong to the same file
        const isSingleSuiteRun = this.isSingleTestSuiteRun(request, testItems);
        const targetFilePath = isSingleSuiteRun ? this.getTargetFilePath(testItems) : null;

        console.log('[TestExecutionManager] Running', testItems.length, 'tests');
        console.log('[TestExecutionManager] Is single suite run:', isSingleSuiteRun, 'Target file:', targetFilePath);
        
        // Log execution start
        this.outputLogger.logExecutionStart(testItems.length);

        for (const item of testItems) {
            run.started(item);
        }

        this.statusBar.showRunning(testItems.length);

        try {
            for (const folder of workspaceFolders) {
                const adapter = await this.adapterRegistry.detectFramework(folder);
                if (!adapter) {
                    continue;
                }

                const result = await adapter.runTests(folder, testIds, token);

                console.log('[TestExecutionManager] Got results:', result.results.length, 'results');
                console.log('[TestExecutionManager] Result details:', {
                    passed: result.passed,
                    failed: result.failed,
                    skipped: result.skipped,
                    resultsCount: result.results.length
                });

                // Group results by file
                const resultsByFile = new Map<string, TestExecutionResult[]>();
                for (const testResult of result.results) {
                    const filePath = this.extractFilePathFromTestId(testResult.testId);
                    console.log('[TestExecutionManager] Test result:', testResult.testId, '-> file:', filePath);
                    if (!resultsByFile.has(filePath)) {
                        resultsByFile.set(filePath, []);
                    }
                    resultsByFile.get(filePath)!.push(testResult);
                }

                console.log('[TestExecutionManager] Grouped into', resultsByFile.size, 'files');

                // Log results per file
                for (const [filePath, fileResults] of resultsByFile) {
                    // Skip files that are not the target when running a single suite
                    if (isSingleSuiteRun && targetFilePath && !this.isMatchingFilePath(filePath, targetFilePath)) {
                        console.log('[TestExecutionManager] Skipping file (not target):', filePath);
                        continue;
                    }

                    console.log('[TestExecutionManager] Processing file:', filePath, 'with', fileResults.length, 'results');
                    this.outputLogger.logTestFile(filePath);
                    
                    let filePassed = 0;
                    let fileFailed = 0;
                    let fileSkipped = 0;

                    for (const testResult of fileResults) {
                        const testItem = this.findTestItem(testResult.testId);
                        if (!testItem) {
                            console.log('[TestExecutionManager] Could not find test item for:', testResult.testId);
                            continue;
                        }

                        const testName = this.extractTestNameFromId(testResult.testId);

                        switch (testResult.status) {
                            case TestStatus.Passed:
                                run.passed(testItem, testResult.duration);
                                passedItems.push(testItem);
                                this.outputLogger.logTestResult(testName, 'passed', testResult.duration);
                                filePassed++;
                                break;
                            case TestStatus.Failed:
                                run.failed(
                                    testItem,
                                    new vscode.TestMessage(
                                        testResult.errorMessage ?? 'Test failed'
                                    ),
                                    testResult.duration
                                );
                                this.outputLogger.logTestResult(testName, 'failed', testResult.duration);
                                if (testResult.errorMessage) {
                                    this.outputLogger.logTestError(testName, testResult.errorMessage);
                                }
                                fileFailed++;
                                break;
                            case TestStatus.Skipped:
                                run.skipped(testItem);
                                this.outputLogger.logTestResult(testName, 'skipped');
                                fileSkipped++;
                                break;
                            default:
                                run.skipped(testItem);
                                fileSkipped++;
                        }
                    }

                    // Log file stats
                    const fileTotal = filePassed + fileFailed + fileSkipped;
                    this.outputLogger.logFileStats(filePath, fileTotal, filePassed, fileFailed, fileSkipped);
                }

                // Log overall stats only when running all tests (not a single suite)
                if (!isSingleSuiteRun) {
                    const totalTests = result.passed + result.failed + result.skipped;
                    this.outputLogger.logOverallStats(
                        totalTests,
                        result.passed,
                        result.failed,
                        result.skipped,
                        result.duration
                    );
                }

                this.statusBar.showResults(
                    result.passed,
                    result.failed,
                    result.skipped
                );
            }
        } catch (error) {
            const errorMessage = error instanceof Error 
                ? error.message 
                : 'Unknown error occurred';
            
            this.outputLogger.logError(errorMessage);
            
            for (const item of testItems) {
                run.failed(item, new vscode.TestMessage(errorMessage));
            }
            this.statusBar.showError();
        }

        run.end();

        // Schedule clearing of passed test results after delay
        if (passedItems.length > 0) {
            this.clearResultsTimeout = setTimeout(() => {
                this.invalidatePassedItems(passedItems);
            }, this.passedResultClearDelayMs);
        }
    }

    private extractFilePathFromTestId(testId: string): string {
        const parts = testId.split('::');
        return parts[0].replace(/_/g, '/');
    }

    private extractTestNameFromId(testId: string): string {
        const parts = testId.split('::');
        return parts.slice(1).join(' > ');
    }

    private invalidatePassedItems(items: vscode.TestItem[]): void {
        // Create a new test run to clear the state of passed items
        const request = new vscode.TestRunRequest(items, undefined, undefined, false);
        const run = this.testController.createTestRun(request, undefined, false);
        // End immediately without setting any state - this clears the checkmarks
        run.end();
    }

    private collectTestItems(request: vscode.TestRunRequest): vscode.TestItem[] {
        const items: vscode.TestItem[] = [];

        if (request.include) {
            for (const item of request.include) {
                this.collectItemsRecursively(item, items);
            }
        } else {
            this.testController.items.forEach(item => {
                this.collectItemsRecursively(item, items);
            });
        }

        if (request.exclude) {
            const excludeIds = new Set(request.exclude.map(item => item.id));
            return items.filter(item => !excludeIds.has(item.id));
        }

        return items;
    }

    private collectItemsRecursively(
        item: vscode.TestItem,
        collected: vscode.TestItem[]
    ): void {
        if (item.children.size === 0) {
            collected.push(item);
        } else {
            item.children.forEach(child => {
                this.collectItemsRecursively(child, collected);
            });
        }
    }

    /**
     * Determines if this is a single test suite (file) run.
     * A single test suite run is when:
     * 1. request.include is specified (user selected specific tests)
     * 2. All selected tests belong to the same file
     */
    private isSingleTestSuiteRun(request: vscode.TestRunRequest, testItems: vscode.TestItem[]): boolean {
        // If no specific tests were requested, it's a "run all" scenario
        if (!request.include || request.include.length === 0) {
            return false;
        }

        // Get unique file paths from all test items
        const filePaths = new Set<string>();
        for (const item of testItems) {
            const filePath = this.extractFilePathFromTestId(item.id);
            filePaths.add(filePath.toLowerCase()); // Normalize for Windows
        }

        // It's a single suite run if all tests come from the same file
        return filePaths.size === 1;
    }

    /**
     * Gets the target file path from the test items (for single suite runs).
     */
    private getTargetFilePath(testItems: vscode.TestItem[]): string | null {
        if (testItems.length === 0) {
            return null;
        }
        return this.extractFilePathFromTestId(testItems[0].id);
    }

    /**
     * Checks if two file paths match (case-insensitive for Windows compatibility).
     */
    private isMatchingFilePath(path1: string, path2: string): boolean {
        return path1.toLowerCase() === path2.toLowerCase();
    }

    private findTestItem(testId: string): vscode.TestItem | undefined {
        console.log('[TestExecutionManager] findTestItem called with:', testId);
        // Normalize testId to lowercase for case-insensitive comparison (Windows drive letters)
        const normalizedTestId = testId.toLowerCase();
        const parts = testId.split('::');
        console.log('[TestExecutionManager] Split into parts:', parts);
        let currentItems = this.testController.items;
        let result: vscode.TestItem | undefined;

        // Log all available test items at root level
        const rootIds: string[] = [];
        currentItems.forEach(item => rootIds.push(item.id));
        console.log('[TestExecutionManager] Available root test items:', rootIds);

        for (let i = 0; i < parts.length; i++) {
            const partialId = parts.slice(0, i + 1).join('::');
            const normalizedPartialId = partialId.toLowerCase();
            console.log('[TestExecutionManager] Looking for partial ID:', partialId);
            let foundItem: vscode.TestItem | undefined;
            
            currentItems.forEach(item => {
                // Case-insensitive comparison to handle Windows drive letter casing differences
                const normalizedItemId = item.id.toLowerCase();
                if (normalizedItemId === normalizedPartialId || normalizedItemId === normalizedTestId) {
                    foundItem = item;
                    console.log('[TestExecutionManager] Found match:', item.id);
                }
            });

            if (foundItem) {
                result = foundItem;
                if (foundItem.children.size > 0) {
                    currentItems = foundItem.children;
                } else {
                    return foundItem;
                }
            } else {
                console.log('[TestExecutionManager] No match found for partial ID:', partialId);
            }
        }

        return result;
    }
}
