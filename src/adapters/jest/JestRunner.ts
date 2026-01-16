import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { TestRunResult, TestExecutionResult, TestStatus } from '../../types';
import { JEST_BIN_PATHS } from '../../config';

interface JestTestResult {
    ancestorTitles: string[];
    title: string;
    status: 'passed' | 'failed' | 'pending' | 'skipped';
    duration: number | null;
    failureMessages: string[];
}

interface JestTestSuiteResult {
    testFilePath: string;
    testResults: JestTestResult[];
}

interface JestJsonOutput {
    success: boolean;
    numTotalTests: number;
    numPassedTests: number;
    numFailedTests: number;
    numPendingTests: number;
    testResults: JestTestSuiteResult[];
}

export class JestRunner {
    async runTests(
        workspaceFolder: vscode.WorkspaceFolder,
        testIds: ReadonlyArray<string>,
        token: vscode.CancellationToken
    ): Promise<TestRunResult> {
        const workspacePath = workspaceFolder.uri.fsPath;
        const jestPath = await this.findJestExecutable(workspacePath);

        if (!jestPath) {
            return this.createEmptyResult();
        }

        const testPatterns = this.buildTestPatterns(testIds);
        const args = this.buildJestArgs(testPatterns);

        return new Promise<TestRunResult>((resolve) => {
            console.log('[Testr] Spawning Jest:', jestPath, args.join(' '));
            console.log('[Testr] Working directory:', workspacePath);
            
            const process = cp.spawn(jestPath, args, {
                cwd: workspacePath,
                shell: true,
                env: { ...globalThis.process.env, CI: 'true' }
            });

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            const cancelHandler = token.onCancellationRequested(() => {
                process.kill();
                resolve(this.createEmptyResult());
            });

            process.on('close', (code) => {
                console.log('[Testr] Jest exited with code:', code);
                console.log('[Testr] stdout length:', stdout.length);
                console.log('[Testr] stderr:', stderr.substring(0, 500));
                cancelHandler.dispose();
                const result = this.parseJestOutput(stdout, testIds);
                console.log('[Testr] Parsed results:', result.passed, 'passed,', result.failed, 'failed');
                resolve(result);
            });

            process.on('error', (err) => {
                console.log('[Testr] Process error:', err);
                cancelHandler.dispose();
                resolve(this.createEmptyResult());
            });
        });
    }

    private async findJestExecutable(workspacePath: string): Promise<string | undefined> {
        const localJest = path.join(workspacePath, JEST_BIN_PATHS.unix);
        const localJestCmd = path.join(workspacePath, JEST_BIN_PATHS.windows);

        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(localJestCmd));
            return localJestCmd;
        } catch {
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(localJest));
                return localJest;
            } catch {
                return JEST_BIN_PATHS.fallback;
            }
        }
    }

    private buildTestPatterns(testIds: ReadonlyArray<string>): string[] {
        if (testIds.length === 0) {
            return [];
        }

        return testIds.map(id => {
            const parts = id.split('::');
            if (parts.length > 1) {
                return parts.slice(1).join(' ');
            }
            return '';
        }).filter(pattern => pattern.length > 0);
    }

    private buildJestArgs(testPatterns: string[]): string[] {
        const args = ['--json', '--testLocationInResults'];

        if (testPatterns.length > 0) {
            const pattern = testPatterns.join('|');
            args.push('--testNamePattern', `"${pattern}"`);
        }

        return args;
    }

    private parseJestOutput(
        stdout: string,
        _testIds: ReadonlyArray<string>
    ): TestRunResult {
        try {
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return this.createEmptyResult();
            }

            const jestOutput = JSON.parse(jsonMatch[0]) as JestJsonOutput;
            const results: TestExecutionResult[] = [];

            for (const suiteResult of jestOutput.testResults) {
                for (const testResult of suiteResult.testResults) {
                    const testId = this.buildTestId(
                        suiteResult.testFilePath,
                        testResult.ancestorTitles,
                        testResult.title
                    );

                    results.push({
                        testId,
                        status: this.mapJestStatus(testResult.status),
                        duration: testResult.duration ?? 0,
                        errorMessage: testResult.failureMessages[0],
                        errorStack: testResult.failureMessages.join('\n')
                    });
                }
            }

            return {
                passed: jestOutput.numPassedTests,
                failed: jestOutput.numFailedTests,
                skipped: jestOutput.numPendingTests,
                duration: results.reduce((sum, r) => sum + r.duration, 0),
                results
            };
        } catch {
            return this.createEmptyResult();
        }
    }

    private buildTestId(
        filePath: string,
        ancestorTitles: string[],
        title: string
    ): string {
        const fileId = filePath.replace(/[\\/:]/g, '_');
        const parts = [fileId, ...ancestorTitles, title];
        return parts.join('::');
    }

    private mapJestStatus(
        status: 'passed' | 'failed' | 'pending' | 'skipped'
    ): TestStatus {
        switch (status) {
            case 'passed':
                return TestStatus.Passed;
            case 'failed':
                return TestStatus.Failed;
            case 'pending':
            case 'skipped':
                return TestStatus.Skipped;
            default:
                return TestStatus.Pending;
        }
    }

    private createEmptyResult(): TestRunResult {
        return {
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            results: []
        };
    }
}
