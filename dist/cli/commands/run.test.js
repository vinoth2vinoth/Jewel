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
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const run_1 = require("./run");
function createTempWorkspace() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-run-test-'));
    // Initialize Git repo
    (0, child_process_1.execSync)('git init', { cwd: tempDir, stdio: 'ignore' });
    (0, child_process_1.execSync)('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    (0, child_process_1.execSync)('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' });
    // Write a basic package.json
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        scripts: {
            test: 'echo "tests pass"'
        }
    }, null, 2), 'utf8');
    // Write .gitignore to prevent git clean from deleting report outputs
    fs.writeFileSync(path.join(tempDir, '.gitignore'), '.jewel\nnode_modules\ndist\n', 'utf8');
    (0, child_process_1.execSync)('git add package.json .gitignore', { cwd: tempDir, stdio: 'ignore' });
    (0, child_process_1.execSync)('git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });
    // Write jewel.config.json
    fs.writeFileSync(path.join(tempDir, 'jewel.config.json'), JSON.stringify({
        projectName: 'test-project',
        mode: 'strict',
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0,
        maxOutputTokens: 4000,
        llmTimeoutMs: 60000,
        llmMaxRetries: 1,
        llmStrictJson: true,
        commands: {
            test: 'npm run test'
        },
        requireHumanDiffApproval: false,
        agentToolLoopEnabled: false
    }, null, 2), 'utf8');
    return tempDir;
}
function cleanupWorkspace(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    catch { }
}
(0, node_test_1.default)('run command - OpenAI integration safe patch writes successfully', async () => {
    const tempDir = createTempWorkspace();
    const originalExit = process.exit;
    const originalFetch = globalThis.fetch;
    let exitCode = null;
    process.exit = ((code) => {
        exitCode = code !== undefined ? code : 0;
        throw new Error(`exit-${exitCode}`);
    });
    // Mock fetch to simulate plan and patch
    globalThis.fetch = (async (url, options) => {
        const body = JSON.parse(options.body);
        const lastMessage = body.messages[body.messages.length - 1].content;
        if (lastMessage.includes('TaskContract')) {
            // Return a valid plan
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                            message: {
                                content: JSON.stringify({
                                    task: 'Fix math',
                                    understanding: 'math plan',
                                    assumptions: [],
                                    filesLikelyNeeded: ['math.js'],
                                    forbiddenActions: [],
                                    successCriteria: ['compile'],
                                    riskLevel: 'low',
                                    requiresApproval: false,
                                    createdAt: new Date().toISOString(),
                                    mode: 'lax'
                                })
                            }
                        }]
                })
            };
        }
        else if (lastMessage.includes('ReviewResult')) {
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                            message: {
                                content: JSON.stringify({
                                    status: 'PASS',
                                    findings: ['Mock review passed.']
                                })
                            }
                        }]
                })
            };
        }
        else {
            // Return a valid safe patch
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                            message: {
                                content: JSON.stringify({
                                    summary: 'safe patch',
                                    files: [{ filePath: 'math.js', content: 'console.log("math content");', reason: 'math content reason' }],
                                    notes: [],
                                    riskLevel: 'low'
                                })
                            }
                        }]
                })
            };
        }
    });
    process.env.OPENAI_API_KEY = 'sk-mock-key-12345678901234567890';
    try {
        try {
            await (0, run_1.runTask)('Fix math', ['math.js'], false, tempDir, true, true, true);
        }
        catch (err) {
            if (!err.message.includes('exit-0')) {
                throw err;
            }
        }
        node_assert_1.default.strictEqual(exitCode, 0);
        node_assert_1.default.strictEqual(fs.readFileSync(path.join(tempDir, 'math.js'), 'utf8'), 'console.log("math content");');
        // Verify report details
        const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
        node_assert_1.default.ok(fs.existsSync(reportPath));
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        node_assert_1.default.strictEqual(report.provider, 'openai');
        node_assert_1.default.strictEqual(report.model, 'gpt-4o-mini');
        node_assert_1.default.strictEqual(report.status, 'PASS');
        // Confirm no API key is written in the report
        const rawReportContent = fs.readFileSync(reportPath, 'utf8');
        node_assert_1.default.ok(!rawReportContent.includes('sk-mock-key'));
    }
    finally {
        process.exit = originalExit;
        globalThis.fetch = originalFetch;
        delete process.env.OPENAI_API_KEY;
        cleanupWorkspace(tempDir);
    }
});
(0, node_test_1.default)('run command - OpenAI integration blocked for parent traversal', async () => {
    const tempDir = createTempWorkspace();
    const originalExit = process.exit;
    const originalFetch = globalThis.fetch;
    let exitCode = null;
    process.exit = ((code) => {
        exitCode = code !== undefined ? code : 0;
        throw new Error(`exit-${exitCode}`);
    });
    globalThis.fetch = (async (url, options) => {
        const body = JSON.parse(options.body);
        const lastMessage = body.messages[body.messages.length - 1].content;
        if (lastMessage.includes('TaskContract')) {
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                            message: {
                                content: JSON.stringify({
                                    task: 'Unsafe traversal task',
                                    understanding: 'math plan',
                                    assumptions: [],
                                    filesLikelyNeeded: ['math.js'],
                                    forbiddenActions: [],
                                    successCriteria: ['compile'],
                                    riskLevel: 'low',
                                    requiresApproval: false,
                                    createdAt: new Date().toISOString(),
                                    mode: 'lax'
                                })
                            }
                        }]
                })
            };
        }
        else if (lastMessage.includes('ReviewResult')) {
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                            message: {
                                content: JSON.stringify({
                                    status: 'PASS',
                                    findings: ['Mock review passed.']
                                })
                            }
                        }]
                })
            };
        }
        else {
            // Propose traversal path
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                            message: {
                                content: JSON.stringify({
                                    summary: 'unsafe patch',
                                    files: [{ filePath: '../outside.txt', content: 'hack content', reason: 'exploit' }],
                                    notes: [],
                                    riskLevel: 'low'
                                })
                            }
                        }]
                })
            };
        }
    });
    process.env.OPENAI_API_KEY = 'sk-mock-key-12345678901234567890';
    try {
        try {
            await (0, run_1.runTask)('Unsafe traversal task', ['math.js'], false, tempDir, true, true, true);
        }
        catch (err) {
            if (!err.message.includes('exit-1')) {
                throw err;
            }
        }
        node_assert_1.default.strictEqual(exitCode, 1);
        node_assert_1.default.ok(!fs.existsSync(path.join(tempDir, '../outside.txt')));
        const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
        node_assert_1.default.ok(fs.existsSync(reportPath));
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        node_assert_1.default.strictEqual(report.status, 'BLOCKED');
    }
    finally {
        process.exit = originalExit;
        globalThis.fetch = originalFetch;
        delete process.env.OPENAI_API_KEY;
        cleanupWorkspace(tempDir);
    }
});
(0, node_test_1.default)('run command - OpenAI integration blocked for absolute path', async () => {
    const tempDir = createTempWorkspace();
    const originalExit = process.exit;
    const originalFetch = globalThis.fetch;
    let exitCode = null;
    process.exit = ((code) => {
        exitCode = code !== undefined ? code : 0;
        throw new Error(`exit-${exitCode}`);
    });
    globalThis.fetch = (async (url, options) => {
        const body = JSON.parse(options.body);
        const lastMessage = body.messages[body.messages.length - 1].content;
        if (lastMessage.includes('TaskContract')) {
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                            message: {
                                content: JSON.stringify({
                                    task: 'Unsafe absolute task',
                                    understanding: 'math plan',
                                    assumptions: [],
                                    filesLikelyNeeded: ['math.js'],
                                    forbiddenActions: [],
                                    successCriteria: ['compile'],
                                    riskLevel: 'low',
                                    requiresApproval: false,
                                    createdAt: new Date().toISOString(),
                                    mode: 'lax'
                                })
                            }
                        }]
                })
            };
        }
        else if (lastMessage.includes('ReviewResult')) {
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                            message: {
                                content: JSON.stringify({
                                    status: 'PASS',
                                    findings: ['Mock review passed.']
                                })
                            }
                        }]
                })
            };
        }
        else {
            // Propose Windows drive absolute path
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                            message: {
                                content: JSON.stringify({
                                    summary: 'unsafe patch',
                                    files: [{ filePath: 'C:\\Users\\test\\outside.txt', content: 'hack content', reason: 'exploit' }],
                                    notes: [],
                                    riskLevel: 'low'
                                })
                            }
                        }]
                })
            };
        }
    });
    process.env.OPENAI_API_KEY = 'sk-mock-key-12345678901234567890';
    try {
        try {
            await (0, run_1.runTask)('Unsafe absolute task', ['math.js'], false, tempDir, true, true, true);
        }
        catch (err) {
            if (!err.message.includes('exit-1')) {
                throw err;
            }
        }
        node_assert_1.default.strictEqual(exitCode, 1);
        const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
        node_assert_1.default.ok(fs.existsSync(reportPath));
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        node_assert_1.default.strictEqual(report.status, 'BLOCKED');
    }
    finally {
        process.exit = originalExit;
        globalThis.fetch = originalFetch;
        delete process.env.OPENAI_API_KEY;
        cleanupWorkspace(tempDir);
    }
});
(0, node_test_1.default)('run command - CLI provider overrides and validation', async () => {
    const tempDir = createTempWorkspace();
    const originalExit = process.exit;
    const originalFetch = globalThis.fetch;
    let exitCode = null;
    process.exit = ((code) => {
        exitCode = code !== undefined ? code : 0;
        throw new Error(`exit-${exitCode}`);
    });
    // 1. Invalid provider override exits immediately before checkpoint
    try {
        await (0, run_1.runTask)('Test invalid provider', [], false, tempDir, true, true, true, { provider: 'invalid-provider' });
    }
    catch (err) {
        node_assert_1.default.ok(err.message.includes('exit-1'));
    }
    node_assert_1.default.strictEqual(exitCode, 1);
    // Verify no session folder exists
    const sessionsDir = path.join(tempDir, '.jewel', 'sessions');
    node_assert_1.default.ok(!fs.existsSync(sessionsDir));
    // Reset exitCode
    exitCode = null;
    // Mock fetch for planning/patching
    globalThis.fetch = (async (url, options) => {
        const body = JSON.parse(options.body);
        const lastMessage = body.messages[body.messages.length - 1].content;
        if (lastMessage.includes('TaskContract')) {
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                            message: {
                                content: JSON.stringify({
                                    task: 'Override test',
                                    understanding: 'override plan',
                                    assumptions: [],
                                    filesLikelyNeeded: ['math.js'],
                                    forbiddenActions: [],
                                    successCriteria: ['compile'],
                                    riskLevel: 'low',
                                    requiresApproval: false,
                                    createdAt: new Date().toISOString(),
                                    mode: 'lax'
                                })
                            }
                        }],
                    usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 }
                })
            };
        }
        else if (lastMessage.includes('ReviewResult')) {
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                            message: {
                                content: JSON.stringify({
                                    status: 'PASS',
                                    findings: ['Mock review passed.']
                                })
                            }
                        }]
                })
            };
        }
        else {
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                            message: {
                                content: JSON.stringify({
                                    summary: 'override patch',
                                    files: [{ filePath: 'math.js', content: 'console.log("override");', reason: 'override' }],
                                    notes: [],
                                    riskLevel: 'low'
                                })
                            }
                        }],
                    usage: { prompt_tokens: 60, completion_tokens: 30, total_tokens: 90 }
                })
            };
        }
    });
    process.env.OPENAI_API_KEY = 'sk-mock-key-12345678901234567890';
    try {
        // 2. OpenAI provider override executes successfully
        try {
            await (0, run_1.runTask)('Override test', ['math.js'], false, tempDir, true, true, true, {
                provider: 'openai',
                model: 'gpt-4-custom',
                temperature: 0.1,
                maxOutputTokens: 2500
            });
        }
        catch (err) {
            if (!err.message.includes('exit-0'))
                throw err;
        }
        node_assert_1.default.strictEqual(exitCode, 0);
        const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
        node_assert_1.default.ok(fs.existsSync(reportPath));
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        node_assert_1.default.strictEqual(report.provider, 'openai');
        node_assert_1.default.strictEqual(report.model, 'gpt-4-custom');
        node_assert_1.default.strictEqual(report.status, 'PASS');
        node_assert_1.default.strictEqual(report.usage.totalTokens, 165); // 75 + 90
    }
    finally {
        process.exit = originalExit;
        globalThis.fetch = originalFetch;
        delete process.env.OPENAI_API_KEY;
        cleanupWorkspace(tempDir);
    }
});
(0, node_test_1.default)('run command - Gemini integration safe patch and unsafe blocking', async () => {
    const tempDir = createTempWorkspace();
    const originalExit = process.exit;
    const originalFetch = globalThis.fetch;
    let exitCode = null;
    process.exit = ((code) => {
        exitCode = code !== undefined ? code : 0;
        throw new Error(`exit-${exitCode}`);
    });
    process.env.GEMINI_API_KEY = 'gemini-mock-key';
    let returnUnsafe = false;
    globalThis.fetch = (async (url, options) => {
        const body = JSON.parse(options.body);
        const lastMessage = body.contents?.[body.contents.length - 1]?.parts?.[0]?.text || '';
        if (lastMessage.includes('TaskContract')) {
            // Plan phase
            return {
                ok: true,
                json: async () => ({
                    candidates: [{
                            content: {
                                parts: [{
                                        text: JSON.stringify({
                                            task: 'gemini task',
                                            understanding: 'gemini plan',
                                            assumptions: [],
                                            filesLikelyNeeded: ['math.js'],
                                            forbiddenActions: [],
                                            successCriteria: ['compile'],
                                            riskLevel: 'low',
                                            requiresApproval: false,
                                            createdAt: new Date().toISOString(),
                                            mode: 'lax'
                                        })
                                    }]
                            }
                        }]
                })
            };
        }
        else if (lastMessage.includes('ReviewResult')) {
            return {
                ok: true,
                json: async () => ({
                    candidates: [{
                            content: {
                                parts: [{
                                        text: JSON.stringify({
                                            status: 'PASS',
                                            findings: ['Mock Gemini review passed.']
                                        })
                                    }]
                            }
                        }]
                })
            };
        }
        else {
            // Patch phase
            const patchContent = returnUnsafe
                ? {
                    summary: 'unsafe patch',
                    files: [{ filePath: '../outside.txt', content: 'hack', reason: 'exploit' }],
                    notes: [],
                    riskLevel: 'low'
                }
                : {
                    summary: 'safe patch',
                    files: [{ filePath: 'math.js', content: 'console.log("gemini math");', reason: 'gemini math' }],
                    notes: [],
                    riskLevel: 'low'
                };
            return {
                ok: true,
                json: async () => ({
                    candidates: [{
                            content: {
                                parts: [{
                                        text: JSON.stringify(patchContent)
                                    }]
                            }
                        }]
                })
            };
        }
    });
    try {
        // 1. Safe patch execution
        try {
            await (0, run_1.runTask)('gemini task', ['math.js'], false, tempDir, true, true, true, { provider: 'gemini', model: 'gemini-test' });
        }
        catch (err) {
            if (!err.message.includes('exit-0'))
                throw err;
        }
        node_assert_1.default.strictEqual(exitCode, 0);
        node_assert_1.default.strictEqual(fs.readFileSync(path.join(tempDir, 'math.js'), 'utf8'), 'console.log("gemini math");');
        // Verify report
        const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        node_assert_1.default.strictEqual(report.provider, 'gemini');
        node_assert_1.default.strictEqual(report.model, 'gemini-test');
        node_assert_1.default.strictEqual(report.status, 'PASS');
        // 2. Unsafe patch blocking
        returnUnsafe = true;
        exitCode = null;
        try {
            await (0, run_1.runTask)('gemini task', ['math.js'], false, tempDir, true, true, true, { provider: 'gemini', model: 'gemini-test' });
        }
        catch (err) {
            if (!err.message.includes('exit-1'))
                throw err;
        }
        node_assert_1.default.strictEqual(exitCode, 1);
        node_assert_1.default.ok(!fs.existsSync(path.join(tempDir, '../outside.txt')));
        const report2 = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        node_assert_1.default.strictEqual(report2.status, 'BLOCKED');
    }
    finally {
        process.exit = originalExit;
        globalThis.fetch = originalFetch;
        delete process.env.GEMINI_API_KEY;
        cleanupWorkspace(tempDir);
    }
});
(0, node_test_1.default)('run command - Anthropic integration safe patch and unsafe blocking', async () => {
    const tempDir = createTempWorkspace();
    const originalExit = process.exit;
    const originalFetch = globalThis.fetch;
    let exitCode = null;
    process.exit = ((code) => {
        exitCode = code !== undefined ? code : 0;
        throw new Error(`exit-${exitCode}`);
    });
    process.env.ANTHROPIC_API_KEY = 'anthropic-mock-key';
    let returnUnsafe = false;
    globalThis.fetch = (async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.system && body.system.includes('planning assistant')) {
            // Plan phase
            return {
                ok: true,
                json: async () => ({
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                task: 'anthropic task',
                                understanding: 'anthropic plan',
                                assumptions: [],
                                filesLikelyNeeded: ['math.js'],
                                forbiddenActions: [],
                                successCriteria: ['compile'],
                                riskLevel: 'low',
                                requiresApproval: false,
                                createdAt: new Date().toISOString(),
                                mode: 'lax'
                            })
                        }]
                })
            };
        }
        else if (body.system && (body.system.includes('critic') || body.system.includes('auditor') || body.system.includes('architect'))) {
            return {
                ok: true,
                json: async () => ({
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                status: 'PASS',
                                findings: ['Mock Anthropic review passed.']
                            })
                        }]
                })
            };
        }
        else {
            // Patch phase
            const patchContent = returnUnsafe
                ? {
                    summary: 'unsafe patch',
                    files: [{ filePath: '../outside.txt', content: 'hack', reason: 'exploit' }],
                    notes: [],
                    riskLevel: 'low'
                }
                : {
                    summary: 'safe patch',
                    files: [{ filePath: 'math.js', content: 'console.log("anthropic math");', reason: 'anthropic math' }],
                    notes: [],
                    riskLevel: 'low'
                };
            return {
                ok: true,
                json: async () => ({
                    content: [{
                            type: 'text',
                            text: JSON.stringify(patchContent)
                        }]
                })
            };
        }
    });
    try {
        // 1. Safe patch execution
        try {
            await (0, run_1.runTask)('anthropic task', ['math.js'], false, tempDir, true, true, true, { provider: 'anthropic', model: 'claude-test' });
        }
        catch (err) {
            if (!err.message.includes('exit-0'))
                throw err;
        }
        node_assert_1.default.strictEqual(exitCode, 0);
        node_assert_1.default.strictEqual(fs.readFileSync(path.join(tempDir, 'math.js'), 'utf8'), 'console.log("anthropic math");');
        // Verify report
        const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        node_assert_1.default.strictEqual(report.provider, 'anthropic');
        node_assert_1.default.strictEqual(report.model, 'claude-test');
        node_assert_1.default.strictEqual(report.status, 'PASS');
        // 2. Unsafe patch blocking
        returnUnsafe = true;
        exitCode = null;
        try {
            await (0, run_1.runTask)('anthropic task', ['math.js'], false, tempDir, true, true, true, { provider: 'anthropic', model: 'claude-test' });
        }
        catch (err) {
            if (!err.message.includes('exit-1'))
                throw err;
        }
        node_assert_1.default.strictEqual(exitCode, 1);
        node_assert_1.default.ok(!fs.existsSync(path.join(tempDir, '../outside.txt')));
        const report2 = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        node_assert_1.default.strictEqual(report2.status, 'BLOCKED');
    }
    finally {
        process.exit = originalExit;
        globalThis.fetch = originalFetch;
        delete process.env.ANTHROPIC_API_KEY;
        cleanupWorkspace(tempDir);
    }
});
(0, node_test_1.default)('run command - OpenRouter integration safe patch and unsafe blocking', async () => {
    const tempDir = createTempWorkspace();
    const originalExit = process.exit;
    const originalFetch = globalThis.fetch;
    let exitCode = null;
    process.exit = ((code) => {
        exitCode = code !== undefined ? code : 0;
        throw new Error(`exit-${exitCode}`);
    });
    process.env.OPENROUTER_API_KEY = 'openrouter-mock-key';
    let returnUnsafe = false;
    globalThis.fetch = (async (url, options) => {
        const body = JSON.parse(options.body);
        const lastMessage = body.messages[body.messages.length - 1].content;
        if (lastMessage.includes('TaskContract')) {
            // Plan phase
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                            message: {
                                content: JSON.stringify({
                                    task: 'openrouter task',
                                    understanding: 'openrouter plan',
                                    assumptions: [],
                                    filesLikelyNeeded: ['math.js'],
                                    forbiddenActions: [],
                                    successCriteria: ['compile'],
                                    riskLevel: 'low',
                                    requiresApproval: false,
                                    createdAt: new Date().toISOString(),
                                    mode: 'lax'
                                })
                            }
                        }]
                })
            };
        }
        else if (lastMessage.includes('ReviewResult')) {
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                            message: {
                                content: JSON.stringify({
                                    status: 'PASS',
                                    findings: ['Mock review passed.']
                                })
                            }
                        }]
                })
            };
        }
        else {
            // Patch phase
            const patchContent = returnUnsafe
                ? {
                    summary: 'unsafe patch',
                    files: [{ filePath: '../outside.txt', content: 'hack', reason: 'exploit' }],
                    notes: [],
                    riskLevel: 'low'
                }
                : {
                    summary: 'safe patch',
                    files: [{ filePath: 'math.js', content: 'console.log("openrouter math");', reason: 'openrouter math' }],
                    notes: [],
                    riskLevel: 'low'
                };
            return {
                ok: true,
                json: async () => ({
                    choices: [{
                            message: {
                                content: JSON.stringify(patchContent)
                            }
                        }]
                })
            };
        }
    });
    try {
        // 1. Safe patch execution
        try {
            await (0, run_1.runTask)('openrouter task', ['math.js'], false, tempDir, true, true, true, { provider: 'openrouter', model: 'openrouter-test' });
        }
        catch (err) {
            if (!err.message.includes('exit-0'))
                throw err;
        }
        node_assert_1.default.strictEqual(exitCode, 0);
        node_assert_1.default.strictEqual(fs.readFileSync(path.join(tempDir, 'math.js'), 'utf8'), 'console.log("openrouter math");');
        // Verify report
        const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        node_assert_1.default.strictEqual(report.provider, 'openrouter');
        node_assert_1.default.strictEqual(report.model, 'openrouter-test');
        node_assert_1.default.strictEqual(report.status, 'PASS');
        // 2. Unsafe patch blocking
        returnUnsafe = true;
        exitCode = null;
        try {
            await (0, run_1.runTask)('openrouter task', ['math.js'], false, tempDir, true, true, true, { provider: 'openrouter', model: 'openrouter-test' });
        }
        catch (err) {
            if (!err.message.includes('exit-1'))
                throw err;
        }
        node_assert_1.default.strictEqual(exitCode, 1);
        node_assert_1.default.ok(!fs.existsSync(path.join(tempDir, '../outside.txt')));
        const report2 = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        node_assert_1.default.strictEqual(report2.status, 'BLOCKED');
    }
    finally {
        process.exit = originalExit;
        globalThis.fetch = originalFetch;
        delete process.env.OPENROUTER_API_KEY;
        cleanupWorkspace(tempDir);
    }
});
(0, node_test_1.default)('run command - dry-run does not write files, create checkpoints, or call providers', async () => {
    const tempDir = createTempWorkspace();
    const originalExit = process.exit;
    let exitCode = null;
    process.exit = ((code) => {
        exitCode = code !== undefined ? code : 0;
        throw new Error(`exit-${exitCode}`);
    });
    try {
        try {
            await (0, run_1.runTask)('dry run task', ['math.js'], false, tempDir, true, true, true, { provider: 'openai', model: 'gpt-4o-mini' }, true);
        }
        catch (err) {
            if (!err.message.includes('exit-0')) {
                throw err;
            }
        }
        node_assert_1.default.strictEqual(exitCode, 0);
        // Verify no files are written
        node_assert_1.default.ok(!fs.existsSync(path.join(tempDir, 'math.js')));
        // Verify no session folder or reports folder is created
        node_assert_1.default.ok(!fs.existsSync(path.join(tempDir, '.jewel')));
    }
    finally {
        process.exit = originalExit;
        cleanupWorkspace(tempDir);
    }
});
(0, node_test_1.default)('run command - provider none metadata is correct in report', async () => {
    const tempDir = createTempWorkspace();
    const originalExit = process.exit;
    let exitCode = null;
    process.exit = ((code) => {
        exitCode = code !== undefined ? code : 0;
        throw new Error(`exit-${exitCode}`);
    });
    fs.writeFileSync(path.join(tempDir, 'jewel.config.json'), JSON.stringify({
        projectName: 'test-project',
        mode: 'strict',
        provider: 'none',
        model: 'gpt-4o-mini',
        temperature: 0,
        maxOutputTokens: 4000,
        llmTimeoutMs: 60000,
        llmMaxRetries: 1,
        llmStrictJson: true,
        commands: {
            test: 'npm run test'
        },
        requireHumanDiffApproval: false,
        agentToolLoopEnabled: false
    }, null, 2), 'utf8');
    try {
        try {
            await (0, run_1.runTask)('mock task', ['math.js'], true, tempDir, true, true, true);
        }
        catch (err) {
            if (!err.message.includes('exit-0')) {
                throw err;
            }
        }
        node_assert_1.default.strictEqual(exitCode, 0);
        const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
        node_assert_1.default.ok(fs.existsSync(reportPath));
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        node_assert_1.default.strictEqual(report.provider, 'none');
        node_assert_1.default.strictEqual(report.model, 'mock');
        node_assert_1.default.strictEqual(report.adapterName, 'mock-agent');
        node_assert_1.default.strictEqual(report.usage, 'usage unavailable (mock)');
    }
    finally {
        process.exit = originalExit;
        cleanupWorkspace(tempDir);
    }
});
