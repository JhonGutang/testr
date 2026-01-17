import * as vscode from 'vscode';
import {
    TestFramework,
    TestFrameworkAdapter,
    TestDiscoveryResult,
    TestRunResult,
    TestSuite
} from '../../types';
import { PHPUNIT_CONFIG_FILES, PHPUNIT_TEST_PATTERNS } from '../../config';
import { PhpunitParser } from './PhpunitParser';
import { PhpunitRunner } from './PhpunitRunner';
import { OutputLogger } from '../../ui/OutputLogger';

export class PhpunitAdapter implements TestFrameworkAdapter {
    readonly framework = TestFramework.Phpunit;
    private readonly parser: PhpunitParser;
    private readonly runner: PhpunitRunner;

    constructor(outputLogger: OutputLogger) {
        this.parser = new PhpunitParser();
        this.runner = new PhpunitRunner(outputLogger);
    }

    async detectFramework(
        workspaceFolder: vscode.WorkspaceFolder
    ): Promise<boolean> {
        for (const configFile of PHPUNIT_CONFIG_FILES) {
            const configUri = vscode.Uri.joinPath(workspaceFolder.uri, configFile);
            try {
                await vscode.workspace.fs.stat(configUri);
                return true;
            } catch {
                // Config file doesn't exist, continue checking
            }
        }

        const composerJsonUri = vscode.Uri.joinPath(
            workspaceFolder.uri,
            'composer.json'
        );

        try {
            const composerJsonContent = await vscode.workspace.fs.readFile(composerJsonUri);
            const composerJson = JSON.parse(
                Buffer.from(composerJsonContent).toString('utf-8')
            ) as Record<string, unknown>;

            const require = composerJson['require'] as Record<string, string> | undefined;
            const requireDev = composerJson['require-dev'] as Record<string, string> | undefined;

            const hasPhpunit = 
                require?.['phpunit/phpunit'] !== undefined ||
                requireDev?.['phpunit/phpunit'] !== undefined;

            if (hasPhpunit) {
                return true;
            }
        } catch {
            // composer.json doesn't exist or can't be parsed
        }

        const artisanUri = vscode.Uri.joinPath(workspaceFolder.uri, 'artisan');
        try {
            await vscode.workspace.fs.stat(artisanUri);
            return true;
        } catch {
            // Not a Laravel project
        }

        return false;
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
        const excludePattern = '**/vendor/**';

        for (const pattern of PHPUNIT_TEST_PATTERNS) {
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
