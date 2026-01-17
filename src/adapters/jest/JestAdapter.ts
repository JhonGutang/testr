import * as vscode from 'vscode';
import {
    TestFramework,
    TestFrameworkAdapter,
    TestDiscoveryResult,
    TestRunResult,
    TestSuite
} from '../../types';
import { JEST_CONFIG_FILES, JEST_TEST_PATTERNS } from '../../config';
import { JestParser } from './JestParser';
import { JestRunner } from './JestRunner';
import { OutputLogger } from '../../ui/OutputLogger';

export class JestAdapter implements TestFrameworkAdapter {
    readonly framework = TestFramework.Jest;
    private readonly parser: JestParser;
    private readonly runner: JestRunner;

    constructor(outputLogger: OutputLogger) {
        this.parser = new JestParser();
        this.runner = new JestRunner(outputLogger);
    }

    async detectFramework(
        workspaceFolder: vscode.WorkspaceFolder
    ): Promise<boolean> {
        const packageJsonUri = vscode.Uri.joinPath(
            workspaceFolder.uri,
            'package.json'
        );

        try {
            const packageJsonContent = await vscode.workspace.fs.readFile(packageJsonUri);
            const packageJson = JSON.parse(
                Buffer.from(packageJsonContent).toString('utf-8')
            ) as Record<string, unknown>;

            const dependencies = packageJson['dependencies'] as Record<string, string> | undefined;
            const devDependencies = packageJson['devDependencies'] as Record<string, string> | undefined;

            const hasJest = 
                dependencies?.['jest'] !== undefined ||
                devDependencies?.['jest'] !== undefined;

            if (hasJest) {
                return true;
            }

            for (const configFile of JEST_CONFIG_FILES) {
                const configUri = vscode.Uri.joinPath(workspaceFolder.uri, configFile);
                try {
                    await vscode.workspace.fs.stat(configUri);
                    return true;
                } catch {
                    // Config file doesn't exist, continue checking
                }
            }

            return false;
        } catch {
            return false;
        }
    }

    async discoverTests(
        _workspaceFolder: vscode.WorkspaceFolder,
        testFolder: vscode.Uri
    ): Promise<TestDiscoveryResult> {
        const suites: TestSuite[] = [];
        let testCount = 0;

        const testFiles = await this.findTestFiles(testFolder);

        for (const fileUri of testFiles) {
            try {
                const content = await vscode.workspace.fs.readFile(fileUri);
                const contentString = Buffer.from(content).toString('utf-8');
                const suite = this.parseTestFile(fileUri, contentString);

                if (suite) {
                    suites.push(suite);
                    testCount += this.countTests(suite);
                }
            } catch {
                // Skip files that can't be read
            }
        }

        return {
            framework: this.framework,
            suites,
            testCount
        };
    }

    async runTests(
        workspaceFolder: vscode.WorkspaceFolder,
        testIds: ReadonlyArray<string>,
        token: vscode.CancellationToken
    ): Promise<TestRunResult> {
        return this.runner.runTests(workspaceFolder, testIds, token);
    }

    parseTestFile(fileUri: vscode.Uri, content: string): TestSuite | undefined {
        return this.parser.parseTestFile(fileUri, content);
    }

    private async findTestFiles(folder: vscode.Uri): Promise<vscode.Uri[]> {
        const testFiles: vscode.Uri[] = [];
        const excludePattern = '**/node_modules/**';

        for (const pattern of JEST_TEST_PATTERNS) {
            const relativePattern = new vscode.RelativePattern(folder, pattern);
            const files = await vscode.workspace.findFiles(relativePattern, excludePattern);
            testFiles.push(...files);
        }

        return testFiles;
    }

    private countTests(suite: TestSuite): number {
        let count = 0;
        for (const child of suite.children) {
            if ('children' in child) {
                count += this.countTests(child);
            } else {
                count += 1;
            }
        }
        return count;
    }
}
