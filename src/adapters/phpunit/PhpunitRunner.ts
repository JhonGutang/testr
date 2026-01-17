import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { TestRunResult, TestExecutionResult, TestStatus } from '../../types';
import { PHPUNIT_BIN_PATHS } from '../../config';
import { OutputLogger } from '../../ui/OutputLogger';



export class PhpunitRunner {
    private readonly outputLogger: OutputLogger;

    constructor(outputLogger: OutputLogger) {
        this.outputLogger = outputLogger;
    }

    async runTests(
        workspaceFolder: vscode.WorkspaceFolder,
        testIds: ReadonlyArray<string>,
        token: vscode.CancellationToken
    ): Promise<TestRunResult> {
        const workspacePath = workspaceFolder.uri.fsPath;
        const phpunitPath = await this.findPhpunitExecutable(workspacePath);
        const tempXmlFile = path.join(workspacePath, `testr-junit-${Date.now()}.xml`);

        if (!phpunitPath) {
            this.outputLogger.logError('PHPUnit executable not found');
            return this.createEmptyResult();
        }

        const testFilters = this.buildTestFilters(testIds);
        const args = this.buildPhpunitArgs(testFilters, phpunitPath, tempXmlFile);

        return new Promise<TestRunResult>((resolve) => {
            console.log('[Testr] Spawning PHPUnit:', phpunitPath, args.join(' '));
            console.log('[Testr] Working directory:', workspacePath);
            this.outputLogger.logInfo(`Executing PHPUnit with ${testFilters.length} test filter(s)`);

            const process = cp.spawn(phpunitPath, args, {
                cwd: workspacePath,
                shell: true,
                env: { ...globalThis.process.env }
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
                this.cleanupTempFile(tempXmlFile);
                resolve(this.createEmptyResult());
            });

            if (token.isCancellationRequested) {
                process.kill();
                cancelHandler.dispose();
                this.cleanupTempFile(tempXmlFile);
                resolve(this.createEmptyResult());
                return;
            }

            process.on('close', async (code) => {
                console.log('[Testr] PHPUnit exited with code:', code);
                cancelHandler.dispose();

                // Parse XML result if exists
                let result: TestRunResult;
                if (fs.existsSync(tempXmlFile)) {
                    const xmlContent = await fs.promises.readFile(tempXmlFile, 'utf-8');
                    result = this.parseJunitXml(xmlContent, stdout + stderr, testIds);
                    this.cleanupTempFile(tempXmlFile);
                } else {
                    console.log('[Testr] No JUnit XML generated, falling back to stdout parsing');
                    result = this.parsePhpunitOutput(stdout, stderr, testIds);
                }
                
                console.log('[Testr] Parsed results:', result.passed, 'passed,', result.failed, 'failed');
                resolve(result);
            });

            process.on('error', (err) => {
                console.log('[Testr] Process error:', err);
                cancelHandler.dispose();
                this.cleanupTempFile(tempXmlFile);
                resolve(this.createEmptyResult());
            });
        });
    }

    private cleanupTempFile(filePath: string): void {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (e) {
            console.error('[Testr] Failed to cleanup temp file:', e);
        }
    }

    private async findPhpunitExecutable(workspacePath: string): Promise<string | undefined> {
        const vendorPhpunit = path.join(workspacePath, PHPUNIT_BIN_PATHS.vendor);
        
        if (fs.existsSync(vendorPhpunit)) {
            return vendorPhpunit;
        }

        const artisanPath = path.join(workspacePath, 'artisan');
        if (fs.existsSync(artisanPath)) {
            return 'php';
        }

        return PHPUNIT_BIN_PATHS.fallback;
    }

    private buildTestFilters(testIds: ReadonlyArray<string>): string[] {
        if (testIds.length === 0) {
            return [];
        }

        return testIds.map(id => {
            const parts = id.split('::');
            if (parts.length >= 3) {
                const className = parts[parts.length - 2];
                const methodName = parts[parts.length - 1];
                return `${className}::${methodName}`;
            } else if (parts.length === 2) {
                return parts[1];
            }
            return '';
        }).filter(pattern => pattern.length > 0);
    }

