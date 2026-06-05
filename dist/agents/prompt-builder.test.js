"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const prompt_builder_1 = require("./prompt-builder");
const config_1 = require("../core/config");
const session_1 = require("../core/session");
(0, node_test_1.default)('prompt-builder - planning prompt contains required rules', () => {
    const prompt = (0, prompt_builder_1.buildPlanningPrompt)({
        task: 'Create endpoint',
        repoSummary: 'Summary text',
        config: config_1.DEFAULT_CONFIG,
        skills: []
    });
    node_assert_1.default.ok(prompt.includes('JSON'), 'Mentions JSON');
    node_assert_1.default.ok(prompt.includes('absolute paths'), 'Mentions no absolute paths');
    node_assert_1.default.ok(prompt.includes('parent traversal'), 'Mentions parent traversal');
    node_assert_1.default.ok(prompt.includes('shell commands'), 'Mentions no shell commands');
    node_assert_1.default.ok(prompt.includes('surgical'), 'Mentions surgical changes');
    node_assert_1.default.ok(prompt.includes('Create endpoint'), 'Contains task description');
});
(0, node_test_1.default)('prompt-builder - patch proposal prompt contains task contract constraints', () => {
    const contract = (0, session_1.generateLocalContract)('Fix division', config_1.DEFAULT_CONFIG, ['math.js']);
    const prompt = (0, prompt_builder_1.buildPatchProposalPrompt)({
        taskContract: contract,
        allowedFiles: contract.filesLikelyNeeded,
        repoContext: 'some code context',
        verificationResult: null
    });
    node_assert_1.default.ok(prompt.includes('JSON'), 'Mentions JSON');
    node_assert_1.default.ok(prompt.includes('absolute paths'), 'Mentions no absolute paths');
    node_assert_1.default.ok(prompt.includes('parent traversal'), 'Mentions parent traversal');
    node_assert_1.default.ok(prompt.includes('Fix division'), 'Contains task name');
    node_assert_1.default.ok(prompt.includes('math.js'), 'Contains allowed files list');
});
(0, node_test_1.default)('prompt-builder - diff review prompt contains diff', () => {
    const contract = (0, session_1.generateLocalContract)('Fix division', config_1.DEFAULT_CONFIG, ['math.js']);
    const prompt = (0, prompt_builder_1.buildDiffReviewPrompt)({
        diff: '+ added lines',
        verificationResult: null,
        taskContract: contract
    });
    node_assert_1.default.ok(prompt.includes('+ added lines'), 'Contains diff');
    node_assert_1.default.ok(prompt.includes('JSON'), 'Mentions JSON');
    node_assert_1.default.ok(prompt.includes('commands'), 'Mentions commands');
});
(0, node_test_1.default)('prompt-builder - patch proposal prompt contains verification logs and critic feedback on repair', () => {
    const contract = (0, session_1.generateLocalContract)('Fix division', config_1.DEFAULT_CONFIG, ['math.js']);
    contract.preserveExistingTests = true;
    const verificationResult = {
        projectName: 'test-project',
        date: new Date().toISOString(),
        mode: 'strict',
        overallStatus: 'FAIL',
        results: [
            {
                commandKey: 'test',
                commandLine: 'npm run test',
                status: 'FAIL',
                stdout: '',
                stderr: '',
                errorMsg: 'AssertionError: expected 2 to be 3'
            }
        ],
        stats: { passed: 0, failed: 1, skipped: 0, blocked: 0 }
    };
    const testCriticResult = {
        verdict: 'BAD_GENERATED_TEST',
        confidence: 'high',
        explanation: 'Expected 2x2 * 2x3 to fail, but it is valid.',
        suspectedRootCause: 'Wrong math dimensions',
        suggestedFix: 'Fix dimensions in test',
        canAutoRetry: true,
        requiresHumanReview: false
    };
    const prompt = (0, prompt_builder_1.buildPatchProposalPrompt)({
        taskContract: contract,
        allowedFiles: contract.filesLikelyNeeded,
        repoContext: 'some code context',
        verificationResult,
        testCriticResult,
        config: {
            ...config_1.DEFAULT_CONFIG,
            maxFilesChanged: 5,
            maxLinesChanged: 250
        }
    });
    node_assert_1.default.ok(prompt.includes('AssertionError: expected 2 to be 3'), 'Contains failure logs');
    node_assert_1.default.ok(prompt.includes('BAD_GENERATED_TEST'), 'Contains critic verdict');
    node_assert_1.default.ok(prompt.includes('Expected 2x2 * 2x3 to fail'), 'Contains critic explanation');
    node_assert_1.default.ok(prompt.includes('Fix dimensions in test'), 'Contains critic suggested fix');
    node_assert_1.default.ok(prompt.includes('CRITICAL WARNING: The user requested to keep existing tests exactly as they are'), 'Contains preserve warning');
    node_assert_1.default.ok(prompt.includes('no more than 5 files'), 'Contains max files limit');
    node_assert_1.default.ok(prompt.includes('must not exceed 250 lines'), 'Contains max lines limit');
});
(0, node_test_1.default)('prompt-builder - buildTestCriticPrompt contains diff and verification results', () => {
    const contract = (0, session_1.generateLocalContract)('Fix division', config_1.DEFAULT_CONFIG, ['math.js']);
    const verificationResult = {
        projectName: 'test-project',
        date: new Date().toISOString(),
        mode: 'strict',
        overallStatus: 'FAIL',
        results: [
            {
                commandKey: 'test',
                commandLine: 'npm run test',
                status: 'FAIL',
                stdout: '',
                stderr: '',
                errorMsg: 'AssertionError: expected 2 to be 3'
            }
        ],
        stats: { passed: 0, failed: 1, skipped: 0, blocked: 0 }
    };
    const prompt = (0, prompt_builder_1.buildDiffReviewPrompt)({
        diff: '+ added lines',
        verificationResult,
        taskContract: contract
    });
    node_assert_1.default.ok(prompt.includes('+ added lines'), 'Contains diff');
    node_assert_1.default.ok(prompt.includes('AssertionError: expected 2 to be 3'), 'Contains verification failures');
});
