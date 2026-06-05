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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const provider_ready_1 = require("./provider-ready");
(0, node_test_1.default)('provider-ready - provider none is invalid', async () => {
    const originalExit = process.exit;
    const originalError = console.error;
    let exitCode;
    process.exit = ((code) => {
        exitCode = code;
        return undefined;
    });
    console.error = () => { };
    try {
        await (0, provider_ready_1.runProviderReady)('none');
        node_assert_1.default.strictEqual(exitCode, 1);
    }
    finally {
        process.exit = originalExit;
        console.error = originalError;
    }
});
(0, node_test_1.default)('provider-ready - missing key fails cleanly and writes report', async () => {
    const originalExit = process.exit;
    const originalError = console.error;
    const originalApiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    let exitCode;
    process.exit = ((code) => {
        exitCode = code;
        return undefined;
    });
    console.error = () => { };
    const tempDir = path.join(__dirname, `../../../tmp-ready-missing-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    try {
        await (0, provider_ready_1.runProviderReady)('gemini', 'gemini-2.5-flash', tempDir);
        node_assert_1.default.strictEqual(exitCode, 1);
        const jsonPath = path.join(tempDir, '.jewel', 'reports', 'provider-ready.json');
        const mdPath = path.join(tempDir, '.jewel', 'reports', 'provider-ready.md');
        node_assert_1.default.ok(fs.existsSync(jsonPath), 'JSON readiness report should exist even on missing key');
        node_assert_1.default.ok(fs.existsSync(mdPath), 'Markdown readiness report should exist even on missing key');
        const jsonReport = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        node_assert_1.default.strictEqual(jsonReport.provider, 'gemini');
        node_assert_1.default.strictEqual(jsonReport.model, 'gemini-2.5-flash');
        node_assert_1.default.strictEqual(jsonReport.apiKeyPresent, 'No');
        node_assert_1.default.strictEqual(jsonReport.smokeResult, 'FAIL');
        node_assert_1.default.ok(jsonReport.nextAction.includes('Set the GEMINI_API_KEY'));
    }
    finally {
        process.exit = originalExit;
        console.error = originalError;
        if (originalApiKey) {
            process.env.GEMINI_API_KEY = originalApiKey;
        }
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        catch { }
    }
});
(0, node_test_1.default)('provider-ready - mocked gemini readiness check passes', async () => {
    const originalExit = process.exit;
    const originalError = console.error;
    const originalLog = console.log;
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'AIzaSyMockKey';
    let exitCode;
    process.exit = ((code) => {
        exitCode = code;
        return undefined;
    });
    console.error = () => { };
    console.log = () => { };
    // Mock global fetch for Gemini response
    globalThis.fetch = (async (url, options) => {
        return {
            ok: true,
            json: async () => ({
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    text: JSON.stringify({
                                        status: 'PASS',
                                        findings: ['Smoke test passed from mock Gemini']
                                    })
                                }
                            ]
                        }
                    }
                ],
                usageMetadata: {
                    promptTokenCount: 15,
                    candidatesTokenCount: 10,
                    totalTokenCount: 25
                }
            })
        };
    });
    const tempDir = path.join(__dirname, `../../../tmp-ready-gemini-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    try {
        await (0, provider_ready_1.runProviderReady)('gemini', 'gemini-2.5-flash', tempDir);
        node_assert_1.default.strictEqual(exitCode, 0);
        const jsonPath = path.join(tempDir, '.jewel', 'reports', 'provider-ready.json');
        const mdPath = path.join(tempDir, '.jewel', 'reports', 'provider-ready.md');
        node_assert_1.default.ok(fs.existsSync(jsonPath), 'JSON readiness report should exist');
        node_assert_1.default.ok(fs.existsSync(mdPath), 'Markdown readiness report should exist');
        const jsonReport = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        node_assert_1.default.strictEqual(jsonReport.provider, 'gemini');
        node_assert_1.default.strictEqual(jsonReport.model, 'gemini-2.5-flash');
        node_assert_1.default.strictEqual(jsonReport.apiKeyPresent, 'Yes');
        node_assert_1.default.strictEqual(jsonReport.structuredOutputSupported, 'Yes');
        node_assert_1.default.strictEqual(jsonReport.smokeResult, 'PASS');
        node_assert_1.default.strictEqual(jsonReport.retryCount, 0);
        node_assert_1.default.ok(jsonReport.usage !== null);
        node_assert_1.default.strictEqual(jsonReport.usage.totalTokens, 25);
        node_assert_1.default.strictEqual(jsonReport.redactionStatus, 'COMPLIANT');
    }
    finally {
        process.exit = originalExit;
        console.error = originalError;
        console.log = originalLog;
        globalThis.fetch = originalFetch;
        if (originalApiKey) {
            process.env.GEMINI_API_KEY = originalApiKey;
        }
        else {
            delete process.env.GEMINI_API_KEY;
        }
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        catch { }
    }
});
(0, node_test_1.default)('provider-ready - mocked openrouter readiness check passes', async () => {
    const originalExit = process.exit;
    const originalError = console.error;
    const originalLog = console.log;
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-MockKey';
    let exitCode;
    process.exit = ((code) => {
        exitCode = code;
        return undefined;
    });
    console.error = () => { };
    console.log = () => { };
    // Mock global fetch for OpenRouter response
    globalThis.fetch = (async (url, options) => {
        // Assert response_format is included
        const bodyObj = JSON.parse(options.body);
        node_assert_1.default.strictEqual(bodyObj.response_format?.type, 'json_schema');
        return {
            ok: true,
            json: async () => ({
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                status: 'PASS',
                                findings: ['Smoke test passed from mock OpenRouter']
                            })
                        }
                    }
                ],
                usage: {
                    prompt_tokens: 20,
                    completion_tokens: 15,
                    total_tokens: 35
                }
            })
        };
    });
    const tempDir = path.join(__dirname, `../../../tmp-ready-openrouter-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    try {
        await (0, provider_ready_1.runProviderReady)('openrouter', 'openai/gpt-4o-mini', tempDir);
        node_assert_1.default.strictEqual(exitCode, 0);
        const jsonPath = path.join(tempDir, '.jewel', 'reports', 'provider-ready.json');
        const jsonReport = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        node_assert_1.default.strictEqual(jsonReport.provider, 'openrouter');
        node_assert_1.default.strictEqual(jsonReport.model, 'openai/gpt-4o-mini');
        node_assert_1.default.strictEqual(jsonReport.apiKeyPresent, 'Yes');
        node_assert_1.default.strictEqual(jsonReport.structuredOutputSupported, 'Yes');
        node_assert_1.default.strictEqual(jsonReport.smokeResult, 'PASS');
        node_assert_1.default.strictEqual(jsonReport.usage.totalTokens, 35);
    }
    finally {
        process.exit = originalExit;
        console.error = originalError;
        console.log = originalLog;
        globalThis.fetch = originalFetch;
        if (originalApiKey) {
            process.env.OPENROUTER_API_KEY = originalApiKey;
        }
        else {
            delete process.env.OPENROUTER_API_KEY;
        }
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        catch { }
    }
});
