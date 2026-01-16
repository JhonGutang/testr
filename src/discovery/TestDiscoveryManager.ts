import * as vscode from 'vscode';
import { AdapterRegistry } from '../adapters/AdapterRegistry';
import { TestSuite, TestCase, TestItemData, TestFramework, isTestSuite } from '../types';
import { TestFileWatcher } from './TestFileWatcher';

export class TestDiscoveryManager implements vscode.Disposable {
    private readonly testController: vscode.TestController;
    private readonly adapterRegistry: AdapterRegistry;
    private readonly fileWatcher: TestFileWatcher;
    private readonly testDataMap: WeakMap<vscode.TestItem, TestItemData> = new WeakMap();

    constructor(
        testController: vscode.TestController,
        adapterRegistry: AdapterRegistry
    ) {
        this.testController = testController;
        this.adapterRegistry = adapterRegistry;
        this.fileWatcher = new TestFileWatcher(
            () => void this.discoverAllTests()
        );
    }

    async discoverAllTests(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        this.testController.items.replace([]);

        for (const folder of workspaceFolders) {
            await this.discoverTestsInWorkspace(folder);
        }
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
    ): Promise<void> {
        const adapter = await this.adapterRegistry.detectFramework(workspaceFolder);
        if (!adapter) {
            return;
        }

        const result = await adapter.discoverTests(workspaceFolder, workspaceFolder.uri);

        for (const suite of result.suites) {
            const testItem = this.createTestItem(suite, adapter.framework);
            this.testController.items.add(testItem);
        }
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
