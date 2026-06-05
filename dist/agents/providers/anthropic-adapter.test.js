"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const anthropic_adapter_1 = require("./anthropic-adapter");
const config_1 = require("../../core/config");
const session_1 = require("../../core/session");
(0, node_test_1.default)('anthropic-adapter - plan throws when API key is missing', async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
        const adapter = new anthropic_adapter_1.AnthropicAdapter();
        await node_assert_1.default.rejects(async () => {
            await adapter.plan({
                task: 'Add hello world',
                repoSummary: 'Test repo',
                config: config_1.DEFAULT_CONFIG,
                skills: []
            });
        }, /ANTHROPIC_API_KEY is not set in the environment/);
    }
    finally {
        if (originalKey) {
            process.env.ANTHROPIC_API_KEY = originalKey;
        }
    }
});
(0, node_test_1.default)('anthropic-adapter - mocked fetch successfully generates plan', async () => {
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
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            task: 'Add hello world',
                            understanding: 'mock plan from Anthropic',
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
                ],
                usage: {
                    input_tokens: 150,
                    output_tokens: 75
                }
            })
        };
    });
    process.env.ANTHROPIC_API_KEY = 'anthropic-mock-key';
    try {
        const adapter = new anthropic_adapter_1.AnthropicAdapter();
        const config = { ...config_1.DEFAULT_CONFIG, provider: 'anthropic' };
        const plan = await adapter.plan({
            task: 'Add hello world',
            repoSummary: 'Test repo',
            config,
            skills: []
        });
        node_assert_1.default.ok(fetchCalled);
        node_assert_1.default.strictEqual(requestHeaders['x-api-key'], 'anthropic-mock-key');
        node_assert_1.default.strictEqual(requestHeaders['anthropic-version'], '2023-06-01');
        node_assert_1.default.strictEqual(plan.understanding, 'mock plan from Anthropic');
        node_assert_1.default.strictEqual(adapter.usage?.totalTokens, 225);
    }
    finally {
        globalThis.fetch = originalFetch;
        delete process.env.ANTHROPIC_API_KEY;
    }
});
(0, node_test_1.default)('anthropic-adapter - mocked fetch successfully proposes patch', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (async (url, options) => {
        fetchCalled = true;
        return {
            ok: true,
            json: async () => ({
                content: [
                    {
                        type: 'text',
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
                ],
                usage: {
                    input_tokens: 200,
                    output_tokens: 100
                }
            })
        };
    });
    process.env.ANTHROPIC_API_KEY = 'anthropic-mock-key';
    try {
        const adapter = new anthropic_adapter_1.AnthropicAdapter();
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
        node_assert_1.default.strictEqual(adapter.usage?.totalTokens, 300);
    }
    finally {
        globalThis.fetch = originalFetch;
        delete process.env.ANTHROPIC_API_KEY;
    }
});
(0, node_test_1.default)('anthropic-adapter - handles http non-200 cleanly', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url, options) => {
        return {
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error'
        };
    });
    process.env.ANTHROPIC_API_KEY = 'anthropic-mock-key';
    try {
        const adapter = new anthropic_adapter_1.AnthropicAdapter();
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
        delete process.env.ANTHROPIC_API_KEY;
    }
});
(0, node_test_1.default)('anthropic-adapter - handles timeout cleanly', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url, options) => {
        const err = new Error('The user aborted a request.');
        err.name = 'AbortError';
        throw err;
    });
    process.env.ANTHROPIC_API_KEY = 'anthropic-mock-key';
    try {
        const adapter = new anthropic_adapter_1.AnthropicAdapter();
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
        delete process.env.ANTHROPIC_API_KEY;
    }
});
