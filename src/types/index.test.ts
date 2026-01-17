import { isTestSuite, TestSuite, TestCase, TestFramework, TestStatus } from './index';

describe('Types', () => {
    describe('isTestSuite', () => {
        it('should return true for objects with children property', () => {
            const suite: TestSuite = {
                id: 'test-suite',
                name: 'Test Suite',
                location: { file: '/path/to/file.ts', line: 1, column: 1 },
                children: [],
                parentId: undefined
            };

            expect(isTestSuite(suite)).toBe(true);
        });

        it('should return false for TestCase objects', () => {
            const testCase: TestCase = {
                id: 'test-case',
                name: 'Test Case',
                fullName: 'Test Case',
                location: { file: '/path/to/file.ts', line: 1, column: 1 },
                parentId: 'parent-id'
            };

            expect(isTestSuite(testCase)).toBe(false);
        });

        it('should return true for suite with nested children', () => {
            const nestedTestCase: TestCase = {
                id: 'nested-test',
                name: 'Nested Test',
                fullName: 'Nested Test',
                location: { file: '/path/to/file.ts', line: 5, column: 1 },
                parentId: 'test-suite'
            };

            const suite: TestSuite = {
                id: 'test-suite',
                name: 'Test Suite',
                location: { file: '/path/to/file.ts', line: 1, column: 1 },
                children: [nestedTestCase],
                parentId: undefined
            };

            expect(isTestSuite(suite)).toBe(true);
        });
    });

    describe('TestFramework enum', () => {
        it('should have Jest value', () => {
            expect(TestFramework.Jest).toBe('jest');
        });

        it('should have Vitest value', () => {
            expect(TestFramework.Vitest).toBe('vitest');
        });

        it('should have Mocha value', () => {
            expect(TestFramework.Mocha).toBe('mocha');
        });
    });

    describe('TestStatus enum', () => {
        it('should have Pending value', () => {
            expect(TestStatus.Pending).toBe('pending');
        });

        it('should have Running value', () => {
            expect(TestStatus.Running).toBe('running');
        });

        it('should have Passed value', () => {
            expect(TestStatus.Passed).toBe('passed');
        });

        it('should have Failed value', () => {
            expect(TestStatus.Failed).toBe('failed');
        });

        it('should have Skipped value', () => {
            expect(TestStatus.Skipped).toBe('skipped');
        });
    });
});
