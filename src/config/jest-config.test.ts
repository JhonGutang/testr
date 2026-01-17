import { JEST_CONFIG_FILES, JEST_TEST_PATTERNS, JEST_BIN_PATHS, JEST_CLI_ARGS } from './jest-config';

describe('Jest Configuration', () => {
    describe('JEST_CONFIG_FILES', () => {
        it('should contain jest.config.js', () => {
            expect(JEST_CONFIG_FILES).toContain('jest.config.js');
        });

        it('should contain jest.config.ts', () => {
            expect(JEST_CONFIG_FILES).toContain('jest.config.ts');
        });

        it('should contain jest.config.mjs', () => {
            expect(JEST_CONFIG_FILES).toContain('jest.config.mjs');
        });

        it('should contain jest.config.cjs', () => {
            expect(JEST_CONFIG_FILES).toContain('jest.config.cjs');
        });

        it('should contain jest.config.json', () => {
            expect(JEST_CONFIG_FILES).toContain('jest.config.json');
        });

        it('should have exactly 5 config files', () => {
            expect(JEST_CONFIG_FILES).toHaveLength(5);
        });
    });

    describe('JEST_TEST_PATTERNS', () => {
        it('should contain TypeScript test patterns', () => {
            expect(JEST_TEST_PATTERNS).toContain('**/*.test.ts');
            expect(JEST_TEST_PATTERNS).toContain('**/*.spec.ts');
        });

        it('should contain JavaScript test patterns', () => {
            expect(JEST_TEST_PATTERNS).toContain('**/*.test.js');
            expect(JEST_TEST_PATTERNS).toContain('**/*.spec.js');
        });

        it('should contain React test patterns', () => {
            expect(JEST_TEST_PATTERNS).toContain('**/*.test.tsx');
            expect(JEST_TEST_PATTERNS).toContain('**/*.spec.tsx');
            expect(JEST_TEST_PATTERNS).toContain('**/*.test.jsx');
            expect(JEST_TEST_PATTERNS).toContain('**/*.spec.jsx');
        });

        it('should have exactly 8 patterns', () => {
            expect(JEST_TEST_PATTERNS).toHaveLength(8);
        });
    });

    describe('JEST_BIN_PATHS', () => {
        it('should have unix path', () => {
            expect(JEST_BIN_PATHS.unix).toBe('node_modules/.bin/jest');
        });

        it('should have windows path', () => {
            expect(JEST_BIN_PATHS.windows).toBe('node_modules/.bin/jest.cmd');
        });

        it('should have fallback path', () => {
            expect(JEST_BIN_PATHS.fallback).toBe('npx jest');
        });
    });

    describe('JEST_CLI_ARGS', () => {
        it('should have json flag', () => {
            expect(JEST_CLI_ARGS.json).toBe('--json');
        });

        it('should have testLocationInResults flag', () => {
            expect(JEST_CLI_ARGS.testLocationInResults).toBe('--testLocationInResults');
        });

        it('should have testNamePattern flag', () => {
            expect(JEST_CLI_ARGS.testNamePattern).toBe('--testNamePattern');
        });
    });
});
