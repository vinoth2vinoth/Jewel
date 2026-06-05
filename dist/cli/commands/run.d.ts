export declare function runTask(task: string, filesNeeded?: string[], useMock?: boolean, cwd?: string, yesFlag?: boolean, noReview?: boolean, keepFailed?: boolean, cliOverrides?: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
}, dryRun?: boolean, useUI?: boolean): Promise<void>;
