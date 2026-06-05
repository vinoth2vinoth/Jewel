"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const http_client_1 = require("./http-client");
(0, node_test_1.default)('http-client - 429 status code retries and succeeds on next attempt', async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = (async (url, options) => {
        callCount++;
        if (callCount === 1) {
            return {
                ok: false,
                status: 429,
                text: async () => 'Rate limit exceeded'
            };
        }
        return {
            ok: true,
            status: 200,
            json: async () => ({ success: true })
        };
    });
    try {
        const tracker = { count: 0 };
        const res = await (0, http_client_1.postJsonWithRetry)('https://api.test.com', {
            headers: {},
            body: {},
            timeoutMs: 1000,
            maxRetries: 2,
            providerName: 'test',
            methodName: 'testMethod',
            retryTracker: tracker
        });
        node_assert_1.default.strictEqual(callCount, 2);
        node_assert_1.default.strictEqual(tracker.count, 1);
        node_assert_1.default.deepStrictEqual(res, { success: true });
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
(0, node_test_1.default)('http-client - 500 status code retries and fails after maxRetries', async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = (async (url, options) => {
        callCount++;
        return {
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error'
        };
    });
    try {
        const tracker = { count: 0 };
        await node_assert_1.default.rejects((0, http_client_1.postJsonWithRetry)('https://api.test.com', {
            headers: {},
            body: {},
            timeoutMs: 1000,
            maxRetries: 2,
            providerName: 'test',
            methodName: 'testMethod',
            retryTracker: tracker
        }), /Error: FAIL: LLM request failed after 3 attempts/);
        node_assert_1.default.strictEqual(callCount, 3); // initial + 2 retries
        node_assert_1.default.strictEqual(tracker.count, 2);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
(0, node_test_1.default)('http-client - 401 status code does not retry and fails immediately', async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = (async (url, options) => {
        callCount++;
        return {
            ok: false,
            status: 401,
            text: async () => 'Unauthorized'
        };
    });
    try {
        const tracker = { count: 0 };
        await node_assert_1.default.rejects((0, http_client_1.postJsonWithRetry)('https://api.test.com', {
            headers: {},
            body: { secret: 'secret-key-12345' },
            timeoutMs: 1000,
            maxRetries: 2,
            providerName: 'test',
            methodName: 'testMethod',
            retryTracker: tracker
        }), /Non-retryable error/);
        node_assert_1.default.strictEqual(callCount, 1);
        node_assert_1.default.strictEqual(tracker.count, 0);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
(0, node_test_1.default)('http-client - secrets are redacted from error outputs', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url, options) => {
        return {
            ok: false,
            status: 400,
            text: async () => 'Bad Request containing OpenAI API key sk-proj-12345678901234567890'
        };
    });
    try {
        await node_assert_1.default.rejects((0, http_client_1.postJsonWithRetry)('https://api.test.com', {
            headers: {},
            body: {},
            timeoutMs: 1000,
            maxRetries: 1,
            providerName: 'test',
            methodName: 'testMethod'
        }), (err) => {
            node_assert_1.default.ok(!err.message.includes('sk-proj-12345678901234567890'));
            node_assert_1.default.ok(err.message.includes('[REDACTED'));
            return true;
        });
    }
    finally {
        globalThis.fetch = originalFetch;
    }
});
