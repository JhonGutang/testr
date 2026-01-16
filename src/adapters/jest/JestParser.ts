import * as vscode from 'vscode';
import * as path from 'path';
import { TestSuite, TestCase, TestLocation } from '../../types';

interface ParsedBlock {
    type: 'describe' | 'test' | 'it';
    name: string;
    line: number;
    column: number;
    children: ParsedBlock[];
}

export class JestParser {

    parseTestFile(fileUri: vscode.Uri, content: string): TestSuite | undefined {
        const lines = content.split('\n');
        const blocks = this.parseBlocks(content, lines);
        
        if (blocks.length === 0) {
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
            children: this.convertBlocksToSuites(blocks, fileUri.fsPath, fileId),
            parentId: undefined
        };
    }

    private parseBlocks(_content: string, lines: string[]): ParsedBlock[] {
        const blocks: ParsedBlock[] = [];
        const stack: ParsedBlock[] = [];
        
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const lineNumber = lineIndex + 1;
            
            const describeMatch = this.matchDescribe(line);
            if (describeMatch) {
                const block: ParsedBlock = {
                    type: 'describe',
                    name: describeMatch.name,
                    line: lineNumber,
                    column: describeMatch.column,
                    children: []
                };
                
                this.addBlockToHierarchy(block, blocks, stack);
                stack.push(block);
            }
            
            const testMatch = this.matchTest(line);
            if (testMatch) {
                const block: ParsedBlock = {
                    type: 'test',
                    name: testMatch.name,
                    line: lineNumber,
                    column: testMatch.column,
                    children: []
                };
                
                this.addBlockToHierarchy(block, blocks, stack);
            }
            
            const closingBraces = (line.match(/\}\s*\)/g) ?? []).length;
            for (let i = 0; i < closingBraces && stack.length > 0; i++) {
                stack.pop();
            }
        }
        
        return blocks;
    }

    private matchDescribe(line: string): { name: string; column: number } | undefined {
        const match = /(?:describe|describe\.only|describe\.skip)\s*\(\s*(['"`])(.+?)\1/.exec(line);
        if (match) {
            return {
                name: match[2],
                column: match.index + 1
            };
        }
        return undefined;
    }

    private matchTest(line: string): { name: string; column: number } | undefined {
        const match = /(?:test|it|test\.only|test\.skip|it\.only|it\.skip)\s*\(\s*(['"`])(.+?)\1/.exec(line);
        if (match) {
            return {
                name: match[2],
                column: match.index + 1
            };
        }
        return undefined;
    }

    private addBlockToHierarchy(
        block: ParsedBlock,
        blocks: ParsedBlock[],
        stack: ParsedBlock[]
    ): void {
        if (stack.length > 0) {
            const parent = stack[stack.length - 1];
            parent.children.push(block);
        } else {
            blocks.push(block);
        }
    }

    private convertBlocksToSuites(
        blocks: ParsedBlock[],
        filePath: string,
        parentId: string
    ): (TestSuite | TestCase)[] {
        return blocks.map(block => {
            const location: TestLocation = {
                file: filePath,
                line: block.line,
                column: block.column
            };

            const id = `${parentId}::${block.name}`;

            if (block.type === 'describe') {
                const suite: TestSuite = {
                    id,
                    name: block.name,
                    location,
                    children: this.convertBlocksToSuites(block.children, filePath, id),
                    parentId
                };
                return suite;
            } else {
                const testCase: TestCase = {
                    id,
                    name: block.name,
                    fullName: block.name,
                    location,
                    parentId
                };
                return testCase;
            }
        });
    }

    private generateId(filePath: string): string {
        return filePath.replace(/[\\/:]/g, '_');
    }
}
