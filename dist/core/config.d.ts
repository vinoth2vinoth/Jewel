export interface JewelConfig {
    projectName: string;
    mode: 'strict' | 'lax';
    maxRetries: number;
    maxFilesChanged: number;
    maxLinesChanged: number;
    requirePlanBeforeEdit: boolean;
    requireVerificationBeforeDone: boolean;
    allowNewDependencies: boolean;
    allowProtectedFileChanges: boolean;
    allowGitPush: boolean;
    commands: {
        lint: string;
        typecheck: string;
        test: string;
        build: string;
        e2e: string;
    };
    protectedFiles: string[];
    dangerousCommandPolicy: 'block' | 'warn' | 'allow';
    reportFormat: ('markdown' | 'json')[];
}
export declare const DEFAULT_CONFIG: JewelConfig;
export declare function loadConfig(cwd?: string): JewelConfig;
export declare function validateAndMergeConfig(parsed: any): JewelConfig;
