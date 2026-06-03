export interface AuditCheck {
    id: string;
    title: string;
    status: 'PASS' | 'WARN' | 'FAIL';
    details: string;
}
export declare function runAudit(cwd?: string): void;
