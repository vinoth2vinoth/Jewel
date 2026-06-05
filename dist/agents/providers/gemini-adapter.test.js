"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const gemini_adapter_1 = require("./gemini-adapter");
const config_1 = require("../../core/config");
const session_1 = require("../../core/session");
(0, node_test_1.default)('gemini-adapter - plan throws when API key is missing', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
        const adapter = new gemini_adapter_1.GeminiAdapter();
        await node_assert_1.default.rejects(async () => {
            await adapter.plan({
                task: 'Add hello world',
                repoSummary: 'Test repo',
                config: config_1.DEFAULT_CONFIG,
                skills: []
            });
        }, /GEMINI_API_KEY is not set in the environment/);
    }
    finally {
        if (originalKey) {
            process.env.GEMINI_API_KEY = originalKey;
        }
    }
});
(0, node_test_1.default)('gemini-adapter - mocked fetch successfully generates plan', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    let requestHeaders = {};
    let requestBody = null;
    globalThis.fetch = (async (url, options) => {
        fetchCalled = true;
        requestHeaders = options.headers;
        requestBody = JSON.parse(options.body);
        return {
            ok: true,
            json: async () => ({
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    text: JSON.stringify({
                                        task: 'Add hello world',
                                        understanding: 'mock plan from Gemini',
                                        assumptions: ['none'],
                                        filesLikelyNeeded: ['src/index.ts'],
                                        forbiddenActions: ['none'],
                                        successCriteria: ['compile'],
                                        riskLevel: 'low',
                                        requiresApproval: false,
                                        createdAt: new Date().toISOString(),
                                        mode: 'strict'
                                    })
                                }
                            ]
                        }
                    }
                ],
                usageMetadata: {
                    promptTokenCount: 120,
                    candidatesTokenCount: 60,
                    totalTokenCount: 180
                }
            })
        };
    });
    process.env.GEMINI_API_KEY = 'ai-mock-key';
    try {
        const adapter = new gemini_adapter_1.GeminiAdapter();
        const config = { ...config_1.DEFAULT_CONFIG, provider: 'gemini' };
        const plan = await adapter.plan({
            task: 'Add hello world',
            repoSummary: 'Test repo',
            config,
            skills: []
        });
        node_assert_1.default.ok(fetchCalled);
        node_assert_1.default.strictEqual(requestHeaders['x-goog-api-key'], 'ai-mock-key');
        node_assert_1.default.strictEqual(plan.understanding, 'mock plan from Gemini');
        node_assert_1.default.strictEqual(adapter.usage?.totalTokens, 180);
    }
    finally {
        globalThis.fetch = originalFetch;
        delete process.env.GEMINI_API_KEY;
    }
});
(0, node_test_1.default)('gemini-adapter - mocked fetch successfully proposes patch', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (async (url, options) => {
        fetchCalled = true;
        return {
            ok: true,
            json: async () => ({
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    text: JSON.stringify({
                                        summary: 'implement greeting',
                                        files: [
                                            {
                                                filePath: 'src/index.ts',
                                                content: 'console.log("hello");',
                                                reason: 'initial endpoint'
                                            }
                                        ],
                                        notes: ['no notes'],
                                        riskLevel: 'low'
                                    })
                                }
                            ]
                        }
                    }
                ],
                usageMetadata: {
                    promptTokenCount: 150,
                    candidatesTokenCount: 90,
                    totalTokenCount: 240
                }
            })
        };
    });
    process.env.GEMINI_API_KEY = 'ai-mock-key';
    try {
        const adapter = new gemini_adapter_1.GeminiAdapter();
        const contract = (0, session_1.generateLocalContract)('task', config_1.DEFAULT_CONFIG, ['src/index.ts']);
        const patch = await adapter.proposePatch({
            taskContract: contract,
            allowedFiles: contract.filesLikelyNeeded,
            repoContext: '',
            verificationResult: null
        });
        node_assert_1.default.ok(fetchCalled);
        node_assert_1.default.strictEqual(patch.summary, 'implement greeting');
        node_assert_1.default.strictEqual(patch.files[0].filePath, 'src/index.ts');
        node_assert_1.default.strictEqual(patch.files[0].content, 'console.log("hello");');
        node_assert_1.default.strictEqual(adapter.usage?.totalTokens, 240);
    }
    finally {
        globalThis.fetch = originalFetch;
        delete process.env.GEMINI_API_KEY;
    }
});
(0, node_test_1.default)('gemini-adapter - handles http non-200 cleanly', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url, options) => {
        return {
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error'
        };
    });
    process.env.GEMINI_API_KEY = 'ai-mock-key';
    try {
        const adapter = new gemini_adapter_1.GeminiAdapter();
        await node_assert_1.default.rejects(async () => {
            await adapter.plan({
                task: 'Add hello world',
                repoSummary: 'Test repo',
                config: config_1.DEFAULT_CONFIG,
                skills: []
            });
        }, /FAIL: LLM request failed/);
    }
    finally {
        globalThis.fetch = originalFetch;
        delete process.env.GEMINI_API_KEY;
    }
});
(0, node_test_1.default)('gemini-adapter - handles timeout cleanly', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url, options) => {
        const err = new Error('The user aborted a request.');
        err.name = 'AbortError';
        throw err;
    });
    process.env.GEMINI_API_KEY = 'ai-mock-key';
    try {
        const adapter = new gemini_adapter_1.GeminiAdapter();
        await node_assert_1.default.rejects(async () => {
            await adapter.plan({
                task: 'Add hello world',
                repoSummary: 'Test repo',
                config: { ...config_1.DEFAULT_CONFIG, llmTimeoutMs: 1 },
                skills: []
            });
        }, /timed out/);
    }
    finally {
        globalThis.fetch = originalFetch;
        delete process.env.GEMINI_API_KEY;
    }
});
(0, node_test_1.default)('gemini-adapter - request includes JSON schema config', async () => {
    const originalFetch = globalThis.fetch;
    let requestBody = null;
    globalThis.fetch = (async (url, options) => {
        requestBody = JSON.parse(options.body);
        return {
            ok: true,
            json: async () => ({
                candidates: [{
                        content: {
                            parts: [{
                                    text: JSON.stringify({
                                        task: 'task',
                                        understanding: 'plan',
                                        assumptions: [],
                                        filesLikelyNeeded: ['src/index.ts'],
                                        forbiddenActions: [],
                                        successCriteria: ['compile'],
                                        riskLevel: 'low',
                                        requiresApproval: false,
                                        createdAt: new Date().toISOString(),
                                        mode: 'strict'
                                    })
                                }]
                        }
                    }]
            })
        };
    });
    process.env.GEMINI_API_KEY = 'ai-mock-key';
    try {
        const adapter = new gemini_adapter_1.GeminiAdapter();
        const config = { ...config_1.DEFAULT_CONFIG, provider: 'gemini', model: 'gemini-1.5-flash' };
        await adapter.plan({
            task: 'task',
            repoSummary: 'summary',
            config,
            skills: []
        });
        node_assert_1.default.ok(requestBody);
        node_assert_1.default.strictEqual(requestBody.generationConfig?.responseMimeType, 'application/json');
        node_assert_1.default.ok(requestBody.generationConfig?.responseSchema);
    }
    finally {
        globalThis.fetch = originalFetch;
        delete process.env.GEMINI_API_KEY;
    }
});
(0, node_test_1.default)('gemini-adapter - blocks unsupported models by default', async () => {
    process.env.GEMINI_API_KEY = 'ai-mock-key';
    try {
        const adapter = new gemini_adapter_1.GeminiAdapter();
        // Default config has allowUnstructuredProviderFallback = false
        const config = { ...config_1.DEFAULT_CONFIG, provider: 'gemini', model: 'unknown-gemini-model' };
        await node_assert_1.default.rejects(async () => {
            await adapter.plan({
                task: 'task',
                repoSummary: 'summary',
                config,
                skills: []
            });
        }, /does not support structured output, and allowUnstructuredProviderFallback is false/);
    }
    finally {
        delete process.env.GEMINI_API_KEY;
    }
});
