import * as vscode from 'vscode';
import { TestFramework, TestFrameworkAdapter } from '../types';

export class AdapterRegistry {
    private readonly adapters: Map<TestFramework, TestFrameworkAdapter> = new Map();

    registerAdapter(adapter: TestFrameworkAdapter): void {
        this.adapters.set(adapter.framework, adapter);
    }

    getAdapter(framework: TestFramework): TestFrameworkAdapter | undefined {
        return this.adapters.get(framework);
    }

    getAllAdapters(): ReadonlyArray<TestFrameworkAdapter> {
        return Array.from(this.adapters.values());
    }

    async detectFramework(
        workspaceFolder: vscode.WorkspaceFolder
    ): Promise<TestFrameworkAdapter | undefined> {
        for (const adapter of this.adapters.values()) {
            const detected = await adapter.detectFramework(workspaceFolder);
            if (detected) {
                return adapter;
            }
        }
        return undefined;
    }
}
