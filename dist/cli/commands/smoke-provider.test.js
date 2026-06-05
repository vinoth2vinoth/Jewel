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
const smoke_provider_1 = require("./smoke-provider");
(0, node_test_1.default)('smoke-provider - provider none is invalid', async () => {
    const originalExit = process.exit;
    const originalError = console.error;
    const originalLog = console.log;
    let exitCode;
    process.exit = ((code) => {
        exitCode = code;
        return undefined;
    });
    let consoleErrors = [];
    console.error = (...args) => {
        consoleErrors.push(args.join(' '));
    };
    console.log = () => { };
    try {
        await (0, smoke_provider_1.runSmokeProvider)('none');
        node_assert_1.default.strictEqual(exitCode, 1);
        node_assert_1.default.ok(consoleErrors.some(err => err.toLowerCase().includes('provider "none" is invalid')));
    }
    finally {
        process.exit = originalExit;
        console.error = originalError;
        console.log = originalLog;
    }
});
(0, node_test_1.default)('smoke-provider - missing API key fails cleanly', async () => {
    const originalExit = process.exit;
    const originalError = console.error;
    const originalLog = console.log;
    const originalApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    let exitCode;
    process.exit = ((code) => {
        exitCode = code;
        return undefined;
    });
    let consoleErrors = [];
    console.error = (...args) => {
        consoleErrors.push(args.join(' '));
    };
    console.log = () => { };
    try {
        await (0, smoke_provider_1.runSmokeProvider)('openai');
        node_assert_1.default.strictEqual(exitCode, 1);
        node_assert_1.default.ok(consoleErrors.some(err => err.includes('Missing API key environment variable "OPENAI_API_KEY"')));
    }
    finally {
        process.exit = originalExit;
        console.error = originalError;
        console.log = originalLog;
        if (originalApiKey) {
            process.env.OPENAI_API_KEY = originalApiKey;
        }
    }
});
(0, node_test_1.default)('smoke-provider - mocked smoke test passes', async () => {
    const originalExit = process.exit;
    const originalError = console.error;
    const originalLog = console.log;
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-mock-key';
    let exitCode;
    process.exit = ((code) => {
        exitCode = code;
        return undefined;
    });
    console.error = () => { };
    console.log = () => { };
    // Mock global fetch for OpenAI ReviewResult format
    globalThis.fetch = (async (url, options) => {
        return {
            ok: true,
            json: async () => ({
                choices: [
                    {
                        finish_reason: 'stop',
                        message: {
                            content: JSON.stringify({
                                status: 'PASS',
                                findings: ['Smoke test passed from mock OpenAI']
                            })
                        }
                    }
                ],
                usage: {
                    prompt_tokens: 42,
                    completion_tokens: 12,
                    total_tokens: 54
                }
            })
        };
    });
    const tempDir = path.join(__dirname, `../../../tmp-smoke-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    try {
        await (0, smoke_provider_1.runSmokeProvider)('openai', 'gpt-4o-mini', true, false, tempDir);
        node_assert_1.default.strictEqual(exitCode, 0);
        // Verify report was written
        const jsonPath = path.join(tempDir, '.jewel', 'reports', 'provider-smoke.json');
        const mdPath = path.join(tempDir, '.jewel', 'reports', 'provider-smoke.md');
        node_assert_1.default.ok(fs.existsSync(jsonPath), 'JSON report should exist');
        node_assert_1.default.ok(fs.existsSync(mdPath), 'Markdown report should exist');
        const jsonReport = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        node_assert_1.default.strictEqual(jsonReport.provider, 'openai');
        node_assert_1.default.strictEqual(jsonReport.schemaMode, true);
        node_assert_1.default.strictEqual(jsonReport.status, 'PASS');
        node_assert_1.default.strictEqual(jsonReport.usage.totalTokens, 54);
    }
    finally {
        process.exit = originalExit;
        console.error = originalError;
        console.log = originalLog;
        globalThis.fetch = originalFetch;
        if (originalApiKey) {
            process.env.OPENAI_API_KEY = originalApiKey;
        }
        else {
            delete process.env.OPENAI_API_KEY;
        }
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        catch { }
    }
});
(0, node_test_1.default)('smoke-provider - no-write flag skips writing report', async () => {
    const originalExit = process.exit;
    const originalError = console.error;
    const originalLog = console.log;
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-mock-key';
    let exitCode;
    process.exit = ((code) => {
        exitCode = code;
        return undefined;
    });
    console.error = () => { };
    console.log = () => { };
    globalThis.fetch = (async (url, options) => {
        return {
            ok: true,
            json: async () => ({
                choices: [
                    {
                        finish_reason: 'stop',
                        message: {
                            content: JSON.stringify({
                                status: 'PASS',
                                findings: ['Smoke test passed from mock OpenAI']
                            })
                        }
                    }
                ]
            })
        };
    });
    const tempDir = path.join(__dirname, `../../../tmp-smoke-nowrite-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    try {
        await (0, smoke_provider_1.runSmokeProvider)('openai', 'gpt-4o-mini', true, true, tempDir);
        node_assert_1.default.strictEqual(exitCode, 0);
        const jsonPath = path.join(tempDir, '.jewel', 'reports', 'provider-smoke.json');
        node_assert_1.default.ok(!fs.existsSync(jsonPath), 'JSON report should NOT exist when no-write is enabled');
    }
    finally {
        process.exit = originalExit;
        console.error = originalError;
        console.log = originalLog;
        globalThis.fetch = originalFetch;
        if (originalApiKey) {
            process.env.OPENAI_API_KEY = originalApiKey;
        }
        else {
            delete process.env.OPENAI_API_KEY;
        }
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        catch { }
    }
});
