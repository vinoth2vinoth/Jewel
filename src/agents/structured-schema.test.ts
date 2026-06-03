import test from 'node:test';
import assert from 'node:assert';
import { TaskContractSchema, PatchProposalSchema, ReviewResultSchema } from './structured-schema';
import { validateTaskContractJson, validatePatchProposalJson, validateReviewResultJson, assertNoForbiddenExecutionFields } from './json-response';

test('structured schema - schemas compile as valid objects', () => {
  assert.strictEqual(typeof TaskContractSchema, 'object');
  assert.strictEqual(typeof PatchProposalSchema, 'object');
  assert.strictEqual(typeof ReviewResultSchema, 'object');
  assert.strictEqual(TaskContractSchema.title, 'TaskContract');
  assert.strictEqual(PatchProposalSchema.title, 'PatchProposal');
  assert.strictEqual(ReviewResultSchema.title, 'ReviewResult');
});

test('structured schema - task contract validator checks required fields', () => {
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
  assert.deepStrictEqual(validateTaskContractJson(validContract), validContract);

  // Missing required field throws
  const invalidContract = { ...validContract, task: undefined };
  assert.throws(() => validateTaskContractJson(invalidContract), /task/);
});

test('structured schema - forbidden execution fields are rejected', () => {
  const goodPayload = {
    summary: 'Updates files',
    files: [{ filePath: 'src/math.ts', content: 'export function add() {}', reason: 'implement' }],
    notes: [],
    riskLevel: 'low'
  };

  assert.doesNotThrow(() => validatePatchProposalJson(goodPayload));

  // Add forbidden fields
  const badPayload1 = { ...goodPayload, command: 'npm install' };
  assert.throws(() => validatePatchProposalJson(badPayload1), /Forbidden execution field "command" detected./);

  const badPayload2 = {
    ...goodPayload,
    files: [{ filePath: 'src/math.ts', content: 'export function add() {}', reason: 'implement', exec: 'reboot' }]
  };
  assert.throws(() => validatePatchProposalJson(badPayload2), /Forbidden execution field "exec" detected./);
});

test('structured schema - empty patch requires noChangeNeeded and noChangeReason', () => {
  const emptyPayload = {
    summary: 'No changes',
    files: [],
    notes: [],
    riskLevel: 'low'
  };

  // Standard empty patch without noChangeNeeded throws
  assert.throws(() => validatePatchProposalJson(emptyPayload), /empty files array is blocked/);

  // With noChangeNeeded but missing noChangeReason throws
  const withFlag = { ...emptyPayload, noChangeNeeded: true };
  assert.throws(() => validatePatchProposalJson(withFlag), /noChangeReason/);

  // Fully compliant empty patch passes
  const compliantEmpty = { ...emptyPayload, noChangeNeeded: true, noChangeReason: 'No modifications required' };
  assert.deepStrictEqual(validatePatchProposalJson(compliantEmpty), compliantEmpty);
});

test('structured schema - review result validator checks values', () => {
  const validReview = {
    status: 'PASS',
    findings: []
  };

  assert.deepStrictEqual(validateReviewResultJson(validReview), validReview);

  // Invalid enum status
  const invalidReview = { ...validReview, status: 'INVALID' };
  assert.throws(() => validateReviewResultJson(invalidReview), /status/);
});
