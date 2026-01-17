/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js'],
    moduleNameMapper: {
        '^vscode$': '<rootDir>/src/test/mocks/vscode.mock.ts'
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.test.ts',
        '!src/test/**/*',
        '!src/extension.ts'
    ],
    coverageDirectory: 'coverage',
    verbose: true
};
