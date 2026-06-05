export interface NormalizedResponse {
    text: string;
    usage: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
        estimatedCostUsd?: undefined;
    };
    rawProvider: 'openai' | 'gemini' | 'anthropic' | 'openrouter';
    model: string;
    finishReason?: string;
}
export declare function normalizeResponse(responseBody: any, provider: string, model: string): NormalizedResponse;
export { parseProviderResponseText } from './http-client';
