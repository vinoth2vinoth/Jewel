"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseProviderResponseText = void 0;
exports.normalizeResponse = normalizeResponse;
const secret_redactor_1 = require("../../safety/secret-redactor");
function normalizeResponse(responseBody, provider, model) {
    if (!responseBody) {
        throw new Error('Response body is empty or null.');
    }
    const p = provider.toLowerCase();
    let text = '';
    let usage = {};
    let finishReason;
    // Redact secrets before processing
    const bodyStr = (0, secret_redactor_1.redactSecrets)(JSON.stringify(responseBody));
    const safeBody = JSON.parse(bodyStr);
    if (p === 'openai' || p === 'openrouter' || p === 'deepseek') {
        const choice = safeBody.choices?.[0];
        if (!choice) {
            throw new Error(`Invalid ${provider} response: choices array is missing or empty.`);
        }
        if (choice.message && typeof choice.message.content === 'string') {
            text = choice.message.content;
        }
        else {
            throw new Error(`Invalid ${provider} response: message content is not a string.`);
        }
        finishReason = choice.finish_reason;
        if (safeBody.usage) {
            usage = {
                inputTokens: safeBody.usage.prompt_tokens,
                outputTokens: safeBody.usage.completion_tokens,
                totalTokens: safeBody.usage.total_tokens
            };
        }
    }
    else if (p === 'gemini') {
        const candidate = safeBody.candidates?.[0];
        if (!candidate) {
            throw new Error('Invalid Gemini response: candidates array is missing or empty.');
        }
        const content = candidate.content;
        const textPart = content?.parts?.[0]?.text;
        if (typeof textPart === 'string') {
            text = textPart;
        }
        else {
            throw new Error('Invalid Gemini response: text part is not a string.');
        }
        finishReason = candidate.finishReason;
        if (safeBody.usageMetadata) {
            usage = {
                inputTokens: safeBody.usageMetadata.promptTokenCount,
                outputTokens: safeBody.usageMetadata.candidatesTokenCount,
                totalTokens: safeBody.usageMetadata.totalTokenCount
            };
        }
    }
    else if (p === 'anthropic') {
        const contentPart = safeBody.content?.[0];
        if (!contentPart) {
            throw new Error('Invalid Anthropic response: content array is missing or empty.');
        }
        if (contentPart.type === 'text' && typeof contentPart.text === 'string') {
            text = contentPart.text;
        }
        else if (contentPart.type === 'tool_use' && contentPart.input && typeof contentPart.input === 'object') {
            text = JSON.stringify(contentPart.input);
        }
        else {
            throw new Error('Invalid Anthropic response: first content element is not text or tool_use.');
        }
        finishReason = safeBody.stop_reason;
        if (safeBody.usage) {
            const input = safeBody.usage.input_tokens;
            const output = safeBody.usage.output_tokens;
            usage = {
                inputTokens: input,
                outputTokens: output,
                totalTokens: (input !== undefined && output !== undefined) ? (input + output) : undefined
            };
        }
    }
    else {
        throw new Error(`Unsupported provider: ${provider}`);
    }
    return {
        text,
        usage,
        rawProvider: p,
        model,
        finishReason
    };
}
var http_client_1 = require("./http-client");
Object.defineProperty(exports, "parseProviderResponseText", { enumerable: true, get: function () { return http_client_1.parseProviderResponseText; } });
