"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const response_normalizer_1 = require("./response-normalizer");
(0, node_test_1.default)('response normalizer - OpenAI response normalizes', () => {
    const mockResponse = {
        choices: [{
                message: { content: 'hello world' },
                finish_reason: 'stop'
            }],
        usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
        }
    };
    const normalized = (0, response_normalizer_1.normalizeResponse)(mockResponse, 'openai', 'gpt-4o');
    node_assert_1.default.strictEqual(normalized.text, 'hello world');
    node_assert_1.default.strictEqual(normalized.rawProvider, 'openai');
    node_assert_1.default.strictEqual(normalized.model, 'gpt-4o');
    node_assert_1.default.strictEqual(normalized.finishReason, 'stop');
    node_assert_1.default.deepStrictEqual(normalized.usage, {
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30
    });
});
(0, node_test_1.default)('response normalizer - Gemini response normalizes', () => {
    const mockResponse = {
        candidates: [{
                content: {
                    parts: [{ text: 'gemini content' }]
                },
                finishReason: 'STOP'
            }],
        usageMetadata: {
            promptTokenCount: 15,
            candidatesTokenCount: 25,
            totalTokenCount: 40
        }
    };
    const normalized = (0, response_normalizer_1.normalizeResponse)(mockResponse, 'gemini', 'gemini-1.5-pro');
    node_assert_1.default.strictEqual(normalized.text, 'gemini content');
    node_assert_1.default.strictEqual(normalized.rawProvider, 'gemini');
    node_assert_1.default.strictEqual(normalized.model, 'gemini-1.5-pro');
    node_assert_1.default.strictEqual(normalized.finishReason, 'STOP');
    node_assert_1.default.deepStrictEqual(normalized.usage, {
        inputTokens: 15,
        outputTokens: 25,
        totalTokens: 40
    });
});
(0, node_test_1.default)('response normalizer - Anthropic response normalizes', () => {
    const mockResponse = {
        content: [{
                type: 'text',
                text: 'anthropic content'
            }],
        stop_reason: 'end_turn',
        usage: {
            input_tokens: 100,
            output_tokens: 50
        }
    };
    const normalized = (0, response_normalizer_1.normalizeResponse)(mockResponse, 'anthropic', 'claude-3-5-sonnet');
    node_assert_1.default.strictEqual(normalized.text, 'anthropic content');
    node_assert_1.default.strictEqual(normalized.rawProvider, 'anthropic');
    node_assert_1.default.strictEqual(normalized.model, 'claude-3-5-sonnet');
    node_assert_1.default.strictEqual(normalized.finishReason, 'end_turn');
    node_assert_1.default.deepStrictEqual(normalized.usage, {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150
    });
});
(0, node_test_1.default)('response normalizer - missing usage is handled safely', () => {
    const mockResponse = {
        choices: [{
                message: { content: 'no usage data' }
            }]
    };
    const normalized = (0, response_normalizer_1.normalizeResponse)(mockResponse, 'openai', 'gpt-4o');
    node_assert_1.default.strictEqual(normalized.text, 'no usage data');
    node_assert_1.default.deepStrictEqual(normalized.usage, {});
});
(0, node_test_1.default)('response normalizer - non-text response throws error', () => {
    const badResponse = {
        choices: [{
                message: { content: null } // non-string
            }]
    };
    node_assert_1.default.throws(() => (0, response_normalizer_1.normalizeResponse)(badResponse, 'openai', 'gpt-4o'), /message content is not a string/);
});
(0, node_test_1.default)('response normalizer - Anthropic response tool_use normalizes', () => {
    const mockResponse = {
        content: [{
                type: 'tool_use',
                id: 'toolu_0123',
                name: 'submit_task_contract',
                input: { task: 'test', successCriteria: ['ok'] }
            }],
        stop_reason: 'tool_use',
        usage: {
            input_tokens: 10,
            output_tokens: 20
        }
    };
    const normalized = (0, response_normalizer_1.normalizeResponse)(mockResponse, 'anthropic', 'claude-3-5-sonnet');
    node_assert_1.default.deepStrictEqual(JSON.parse(normalized.text), { task: 'test', successCriteria: ['ok'] });
    node_assert_1.default.strictEqual(normalized.rawProvider, 'anthropic');
    node_assert_1.default.strictEqual(normalized.model, 'claude-3-5-sonnet');
    node_assert_1.default.strictEqual(normalized.finishReason, 'tool_use');
});
