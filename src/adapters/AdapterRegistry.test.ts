import { AdapterRegistry } from './AdapterRegistry';
import { TestFramework, TestFrameworkAdapter, TestDiscoveryResult, TestRunResult, TestSuite } from '../types';
import * as vscode from 'vscode';

// Create a mock adapter for testing
const createMockAdapter = (framework: TestFramework, detectResult: boolean = true): TestFrameworkAdapter => ({
    framework,
    detectFramework: jest.fn().mockResolvedValue(detectResult),
    discoverTests: jest.fn().mockResolvedValue({
        framework,
        suites: [],
        testCount: 0
    } as TestDiscoveryResult),
    runTests: jest.fn().mockResolvedValue({
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        results: []
    } as TestRunResult),
    parseTestFile: jest.fn().mockReturnValue(undefined as TestSuite | undefined)
});

describe('AdapterRegistry', () => {
    let registry: AdapterRegistry;

    beforeEach(() => {
        registry = new AdapterRegistry();
    });

    describe('registerAdapter', () => {
        it('should register an adapter', () => {
            const adapter = createMockAdapter(TestFramework.Jest);
            registry.registerAdapter(adapter);
            
            const retrieved = registry.getAdapter(TestFramework.Jest);
            expect(retrieved).toBe(adapter);
        });

        it('should overwrite existing adapter for same framework', () => {
            const adapter1 = createMockAdapter(TestFramework.Jest);
            const adapter2 = createMockAdapter(TestFramework.Jest);
            
            registry.registerAdapter(adapter1);
            registry.registerAdapter(adapter2);
            
            expect(registry.getAdapter(TestFramework.Jest)).toBe(adapter2);
        });
    });

    describe('getAdapter', () => {
        it('should return undefined for unregistered framework', () => {
            const result = registry.getAdapter(TestFramework.Jest);
            expect(result).toBeUndefined();
        });

        it('should return correct adapter for registered framework', () => {
            const jestAdapter = createMockAdapter(TestFramework.Jest);
            const vitestAdapter = createMockAdapter(TestFramework.Vitest);
            
            registry.registerAdapter(jestAdapter);
            registry.registerAdapter(vitestAdapter);
            
            expect(registry.getAdapter(TestFramework.Jest)).toBe(jestAdapter);
            expect(registry.getAdapter(TestFramework.Vitest)).toBe(vitestAdapter);
        });
    });

    describe('getAllAdapters', () => {
        it('should return empty array when no adapters registered', () => {
            const adapters = registry.getAllAdapters();
            expect(adapters).toEqual([]);
        });

        it('should return all registered adapters', () => {
            const jestAdapter = createMockAdapter(TestFramework.Jest);
            const vitestAdapter = createMockAdapter(TestFramework.Vitest);
            
            registry.registerAdapter(jestAdapter);
            registry.registerAdapter(vitestAdapter);
            
            const adapters = registry.getAllAdapters();
            expect(adapters).toHaveLength(2);
            expect(adapters).toContain(jestAdapter);
            expect(adapters).toContain(vitestAdapter);
        });
    });

    describe('detectFramework', () => {
        it('should return adapter that detects the framework', async () => {
            const jestAdapter = createMockAdapter(TestFramework.Jest, true);
            registry.registerAdapter(jestAdapter);
            
            const workspaceFolder = {
                uri: vscode.Uri.file('/workspace'),
                name: 'workspace',
                index: 0
            };
            
            const result = await registry.detectFramework(workspaceFolder);
            expect(result).toBe(jestAdapter);
            expect(jestAdapter.detectFramework).toHaveBeenCalledWith(workspaceFolder);
        });

        it('should return undefined if no adapter detects framework', async () => {
            const jestAdapter = createMockAdapter(TestFramework.Jest, false);
            registry.registerAdapter(jestAdapter);
            
            const workspaceFolder = {
                uri: vscode.Uri.file('/workspace'),
                name: 'workspace',
                index: 0
            };
            
            const result = await registry.detectFramework(workspaceFolder);
            expect(result).toBeUndefined();
        });

        it('should return first adapter that detects framework', async () => {
            const jestAdapter = createMockAdapter(TestFramework.Jest, false);
            const vitestAdapter = createMockAdapter(TestFramework.Vitest, true);
            
            registry.registerAdapter(jestAdapter);
            registry.registerAdapter(vitestAdapter);
            
            const workspaceFolder = {
                uri: vscode.Uri.file('/workspace'),
                name: 'workspace',
                index: 0
            };
            
            const result = await registry.detectFramework(workspaceFolder);
            expect(result).toBe(vitestAdapter);
        });
    });
});
