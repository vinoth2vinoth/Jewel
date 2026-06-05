export interface AuditLeak {
    filePath: string;
    reason: string;
}
export interface AuditReportResult {
    success: boolean;
    leakedFiles: AuditLeak[];
}
/**
 * Scans the .jewel/reports directory for potential unredacted secret leaks.
 * If running redactSecrets on a report file changes its content, a leak is identified.
 */
export declare function auditReports(cwd?: string): AuditReportResult;
