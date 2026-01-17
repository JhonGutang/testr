import * as vscode from 'vscode';
import { AdapterRegistry } from '../adapters/AdapterRegistry';
import { TestSuite, TestCase, TestItemData, TestFramework, isTestSuite } from '../types';
import { TestFileWatcher } from './TestFileWatcher';
import { OutputLogger } from '../ui/OutputLogger';

export class TestDiscoveryManager implements vscode.Disposable {
    private readonly testController: vscode.TestController;
    private readonly adapterRegistry: AdapterRegistry;
    private readonly outputLogger: OutputLogger;
    private readonly fileWatcher: TestFileWatcher;
    private readonly testDataMap: WeakMap<vscode.TestItem, TestItemData> = new WeakMap();

    constructor(
        testController: vscode.TestController,
        adapterRegistry: AdapterRegistry,
        outputLogger: OutputLogger
    ) {
        this.testController = testController;
        this.adapterRegistry = adapterRegistry;
        this.outputLogger = outputLogger;
        this.fileWatcher = new TestFileWatcher(
            () => void this.discoverAllTests()
        );
    }

    async discoverAllTests(): Promise<void> {
        console.log('[TestDiscoveryManager] discoverAllTests called');
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            console.log('[TestDiscoveryManager] No workspace folders');
            return;
        }

        this.testController.items.replace([]);

        let totalFiles = 0;
        let totalTests = 0;

        for (const folder of workspaceFolders) {
            console.log('[TestDiscoveryManager] Discovering tests in:', folder.name);
            this.outputLogger.logDiscoveryStart(folder.name);
            const result = await this.discoverTestsInWorkspace(folder);
            totalFiles += result.files;
            totalTests += result.tests;
        }

        console.log('[TestDiscoveryManager] Discovery complete:', totalFiles, 'files,', totalTests, 'tests');
        this.outputLogger.logDiscoveryComplete(totalFiles, totalTests);
    }

    async discoverTestsForItem(item: vscode.TestItem): Promise<void> {
        const data = this.testDataMap.get(item);
        if (!data) {
            return;
        }

        const adapter = this.adapterRegistry.getAdapter(data.framework);
        if (!adapter) {
            return;
        }
    }

    private async discoverTestsInWorkspace(
        workspaceFolder: vscode.WorkspaceFolder
    ): Promise<{ files: number; tests: number }> {
        const adapter = await this.adapterRegistry.detectFramework(workspaceFolder);
        if (!adapter) {
            return { files: 0, tests: 0 };
        }

        const result = await adapter.discoverTests(workspaceFolder, workspaceFolder.uri);

        for (const suite of result.suites) {
            const testItem = this.createTestItem(suite, adapter.framework);
            this.testController.items.add(testItem);
            
            const testCount = this.countTests(suite);
            this.outputLogger.logDiscoveredFile(suite.location.file, testCount);
        }

        return { files: result.suites.length, tests: result.testCount };
    }

    private countTests(suite: TestSuite | TestCase): number {
        if (!isTestSuite(suite)) {
            return 1;
        }
        
        let count = 0;
        for (const child of suite.children) {
            count += this.countTests(child);
        }
        return count;
    }

    private createTestItem(
        suite: TestSuite | TestCase,
        framework: TestFramework
    ): vscode.TestItem {
        const uri = vscode.Uri.file(suite.location.file);
        const position = new vscode.Position(
            suite.location.line - 1,
            suite.location.column - 1
        );
        const range = new vscode.Range(position, position);

        const testItem = this.testController.createTestItem(
            suite.id,
            suite.name,
            uri
        );
        testItem.range = range;

        const itemData: TestItemData = {
            type: isTestSuite(suite) ? 'suite' : 'test',
            framework
        };
        this.testDataMap.set(testItem, itemData);

        if (isTestSuite(suite)) {
            for (const child of suite.children) {
                const childItem = this.createTestItem(child, framework);
                testItem.children.add(childItem);
            }
        }

        return testItem;
    }

    getTestItemData(item: vscode.TestItem): TestItemData | undefined {
        return this.testDataMap.get(item);
    }

    dispose(): void {
        this.fileWatcher.dispose();
    }
}
