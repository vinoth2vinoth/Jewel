"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const structured_schema_1 = require("./structured-schema");
const json_response_1 = require("./json-response");
(0, node_test_1.default)('structured schema - schemas compile as valid objects', () => {
    node_assert_1.default.strictEqual(typeof structured_schema_1.TaskContractSchema, 'object');
    node_assert_1.default.strictEqual(typeof structured_schema_1.PatchProposalSchema, 'object');
    node_assert_1.default.strictEqual(typeof structured_schema_1.ReviewResultSchema, 'object');
    node_assert_1.default.strictEqual(structured_schema_1.TaskContractSchema.title, 'TaskContract');
    node_assert_1.default.strictEqual(structured_schema_1.PatchProposalSchema.title, 'PatchProposal');
    node_assert_1.default.strictEqual(structured_schema_1.ReviewResultSchema.title, 'ReviewResult');
});
(0, node_test_1.default)('structured schema - task contract validator checks required fields', () => {
    const validContract = {
        task: 'test task',
        understanding: 'test understanding',
        assumptions: ['assumption1'],
        filesLikelyNeeded: ['file1.ts'],
        forbiddenActions: [],
        successCriteria: ['compile'],
        riskLevel: 'low',
        requiresApproval: false,
        createdAt: new Date().toISOString(),
        mode: 'strict'
    };
    // Valid contract passes
    node_assert_1.default.deepStrictEqual((0, json_response_1.validateTaskContractJson)(validContract), validContract);
    // Missing required field throws
    const invalidContract = { ...validContract, task: undefined };
    node_assert_1.default.throws(() => (0, json_response_1.validateTaskContractJson)(invalidContract), /task/);
});
(0, node_test_1.default)('structured schema - forbidden execution fields are rejected', () => {
    const goodPayload = {
        summary: 'Updates files',
        files: [{ filePath: 'src/math.ts', content: 'export function add() {}', reason: 'implement' }],
        notes: [],
        riskLevel: 'low'
    };
    node_assert_1.default.doesNotThrow(() => (0, json_response_1.validatePatchProposalJson)(goodPayload));
    // Add forbidden fields
    const badPayload1 = { ...goodPayload, command: 'npm install' };
    node_assert_1.default.throws(() => (0, json_response_1.validatePatchProposalJson)(badPayload1), /Forbidden execution field "command" detected./);
    const badPayload2 = {
        ...goodPayload,
        files: [{ filePath: 'src/math.ts', content: 'export function add() {}', reason: 'implement', exec: 'reboot' }]
    };
    node_assert_1.default.throws(() => (0, json_response_1.validatePatchProposalJson)(badPayload2), /Forbidden execution field "exec" detected./);
});
(0, node_test_1.default)('structured schema - empty patch requires noChangeNeeded and noChangeReason', () => {
    const emptyPayload = {
        summary: 'No changes',
        files: [],
        notes: [],
        riskLevel: 'low'
    };
    // Standard empty patch without noChangeNeeded throws
    node_assert_1.default.throws(() => (0, json_response_1.validatePatchProposalJson)(emptyPayload), /empty files array is blocked/);
    // With noChangeNeeded but missing noChangeReason throws
    const withFlag = { ...emptyPayload, noChangeNeeded: true };
    node_assert_1.default.throws(() => (0, json_response_1.validatePatchProposalJson)(withFlag), /noChangeReason/);
    // Fully compliant empty patch passes
    const compliantEmpty = { ...emptyPayload, noChangeNeeded: true, noChangeReason: 'No modifications required' };
    node_assert_1.default.deepStrictEqual((0, json_response_1.validatePatchProposalJson)(compliantEmpty), compliantEmpty);
});
(0, node_test_1.default)('structured schema - review result validator checks values', () => {
    const validReview = {
        status: 'PASS',
        findings: []
    };
    node_assert_1.default.deepStrictEqual((0, json_response_1.validateReviewResultJson)(validReview), validReview);
    // Invalid enum status
    const invalidReview = { ...validReview, status: 'INVALID' };
    node_assert_1.default.throws(() => (0, json_response_1.validateReviewResultJson)(invalidReview), /status/);
});