    private buildPhpunitArgs(testFilters: string[], executablePath: string, tempXmlPath: string): string[] {
        const args: string[] = ['--testdox', '--log-junit', `"${tempXmlPath}"`];

        if (executablePath === 'php') {
             args.unshift('artisan', 'test');
        } 
        
        if (testFilters.length > 0) {
            const filterPattern = testFilters.join('|');
            args.push('--filter', `"${filterPattern}"`);
        }

        return args;
    }

    private parseJunitXml(xml: string, stdOutput: string, testIds: ReadonlyArray<string>): TestRunResult {
        try {
            const results: TestExecutionResult[] = [];
            let passed = 0;
            let failed = 0;
            let skipped = 0;
            let totalDuration = 0;

            // Simple regex parser for JUnit XML
            // <testcase name="test_example" class="Tests\Feature\ExampleTest" classname="Tests.Feature.ExampleTest" file="/path/to/file.php" line="14" assertions="1" time="0.005432">
            const testCaseRegex = /<testcase\s+([^>]+)>(.*?)<\/testcase>|<testcase\s+([^>]+)\/>/gs;
            let match;

            while ((match = testCaseRegex.exec(xml)) !== null) {
                const attributes = match[1] || match[3] || '';
                const body = match[2] || '';

                const nameMatch = attributes.match(/name="([^"]+)"/);
                const fileMatch = attributes.match(/file="([^"]+)"/);
                const timeMatch = attributes.match(/time="([^"]+)"/);
                const classMatch = attributes.match(/class="([^"]+)"/);
                
                if (!nameMatch || !fileMatch) continue;

                const name = nameMatch[1];
                const file = fileMatch[1];
                const time = timeMatch ? parseFloat(parseFloat(timeMatch[1]).toFixed(2)) * 1000 : 0; // Convert to ms
                const className = classMatch ? classMatch[1].split('\\').pop() : '';

                // Generate ID to match with requested IDs
                const fileId = file.replace(/[\\/:]/g, '_');
                // We try to reconstruct the ID: fileId::ClassName::MethodName
                // If we can't get class name easily, we might struggle. 
                // However, standard PHPUnit XML usually has 'class' or 'classname'.
                
                // Construct potential IDs to match against known testIds
                // Note: testIds are guaranteed to be correct if passed from VS Code.
                // We need to find which one matches this result.
                
                const matchedId = testIds.find(id => {
                    return id.includes(name) && (id.includes(fileId) || (className && id.includes(className)));
                }) || `${fileId}::${className}::${name}`; // Fallback

                totalDuration += time;

                let status = TestStatus.Passed;
                let errorMessage: string | undefined;

                if (body.includes('<failure') || body.includes('<error')) {
                    status = TestStatus.Failed;
                    failed++;
                    const msgMatch = body.match(/message="([^"]+)"/);
                    errorMessage = msgMatch ? msgMatch[1] : 'Test failed';
                } else if (body.includes('<skipped')) {
                    status = TestStatus.Skipped;
                    skipped++;
                } else {
                    passed++;
                }

                results.push({
                    testId: matchedId,
                    status,
                    duration: time,
                    errorMessage,
                    errorStack: errorMessage
                });
            }

            // Fallback for total stats if XML parsing was incomplete or weird
            const timeMatch = xml.match(/<testsuite[^>]+time="([^"]+)"/);
            const suiteDuration = timeMatch ? parseFloat(parseFloat(timeMatch[1]).toFixed(2)) * 1000 : totalDuration;

            return {
                passed,
                failed,
                skipped,
                duration: suiteDuration,
                results
            };
        } catch (e) {
            console.error('[Testr] Error parsing JUnit XML:', e);
            return this.parsePhpunitOutput(stdOutput, '', testIds);
        }
    }

    private parsePhpunitOutput(
        stdout: string,
        stderr: string,
        testIds: ReadonlyArray<string>
    ): TestRunResult {
        // ... (Keep existing implementation as fallback)
        try {
            const combinedOutput = stdout + stderr;
            
            const passedMatch = combinedOutput.match(/(\d+)\s+passed/i);
            const failedMatch = combinedOutput.match(/(\d+)\s+failed/i);
            const skippedMatch = combinedOutput.match(/(\d+)\s+skipped/i);
            const errorMatch = combinedOutput.match(/(\d+)\s+error/i);

            const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
            const failed = (failedMatch ? parseInt(failedMatch[1], 10) : 0) + 
                          (errorMatch ? parseInt(errorMatch[1], 10) : 0);
            const skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;

            const altPassMatch = combinedOutput.match(/OK\s*\((\d+)\s+test/i);
            const altFailMatch = combinedOutput.match(/FAILURES!\s*Tests:\s*(\d+)/i);

            let finalPassed = passed;
            let finalFailed = failed;

            if (altPassMatch && passed === 0) {
                finalPassed = parseInt(altPassMatch[1], 10);
            }
            if (altFailMatch && failed === 0) {
                const failureDetails = combinedOutput.match(/Failures:\s*(\d+)/i);
                if (failureDetails) {
                    finalFailed = parseInt(failureDetails[1], 10);
                }
            }

            const results: TestExecutionResult[] = this.extractTestResults(combinedOutput, testIds);

            const timeMatch = combinedOutput.match(/Time:\s*([\d.:]+)(?:\s*(?:seconds?|ms))?/i);
            let duration = 0;
            
            if (timeMatch) {
                const timeStr = timeMatch[1];
                if (timeStr.includes(':')) {
                    // Handle MM:SS.SSS
                    const parts = timeStr.split(':');
                    if (parts.length === 2) {
                        const minutes = parseInt(parts[0], 10);
                        const seconds = parseFloat(parts[1]);
                        duration = (minutes * 60 + seconds) * 1000;
                    }
                } else {
                    // Handle simple seconds or ms
                    const val = parseFloat(timeStr);
                    if (combinedOutput.match(/ms/i) && !combinedOutput.match(/seconds?/i)) {
                         duration = val;
                    } else {
                        // Default to seconds if not specified or specified as seconds
                        duration = val * 1000;
                    }
                }
            }

            return {
                passed: finalPassed,
                failed: finalFailed,
                skipped,
                duration,
                results
            };
        } catch (error) {
            console.log('[Testr] Error parsing PHPUnit output:', error);
            return this.createEmptyResult();
        }
    }

    private extractTestResults(
        output: string,
        testIds: ReadonlyArray<string>
    ): TestExecutionResult[] {
        const results: TestExecutionResult[] = [];

        for (const testId of testIds) {
            const parts = testId.split('::');
            const testName = parts[parts.length - 1];
            
            const passPattern = new RegExp(`✓|✔|PASS.*${this.escapeRegex(testName)}|${this.escapeRegex(testName)}.*OK`, 'i');
            const failPattern = new RegExp(`✗|✘|FAIL.*${this.escapeRegex(testName)}|${this.escapeRegex(testName)}.*FAIL`, 'i');
            
            let status = TestStatus.Passed;
            let errorMessage: string | undefined;

            if (failPattern.test(output)) {
                status = TestStatus.Failed;
                const errorMatch = output.match(new RegExp(`${this.escapeRegex(testName)}[\\s\\S]*?(Expected|Assert|Error|Exception)[\\s\\S]*?(?=\\n\\n|$)`, 'i'));
                if (errorMatch) {
                    errorMessage = errorMatch[0].substring(0, 500);
                }
            } else if (!passPattern.test(output) && output.includes('FAILURES')) {
                status = TestStatus.Failed;
            }

            results.push({
                testId,
                status,
                duration: 0,
                errorMessage,
                errorStack: errorMessage
            });
        }

        return results;
    }

    private escapeRegex(pattern: string): string {
        return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
