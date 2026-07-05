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
const node_test_1 = __importStar(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const run_1 = require("./run");
function createTempWorkspace() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-critic-retry-test-'));
    // Initialize Git repo
    (0, child_process_1.execSync)('git init', { cwd: tempDir, stdio: 'ignore' });
    (0, child_process_1.execSync)('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    (0, child_process_1.execSync)('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' });
    // Write a basic package.json
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        scripts: {
            test: 'node test-runner.js'
        }
    }, null, 2), 'utf8');
    // Write .gitignore to prevent git clean from deleting report outputs
    fs.writeFileSync(path.join(tempDir, '.gitignore'), '.jewel\nnode_modules\ndist\n', 'utf8');
    // Write jewel.config.json with 2 retries
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
        maxRetries: 2,
        commands: {
            test: 'node test-runner.js'
        },
        requireHumanDiffApproval: false,
        requireVerificationBeforeDone: true,
        agentToolLoopEnabled: false
    }, null, 2), 'utf8');
    // Write default test-runner.js that fails unless math.js content contains 'correct'
    fs.writeFileSync(path.join(tempDir, 'test-runner.js'), `const fs = require('fs');
let contentVal = 'missing';
if (fs.existsSync('math.js')) {
  const content = fs.readFileSync('math.js', 'utf8');
  contentVal = content.trim();
  if (content.includes('correct')) {
    console.log('TAP version 13\\nok 1 - math test passes\\n1..1');
    process.exit(0);
  }
}
console.log('TAP version 13\\nnot ok 1 - math test fails: ' + contentVal + '\\n1..1');
process.exit(1);
`, 'utf8');
    // Commit all setup files to git
    (0, child_process_1.execSync)('git add .', { cwd: tempDir, stdio: 'ignore' });
    (0, child_process_1.execSync)('git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });
    return tempDir;
}
function cleanupWorkspace(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    catch { }
}
(0, node_test_1.describe)('runTask Critic & Retry Integration Loops', () => {
    (0, node_test_1.default)('repair loop successfully retries and passes', async () => {
        const tempDir = createTempWorkspace();
        const originalExit = process.exit;
        const originalFetch = globalThis.fetch;
        let exitCode = null;
        process.exit = ((code) => {
            exitCode = code !== undefined ? code : 0;
            throw new Error(`exit-${exitCode}`);
        });
        let attempt = 0;
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
                                        task: 'Fix math logic',
                                        understanding: 'math plan',
                                        assumptions: [],
                                        filesLikelyNeeded: ['math.js'],
                                        forbiddenActions: [],
                                        successCriteria: ['math.js contains correct implementation'],
                                        riskLevel: 'low',
                                        requiresApproval: false,
                                        createdAt: new Date().toISOString(),
                                        mode: 'lax',
                                        preserveExistingTests: false
                                    })
                                }
                            }]
                    })
                };
            }
            else if (lastMessage.includes('TestCriticResult')) {
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        verdict: 'BAD_IMPLEMENTATION',
                                        confidence: 'high',
                                        explanation: 'The implementation did not contain correct.',
                                        suspectedRootCause: 'Wrong math.js content',
                                        suggestedFix: 'Write correct in math.js',
                                        canAutoRetry: true,
                                        requiresHumanReview: false
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
                attempt++;
                const content = attempt === 1
                    ? 'console.log("wrong implementation");'
                    : 'console.log("correct implementation");';
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        summary: 'patch proposal',
                                        files: [{ filePath: 'math.js', content, reason: 'implement math' }],
                                        notes: [],
                                        riskLevel: 'low'
                                    })
                                }
                            }]
                    })
                };
            }
        });
        process.env.OPENAI_API_KEY = 'sk-mock-key';
        try {
            try {
                await (0, run_1.runTask)('Fix math logic', ['math.js'], false, tempDir, true, true, true);
            }
            catch (err) {
                if (!err.message.includes('exit-0'))
                    throw err;
            }
            node_assert_1.default.strictEqual(exitCode, 0);
            node_assert_1.default.strictEqual(attempt, 2, 'Should take 2 attempts');
            node_assert_1.default.ok(fs.readFileSync(path.join(tempDir, 'math.js'), 'utf8').includes('correct'));
            const report = JSON.parse(fs.readFileSync(path.join(tempDir, '.jewel', 'reports', 'latest-run.json'), 'utf8'));
            node_assert_1.default.strictEqual(report.status, 'PASS');
        }
        finally {
            process.exit = originalExit;
            globalThis.fetch = originalFetch;
            delete process.env.OPENAI_API_KEY;
            cleanupWorkspace(tempDir);
        }
    });
    (0, node_test_1.default)('repair loop hits retry limit and stops with RETRY_LIMIT_REACHED', async () => {
        const tempDir = createTempWorkspace();
        const originalExit = process.exit;
        const originalFetch = globalThis.fetch;
        let exitCode = null;
        process.exit = ((code) => {
            exitCode = code !== undefined ? code : 0;
            throw new Error(`exit-${exitCode}`);
        });
        let attempt = 0;
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
                                        task: 'Fix math logic',
                                        understanding: 'math plan',
                                        assumptions: [],
                                        filesLikelyNeeded: ['math.js'],
                                        forbiddenActions: [],
                                        successCriteria: ['math.js contains correct implementation'],
                                        riskLevel: 'low',
                                        requiresApproval: false,
                                        createdAt: new Date().toISOString(),
                                        mode: 'lax',
                                        preserveExistingTests: false
                                    })
                                }
                            }]
                    })
                };
            }
            else if (lastMessage.includes('TestCriticResult')) {
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        verdict: 'BAD_IMPLEMENTATION',
                                        confidence: 'high',
                                        explanation: 'Wrong code.',
                                        suspectedRootCause: 'Wrong math.js content',
                                        suggestedFix: 'Fix it.',
                                        canAutoRetry: true,
                                        requiresHumanReview: false
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
                attempt++;
                // Propose different wrong content each time so it doesn't trigger same-failure detection
                const content = `console.log("wrong implementation ${attempt}");`;
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        summary: 'patch proposal',
                                        files: [{ filePath: 'math.js', content, reason: 'implement math' }],
                                        notes: [],
                                        riskLevel: 'low'
                                    })
                                }
                            }]
                    })
                };
            }
        });
        process.env.OPENAI_API_KEY = 'sk-mock-key';
        try {
            try {
                await (0, run_1.runTask)('Fix math logic', ['math.js'], false, tempDir, true, true, false);
            }
            catch (err) {
                if (!err.message.includes('exit-1'))
                    throw err;
            }
            node_assert_1.default.strictEqual(exitCode, 1);
            node_assert_1.default.strictEqual(attempt, 3, 'Should attempt initial (1) + 2 retries = 3');
            const report = JSON.parse(fs.readFileSync(path.join(tempDir, '.jewel', 'reports', 'latest-run.json'), 'utf8'));
            node_assert_1.default.strictEqual(report.status, 'RETRY_LIMIT_REACHED');
        }
        finally {
            process.exit = originalExit;
            globalThis.fetch = originalFetch;
            delete process.env.OPENAI_API_KEY;
            cleanupWorkspace(tempDir);
        }
    });
    (0, node_test_1.default)('repair loop stops early on same verification failure logs', async () => {
        const tempDir = createTempWorkspace();
        const originalExit = process.exit;
        const originalFetch = globalThis.fetch;
        let exitCode = null;
        process.exit = ((code) => {
            exitCode = code !== undefined ? code : 0;
            throw new Error(`exit-${exitCode}`);
        });
        let attempt = 0;
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
                                        task: 'Fix math logic',
                                        understanding: 'math plan',
                                        assumptions: [],
                                        filesLikelyNeeded: ['math.js'],
                                        forbiddenActions: [],
                                        successCriteria: ['math.js contains correct implementation'],
                                        riskLevel: 'low',
                                        requiresApproval: false,
                                        createdAt: new Date().toISOString(),
                                        mode: 'lax',
                                        preserveExistingTests: false
                                    })
                                }
                            }]
                    })
                };
            }
            else if (lastMessage.includes('TestCriticResult')) {
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        verdict: 'BAD_IMPLEMENTATION',
                                        confidence: 'high',
                                        explanation: 'Wrong code.',
                                        suspectedRootCause: 'Wrong math.js content',
                                        suggestedFix: 'Fix it.',
                                        canAutoRetry: true,
                                        requiresHumanReview: false
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
                attempt++;
                // Propose exactly the same wrong content so verification produces same logs
                const content = `console.log("identical failure");`;
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        summary: 'patch proposal',
                                        files: [{ filePath: 'math.js', content, reason: 'implement math' }],
                                        notes: [],
                                        riskLevel: 'low'
                                    })
                                }
                            }]
                    })
                };
            }
        });
        process.env.OPENAI_API_KEY = 'sk-mock-key';
        try {
            try {
                await (0, run_1.runTask)('Fix math logic', ['math.js'], false, tempDir, true, true, false);
            }
            catch (err) {
                if (!err.message.includes('exit-1'))
                    throw err;
            }
            node_assert_1.default.strictEqual(exitCode, 1);
            node_assert_1.default.strictEqual(attempt, 2, 'Should stop after second identical failure');
            const report = JSON.parse(fs.readFileSync(path.join(tempDir, '.jewel', 'reports', 'latest-run.json'), 'utf8'));
            node_assert_1.default.strictEqual(report.status, 'RETRY_LIMIT_REACHED');
        }
        finally {
            process.exit = originalExit;
            globalThis.fetch = originalFetch;
            delete process.env.OPENAI_API_KEY;
            cleanupWorkspace(tempDir);
        }
    });
    (0, node_test_1.default)('repair loop stops on UNKNOWN verdict with NEEDS_HUMAN_REVIEW', async () => {
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
                                        task: 'Fix math logic',
                                        understanding: 'math plan',
                                        assumptions: [],
                                        filesLikelyNeeded: ['math.js'],
                                        forbiddenActions: [],
                                        successCriteria: ['math.js contains correct implementation'],
                                        riskLevel: 'low',
                                        requiresApproval: false,
                                        createdAt: new Date().toISOString(),
                                        mode: 'lax',
                                        preserveExistingTests: false
                                    })
                                }
                            }]
                    })
                };
            }
            else if (lastMessage.includes('TestCriticResult')) {
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        verdict: 'UNKNOWN',
                                        confidence: 'low',
                                        explanation: 'Unknown issue.',
                                        suspectedRootCause: 'Unknown issue.',
                                        suggestedFix: 'Needs review.',
                                        canAutoRetry: false,
                                        requiresHumanReview: true
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
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        summary: 'patch proposal',
                                        files: [{ filePath: 'math.js', content: 'console.log("wrong");', reason: 'implement math' }],
                                        notes: [],
                                        riskLevel: 'low'
                                    })
                                }
                            }]
                    })
                };
            }
        });
        process.env.OPENAI_API_KEY = 'sk-mock-key';
        try {
            try {
                await (0, run_1.runTask)('Fix math logic', ['math.js'], false, tempDir, true, true, false);
            }
            catch (err) {
                if (!err.message.includes('exit-1'))
                    throw err;
            }
            node_assert_1.default.strictEqual(exitCode, 1);
            const report = JSON.parse(fs.readFileSync(path.join(tempDir, '.jewel', 'reports', 'latest-run.json'), 'utf8'));
            node_assert_1.default.strictEqual(report.status, 'NEEDS_HUMAN_REVIEW');
        }
        finally {
            process.exit = originalExit;
            globalThis.fetch = originalFetch;
            delete process.env.OPENAI_API_KEY;
            cleanupWorkspace(tempDir);
        }
    });
    (0, node_test_1.default)('repair loop detects bad generated test and returns GENERATED_TEST_SUSPECT', async () => {
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
                                        task: 'Fix math logic',
                                        understanding: 'math plan',
                                        assumptions: [],
                                        filesLikelyNeeded: ['math.js'],
                                        forbiddenActions: [],
                                        successCriteria: ['math.js contains correct implementation'],
                                        riskLevel: 'low',
                                        requiresApproval: false,
                                        createdAt: new Date().toISOString(),
                                        mode: 'lax',
                                        preserveExistingTests: false
                                    })
                                }
                            }]
                    })
                };
            }
            else if (lastMessage.includes('TestCriticResult')) {
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        verdict: 'BAD_GENERATED_TEST',
                                        confidence: 'high',
                                        explanation: 'The test asserts incorrect math.',
                                        suspectedRootCause: 'Bad test math',
                                        suggestedFix: 'Fix the generated test assertion.',
                                        canAutoRetry: false,
                                        requiresHumanReview: true
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
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        summary: 'patch proposal',
                                        files: [{ filePath: 'math.js', content: 'console.log("wrong");', reason: 'implement math' }],
                                        notes: [],
                                        riskLevel: 'low'
                                    })
                                }
                            }]
                    })
                };
            }
        });
        process.env.OPENAI_API_KEY = 'sk-mock-key';
        try {
            try {
                await (0, run_1.runTask)('Fix math logic', ['math.js'], false, tempDir, true, true, false);
            }
            catch (err) {
                if (!err.message.includes('exit-1'))
                    throw err;
            }
            node_assert_1.default.strictEqual(exitCode, 1);
            const report = JSON.parse(fs.readFileSync(path.join(tempDir, '.jewel', 'reports', 'latest-run.json'), 'utf8'));
            node_assert_1.default.strictEqual(report.status, 'GENERATED_TEST_SUSPECT');
        }
        finally {
            process.exit = originalExit;
            globalThis.fetch = originalFetch;
            delete process.env.OPENAI_API_KEY;
            cleanupWorkspace(tempDir);
        }
    });
    (0, node_test_1.default)('repair loop blocks modification of existing tests with EXISTING_TEST_MODIFIED', async () => {
        const tempDir = createTempWorkspace();
        // Write an existing test file to git repo
        fs.writeFileSync(path.join(tempDir, 'math.test.js'), `const assert = require('assert');\ntest('adds 1 + 2', () => { assert.strictEqual(3, 3); });\n`, 'utf8');
        (0, child_process_1.execSync)('git add math.test.js', { cwd: tempDir, stdio: 'ignore' });
        (0, child_process_1.execSync)('git commit -m "add test file"', { cwd: tempDir, stdio: 'ignore' });
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
                                        task: 'keep existing tests exactly as they are',
                                        understanding: 'math plan',
                                        assumptions: [],
                                        filesLikelyNeeded: ['math.test.js'],
                                        forbiddenActions: [],
                                        successCriteria: ['pass tests'],
                                        riskLevel: 'low',
                                        requiresApproval: false,
                                        createdAt: new Date().toISOString(),
                                        mode: 'lax',
                                        preserveExistingTests: true
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
                // Model attempts to change existing test assertions
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        summary: 'patch proposal',
                                        files: [{
                                                filePath: 'math.test.js',
                                                content: `const assert = require('assert');\ntest('adds 1 + 2', () => { assert.strictEqual(3, 4); });\n`,
                                                reason: 'modify assertions'
                                            }],
                                        notes: [],
                                        riskLevel: 'low'
                                    })
                                }
                            }]
                    })
                };
            }
        });
        process.env.OPENAI_API_KEY = 'sk-mock-key';
        try {
            try {
                await (0, run_1.runTask)('keep existing tests exactly as they are', ['math.test.js'], false, tempDir, true, true, false);
            }
            catch (err) {
                if (!err.message.includes('exit-1'))
                    throw err;
            }
            node_assert_1.default.strictEqual(exitCode, 1);
            const report = JSON.parse(fs.readFileSync(path.join(tempDir, '.jewel', 'reports', 'latest-run.json'), 'utf8'));
            node_assert_1.default.strictEqual(report.status, 'EXISTING_TEST_MODIFIED');
        }
        finally {
            process.exit = originalExit;
            globalThis.fetch = originalFetch;
            delete process.env.OPENAI_API_KEY;
            cleanupWorkspace(tempDir);
        }
    });
    (0, node_test_1.default)('repair loop - interactive custom hint retry', async () => {
        const tempDir = createTempWorkspace();
        const originalExit = process.exit;
        const originalFetch = globalThis.fetch;
        const readline = require('readline');
        const originalCreateInterface = readline.createInterface;
        const originalIsTTY = process.stdout.isTTY;
        const originalCI = process.env.CI;
        let exitCode = null;
        process.exit = ((code) => {
            exitCode = code !== undefined ? code : 0;
            throw new Error(`exit-${exitCode}`);
        });
        let customHintReceived = false;
        let attempt = 0;
        process.stdout.isTTY = true;
        delete process.env.CI;
        readline.createInterface = function () {
            return {
                question: (query, callback) => {
                    if (query.includes('Choice [r/o/a]')) {
                        callback('r');
                    }
                    else if (query.includes('Enter hint/guidance')) {
                        callback('use correct math logic');
                    }
                    else {
                        callback('');
                    }
                },
                close: () => { }
            };
        };
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
                                        task: 'Fix math logic',
                                        understanding: 'math plan',
                                        assumptions: [],
                                        filesLikelyNeeded: ['math.js'],
                                        forbiddenActions: [],
                                        successCriteria: ['math.js contains correct implementation'],
                                        riskLevel: 'low',
                                        requiresApproval: false,
                                        createdAt: new Date().toISOString(),
                                        mode: 'lax',
                                        preserveExistingTests: false
                                    })
                                }
                            }]
                    })
                };
            }
            else if (lastMessage.includes('TestCriticResult')) {
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        verdict: 'BAD_IMPLEMENTATION',
                                        confidence: 'high',
                                        explanation: 'Wrong code.',
                                        suspectedRootCause: 'Wrong math.js content',
                                        suggestedFix: 'Fix it.',
                                        canAutoRetry: true,
                                        requiresHumanReview: false
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
                attempt++;
                if (lastMessage.includes('use correct math logic')) {
                    customHintReceived = true;
                    // Return correct patch so it passes
                    return {
                        ok: true,
                        json: async () => ({
                            choices: [{
                                    message: {
                                        content: JSON.stringify({
                                            summary: 'correct patch',
                                            files: [{ filePath: 'math.js', content: 'console.log("correct implementation");', reason: 'implement math' }],
                                            notes: [],
                                            riskLevel: 'low'
                                        })
                                    }
                                }]
                        })
                    };
                }
                // Otherwise return wrong patch
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        summary: 'wrong patch',
                                        files: [{ filePath: 'math.js', content: `console.log("wrong ${attempt}");`, reason: 'implement math' }],
                                        notes: [],
                                        riskLevel: 'low'
                                    })
                                }
                            }]
                    })
                };
            }
        });
        process.env.OPENAI_API_KEY = 'sk-mock-key';
        try {
            try {
                await (0, run_1.runTask)('Fix math logic', ['math.js'], false, tempDir, true, true, false);
            }
            catch (err) {
                if (!err.message.includes('exit-0') && !err.message.includes('exit-1'))
                    throw err;
            }
            node_assert_1.default.strictEqual(customHintReceived, true, 'Should receive user custom retry hint in prompt');
        }
        finally {
            process.exit = originalExit;
            globalThis.fetch = originalFetch;
            readline.createInterface = originalCreateInterface;
            process.stdout.isTTY = originalIsTTY;
            if (originalCI !== undefined) {
                process.env.CI = originalCI;
            }
            else {
                delete process.env.CI;
            }
            delete process.env.OPENAI_API_KEY;
            cleanupWorkspace(tempDir);
        }
    });
    (0, node_test_1.default)('repair loop - interactive override success', async () => {
        const tempDir = createTempWorkspace();
        const originalExit = process.exit;
        const originalFetch = globalThis.fetch;
        const readline = require('readline');
        const originalCreateInterface = readline.createInterface;
        const originalIsTTY = process.stdout.isTTY;
        const originalCI = process.env.CI;
        let exitCode = null;
        process.exit = ((code) => {
            exitCode = code !== undefined ? code : 0;
            throw new Error(`exit-${exitCode}`);
        });
        process.stdout.isTTY = true;
        delete process.env.CI;
        readline.createInterface = function () {
            return {
                question: (query, callback) => {
                    if (query.includes('Choice [r/o/a]')) {
                        callback('o'); // Override
                    }
                    else {
                        callback('');
                    }
                },
                close: () => { }
            };
        };
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
                                        task: 'Fix math logic',
                                        understanding: 'math plan',
                                        assumptions: [],
                                        filesLikelyNeeded: ['math.js'],
                                        forbiddenActions: [],
                                        successCriteria: ['math.js contains correct implementation'],
                                        riskLevel: 'low',
                                        requiresApproval: false,
                                        createdAt: new Date().toISOString(),
                                        mode: 'lax',
                                        preserveExistingTests: false
                                    })
                                }
                            }]
                    })
                };
            }
            else if (lastMessage.includes('TestCriticResult')) {
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        verdict: 'BAD_IMPLEMENTATION',
                                        confidence: 'high',
                                        explanation: 'Wrong code.',
                                        suspectedRootCause: 'Wrong math.js content',
                                        suggestedFix: 'Fix it.',
                                        canAutoRetry: true,
                                        requiresHumanReview: false
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
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        summary: 'wrong patch',
                                        files: [{ filePath: 'math.js', content: 'console.log("wrong");', reason: 'implement math' }],
                                        notes: [],
                                        riskLevel: 'low'
                                    })
                                }
                            }]
                    })
                };
            }
        });
        process.env.OPENAI_API_KEY = 'sk-mock-key';
        try {
            try {
                await (0, run_1.runTask)('Fix math logic', ['math.js'], false, tempDir, true, true, false);
            }
            catch (err) {
                if (!err.message.includes('exit-0'))
                    throw err;
            }
            node_assert_1.default.strictEqual(exitCode, 0, 'Override should successfully finalize with exit code 0');
        }
        finally {
            process.exit = originalExit;
            globalThis.fetch = originalFetch;
            readline.createInterface = originalCreateInterface;
            process.stdout.isTTY = originalIsTTY;
            if (originalCI !== undefined) {
                process.env.CI = originalCI;
            }
            else {
                delete process.env.CI;
            }
            delete process.env.OPENAI_API_KEY;
            cleanupWorkspace(tempDir);
        }
    });
    (0, node_test_1.default)('repair loop aborts immediately on budget limit breach with BUDGET_EXCEEDED and rolls back', async () => {
        const tempDir = createTempWorkspace();
        // Write jewel.config.json with a low maxSessionCost of 0.01
        const configPath = path.join(tempDir, 'jewel.config.json');
        const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        existingConfig.maxSessionCost = 0.01;
        fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2), 'utf8');
        // Commit config change to keep git clean
        (0, child_process_1.execSync)('git add jewel.config.json', { cwd: tempDir, stdio: 'ignore' });
        (0, child_process_1.execSync)('git commit -m "update config"', { cwd: tempDir, stdio: 'ignore' });
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
                                        task: 'Fix math logic',
                                        understanding: 'math plan',
                                        assumptions: [],
                                        filesLikelyNeeded: ['math.js'],
                                        forbiddenActions: [],
                                        successCriteria: ['math.js contains correct implementation'],
                                        riskLevel: 'low',
                                        requiresApproval: false,
                                        createdAt: new Date().toISOString(),
                                        mode: 'lax',
                                        preserveExistingTests: false
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
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                                message: {
                                    content: JSON.stringify({
                                        summary: 'patch proposal',
                                        files: [{ filePath: 'math.js', content: 'console.log("correct implementation");', reason: 'implement math' }],
                                        notes: [],
                                        riskLevel: 'low'
                                    })
                                }
                            }],
                        usage: {
                            prompt_tokens: 100000,
                            completion_tokens: 100000,
                            total_tokens: 200000
                        }
                    })
                };
            }
        });
        process.env.OPENAI_API_KEY = 'sk-mock-key';
        try {
            try {
                await (0, run_1.runTask)('Fix math logic', ['math.js'], false, tempDir, true, true, false);
            }
            catch (err) {
                if (!err.message.includes('exit-1'))
                    throw err;
            }
            node_assert_1.default.strictEqual(exitCode, 1);
            const report = JSON.parse(fs.readFileSync(path.join(tempDir, '.jewel', 'reports', 'latest-run.json'), 'utf8'));
            node_assert_1.default.strictEqual(report.status, 'BUDGET_EXCEEDED');
            // Git status should be clean because rollback was triggered
            const gitStatus = (0, child_process_1.execSync)('git status --porcelain', { cwd: tempDir, encoding: 'utf8' }).trim();
            node_assert_1.default.strictEqual(gitStatus, '');
        }
        finally {
            process.exit = originalExit;
            globalThis.fetch = originalFetch;
            delete process.env.OPENAI_API_KEY;
            cleanupWorkspace(tempDir);
        }
    });
});
