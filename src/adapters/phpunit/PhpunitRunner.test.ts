import * as vscode from 'vscode';
import * as cp from 'child_process';
import { PhpunitRunner } from './PhpunitRunner';
import { OutputLogger } from '../../ui/OutputLogger';
import { TestStatus } from '../../types';
import { EventEmitter } from 'events';

// Mock fs
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    promises: {
        readFile: jest.fn()
    },
    unlinkSync: jest.fn()
}));
const mockFs = require('fs');

// Mock OutputLogger
const mockOutputLogger = {
    logInfo: jest.fn(),
    logError: jest.fn(),
    logDiscoveryStart: jest.fn(),
    logDiscoveryComplete: jest.fn(),
    logDiscoveredFile: jest.fn()
} as unknown as OutputLogger;

// Mock child_process
jest.mock('child_process');
const mockSpawn = cp.spawn as jest.Mock;

describe('PhpunitRunner', () => {
    let runner: PhpunitRunner;
    let mockProcess: any;



    beforeEach(() => {
        jest.clearAllMocks();
        runner = new PhpunitRunner(mockOutputLogger);

        // Setup mock process
        mockProcess = new EventEmitter();
        mockProcess.stdout = new EventEmitter();
        mockProcess.stderr = new EventEmitter();
        mockProcess.kill = jest.fn();
        mockSpawn.mockReturnValue(mockProcess);
        
        // Default fs mocks
        mockFs.existsSync.mockReturnValue(false); // Default to no XML file, use stdout fallback
    });

    const mockWorkspaceFolder = {
        uri: vscode.Uri.file('/workspace'),
        name: 'workspace',
        index: 0
    };

    it('should handle successful test run', async () => {
        const promise = runner.runTests(
            mockWorkspaceFolder,
            ['file_php::UserTest::testExample'],
            new vscode.CancellationTokenSource().token
        );

        // Simulate PHPUnit output with --testdox
        setTimeout(() => {
            const output = `
PHPUnit 9.5.10 by Sebastian Bergmann and contributors.

UserTest
 ✔ Example

Time: 00:00.005, Memory: 6.00 MB

OK (1 test, 1 assertion)
`;
            mockProcess.stdout.emit('data', Buffer.from(output));
            mockProcess.emit('close', 0);
        }, 10);

        const result = await promise;

        expect(result.passed).toBe(1);
        expect(result.failed).toBe(0);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].status).toBe(TestStatus.Passed);
        expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle failed test run', async () => {
        const promise = runner.runTests(
            mockWorkspaceFolder,
            ['file_php::UserTest::testExample'],
            new vscode.CancellationTokenSource().token
        );

        setTimeout(() => {
            const output = `
PHPUnit 9.5.10 by Sebastian Bergmann and contributors.

UserTest
 ✘ Example

Time: 00:00.005, Memory: 6.00 MB

Summary of non-successful tests:

UserTest
 ✘ Example
   │
   │ Failed asserting that false is true.
   │
   │ /path/to/UserTest.php:14
   │

FAILURES!
Tests: 1, Assertions: 1, Failures: 1.
`;
            mockProcess.stdout.emit('data', Buffer.from(output));
            mockProcess.emit('close', 1);
        }, 10);

        const result = await promise;

        expect(result.passed).toBe(0);
        expect(result.failed).toBe(1);
        expect(result.results[0].status).toBe(TestStatus.Failed);
    });

    it('should handle cancellation', async () => {
        const tokenSource = new vscode.CancellationTokenSource();
        const promise = runner.runTests(
            mockWorkspaceFolder,
            ['file_php::UserTest::testExample'],
            tokenSource.token
        );

        tokenSource.cancel();
        
        const result = await promise;
        
        expect(mockProcess.kill).toHaveBeenCalled();
        expect(result.results).toHaveLength(0);
    });
    it('should parse JUnit XML output for accurate duration', async () => {
        const promise = runner.runTests(
            mockWorkspaceFolder,
            ['file_php::UserTest::testExample'],
            new vscode.CancellationTokenSource().token
        );

        const xmlOutput = `
            <?xml version="1.0" encoding="UTF-8"?>
            <testsuites>
                <testsuite name="" tests="1" assertions="1" errors="0" failures="0" skipped="0" time="0.123456">
                    <testcase name="testExample" class="Tests\\Feature\\UserTest" classname="Tests.Feature.UserTest" file="/workspace/tests/Feature/UserTest.php" line="14" assertions="1" time="0.123456"/>
                </testsuite>
            </testsuites>
        `;

        mockFs.existsSync.mockReturnValue(true);
        mockFs.promises.readFile.mockResolvedValue(xmlOutput);

        setTimeout(() => {
            mockProcess.emit('close', 0);
        }, 10);

        const result = await promise;

        expect(result.passed).toBe(1);
        expect(result.duration).toBeCloseTo(120, 1);
        expect(result.results[0].duration).toBeCloseTo(120, 1);
        expect(mockFs.unlinkSync).toHaveBeenCalled();
    });
});
