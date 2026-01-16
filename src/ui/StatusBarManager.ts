import * as vscode from 'vscode';

export class StatusBarManager implements vscode.Disposable {
    private readonly statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'testing.openExplorer';
        this.showIdle();
        this.statusBarItem.show();
    }

    showIdle(): void {
        this.statusBarItem.text = '$(beaker) Testr';
        this.statusBarItem.tooltip = 'Click to open Test Explorer';
        this.statusBarItem.backgroundColor = undefined;
    }

    showRunning(testCount: number): void {
        this.statusBarItem.text = `$(sync~spin) Running ${testCount} tests...`;
        this.statusBarItem.tooltip = 'Tests are running...';
        this.statusBarItem.backgroundColor = undefined;
    }

    showResults(passed: number, failed: number, skipped: number): void {
        const total = passed + failed + skipped;
        
        if (failed > 0) {
            this.statusBarItem.text = `$(error) ${failed}/${total} failed`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                'statusBarItem.errorBackground'
            );
        } else {
            this.statusBarItem.text = `$(check) ${passed}/${total} passed`;
            this.statusBarItem.backgroundColor = undefined;
        }

        this.statusBarItem.tooltip = this.buildTooltip(passed, failed, skipped);
    }

    showError(): void {
        this.statusBarItem.text = '$(error) Test run failed';
        this.statusBarItem.tooltip = 'An error occurred while running tests';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
            'statusBarItem.errorBackground'
        );
    }

    private buildTooltip(passed: number, failed: number, skipped: number): string {
        const lines = [
            `Passed: ${passed}`,
            `Failed: ${failed}`,
            `Skipped: ${skipped}`
        ];
        return lines.join('\n');
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
