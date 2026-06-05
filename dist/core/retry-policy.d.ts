export interface RetryState {
    attempt: number;
    maxRetries: number;
    seenFailures: Set<string>;
    seenVerdicts: Set<string>;
    lastVerdict?: string;
}
export declare function createRetryState(maxRetries: number): RetryState;
export declare function getFailureSignature(log: string): string;
export interface StopDecision {
    stop: boolean;
    reason?: string;
    status?: 'NEEDS_HUMAN_REVIEW' | 'EXISTING_TEST_MODIFIED' | 'RETRY_LIMIT_REACHED' | 'GENERATED_TEST_SUSPECT';
}
export declare function shouldStopRetry(state: RetryState, failureLog: string, verdict: string, confidence: string, existingTestModified: boolean): StopDecision;
export declare function recordRetryAttempt(state: RetryState, failureLog: string, verdict: string): void;
