export declare function getOriginalFileContent(filePath: string, checkpoint: {
    isGit: boolean;
    gitCheckpointSha?: string;
    backupPath?: string;
}, cwd: string): string;
interface TestNodeInfo {
    name: string;
    bodyText: string;
    start: number;
    end: number;
}
export interface PolicyReport {
    success: boolean;
    invasive: boolean;
    appendOnly: boolean;
    findings: string[];
    testProvenance: {
        appendedTestNames: string[];
        modifiedTestNames: string[];
        removedTestNames: string[];
        hasInvasiveChanges: boolean;
    };
}
export declare function parseTestFile(content: string, filename: string): {
    tests: TestNodeInfo[];
    imports: string[];
};
export declare function checkTestChangePolicy(originalContent: string, patchedContent: string, filename: string, preserveExistingTests?: boolean): PolicyReport;
export {};
