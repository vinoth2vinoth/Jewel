"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryableError = exports.NonRetryableError = void 0;
exports.createAbortTimeout = createAbortTimeout;
exports.redactProviderError = redactProviderError;
exports.parseProviderResponseText = parseProviderResponseText;
exports.postJsonWithRetry = postJsonWithRetry;
const secret_redactor_1 = require("../../safety/secret-redactor");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class NonRetryableError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.name = 'NonRetryableError';
        this.status = status;
    }
}
exports.NonRetryableError = NonRetryableError;
class RetryableError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.name = 'RetryableError';
        this.status = status;
    }
}
exports.RetryableError = RetryableError;
function createAbortTimeout(timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return { controller, timeoutId };
}
function redactProviderError(err) {
    const redactedMessage = (0, secret_redactor_1.redactSecrets)(err.message);
    const newErr = new Error(redactedMessage);
    newErr.name = err.name;
    newErr.stack = err.stack ? (0, secret_redactor_1.redactSecrets)(err.stack) : undefined;
    return newErr;
}
function parseProviderResponseText(responseBody, provider) {
    let content = '';
    let usage;
    const p = provider.toLowerCase();
    if (p === 'openai' || p === 'openrouter') {
        content = responseBody.choices?.[0]?.message?.content || '';
        if (responseBody.usage) {
            usage = {
                inputTokens: responseBody.usage.prompt_tokens,
                outputTokens: responseBody.usage.completion_tokens,
                totalTokens: responseBody.usage.total_tokens
            };
        }
    }
    else if (p === 'gemini') {
        content = responseBody.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (responseBody.usageMetadata) {
            usage = {
                inputTokens: responseBody.usageMetadata.promptTokenCount,
                outputTokens: responseBody.usageMetadata.candidatesTokenCount,
                totalTokens: responseBody.usageMetadata.totalTokenCount
            };
        }
    }
    else if (p === 'anthropic') {
        content = responseBody.content?.[0]?.text || '';
        if (responseBody.usage) {
            const input = responseBody.usage.input_tokens;
            const output = responseBody.usage.output_tokens;
            usage = {
                inputTokens: input,
                outputTokens: output,
                totalTokens: (input !== undefined && output !== undefined) ? (input + output) : undefined
            };
        }
    }
    return { content, usage };
}
async function postJsonWithRetry(url, options) {
    const { headers, body, timeoutMs, maxRetries, sessionPath, providerName, methodName, retryTracker } = options;
    let attempt = 0;
    let lastError = null;
    while (attempt <= maxRetries) {
        const { controller, timeoutId } = createAbortTimeout(timeoutMs);
        if (retryTracker) {
            retryTracker.count = attempt;
        }
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!res.ok) {
                const text = await res.text();
                const status = res.status;
                const isRetryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
                const errMsg = `HTTP Error ${status}: ${text}`;
                if (!isRetryable) {
                    throw new NonRetryableError(errMsg, status);
                }
                else {
                    throw new RetryableError(errMsg, status);
                }
            }
            const data = await res.json();
            // Save raw response debug log
            saveDebugLog(sessionPath, providerName, methodName, body, data);
            return data;
        }
        catch (err) {
            clearTimeout(timeoutId);
            let errorToReport = err;
            if (err.name === 'AbortError') {
                errorToReport = new RetryableError(`LLM request timed out after ${timeoutMs}ms.`);
            }
            else if (!(err instanceof NonRetryableError) && !(err instanceof RetryableError)) {
                // Network error, typically retryable
                errorToReport = new RetryableError(err.message || 'Network error');
            }
            lastError = redactProviderError(errorToReport);
            // Save debug log for error
            saveDebugLog(sessionPath, providerName, methodName, body, { error: lastError.message });
            if (err instanceof NonRetryableError) {
                throw new Error(`FAIL: LLM request failed. Non-retryable error: ${lastError.message}`);
            }
            if (attempt < maxRetries) {
                // Exponential backoff with jitter
                const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            attempt++;
        }
    }
    throw new Error(`FAIL: LLM request failed after ${attempt} attempts. Last error: ${lastError.message}`);
}
function saveDebugLog(sessionPath, providerName, methodName, requestBody, responseBody) {
    if (!sessionPath)
        return;
    try {
        const debugDir = path.join(sessionPath, 'debug');
        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
        }
        const logPath = path.join(debugDir, `${providerName}-${methodName}-${Date.now()}.json`);
        const payload = {
            timestamp: new Date().toISOString(),
            provider: providerName,
            method: methodName,
            request: requestBody,
            response: responseBody
        };
        const redactedPayload = (0, secret_redactor_1.redactSecrets)(JSON.stringify(payload, null, 2));
        fs.writeFileSync(logPath, redactedPayload, 'utf8');
    }
    catch (err) {
        // Ignore logging errors to prevent breaking execution
    }
}
