"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const critic_1 = require("./critic");
const config_1 = require("../core/config");
const adapter_1 = require("../agents/adapter");
const mockContract = {
    task: 'Fix auth session bug',
    understanding: 'Understanding...',
    assumptions: [],
    filesLikelyNeeded: ['src/auth/session.ts'],
    forbiddenActions: [],
    successCriteria: ['Success...'],
    riskLevel: 'high',
    requiresApproval: true,
    createdAt: '2026-06-03T12:00:00Z',
    mode: 'strict'
};
const mockDiffAnalysisPass = {
    status: 'PASS',
    changedFilesCount: 1,
    addedLinesCount: 10,
    removedLinesCount: 2,
    changedFiles: ['src/auth/session.ts'],
    protectedFilesChanged: [],
    dependenciesChanged: false,
    lockfilesChanged: [],
    findings: []
};
const mockVerificationPass = {
    projectName: 'test',
    date: '123',
    mode: 'strict',
    overallStatus: 'PASS',
    stats: { passed: 1, failed: 0, skipped: 0, blocked: 0 },
    results: []
};
(0, node_test_1.default)('critic - clean diff with passing verification passes', () => {
    // We mock a test file change so it matches high risk need
    const diff = { ...mockDiffAnalysisPass, changedFiles: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
    const contract = { ...mockContract, filesLikelyNeeded: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
    const result = (0, critic_1.runCriticReview)(contract, diff, mockVerificationPass, config_1.DEFAULT_CONFIG);
    node_assert_1.default.strictEqual(result.status, 'PASS');
});
(0, node_test_1.default)('critic - missing verification blocks when required', () => {
    const result = (0, critic_1.runCriticReview)(mockContract, mockDiffAnalysisPass, null, config_1.DEFAULT_CONFIG);
    node_assert_1.default.strictEqual(result.status, 'BLOCK');
    node_assert_1.default.ok(result.findings.some(f => f.includes('missing')));
});
(0, node_test_1.default)('critic - failing verification blocks', () => {
    const mockVerificationFail = {
        ...mockVerificationPass,
        overallStatus: 'FAIL',
        stats: { passed: 0, failed: 1, skipped: 0, blocked: 0 }
    };
    const result = (0, critic_1.runCriticReview)(mockContract, mockDiffAnalysisPass, mockVerificationFail, config_1.DEFAULT_CONFIG);
    node_assert_1.default.strictEqual(result.status, 'BLOCK');
    node_assert_1.default.ok(result.findings.some(f => f.includes('Verification commands failed')));
});
(0, node_test_1.default)('critic - unplanned file edits block in strict mode', () => {
    const diffUnplanned = {
        ...mockDiffAnalysisPass,
        changedFiles: ['src/auth/session.ts', 'src/unrelated.ts'] // unrelated.ts was not in filesLikelyNeeded
    };
    const result = (0, critic_1.runCriticReview)(mockContract, diffUnplanned, mockVerificationPass, config_1.DEFAULT_CONFIG);
    node_assert_1.default.strictEqual(result.status, 'BLOCK');
    node_assert_1.default.ok(result.findings.some(f => f.includes('Changed files not declared')));
});
(0, node_test_1.default)('multi-agent critic - passing run aggregates critics', async () => {
    const config = {
        ...config_1.DEFAULT_CONFIG,
        critics: ['security', 'linter']
    };
    const adapter = new adapter_1.MockAgentAdapter();
    const diff = { ...mockDiffAnalysisPass, changedFiles: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
    const contract = { ...mockContract, filesLikelyNeeded: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
    const result = await (0, critic_1.runMultiAgentCriticReview)(contract, diff, mockVerificationPass, config, adapter, '/tmp', 'diff content');
    node_assert_1.default.strictEqual(result.status, 'PASS');
    node_assert_1.default.ok(result.findings.some(f => f.includes('[Critic: security] Mock agent review (security) passed successfully.')));
    node_assert_1.default.ok(result.findings.some(f => f.includes('[Critic: linter] Mock agent review (linter) passed successfully.')));
});
(0, node_test_1.default)('multi-agent critic - block result from one critic blocks overall', async () => {
    const config = {
        ...config_1.DEFAULT_CONFIG,
        critics: ['security', 'linter']
    };
    const diff = { ...mockDiffAnalysisPass, changedFiles: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
    const contract = { ...mockContract, filesLikelyNeeded: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
    class BlockingMockAdapter extends adapter_1.MockAgentAdapter {
        async reviewDiff(input) {
            if (input.criticType === 'linter') {
                return { status: 'BLOCK', findings: ['Syntax error found'] };
            }
            return { status: 'PASS', findings: ['Security looks good'] };
        }
    }
    const adapter = new BlockingMockAdapter();
    const result = await (0, critic_1.runMultiAgentCriticReview)(contract, diff, mockVerificationPass, config, adapter, '/tmp', 'diff content');
    node_assert_1.default.strictEqual(result.status, 'BLOCK');
    node_assert_1.default.ok(result.findings.some(f => f.includes('[Critic: linter] Syntax error found')));
    node_assert_1.default.ok(result.requiredActions.some(a => a.includes('Address blocking findings from the "linter" critic')));
});
(0, node_test_1.default)('multi-agent critic - error in one critic degrades to warn finding safely without crashing', async () => {
    const config = {
        ...config_1.DEFAULT_CONFIG,
        critics: ['security', 'linter']
    };
    const diff = { ...mockDiffAnalysisPass, changedFiles: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
    const contract = { ...mockContract, filesLikelyNeeded: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
    class ErrorMockAdapter extends adapter_1.MockAgentAdapter {
        async reviewDiff(input) {
            if (input.criticType === 'linter') {
                throw new Error('Linter crashed connection reset');
            }
            return { status: 'PASS', findings: ['Security looks good'] };
        }
    }
    const adapter = new ErrorMockAdapter();
    const result = await (0, critic_1.runMultiAgentCriticReview)(contract, diff, mockVerificationPass, config, adapter, '/tmp', 'diff content');
    node_assert_1.default.strictEqual(result.status, 'WARN');
    node_assert_1.default.ok(result.findings.some(f => f.includes('[Critic: linter] Critic "linter" failed to respond: Linter crashed connection reset')));
});
