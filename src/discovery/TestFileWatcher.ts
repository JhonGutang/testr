import * as vscode from 'vscode';
import { JEST_TEST_PATTERNS, FILE_WATCHER_DEBOUNCE_MS } from '../config';

export class TestFileWatcher implements vscode.Disposable {
    private readonly watchers: vscode.FileSystemWatcher[] = [];
    private readonly onChangeCallback: () => void;
    private debounceTimer: NodeJS.Timeout | undefined;

    constructor(onChangeCallback: () => void) {
        this.onChangeCallback = onChangeCallback;
        this.setupWatchers();
    }

    private setupWatchers(): void {
        for (const pattern of JEST_TEST_PATTERNS) {
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);

            watcher.onDidCreate(() => this.triggerRefresh());
            watcher.onDidDelete(() => this.triggerRefresh());
            watcher.onDidChange(() => this.triggerRefresh());

            this.watchers.push(watcher);
        }
    }

    private triggerRefresh(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.onChangeCallback();
        }, FILE_WATCHER_DEBOUNCE_MS);
    }

    dispose(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        for (const watcher of this.watchers) {
            watcher.dispose();
        }
    }
}
