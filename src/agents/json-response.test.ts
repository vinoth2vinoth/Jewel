import test from 'node:test';
import assert from 'node:assert';
import {
  extractJsonObject,
  validateTaskContractJson,
  validatePatchProposalJson,
  validateReviewResultJson,
  validateTestCriticResultJson
} from './json-response';

test('json-response - extractJsonObject cases', () => {
  // 1. clean JSON
  const clean = extractJsonObject('{"a": 1, "b": "hello"}');
  assert.deepStrictEqual(clean, { a: 1, b: 'hello' });

  // 2. fenced JSON with single block
  const fenced = extractJsonObject('some text before\n```json\n{"x": 100}\n```\nsome text after');
  assert.deepStrictEqual(fenced, { x: 100 });

  // 3. malformed JSON throws
  assert.throws(() => {
    extractJsonObject('{"a": 1, "b": }');
  }, /Malformed JSON/);

  // 4. multiple JSON objects throws
  assert.throws(() => {
    extractJsonObject('```json\n{"a": 1}\n```\n```json\n{"b": 2}\n```');
  }, /Multiple JSON/);

  // 5. array as root throws
  assert.throws(() => {
    extractJsonObject('[{"a": 1}]');
  }, /cannot be an array/);

  // 6. forbidden keys throw
  assert.throws(() => {
    extractJsonObject('{"command": "rm -rf /"}');
  }, /Forbidden execution field "command"/);

  assert.throws(() => {
    extractJsonObject('{"nested": {"shell": "bash"}}');
  }, /Forbidden execution field "shell"/);
});

test('json-response - validateTaskContractJson cases', () => {
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

  const parsed = validateTaskContractJson(valid);
  assert.deepStrictEqual(parsed, valid);

  // Missing task
  assert.throws(() => {
    validateTaskContractJson({ ...valid, task: '' });
  }, /task.*must be a non-empty string/);

  // Invalid riskLevel
  assert.throws(() => {
    validateTaskContractJson({ ...valid, riskLevel: 'extreme' });
  }, /riskLevel/);

  // Invalid successCriteria
  assert.throws(() => {
    validateTaskContractJson({ ...valid, successCriteria: [] });
  }, /successCriteria/);

  // Valid allowedSymbolChanges
  const validWithSymbols = {
    ...valid,
    allowedSymbolChanges: ['myFunc', 'MyClass.myMethod']
  };
  const parsedWithSymbols = validateTaskContractJson(validWithSymbols);
  assert.deepStrictEqual(parsedWithSymbols.allowedSymbolChanges, ['myFunc', 'MyClass.myMethod']);

  // Invalid allowedSymbolChanges
  assert.throws(() => {
    validateTaskContractJson({ ...valid, allowedSymbolChanges: 'not-an-array' });
  }, /allowedSymbolChanges/);

  assert.throws(() => {
    validateTaskContractJson({ ...valid, allowedSymbolChanges: [123] });
  }, /allowedSymbolChanges/);
});

test('json-response - validatePatchProposalJson cases', () => {
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

  const parsed = validatePatchProposalJson(valid);
  assert.deepStrictEqual(parsed, valid);

  // Missing filePath
  assert.throws(() => {
    validatePatchProposalJson({
      ...valid,
      files: [{ filePath: '', content: 'hello', reason: 'reason' }]
    });
  }, /filePath.*must be a non-empty string/);

  // Missing content and edits
  assert.throws(() => {
    validatePatchProposalJson({
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
  const parsedEdits = validatePatchProposalJson(editsOnly);
  assert.strictEqual(parsedEdits.files[0].edits?.length, 1);

  // Invalid riskLevel
  assert.throws(() => {
    validatePatchProposalJson({ ...valid, riskLevel: 'critical' });
  }, /riskLevel/);
});

test('json-response - validateReviewResultJson cases', () => {
  const valid = {
    status: 'PASS',
    findings: ['no issues found']
  };

  const parsed = validateReviewResultJson(valid);
  assert.deepStrictEqual(parsed, valid);

  // Invalid status
  assert.throws(() => {
    validateReviewResultJson({ ...valid, status: 'APPROVED' });
  }, /status/);

  // Reject forbidden execution fields in review
  assert.throws(() => {
    validateReviewResultJson({ ...valid, exec: 'some command' });
  }, /Forbidden execution field "exec" detected/);
});

test('json-response - forbidden execution fields in other validators', () => {
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

  assert.throws(() => {
    validateTaskContractJson({ ...validContract, command: 'rm -rf /' });
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

  assert.throws(() => {
    validatePatchProposalJson({ ...validPatch, command: 'rm -rf' });
  }, /Forbidden execution field "command" detected/);

  // 3. PatchProposal rejects nested files[0].shell field
  assert.throws(() => {
    validatePatchProposalJson({
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

test('json-response - empty patch validation cases', () => {
  const patchWithoutFiles = {
    summary: 'no files modified',
    files: [],
    notes: ['nothing'],
    riskLevel: 'low'
  };

  // 1. Blocked without noChangeNeeded
  assert.throws(() => {
    validatePatchProposalJson(patchWithoutFiles);
  }, /empty files array is blocked unless "noChangeNeeded" is true/);

  // 2. Blocked if noChangeNeeded true but noChangeReason missing
  assert.throws(() => {
    validatePatchProposalJson({
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

  const parsed = validatePatchProposalJson(validNoChange);
  assert.deepStrictEqual(parsed, validNoChange);
});

test('json-response - validateTestCriticResultJson cases', () => {
  const valid = {
    verdict: 'BAD_GENERATED_TEST',
    confidence: 'high',
    explanation: 'The test had invalid logic.',
    suspectedRootCause: 'Wrong bounds.',
    suggestedFix: 'Correct the assertions.',
    canAutoRetry: true,
    requiresHumanReview: false
  };

  const parsed = validateTestCriticResultJson(valid);
  assert.deepStrictEqual(parsed, valid);

  // Invalid verdict
  assert.throws(() => {
    validateTestCriticResultJson({ ...valid, verdict: 'WRONG' });
  }, /verdict/);

  // Missing explanation
  assert.throws(() => {
    validateTestCriticResultJson({ ...valid, explanation: '' });
  }, /explanation/);

  // Rejects forbidden execution fields
  assert.throws(() => {
    validateTestCriticResultJson({ ...valid, command: 'dangerous' });
  }, /Forbidden execution field "command" detected/);
});

test('json-response - validateTaskContractJson optional scope estimation validation', () => {
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

  const parsed = validateTaskContractJson(contractWithEstimations);
  assert.deepStrictEqual(parsed, contractWithEstimations);

  // Invalid estimatedFilesChangedCount type
  assert.throws(() => {
    validateTaskContractJson({ ...contractWithEstimations, estimatedFilesChangedCount: 'three' });
  }, /estimatedFilesChangedCount/);

  // Invalid estimatedLinesChangedCount type
  assert.throws(() => {
    validateTaskContractJson({ ...contractWithEstimations, estimatedLinesChangedCount: 'many' });
  }, /estimatedLinesChangedCount/);
});

