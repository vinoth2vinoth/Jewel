"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const json_response_1 = require("./json-response");
(0, node_test_1.default)('json-response - extractJsonObject cases', () => {
    // 1. clean JSON
    const clean = (0, json_response_1.extractJsonObject)('{"a": 1, "b": "hello"}');
    node_assert_1.default.deepStrictEqual(clean, { a: 1, b: 'hello' });
    // 2. fenced JSON with single block
    const fenced = (0, json_response_1.extractJsonObject)('some text before\n```json\n{"x": 100}\n```\nsome text after');
    node_assert_1.default.deepStrictEqual(fenced, { x: 100 });
    // 3. malformed JSON throws
    node_assert_1.default.throws(() => {
        (0, json_response_1.extractJsonObject)('{"a": 1, "b": }');
    }, /Malformed JSON/);
    // 4. multiple JSON objects throws
    node_assert_1.default.throws(() => {
        (0, json_response_1.extractJsonObject)('```json\n{"a": 1}\n```\n```json\n{"b": 2}\n```');
    }, /Multiple JSON/);
    // 5. array as root throws
    node_assert_1.default.throws(() => {
        (0, json_response_1.extractJsonObject)('[{"a": 1}]');
    }, /cannot be an array/);
    // 6. forbidden keys throw
    node_assert_1.default.throws(() => {
        (0, json_response_1.extractJsonObject)('{"command": "rm -rf /"}');
    }, /Forbidden execution field "command"/);
    node_assert_1.default.throws(() => {
        (0, json_response_1.extractJsonObject)('{"nested": {"shell": "bash"}}');
    }, /Forbidden execution field "shell"/);
});
(0, node_test_1.default)('json-response - validateTaskContractJson cases', () => {
    const valid = {
        task: 'test task',
        understanding: 'test understanding',
        assumptions: ['assumption 1'],
        filesLikelyNeeded: ['file1.ts'],
        forbiddenActions: ['no push'],
        successCriteria: ['pass tests'],
        riskLevel: 'low',
        requiresApproval: false,
        createdAt: '2026-06-03T00:00:00.000Z',
        mode: 'strict'
    };
    const parsed = (0, json_response_1.validateTaskContractJson)(valid);
    node_assert_1.default.deepStrictEqual(parsed, valid);
    // Missing task
    node_assert_1.default.throws(() => {
        (0, json_response_1.validateTaskContractJson)({ ...valid, task: '' });
    }, /task.*must be a non-empty string/);
    // Invalid riskLevel
    node_assert_1.default.throws(() => {
        (0, json_response_1.validateTaskContractJson)({ ...valid, riskLevel: 'extreme' });
    }, /riskLevel/);
    // Invalid successCriteria
    node_assert_1.default.throws(() => {
        (0, json_response_1.validateTaskContractJson)({ ...valid, successCriteria: [] });
    }, /successCriteria/);
    // Valid allowedSymbolChanges
    const validWithSymbols = {
        ...valid,
        allowedSymbolChanges: ['myFunc', 'MyClass.myMethod']
    };
    const parsedWithSymbols = (0, json_response_1.validateTaskContractJson)(validWithSymbols);
    node_assert_1.default.deepStrictEqual(parsedWithSymbols.allowedSymbolChanges, ['myFunc', 'MyClass.myMethod']);
    // Invalid allowedSymbolChanges
    node_assert_1.default.throws(() => {
        (0, json_response_1.validateTaskContractJson)({ ...valid, allowedSymbolChanges: 'not-an-array' });
    }, /allowedSymbolChanges/);
    node_assert_1.default.throws(() => {
        (0, json_response_1.validateTaskContractJson)({ ...valid, allowedSymbolChanges: [123] });
    }, /allowedSymbolChanges/);
});
(0, node_test_1.default)('json-response - validatePatchProposalJson cases', () => {
    const valid = {
        summary: 'propose a patch',
        files: [
            {
                filePath: 'math.js',
                content: 'console.log("hello");',
                reason: 'implement functionality'
            }
        ],
        notes: ['notes here'],
        riskLevel: 'low'
    };
    const parsed = (0, json_response_1.validatePatchProposalJson)(valid);
    node_assert_1.default.deepStrictEqual(parsed, valid);
    // Missing filePath
    node_assert_1.default.throws(() => {
        (0, json_response_1.validatePatchProposalJson)({
            ...valid,
            files: [{ filePath: '', content: 'hello', reason: 'reason' }]
        });
    }, /filePath.*must be a non-empty string/);
    // Missing content and edits
    node_assert_1.default.throws(() => {
        (0, json_response_1.validatePatchProposalJson)({
            ...valid,
            files: [{ filePath: 'math.js', content: undefined, reason: 'reason' }]
        });
    }, /must include "content" or a non-empty "edits" array/);
    // Valid edits-only patch
    const editsOnly = {
        summary: 'hunk patch',
        files: [{
                filePath: 'math.js',
                edits: [{ search: 'a/b', replace: 'safe divide' }],
                reason: 'surgical fix'
            }],
        notes: [],
        riskLevel: 'low'
    };
    const parsedEdits = (0, json_response_1.validatePatchProposalJson)(editsOnly);
    node_assert_1.default.strictEqual(parsedEdits.files[0].edits?.length, 1);
    // Invalid riskLevel
    node_assert_1.default.throws(() => {
        (0, json_response_1.validatePatchProposalJson)({ ...valid, riskLevel: 'critical' });
    }, /riskLevel/);
});
(0, node_test_1.default)('json-response - validateReviewResultJson cases', () => {
    const valid = {
        status: 'PASS',
        findings: ['no issues found']
    };
    const parsed = (0, json_response_1.validateReviewResultJson)(valid);
    node_assert_1.default.deepStrictEqual(parsed, valid);
    // Invalid status
    node_assert_1.default.throws(() => {
        (0, json_response_1.validateReviewResultJson)({ ...valid, status: 'APPROVED' });
    }, /status/);
    // Reject forbidden execution fields in review
    node_assert_1.default.throws(() => {
        (0, json_response_1.validateReviewResultJson)({ ...valid, exec: 'some command' });
    }, /Forbidden execution field "exec" detected/);
});
(0, node_test_1.default)('json-response - forbidden execution fields in other validators', () => {
    // 1. TaskContract rejects command field
    const validContract = {
        task: 'test task',
        understanding: 'test understanding',
        assumptions: ['assumption 1'],
        filesLikelyNeeded: ['file1.ts'],
        forbiddenActions: ['no push'],
        successCriteria: ['pass tests'],
        riskLevel: 'low',
        requiresApproval: false,
        createdAt: '2026-06-03T00:00:00.000Z',
        mode: 'strict'
    };
    node_assert_1.default.throws(() => {
        (0, json_response_1.validateTaskContractJson)({ ...validContract, command: 'rm -rf /' });
    }, /Forbidden execution field "command" detected/);
    // 2. PatchProposal rejects command field
    const validPatch = {
        summary: 'propose a patch',
        files: [
            {
                filePath: 'math.js',
                content: 'console.log("hello");',
                reason: 'implement functionality'
            }
        ],
        notes: ['notes here'],
        riskLevel: 'low'
    };
    node_assert_1.default.throws(() => {
        (0, json_response_1.validatePatchProposalJson)({ ...validPatch, command: 'rm -rf' });
    }, /Forbidden execution field "command" detected/);
    // 3. PatchProposal rejects nested files[0].shell field
    node_assert_1.default.throws(() => {
        (0, json_response_1.validatePatchProposalJson)({
            ...validPatch,
            files: [
                {
                    filePath: 'math.js',
                    content: 'console.log("hello");',
                    reason: 'implement functionality',
                    shell: 'bash'
                }
            ]
        });
    }, /Forbidden execution field "shell" detected/);
});
(0, node_test_1.default)('json-response - empty patch validation cases', () => {
    const patchWithoutFiles = {
        summary: 'no files modified',
        files: [],
        notes: ['nothing'],
        riskLevel: 'low'
    };
    // 1. Blocked without noChangeNeeded
    node_assert_1.default.throws(() => {
        (0, json_response_1.validatePatchProposalJson)(patchWithoutFiles);
    }, /empty files array is blocked unless "noChangeNeeded" is true/);
    // 2. Blocked if noChangeNeeded true but noChangeReason missing
    node_assert_1.default.throws(() => {
        (0, json_response_1.validatePatchProposalJson)({
            ...patchWithoutFiles,
            noChangeNeeded: true
        });
    }, /"noChangeReason" is required and must be a non-empty string/);
    // 3. Passes with noChangeNeeded true and non-empty explanation/noChangeReason
    const validNoChange = {
        ...patchWithoutFiles,
        noChangeNeeded: true,
        noChangeReason: 'Verified files and no changes are required.'
    };
    const parsed = (0, json_response_1.validatePatchProposalJson)(validNoChange);
    node_assert_1.default.deepStrictEqual(parsed, validNoChange);
});
(0, node_test_1.default)('json-response - validateTestCriticResultJson cases', () => {
    const valid = {
        verdict: 'BAD_GENERATED_TEST',
        confidence: 'high',
        explanation: 'The test had invalid logic.',
        suspectedRootCause: 'Wrong bounds.',
        suggestedFix: 'Correct the assertions.',
        canAutoRetry: true,
        requiresHumanReview: false
    };
    const parsed = (0, json_response_1.validateTestCriticResultJson)(valid);
    node_assert_1.default.deepStrictEqual(parsed, valid);
    // Invalid verdict
    node_assert_1.default.throws(() => {
        (0, json_response_1.validateTestCriticResultJson)({ ...valid, verdict: 'WRONG' });
    }, /verdict/);
    // Missing explanation
    node_assert_1.default.throws(() => {
        (0, json_response_1.validateTestCriticResultJson)({ ...valid, explanation: '' });
    }, /explanation/);
    // Rejects forbidden execution fields
    node_assert_1.default.throws(() => {
        (0, json_response_1.validateTestCriticResultJson)({ ...valid, command: 'dangerous' });
    }, /Forbidden execution field "command" detected/);
});
(0, node_test_1.default)('json-response - validateTaskContractJson optional scope estimation validation', () => {
    const contractWithEstimations = {
        task: 'test task',
        understanding: 'test understanding',
        assumptions: ['assumption 1'],
        filesLikelyNeeded: ['file1.ts'],
        forbiddenActions: ['no push'],
        successCriteria: ['pass tests'],
        riskLevel: 'low',
        requiresApproval: false,
        createdAt: '2026-06-03T00:00:00.000Z',
        mode: 'strict',
        estimatedFilesChangedCount: 3,
        estimatedLinesChangedCount: 150
    };
    const parsed = (0, json_response_1.validateTaskContractJson)(contractWithEstimations);
    node_assert_1.default.deepStrictEqual(parsed, contractWithEstimations);
    // Invalid estimatedFilesChangedCount type
    node_assert_1.default.throws(() => {
        (0, json_response_1.validateTaskContractJson)({ ...contractWithEstimations, estimatedFilesChangedCount: 'three' });
    }, /estimatedFilesChangedCount/);
    // Invalid estimatedLinesChangedCount type
    node_assert_1.default.throws(() => {
        (0, json_response_1.validateTaskContractJson)({ ...contractWithEstimations, estimatedLinesChangedCount: 'many' });
    }, /estimatedLinesChangedCount/);
});
