/**
 * Mock for VS Code API used in unit tests
 */

export class Uri {
    readonly scheme: string;
    readonly authority: string;
    readonly path: string;
    readonly query: string;
    readonly fragment: string;
    readonly fsPath: string;

    private constructor(fsPath: string) {
        this.scheme = 'file';
        this.authority = '';
        this.path = fsPath.replace(/\\/g, '/');
        this.query = '';
        this.fragment = '';
        this.fsPath = fsPath;
    }

    static file(path: string): Uri {
        return new Uri(path);
    }

    static joinPath(base: Uri, ...pathSegments: string[]): Uri {
        const separator = base.fsPath.includes('\\') ? '\\' : '/';
        const joined = [base.fsPath, ...pathSegments].join(separator);
        return new Uri(joined);
    }

    toString(): string {
        return `file://${this.fsPath}`;
    }

    with(_change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
        return new Uri(this.fsPath);
    }
}

export class Position {
    constructor(
        public readonly line: number,
        public readonly character: number
    ) {}
}

export class Range {
    constructor(
        public readonly start: Position,
        public readonly end: Position
    ) {}
}

export class CancellationTokenSource {
    token = {
        isCancellationRequested: false,
        onCancellationRequested: () => ({ dispose: () => {} })
    };

    cancel(): void {
        this.token.isCancellationRequested = true;
    }

    dispose(): void {}
}

export interface WorkspaceFolder {
    readonly uri: Uri;
    readonly name: string;
    readonly index: number;
}

export const workspace = {
    workspaceFolders: undefined as WorkspaceFolder[] | undefined,
    fs: {
        readFile: async (_uri: Uri): Promise<Uint8Array> => {
            return new Uint8Array();
        },
        stat: async (_uri: Uri): Promise<{ type: number }> => {
            return { type: 1 };
        }
    },
    findFiles: async (_include: unknown, _exclude?: unknown): Promise<Uri[]> => {
        return [];
    }
};

export class RelativePattern {
    constructor(
        public readonly base: Uri | string,
        public readonly pattern: string
    ) {}
}

export const window = {
    createOutputChannel: (_name: string) => ({
        appendLine: () => {},
        show: () => {},
        dispose: () => {}
    }),
    showErrorMessage: async (_message: string): Promise<undefined> => undefined,
    showInformationMessage: async (_message: string): Promise<undefined> => undefined
};

export interface TestController {
    readonly id: string;
    items: {
        replace: (items: TestItem[]) => void;
        add: (item: TestItem) => void;
        get: (id: string) => TestItem | undefined;
        forEach: (callback: (item: TestItem) => void) => void;
    };
    createTestItem: (id: string, label: string, uri?: Uri) => TestItem;
    createRunProfile: () => void;
    createTestRun: () => TestRun;
    dispose: () => void;
}

export interface TestItem {
    id: string;
    label: string;
    uri?: Uri;
    range?: Range;
    children: {
        add: (item: TestItem) => void;
        forEach: (callback: (item: TestItem) => void) => void;
        get: (id: string) => TestItem | undefined;
    };
}

export interface TestRun {
    started: (item: TestItem) => void;
    passed: (item: TestItem, duration?: number) => void;
    failed: (item: TestItem, message: unknown, duration?: number) => void;
    skipped: (item: TestItem) => void;
    end: () => void;
}

export const tests = {
    createTestController: (id: string, _label: string): TestController => {
        const items = new Map<string, TestItem>();
        return {
            id,
            items: {
                replace: (newItems: TestItem[]) => {
                    items.clear();
                    newItems.forEach(item => items.set(item.id, item));
                },
                add: (item: TestItem) => items.set(item.id, item),
                get: (id: string) => items.get(id),
                forEach: (callback: (item: TestItem) => void) => items.forEach(callback)
            },
            createTestItem: (id: string, label: string, uri?: Uri): TestItem => {
                const item: TestItem = {
                    id,
                    label,
                    children: {
                        add: () => {},
                        forEach: () => {},
                        get: () => undefined
                    }
                };
                if (uri !== undefined) {
                    item.uri = uri;
                }
                return item;
            },
            createRunProfile: () => {},
            createTestRun: () => ({
                started: () => {},
                passed: () => {},
                failed: () => {},
                skipped: () => {},
                end: () => {}
            }),
            dispose: () => {}
        };
    }
};
