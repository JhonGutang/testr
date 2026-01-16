export const JEST_CONFIG_FILES = [
    'jest.config.js',
    'jest.config.ts',
    'jest.config.mjs',
    'jest.config.cjs',
    'jest.config.json'
] as const;

export const JEST_TEST_PATTERNS = [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/*.test.js',
    '**/*.spec.js',
    '**/*.test.tsx',
    '**/*.spec.tsx',
    '**/*.test.jsx',
    '**/*.spec.jsx'
] as const;

export const JEST_CLI_ARGS = {
    json: '--json',
    testLocationInResults: '--testLocationInResults',
    testNamePattern: '--testNamePattern'
} as const;

export const JEST_BIN_PATHS = {
    unix: 'node_modules/.bin/jest',
    windows: 'node_modules/.bin/jest.cmd',
    fallback: 'npx jest'
} as const;
