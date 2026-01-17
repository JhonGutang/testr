import * as vscode from 'vscode';
import { PhpunitParser } from './PhpunitParser';

describe('PhpunitParser', () => {
    let parser: PhpunitParser;
    const mockFileUri = vscode.Uri.file('/path/to/test/UserTest.php');

    beforeEach(() => {
        parser = new PhpunitParser();
    });

    it('should return undefined for empty content', () => {
        const result = parser.parseTestFile(mockFileUri, '');
        expect(result).toBeUndefined();
    });

    it('should return undefined for file with no test classes', () => {
        const content = `
<?php
class User {
    public function getName() {}
}
`;
        const result = parser.parseTestFile(mockFileUri, content);
        expect(result).toBeUndefined();
    });

    it('should parse simple test class', () => {
        const content = `
<?php
class UserTest extends TestCase {
    public function testExample() {}
}
`;
        const result = parser.parseTestFile(mockFileUri, content);
        
        expect(result).toBeDefined();
        expect(result?.name).toBe('UserTest.php');
        expect(result?.children).toHaveLength(1);
        
        const suite = result?.children[0];
        expect(suite?.name).toBe('UserTest');
        // @ts-ignore
        expect(suite?.children).toHaveLength(1);
        // @ts-ignore
        expect(suite?.children[0].name).toBe('testExample');
    });

    it('should parse multiple test methods', () => {
        const content = `
<?php
class UserTest extends TestCase {
    public function testExample() {}
    public function test_user_creation() {}
}
`;
        const result = parser.parseTestFile(mockFileUri, content);
        const suite = result?.children[0];
        
        // @ts-ignore
        expect(suite?.children).toHaveLength(2);
        // @ts-ignore
        expect(suite?.children[0].name).toBe('testExample');
        // @ts-ignore
        expect(suite?.children[1].name).toBe('test_user_creation');
    });

    it('should handle different TestCase base classes', () => {
        const content = `
<?php
class UnitTest extends PHPUnit\\Framework\\TestCase {
    public function testUnit() {}
}
class FeatureTest extends Tests\\TestCase {
    public function testFeature() {}
}
`;
        const result = parser.parseTestFile(mockFileUri, content);
        expect(result?.children).toHaveLength(2);
        
        expect(result?.children[0].name).toBe('UnitTest');
        expect(result?.children[1].name).toBe('FeatureTest');
    });

    it('should generate correct IDs', () => {
        const content = `
<?php
class UserTest extends TestCase {
    public function testExample() {}
}
`;
        // Windows path style since logic might be platform specific in generateId or standard
        // The implementation uses simple replacement
        const uri = vscode.Uri.file('c:\\project\\tests\\UserTest.php');
        const result = parser.parseTestFile(uri, content);
        
        // The implementation of generateId replaces [\\/:] with _
        // c:\project\tests\UserTest.php -> c__project_tests_UserTest.php
        // And then children append ::ClassName
        
        // We need to check actual implementation behavior.
        // Based on code: filePath.replace(/[\\/:]/g, '_');
        
        expect(result?.id).toContain('UserTest.php');
        // @ts-ignore
        expect(result?.children[0].id).toContain('::UserTest');
        // @ts-ignore
        expect(result?.children[0].children[0].id).toContain('::UserTest::testExample');
    });
});
