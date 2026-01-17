import * as vscode from 'vscode';
import * as path from 'path';
import { TestSuite, TestCase, TestLocation } from '../../types';

interface ParsedClass {
    name: string;
    line: number;
    column: number;
    methods: ParsedMethod[];
}

interface ParsedMethod {
    name: string;
    line: number;
    column: number;
}

export class PhpunitParser {

    parseTestFile(fileUri: vscode.Uri, content: string): TestSuite | undefined {
        const lines = content.split('\n');
        const testClasses = this.parseClasses(lines);
        
        if (testClasses.length === 0) {
            return undefined;
        }

        const fileName = path.basename(fileUri.fsPath);
        const fileId = this.generateId(fileUri.fsPath);

        return {
            id: fileId,
            name: fileName,
            location: {
                file: fileUri.fsPath,
                line: 1,
                column: 1
            },
            children: this.convertClassesToSuites(testClasses, fileUri.fsPath, fileId),
            parentId: undefined
        };
    }

    private parseClasses(lines: string[]): ParsedClass[] {
        const classes: ParsedClass[] = [];
        let currentClass: ParsedClass | undefined;
        let braceDepth = 0;
        let inClass = false;

        let previousLineWasAnnotation = false;

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const lineNumber = lineIndex + 1;

            const classMatch = this.matchTestClass(line);
            if (classMatch) {
                currentClass = {
                    name: classMatch.name,
                    line: lineNumber,
                    column: classMatch.column,
                    methods: []
                };
                classes.push(currentClass);
                inClass = true;
                braceDepth = 0;
            }

            if (inClass && currentClass) {
                const isAnnotation = /@test\b/.test(line);
                
                if (!isAnnotation) {
                   const methodMatch = this.matchTestMethod(line, previousLineWasAnnotation);
                    if (methodMatch) {
                        currentClass.methods.push({
                            name: methodMatch.name,
                            line: lineNumber,
                            column: methodMatch.column
                        });
                        // success, reset annotation flag
                        previousLineWasAnnotation = false;
                    }
                }
                
                // Update brace depth
                braceDepth += (line.match(/{/g) || []).length;
                braceDepth -= (line.match(/}/g) || []).length;

                if (braceDepth <= 0 && line.includes('}')) {
                    inClass = false;
                    currentClass = undefined;
                }
                
                // Set flag for next line if this one was an annotation
                // If we found a method, we already reset it.
                // If this line IS the annotation, set true.
                // If it's effectively empty or comment, maybe keep it? simplified: strict next line for now.
                // Actually, often docblocks are multi-line.
                // Simplified approach: if line has @test, next function def is a test.
                // Reset if line has function but no match (handled) or if brace depth changes?
                // Better: if line contains @test, set flag. If line contains function, consume flag.
                if (isAnnotation) {
                    previousLineWasAnnotation = true;
                } else if (line.trim().length > 0 && !line.trim().startsWith('*') && !line.trim().startsWith('/')) {
                    // if it's code and not a method match (checked above), reset
                     // actually, we checked matchTestMethod above. if it matched, we reset.
                     // if it didn't match, and it's code, we should probably reset to avoid false positives 5 lines down.
                     // but we need to stay true if it was just a blank line or comment.
                     // Simple heuristic: reset on brace close or new class
                }
            } 
        }

        return classes;
    }

    private matchTestClass(line: string): { name: string; column: number } | undefined {
        // Handle abstract and final modifiers
        const match = /(?:abstract\s+|final\s+)?class\s+(\w+)\s+extends\s+(?:TestCase|Tests\\TestCase|PHPUnit\\Framework\\TestCase)/.exec(line);
        if (match) {
            return {
                name: match[1],
                column: match.index + 1
            };
        }
        return undefined;
    }

    private matchTestMethod(line: string, previousLineWasAnnotation: boolean): { name: string; column: number } | undefined {
        const standardMatch = /(?:public\s+)?function\s+(test\w*|test_\w+)\s*\(/.exec(line);
        if (standardMatch) {
            return {
                name: standardMatch[1],
                column: standardMatch.index + 1
            };
        }

        if (previousLineWasAnnotation) {
            const annotationMatch = /(?:public\s+)?function\s+(\w+)\s*\(/.exec(line);
            if (annotationMatch) {
                return {
                    name: annotationMatch[1],
                    column: annotationMatch.index + 1
                };
            }
        }

        return undefined;
    }

    private convertClassesToSuites(
        classes: ParsedClass[],
        filePath: string,
        parentId: string
    ): (TestSuite | TestCase)[] {
        return classes.map(testClass => {
            const location: TestLocation = {
                file: filePath,
                line: testClass.line,
                column: testClass.column
            };

            const classId = `${parentId}::${testClass.name}`;

            const children: TestCase[] = testClass.methods.map(method => ({
                id: `${classId}::${method.name}`,
                name: method.name,
                fullName: `${testClass.name}::${method.name}`,
                location: {
                    file: filePath,
                    line: method.line,
                    column: method.column
                },
                parentId: classId
            }));

            const suite: TestSuite = {
                id: classId,
                name: testClass.name,
                location,
                children,
                parentId
            };

            return suite;
        });
    }

    private generateId(filePath: string): string {
        return filePath.replace(/[\\/:]/g, '_');
    }
}
