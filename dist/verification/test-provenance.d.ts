export interface TestProvenanceRecord {
    testFile: string;
    addedTestNames: string[];
    modifiedTestNames: string[];
    removedTestNames: string[];
    isAppended: boolean;
    isInvasive: boolean;
    provider: string;
    criticVerdict: string;
    verificationStatus: string;
    existingTestsPreserved: boolean;
}
export declare function writeTestProvenanceReport(records: TestProvenanceRecord[], cwd: string): void;
