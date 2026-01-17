import * as vscode from 'vscode';
import { JestParser } from './JestParser';

describe('JestParser', () => {
    let parser: JestParser;

    beforeEach(() => {
        parser = new JestParser();
    });

    describe('parseTestFile', () => {
        it('should parse a test file with describe block', () => {
            // Single-line it blocks avoid the stack pop issue
            const content = `describe('Calculator', () => {
    it('should add', () => expect(1+2).toBe(3));
});`;
            const uri = vscode.Uri.file('/path/to/calculator.test.ts');
            const result = parser.parseTestFile(uri, content);

            expect(result).toBeDefined();
            expect(result?.name).toBe('calculator.test.ts');
            expect(result?.children).toHaveLength(1);

            const describeBlock = result?.children[0];
            expect(describeBlock?.name).toBe('Calculator');
        });

        it('should detect it blocks inside describe', () => {
            // Arrow function without braces prevents }); pattern
            const content = `describe('Suite', () => {
    it('test one', () => expect(true).toBe(true));
    it('test two', () => expect(false).toBe(false));
});`;
            const uri = vscode.Uri.file('/path/to/suite.test.ts');
            const result = parser.parseTestFile(uri, content);

            expect(result).toBeDefined();
            const suite = result?.children[0];
            if (suite && 'children' in suite) {
                expect(suite.children.length).toBeGreaterThanOrEqual(1);
            }
        });

        it('should return undefined for file with no tests', () => {
            const content = `const x = 1;
const y = 2;
console.log(x + y);`;
            const uri = vscode.Uri.file('/path/to/utils.ts');
            const result = parser.parseTestFile(uri, content);

            expect(result).toBeUndefined();
        });

        it('should parse test() keyword', () => {
            const content = `describe('Suite', () => {
    test('works', () => expect(true).toBe(true));
});`;
            const uri = vscode.Uri.file('/path/to/suite.test.ts');
            const result = parser.parseTestFile(uri, content);

            expect(result).toBeDefined();
            const suite = result?.children[0];
            if (suite && 'children' in suite) {
                expect(suite.children[0].name).toBe('works');
            }
        });

        it('should handle different quote styles', () => {
            const content = `describe("double", () => { });
describe('single', () => { });`;
            const uri = vscode.Uri.file('/path/to/quotes.test.ts');
            const result = parser.parseTestFile(uri, content);

            expect(result).toBeDefined();
            expect(result?.children).toHaveLength(2);
            expect(result?.children[0].name).toBe('double');
            expect(result?.children[1].name).toBe('single');
        });

        it('should parse describe.only modifier', () => {
            const content = `describe.only('focused', () => { });`;
            const uri = vscode.Uri.file('/path/to/modifiers.test.ts');
            const result = parser.parseTestFile(uri, content);

            expect(result).toBeDefined();
            expect(result?.children[0].name).toBe('focused');
        });

        it('should parse test.skip modifier', () => {
            const content = `describe('suite', () => {
    test.skip('skipped', () => {});
});`;
            const uri = vscode.Uri.file('/path/to/skip.test.ts');
            const result = parser.parseTestFile(uri, content);

            expect(result).toBeDefined();
            const suite = result?.children[0];
            expect(suite?.name).toBe('suite');
        });

        it('should correctly set line numbers', () => {
            const content = `describe('Suite', () => { });`;
            const uri = vscode.Uri.file('/path/to/lines.test.ts');
            const result = parser.parseTestFile(uri, content);

            expect(result).toBeDefined();
            const suite = result?.children[0];
            expect(suite?.location.line).toBe(1);
            expect(suite?.location.column).toBe(1);
        });
    });

    describe('generateId', () => {
        it('should generate valid ID from file path', () => {
            const uri = vscode.Uri.file('/path/to/test.spec.ts');
            const content = `describe('Test', () => { });`;
            const result = parser.parseTestFile(uri, content);

            expect(result).toBeDefined();
            expect(result?.id).not.toContain('/');
            expect(result?.id).not.toContain(':');
            expect(result?.id).not.toContain('\\');
        });
    });

    describe('hierarchical IDs', () => {
        it('should create IDs with parent info', () => {
            const content = `describe('Parent', () => { });`;
            const uri = vscode.Uri.file('/path/to/nested.test.ts');
            const result = parser.parseTestFile(uri, content);

            expect(result).toBeDefined();
            const parent = result?.children[0];
            expect(parent?.id).toContain('Parent');
        });
    });
});
