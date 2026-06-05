"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const openai_adapter_1 = require("./openai-adapter");
const config_1 = require("../../core/config");
const session_1 = require("../../core/session");
(0, node_test_1.default)('openai-adapter - plan throws when API key is missing', async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
        const adapter = new openai_adapter_1.OpenAIAdapter();
        await node_assert_1.default.rejects(async () => {
            await adapter.plan({
                task: 'Add hello world',
                repoSummary: 'Test repo',
                config: config_1.DEFAULT_CONFIG,
                skills: []
            });
        }, /OPENAI_API_KEY is not set in the environment/);
    }
    finally {
        if (originalKey) {
            process.env.OPENAI_API_KEY = originalKey;
        }
    }
});
(0, node_test_1.default)('openai-adapter - mocked fetch successfully generates plan', async () => {
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
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                task: 'Add hello world',
                                understanding: 'mock plan from OpenAI',
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
                    }
                ]
            })
        };
    });
    process.env.OPENAI_API_KEY = 'sk-mock-key-12345678901234567890';
    try {
        const adapter = new openai_adapter_1.OpenAIAdapter();
        const config = { ...config_1.DEFAULT_CONFIG, provider: 'openai' };
        const plan = await adapter.plan({
            task: 'Add hello world',
            repoSummary: 'Test repo',
            config,
            skills: []
        });
        node_assert_1.default.ok(fetchCalled);
        node_assert_1.default.strictEqual(requestHeaders['Authorization'], 'Bearer sk-mock-key-12345678901234567890');
        node_assert_1.default.strictEqual(requestBody.model, 'gpt-4o-mini');
        node_assert_1.default.strictEqual(plan.understanding, 'mock plan from OpenAI');
    }
    finally {
        globalThis.fetch = originalFetch;
        delete process.env.OPENAI_API_KEY;
    }
});
(0, node_test_1.default)('openai-adapter - mocked fetch successfully proposes patch', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (async (url, options) => {
        fetchCalled = true;
        return {
            ok: true,
            json: async () => ({
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
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
                    }
                ]
            })
        };
    });
    process.env.OPENAI_API_KEY = 'sk-mock-key-12345678901234567890';
    try {
        const adapter = new openai_adapter_1.OpenAIAdapter();
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
    }
    finally {
        globalThis.fetch = originalFetch;
        delete process.env.OPENAI_API_KEY;
    }
});
(0, node_test_1.default)('openai-adapter - handles http non-200 cleanly', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url, options) => {
        return {
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error'
        };
    });
    process.env.OPENAI_API_KEY = 'sk-mock-key-12345678901234567890';
    try {
        const adapter = new openai_adapter_1.OpenAIAdapter();
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
        delete process.env.OPENAI_API_KEY;
    }
});
(0, node_test_1.default)('openai-adapter - request includes json_schema response format', async () => {
    const originalFetch = globalThis.fetch;
    let requestBody = null;
    globalThis.fetch = (async (url, options) => {
        requestBody = JSON.parse(options.body);
        return {
            ok: true,
            json: async () => ({
                choices: [{
                        message: {
                            content: JSON.stringify({
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
                        }
                    }]
            })
        };
    });
    process.env.OPENAI_API_KEY = 'sk-mock-key';
    try {
        const adapter = new openai_adapter_1.OpenAIAdapter();
        const config = { ...config_1.DEFAULT_CONFIG, provider: 'openai', model: 'gpt-4o' };
        await adapter.plan({
            task: 'task',
            repoSummary: 'summary',
            config,
            skills: []
        });
        node_assert_1.default.ok(requestBody);
        node_assert_1.default.strictEqual(requestBody.response_format?.type, 'json_schema');
        node_assert_1.default.strictEqual(requestBody.response_format?.json_schema?.name, 'TaskContract');
    }
    finally {
        globalThis.fetch = originalFetch;
        delete process.env.OPENAI_API_KEY;
    }
});
(0, node_test_1.default)('openai-adapter - blocks unsupported models by default', async () => {
    process.env.OPENAI_API_KEY = 'sk-mock-key';
    try {
        const adapter = new openai_adapter_1.OpenAIAdapter();
        // Default config has allowUnstructuredProviderFallback = false
        const config = { ...config_1.DEFAULT_CONFIG, provider: 'openai', model: 'gpt-3.5-turbo' };
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
        delete process.env.OPENAI_API_KEY;
    }
});
(0, node_test_1.default)('openai-adapter - permits unsupported models when fallback is allowed', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = (async (url, options) => {
        fetchCalled = true;
        return {
            ok: true,
            json: async () => ({
                choices: [{
                        message: {
                            content: JSON.stringify({
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
                        }
                    }]
            })
        };
    });
    process.env.OPENAI_API_KEY = 'sk-mock-key';
    try {
        const adapter = new openai_adapter_1.OpenAIAdapter();
        const config = {
            ...config_1.DEFAULT_CONFIG,
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            allowUnstructuredProviderFallback: true
        };
        await adapter.plan({
            task: 'task',
            repoSummary: 'summary',
            config,
            skills: []
        });
        node_assert_1.default.ok(fetchCalled);
    }
    finally {
        globalThis.fetch = originalFetch;
        delete process.env.OPENAI_API_KEY;
    }
});
(0, node_test_1.default)('openai-adapter - throws error when maxSessionCost is exceeded', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;
    globalThis.fetch = (async (url, options) => {
        fetchCount++;
        return {
            ok: true,
            json: async () => ({
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                task: 'Add hello world',
                                understanding: 'mock plan from OpenAI',
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
                    }
                ],
                usage: {
                    prompt_tokens: 1000000,
                    completion_tokens: 1000000,
                    total_tokens: 2000000
                }
            })
        };
    });
    process.env.OPENAI_API_KEY = 'sk-mock-key';
    try {
        const adapter = new openai_adapter_1.OpenAIAdapter();
        const config = { ...config_1.DEFAULT_CONFIG, provider: 'openai', maxSessionCost: 0.50 };
        await node_assert_1.default.rejects(async () => {
            await adapter.plan({
                task: 'Add hello world',
                repoSummary: 'Test repo',
                config,
                skills: []
            });
        }, /\[Jewel Budget Guard\] Session cost limit exceeded/);
        node_assert_1.default.strictEqual(fetchCount, 1);
    }
    finally {
        globalThis.fetch = originalFetch;
        delete process.env.OPENAI_API_KEY;
    }
});
