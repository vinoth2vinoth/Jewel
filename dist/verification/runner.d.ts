import { JewelConfig } from '../core/config';
export interface CommandResult {
    commandKey: string;
    commandLine: string;
    status: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
    exitCode?: number;
    stdout: string;
    stderr: string;
    errorMsg?: string;
}
export interface VerificationReport {
    projectName: string;
    date: string;
    mode: 'strict' | 'lax';
    overallStatus: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED' | 'COVERAGE_THRESHOLD_VIOLATION';
    stats: {
        passed: number;
        failed: number;
        skipped: number;
        blocked: number;
    };
    results: CommandResult[];
}
export declare const dockerUtils: {
    isDockerAvailable(): boolean;
    executeDocker(args: string[], cwd: string, env: Record<string, string | undefined>, onChunk?: (chunk: string, type: "stdout" | "stderr") => void): Promise<{
        status: number | null;
        signal: string | null;
        stdout: string;
        stderr: string;
        error?: Error;
    }>;
};
export declare function runVerification(config: JewelConfig, cwd?: string, onProgress?: (progress: {
    key: string;
    stdout: string;
    stderr: string;
    status: 'RUNNING' | 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
}) => void): Promise<VerificationReport>;
export declare function saveVerificationReports(report: VerificationReport, cwd: string, formats: ('markdown' | 'json')[]): void;
