import * as vscode from 'vscode';
import { TestDiscoveryManager } from './discovery/TestDiscoveryManager';
import { TestExecutionManager } from './execution/TestExecutionManager';
import { AdapterRegistry } from './adapters/AdapterRegistry';
import { JestAdapter } from './adapters/jest/JestAdapter';
import { StatusBarManager } from './ui/StatusBarManager';

let testController: vscode.TestController;
let discoveryManager: TestDiscoveryManager;
let executionManager: TestExecutionManager;
let adapterRegistry: AdapterRegistry;
let statusBarManager: StatusBarManager;

export function activate(context: vscode.ExtensionContext): void {
    testController = vscode.tests.createTestController('testr', 'Testr');
    context.subscriptions.push(testController);

    adapterRegistry = new AdapterRegistry();
    adapterRegistry.registerAdapter(new JestAdapter());

    statusBarManager = new StatusBarManager();
    context.subscriptions.push(statusBarManager);

    discoveryManager = new TestDiscoveryManager(
        testController,
        adapterRegistry
    );
    context.subscriptions.push(discoveryManager);

    executionManager = new TestExecutionManager(
        testController,
        adapterRegistry,
        statusBarManager
    );

    testController.resolveHandler = async (item): Promise<void> => {
        if (!item) {
            await discoveryManager.discoverAllTests();
            return;
        }
        await discoveryManager.discoverTestsForItem(item);
    };

    const runProfile = testController.createRunProfile(
        'Run Tests',
        vscode.TestRunProfileKind.Run,
        async (request, token): Promise<void> => {
            await executionManager.runTests(request, token);
        },
        true
    );
    context.subscriptions.push(runProfile);

    const runAllCommand = vscode.commands.registerCommand(
        'testr.runAllTests',
        async (): Promise<void> => {
            const request = new vscode.TestRunRequest();
            await executionManager.runTests(
                request,
                new vscode.CancellationTokenSource().token
            );
        }
    );
    context.subscriptions.push(runAllCommand);

    const refreshCommand = vscode.commands.registerCommand(
        'testr.refreshTests',
        async (): Promise<void> => {
            await discoveryManager.discoverAllTests();
        }
    );
    context.subscriptions.push(refreshCommand);

    void discoveryManager.discoverAllTests();
}

export function deactivate(): void {
    // Cleanup handled by disposables
}
