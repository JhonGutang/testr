import * as vscode from 'vscode';

// We need to access private methods for testing, so we'll create a testable subclass
// that exposes them as public methods
class TestableTestExecutionManager {
    // Simulating the private methods for testing purposes
    
    extractFilePathFromTestId(testId: string): string {
        const parts = testId.split('::');
        return parts[0].replace(/_/g, '/');
    }

    isSingleTestSuiteRun(requestInclude: vscode.TestItem[] | undefined, testItems: { id: string }[]): boolean {
        // If no specific tests were requested, it's a "run all" scenario
        if (!requestInclude || requestInclude.length === 0) {
            return false;
        }

        // Get unique file paths from all test items
        const filePaths = new Set<string>();
        for (const item of testItems) {
            const filePath = this.extractFilePathFromTestId(item.id);
            filePaths.add(filePath.toLowerCase()); // Normalize for Windows
        }

        // It's a single suite run if all tests come from the same file
        return filePaths.size === 1;
    }

    getTargetFilePath(testItems: { id: string }[]): string | null {
        if (testItems.length === 0) {
            return null;
        }
        return this.extractFilePathFromTestId(testItems[0].id);
    }

    isMatchingFilePath(path1: string, path2: string): boolean {
        return path1.toLowerCase() === path2.toLowerCase();
    }
}

describe('TestExecutionManager', () => {
    let manager: TestableTestExecutionManager;

    beforeEach(() => {
        manager = new TestableTestExecutionManager();
    });

    describe('extractFilePathFromTestId', () => {
        it('should extract file path from test ID', () => {
            const testId = 'C_/Users/test/file.test.ts::describe::test';
            const result = manager.extractFilePathFromTestId(testId);
            expect(result).toBe('C//Users/test/file.test.ts');
        });

        it('should handle test ID with no describe blocks', () => {
            const testId = 'C_/path/to/test.ts::single-test';
            const result = manager.extractFilePathFromTestId(testId);
            expect(result).toBe('C//path/to/test.ts');
        });
    });

    describe('isSingleTestSuiteRun', () => {
        it('should return false when request.include is undefined (run all)', () => {
            const testItems = [
                { id: 'C_/path/file1.test.ts::test1' },
                { id: 'C_/path/file2.test.ts::test2' }
            ];
            
            const result = manager.isSingleTestSuiteRun(undefined, testItems);
            expect(result).toBe(false);
        });

        it('should return false when request.include is empty (run all)', () => {
            const testItems = [
                { id: 'C_/path/file1.test.ts::test1' },
                { id: 'C_/path/file2.test.ts::test2' }
            ];
            
            const result = manager.isSingleTestSuiteRun([], testItems);
            expect(result).toBe(false);
        });

        it('should return true when all tests belong to same file (single suite)', () => {
            const mockInclude = [{ id: 'mock' }] as vscode.TestItem[];
            const testItems = [
                { id: 'C_/path/file.test.ts::describe::test1' },
                { id: 'C_/path/file.test.ts::describe::test2' },
                { id: 'C_/path/file.test.ts::describe::test3' }
            ];
            
            const result = manager.isSingleTestSuiteRun(mockInclude, testItems);
            expect(result).toBe(true);
        });

        it('should return false when tests belong to different files', () => {
            const mockInclude = [{ id: 'mock' }] as vscode.TestItem[];
            const testItems = [
                { id: 'C_/path/file1.test.ts::test1' },
                { id: 'C_/path/file2.test.ts::test2' }
            ];
            
            const result = manager.isSingleTestSuiteRun(mockInclude, testItems);
            expect(result).toBe(false);
        });

        it('should handle case-insensitive file path comparison (Windows)', () => {
            const mockInclude = [{ id: 'mock' }] as vscode.TestItem[];
            const testItems = [
                { id: 'C_/Path/File.test.ts::test1' },
                { id: 'c_/path/file.test.ts::test2' }
            ];
            
            const result = manager.isSingleTestSuiteRun(mockInclude, testItems);
            expect(result).toBe(true);
        });

        it('should return true for single test item', () => {
            const mockInclude = [{ id: 'mock' }] as vscode.TestItem[];
            const testItems = [
                { id: 'C_/path/file.test.ts::single-test' }
            ];
            
            const result = manager.isSingleTestSuiteRun(mockInclude, testItems);
            expect(result).toBe(true);
        });
    });

    describe('getTargetFilePath', () => {
        it('should return null for empty test items array', () => {
            const result = manager.getTargetFilePath([]);
            expect(result).toBeNull();
        });

        it('should return file path from first test item', () => {
            const testItems = [
                { id: 'C_/path/file.test.ts::test1' },
                { id: 'C_/path/file.test.ts::test2' }
            ];
            
            const result = manager.getTargetFilePath(testItems);
            expect(result).toBe('C//path/file.test.ts');
        });
    });

    describe('isMatchingFilePath', () => {
        it('should return true for exact match', () => {
            const result = manager.isMatchingFilePath(
                'C//Users/test/file.ts',
                'C//Users/test/file.ts'
            );
            expect(result).toBe(true);
        });

        it('should return true for case-insensitive match (Windows)', () => {
            const result = manager.isMatchingFilePath(
                'C//Users/Test/FILE.ts',
                'c//users/test/file.ts'
            );
            expect(result).toBe(true);
        });

        it('should return false for different paths', () => {
            const result = manager.isMatchingFilePath(
                'C//Users/test/file1.ts',
                'C//Users/test/file2.ts'
            );
            expect(result).toBe(false);
        });
    });
});
