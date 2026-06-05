import * as cp from 'child_process';
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
    executeDocker(args: string[], cwd: string, env: Record<string, string | undefined>): cp.SpawnSyncReturns<string>;
};
export declare function runVerification(config: JewelConfig, cwd?: string): VerificationReport;
export declare function saveVerificationReports(report: VerificationReport, cwd: string, formats: ('markdown' | 'json')[]): void;
