import { TestStatus, TestRunResult } from '../../types';
import { JestRunner } from './JestRunner';
import { OutputLogger } from '../../ui/OutputLogger';

// Create a mock output logger
const mockOutputLogger = {
    logDiscoveryStart: jest.fn(),
    logDiscoveredFile: jest.fn(),
    logDiscoveryComplete: jest.fn(),
    logExecutionStart: jest.fn(),
    logTestFile: jest.fn(),
    logTestResult: jest.fn(),
    logTestError: jest.fn(),
    logFileStats: jest.fn(),
    logOverallStats: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn(),
    show: jest.fn(),
    dispose: jest.fn()
} as unknown as OutputLogger;

describe('JestRunner', () => {
    let runner: JestRunner;

    beforeEach(() => {
        runner = new JestRunner(mockOutputLogger);
    });

    describe('buildTestPatterns', () => {
        it('should return empty array for empty test IDs', () => {
            // Access the private method through the instance
            const buildTestPatterns = (runner as unknown as { buildTestPatterns: (ids: string[]) => string[] }).buildTestPatterns.bind(runner);
            const result = buildTestPatterns([]);
            expect(result).toEqual([]);
        });

        it('should extract test names from test IDs', () => {
            const buildTestPatterns = (runner as unknown as { buildTestPatterns: (ids: string[]) => string[] }).buildTestPatterns.bind(runner);
            const testIds = [
                'file_path_test_ts::describe block::test name'
            ];
            const result = buildTestPatterns(testIds);
            expect(result).toHaveLength(1);
            expect(result[0]).toContain('describe block');
            expect(result[0]).toContain('test name');
        });

        it('should handle IDs without nested parts', () => {
            const buildTestPatterns = (runner as unknown as { buildTestPatterns: (ids: string[]) => string[] }).buildTestPatterns.bind(runner);
            const testIds = ['just_a_file'];
            const result = buildTestPatterns(testIds);
            expect(result).toEqual([]);
        });
    });

    describe('buildJestArgs', () => {
        it('should include base args', () => {
            const buildJestArgs = (runner as unknown as { buildJestArgs: (patterns: string[]) => string[] }).buildJestArgs.bind(runner);
            const result = buildJestArgs([]);
            expect(result).toContain('--json');
            expect(result).toContain('--testLocationInResults');
        });

        it('should add testNamePattern when patterns provided', () => {
            const buildJestArgs = (runner as unknown as { buildJestArgs: (patterns: string[]) => string[] }).buildJestArgs.bind(runner);
            const result = buildJestArgs(['pattern1', 'pattern2']);
            expect(result).toContain('--testNamePattern');
            expect(result.some(arg => arg.includes('pattern1'))).toBe(true);
            expect(result.some(arg => arg.includes('pattern2'))).toBe(true);
        });
    });

    describe('parseJestOutput', () => {
        it('should parse valid Jest JSON output', () => {
            const parseJestOutput = (runner as unknown as { parseJestOutput: (stdout: string, testIds: string[]) => TestRunResult }).parseJestOutput.bind(runner);
            
            const jestOutput = JSON.stringify({
                success: true,
                numTotalTests: 2,
                numPassedTests: 2,
                numFailedTests: 0,
                numPendingTests: 0,
                testResults: [{
                    name: '/path/to/test.ts',
                    assertionResults: [
                        {
                            ancestorTitles: ['Suite'],
                            title: 'test 1',
                            status: 'passed',
                            duration: 10,
                            failureMessages: []
                        },
                        {
                            ancestorTitles: ['Suite'],
                            title: 'test 2',
                            status: 'passed',
                            duration: 20,
                            failureMessages: []
                        }
                    ]
                }]
            });

            const result = parseJestOutput(jestOutput, []);
            expect(result.passed).toBe(2);
            expect(result.failed).toBe(0);
            expect(result.results).toHaveLength(2);
        });

        it('should handle failed tests', () => {
            const parseJestOutput = (runner as unknown as { parseJestOutput: (stdout: string, testIds: string[]) => TestRunResult }).parseJestOutput.bind(runner);
            
            const jestOutput = JSON.stringify({
                success: false,
                numTotalTests: 1,
                numPassedTests: 0,
                numFailedTests: 1,
                numPendingTests: 0,
                testResults: [{
                    name: '/path/to/test.ts',
                    assertionResults: [
                        {
                            ancestorTitles: ['Suite'],
                            title: 'failing test',
                            status: 'failed',
                            duration: 15,
                            failureMessages: ['Expected true to be false']
                        }
                    ]
                }]
            });

            const result = parseJestOutput(jestOutput, []);
            expect(result.failed).toBe(1);
            expect(result.results[0].errorMessage).toBe('Expected true to be false');
        });

        it('should return empty result for invalid JSON', () => {
            const parseJestOutput = (runner as unknown as { parseJestOutput: (stdout: string, testIds: string[]) => TestRunResult }).parseJestOutput.bind(runner);
            const result = parseJestOutput('not valid json', []);
            expect(result.passed).toBe(0);
            expect(result.failed).toBe(0);
            expect(result.results).toEqual([]);
        });

        it('should return empty result when no JSON found', () => {
            const parseJestOutput = (runner as unknown as { parseJestOutput: (stdout: string, testIds: string[]) => TestRunResult }).parseJestOutput.bind(runner);
            const result = parseJestOutput('some console output without json', []);
            expect(result.passed).toBe(0);
            expect(result.results).toEqual([]);
        });
    });

    describe('buildTestId', () => {
        it('should build test ID from file path, ancestors, and title', () => {
            const buildTestId = (runner as unknown as { buildTestId: (filePath: string, ancestors: string[], title: string) => string }).buildTestId.bind(runner);
            const result = buildTestId('/path/to/test.ts', ['Suite', 'Nested'], 'test name');
            expect(result).toContain('Suite');
            expect(result).toContain('Nested');
            expect(result).toContain('test name');
        });

        it('should replace path separators in file path', () => {
            const buildTestId = (runner as unknown as { buildTestId: (filePath: string, ancestors: string[], title: string) => string }).buildTestId.bind(runner);
            const result = buildTestId('C:\\path\\to\\test.ts', [], 'test');
            // The file path portion should have path separators replaced with underscores
            const fileIdPart = result.split('::')[0];
            expect(fileIdPart).not.toContain('\\');
            expect(fileIdPart).not.toContain('/');
        });
    });

    describe('mapJestStatus', () => {
        it('should map passed status', () => {
            const mapJestStatus = (runner as unknown as { mapJestStatus: (status: string) => TestStatus }).mapJestStatus.bind(runner);
            expect(mapJestStatus('passed')).toBe(TestStatus.Passed);
        });

        it('should map failed status', () => {
            const mapJestStatus = (runner as unknown as { mapJestStatus: (status: string) => TestStatus }).mapJestStatus.bind(runner);
            expect(mapJestStatus('failed')).toBe(TestStatus.Failed);
        });

        it('should map pending status to skipped', () => {
            const mapJestStatus = (runner as unknown as { mapJestStatus: (status: string) => TestStatus }).mapJestStatus.bind(runner);
            expect(mapJestStatus('pending')).toBe(TestStatus.Skipped);
        });

        it('should map skipped status', () => {
            const mapJestStatus = (runner as unknown as { mapJestStatus: (status: string) => TestStatus }).mapJestStatus.bind(runner);
            expect(mapJestStatus('skipped')).toBe(TestStatus.Skipped);
        });
    });

    describe('createEmptyResult', () => {
        it('should return a result with zero counts', () => {
            const createEmptyResult = (runner as unknown as { createEmptyResult: () => TestRunResult }).createEmptyResult.bind(runner);
            const result = createEmptyResult();
            expect(result.passed).toBe(0);
            expect(result.failed).toBe(0);
            expect(result.skipped).toBe(0);
            expect(result.duration).toBe(0);
            expect(result.results).toEqual([]);
        });
    });
});
