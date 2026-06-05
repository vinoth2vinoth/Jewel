export interface ProviderUsage {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
    retryCount?: number;
}
export interface HttpClientResponse {
    content: string;
    usage?: ProviderUsage;
}
export declare class NonRetryableError extends Error {
    status?: number;
    constructor(message: string, status?: number);
}
export declare class RetryableError extends Error {
    status?: number;
    constructor(message: string, status?: number);
}
export declare function createAbortTimeout(timeoutMs: number): {
    controller: AbortController;
    timeoutId: NodeJS.Timeout;
};
export declare function redactProviderError(err: Error): Error;
export declare function parseProviderResponseText(responseBody: any, provider: string): HttpClientResponse;
export declare function postJsonWithRetry(url: string, options: {
    headers: Record<string, string>;
    body: any;
    timeoutMs: number;
    maxRetries: number;
    sessionPath?: string;
    providerName: string;
    methodName: string;
    retryTracker?: {
        count: number;
    };
}): Promise<any>;
