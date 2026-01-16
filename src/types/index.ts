import * as vscode from 'vscode';

export enum TestStatus {
    Pending = 'pending',
    Running = 'running',
    Passed = 'passed',
    Failed = 'failed',
    Skipped = 'skipped'
}

export enum TestFramework {
    Jest = 'jest',
    Vitest = 'vitest',
    Mocha = 'mocha'
}

export interface TestLocation {
    readonly file: string;
    readonly line: number;
    readonly column: number;
}

export interface TestCase {
    readonly id: string;
    readonly name: string;
    readonly fullName: string;
    readonly location: TestLocation;
    readonly parentId: string | undefined;
}

export interface TestSuite {
    readonly id: string;
    readonly name: string;
    readonly location: TestLocation;
    readonly children: ReadonlyArray<TestSuite | TestCase>;
    readonly parentId: string | undefined;
}

export interface TestDiscoveryResult {
    readonly framework: TestFramework;
    readonly suites: ReadonlyArray<TestSuite>;
    readonly testCount: number;
}

export interface TestExecutionResult {
    readonly testId: string;
    readonly status: TestStatus;
    readonly duration: number;
    readonly errorMessage: string | undefined;
    readonly errorStack: string | undefined;
}

export interface TestRunResult {
    readonly passed: number;
    readonly failed: number;
    readonly skipped: number;
    readonly duration: number;
    readonly results: ReadonlyArray<TestExecutionResult>;
}

export interface TestStatistics {
    readonly totalTests: number;
    readonly passedTests: number;
    readonly failedTests: number;
    readonly skippedTests: number;
    readonly totalDuration: number;
    readonly lastRunTime: Date | undefined;
}

export interface TestFrameworkAdapter {
    readonly framework: TestFramework;
    
    detectFramework(workspaceFolder: vscode.WorkspaceFolder): Promise<boolean>;
    
    discoverTests(
        workspaceFolder: vscode.WorkspaceFolder,
        testFolder: vscode.Uri
    ): Promise<TestDiscoveryResult>;
    
    runTests(
        workspaceFolder: vscode.WorkspaceFolder,
        testIds: ReadonlyArray<string>,
        token: vscode.CancellationToken
    ): Promise<TestRunResult>;
    
    parseTestFile(fileUri: vscode.Uri, content: string): TestSuite | undefined;
}

export interface TestItemData {
    readonly type: 'suite' | 'test';
    readonly framework: TestFramework;
}

export function isTestSuite(item: TestSuite | TestCase): item is TestSuite {
    return 'children' in item;
}
