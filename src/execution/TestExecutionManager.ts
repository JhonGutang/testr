import * as vscode from 'vscode';
import { AdapterRegistry } from '../adapters/AdapterRegistry';
import { StatusBarManager } from '../ui/StatusBarManager';
import { TestStatus } from '../types';

export class TestExecutionManager {
    private readonly testController: vscode.TestController;
    private readonly adapterRegistry: AdapterRegistry;
    private readonly statusBar: StatusBarManager;
    private readonly passedResultClearDelayMs = 5000; // 5 seconds
    private clearResultsTimeout: ReturnType<typeof setTimeout> | undefined;

    constructor(
        testController: vscode.TestController,
        adapterRegistry: AdapterRegistry,
        statusBar: StatusBarManager
    ) {
        this.testController = testController;
        this.adapterRegistry = adapterRegistry;
        this.statusBar = statusBar;
    }

    async runTests(
        request: vscode.TestRunRequest,
        token: vscode.CancellationToken
    ): Promise<void> {
        // Clear any pending timeout from previous run
        if (this.clearResultsTimeout) {
            clearTimeout(this.clearResultsTimeout);
            this.clearResultsTimeout = undefined;
        }

        const run = this.testController.createTestRun(request);
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            run.end();
            return;
        }

        const testItems = this.collectTestItems(request);
        const testIds = testItems.map(item => item.id);
        const passedItems: vscode.TestItem[] = [];

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

                for (const testResult of result.results) {
                    const testItem = this.findTestItem(testResult.testId);
                    if (!testItem) {
                        continue;
                    }

                    switch (testResult.status) {
                        case TestStatus.Passed:
                            run.passed(testItem, testResult.duration);
                            passedItems.push(testItem);
                            break;
                        case TestStatus.Failed:
                            run.failed(
                                testItem,
                                new vscode.TestMessage(
                                    testResult.errorMessage ?? 'Test failed'
                                ),
                                testResult.duration
                            );
                            break;
                        case TestStatus.Skipped:
                            run.skipped(testItem);
                            break;
                        default:
                            run.skipped(testItem);
                    }
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

    private findTestItem(testId: string): vscode.TestItem | undefined {
        const parts = testId.split('::');
        let currentItems = this.testController.items;
        let result: vscode.TestItem | undefined;

        for (let i = 0; i < parts.length; i++) {
            const partialId = parts.slice(0, i + 1).join('::');
            let foundItem: vscode.TestItem | undefined;
            
            currentItems.forEach(item => {
                if (item.id === partialId || item.id === testId) {
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
}
