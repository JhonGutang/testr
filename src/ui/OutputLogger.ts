import * as vscode from 'vscode';

export class OutputLogger {
    private readonly outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Testr');
    }

    // Discovery logging
    logDiscoveryStart(workspaceName: string): void {
        console.log('[OutputLogger] logDiscoveryStart called for:', workspaceName);
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('═══════════════════════════════════════════════════════');
        this.outputChannel.appendLine(`[${this.getTimestamp()}] Starting test discovery in: ${workspaceName}`);
        this.outputChannel.appendLine('═══════════════════════════════════════════════════════');
        this.outputChannel.show(true);
    }

    logDiscoveredFile(filePath: string, testCount: number): void {
        console.log('[OutputLogger] logDiscoveredFile called:', filePath, testCount);
        this.outputChannel.appendLine(`  ✓ Found: ${filePath} (${testCount} test${testCount !== 1 ? 's' : ''})`);
    }

    logDiscoveryComplete(totalFiles: number, totalTests: number): void {
        console.log('[OutputLogger] logDiscoveryComplete called:', totalFiles, totalTests);
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(`Discovery complete: ${totalFiles} file${totalFiles !== 1 ? 's' : ''}, ${totalTests} test${totalTests !== 1 ? 's' : ''}`);
        this.outputChannel.appendLine('═══════════════════════════════════════════════════════');
    }

    // Execution logging
    logExecutionStart(testCount: number): void {
        console.log('[OutputLogger] logExecutionStart called:', testCount);
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('═══════════════════════════════════════════════════════');
        this.outputChannel.appendLine(`[${this.getTimestamp()}] Initiating test execution`);
        this.outputChannel.appendLine(`Running ${testCount} test${testCount !== 1 ? 's' : ''}...`);
        this.outputChannel.appendLine('═══════════════════════════════════════════════════════');
        this.outputChannel.show(true);
    }

    logTestFile(fileName: string): void {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(`📁 ${fileName}`);
    }

    logTestResult(testName: string, status: 'passed' | 'failed' | 'skipped', duration?: number): void {
        let icon: string;
        let statusText: string;

        switch (status) {
            case 'passed':
                icon = '  ✓';
                statusText = 'PASS';
                break;
            case 'failed':
                icon = '  ✗';
                statusText = 'FAIL';
                break;
            case 'skipped':
                icon = '  ○';
                statusText = 'SKIP';
                break;
        }

        const durationText = duration !== undefined ? ` (${duration}ms)` : '';
        this.outputChannel.appendLine(`${icon} ${testName} - ${statusText}${durationText}`);
    }

    logTestError(testName: string, errorMessage: string): void {
        this.outputChannel.appendLine(`  ✗ ${testName} - FAIL`);
        this.outputChannel.appendLine(`    Error: ${errorMessage}`);
    }

    logFileStats(fileName: string, total: number, passed: number, failed: number, skipped: number): void {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(`  Stats for ${fileName}:`);
        this.outputChannel.appendLine(`    Total: ${total} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
    }

    logOverallStats(total: number, passed: number, failed: number, skipped: number, duration: number): void {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('═══════════════════════════════════════════════════════');
        this.outputChannel.appendLine('OVERALL RESULTS');
        this.outputChannel.appendLine('───────────────────────────────────────────────────────');
        this.outputChannel.appendLine(`  Total Tests:   ${total}`);
        this.outputChannel.appendLine(`  ✓ Passed:      ${passed}`);
        this.outputChannel.appendLine(`  ✗ Failed:      ${failed}`);
        this.outputChannel.appendLine(`  ○ Skipped:     ${skipped}`);
        this.outputChannel.appendLine(`  Duration:      ${duration}ms`);
        this.outputChannel.appendLine('═══════════════════════════════════════════════════════');
        
        // Show the output channel if there are failures
        if (failed > 0) {
            this.outputChannel.show(true);
        }
    }

    logError(message: string): void {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine(`[ERROR] ${message}`);
        this.outputChannel.show(true);
    }

    logInfo(message: string): void {
        this.outputChannel.appendLine(`[INFO] ${message}`);
    }

    show(): void {
        this.outputChannel.show(true);
    }

    dispose(): void {
        this.outputChannel.dispose();
    }

    private getTimestamp(): string {
        const now = new Date();
        return now.toLocaleTimeString();
    }
}
