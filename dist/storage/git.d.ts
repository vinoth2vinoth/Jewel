export interface CheckpointMetadata {
    timestamp: string;
    isGit: boolean;
    gitCommitSha?: string;
    gitWasDirty?: boolean;
    gitCheckpointSha?: string;
    backupPath?: string;
}
export declare function isGitRepository(cwd?: string): boolean;
export declare function getGitStatus(cwd?: string): string;
export declare function getGitHead(cwd?: string): string;
export declare function createCheckpoint(sessionId: string, cwd?: string): CheckpointMetadata;
export declare function rollbackCheckpoint(metadata: CheckpointMetadata, cwd?: string): void;
