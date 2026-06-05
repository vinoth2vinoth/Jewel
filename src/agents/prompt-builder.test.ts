import test from 'node:test';
import assert from 'node:assert';
import { buildPlanningPrompt, buildPatchProposalPrompt, buildDiffReviewPrompt, buildTestCriticPrompt } from './prompt-builder';
import { DEFAULT_CONFIG } from '../core/config';
import { generateLocalContract } from '../core/session';

test('prompt-builder - planning prompt contains required rules', () => {
  const prompt = buildPlanningPrompt({
    task: 'Create endpoint',
    repoSummary: 'Summary text',
    config: DEFAULT_CONFIG,
    skills: []
  });

  assert.ok(prompt.includes('JSON'), 'Mentions JSON');
  assert.ok(prompt.includes('absolute paths'), 'Mentions no absolute paths');
  assert.ok(prompt.includes('parent traversal'), 'Mentions parent traversal');
  assert.ok(prompt.includes('shell commands'), 'Mentions no shell commands');
  assert.ok(prompt.includes('surgical'), 'Mentions surgical changes');
  assert.ok(prompt.includes('Create endpoint'), 'Contains task description');
});

test('prompt-builder - patch proposal prompt contains task contract constraints', () => {
  const contract = generateLocalContract('Fix division', DEFAULT_CONFIG, ['math.js']);
  const prompt = buildPatchProposalPrompt({
    taskContract: contract,
    allowedFiles: contract.filesLikelyNeeded,
    repoContext: 'some code context',
    verificationResult: null
  });

  assert.ok(prompt.includes('JSON'), 'Mentions JSON');
  assert.ok(prompt.includes('absolute paths'), 'Mentions no absolute paths');
  assert.ok(prompt.includes('parent traversal'), 'Mentions parent traversal');
  assert.ok(prompt.includes('Fix division'), 'Contains task name');
  assert.ok(prompt.includes('math.js'), 'Contains allowed files list');
});

test('prompt-builder - diff review prompt contains diff', () => {
  const contract = generateLocalContract('Fix division', DEFAULT_CONFIG, ['math.js']);
  const prompt = buildDiffReviewPrompt({
    diff: '+ added lines',
    verificationResult: null,
    taskContract: contract
  });

  assert.ok(prompt.includes('+ added lines'), 'Contains diff');
  assert.ok(prompt.includes('JSON'), 'Mentions JSON');
  assert.ok(prompt.includes('commands'), 'Mentions commands');
});

test('prompt-builder - patch proposal prompt contains verification logs and critic feedback on repair', () => {
  const contract = generateLocalContract('Fix division', DEFAULT_CONFIG, ['math.js']);
  contract.preserveExistingTests = true;
  
  const verificationResult = {
    projectName: 'test-project',
    date: new Date().toISOString(),
    mode: 'strict' as const,
    overallStatus: 'FAIL' as const,
    results: [
      {
        commandKey: 'test',
        commandLine: 'npm run test',
        status: 'FAIL' as const,
        stdout: '',
        stderr: '',
        errorMsg: 'AssertionError: expected 2 to be 3'
      }
    ],
    stats: { passed: 0, failed: 1, skipped: 0, blocked: 0 }
  };

  const testCriticResult = {
    verdict: 'BAD_GENERATED_TEST' as const,
    confidence: 'high' as const,
    explanation: 'Expected 2x2 * 2x3 to fail, but it is valid.',
    suspectedRootCause: 'Wrong math dimensions',
    suggestedFix: 'Fix dimensions in test',
    canAutoRetry: true,
    requiresHumanReview: false
  };

  const prompt = buildPatchProposalPrompt({
    taskContract: contract,
    allowedFiles: contract.filesLikelyNeeded,
    repoContext: 'some code context',
    verificationResult,
    testCriticResult,
    config: {
      ...DEFAULT_CONFIG,
      maxFilesChanged: 5,
      maxLinesChanged: 250
    }
  });

  assert.ok(prompt.includes('AssertionError: expected 2 to be 3'), 'Contains failure logs');
  assert.ok(prompt.includes('BAD_GENERATED_TEST'), 'Contains critic verdict');
  assert.ok(prompt.includes('Expected 2x2 * 2x3 to fail'), 'Contains critic explanation');
  assert.ok(prompt.includes('Fix dimensions in test'), 'Contains critic suggested fix');
  assert.ok(prompt.includes('CRITICAL WARNING: The user requested to keep existing tests exactly as they are'), 'Contains preserve warning');
  assert.ok(prompt.includes('no more than 5 files'), 'Contains max files limit');
  assert.ok(prompt.includes('must not exceed 250 lines'), 'Contains max lines limit');
});

test('prompt-builder - buildTestCriticPrompt contains diff and verification results', () => {
  const contract = generateLocalContract('Fix division', DEFAULT_CONFIG, ['math.js']);
  const verificationResult = {
    projectName: 'test-project',
    date: new Date().toISOString(),
    mode: 'strict' as const,
    overallStatus: 'FAIL' as const,
    results: [
      {
        commandKey: 'test',
        commandLine: 'npm run test',
        status: 'FAIL' as const,
        stdout: '',
        stderr: '',
        errorMsg: 'AssertionError: expected 2 to be 3'
      }
    ],
    stats: { passed: 0, failed: 1, skipped: 0, blocked: 0 }
  };

  const prompt = buildTestCriticPrompt({
    diff: '+ added lines',
    verificationResult,
    taskContract: contract
  });

  assert.ok(prompt.includes('+ added lines'), 'Contains diff');
  assert.ok(prompt.includes('AssertionError: expected 2 to be 3'), 'Contains verification failures');
});

test('prompt-builder - buildTestCriticPrompt formats and includes truncated stdout and stderr of failed commands', () => {
  const contract = generateLocalContract('Fix division', DEFAULT_CONFIG, ['math.js']);
  const verificationResult = {
    projectName: 'test-project',
    date: new Date().toISOString(),
    mode: 'strict' as const,
    overallStatus: 'FAIL' as const,
    results: [
      {
        commandKey: 'test',
        commandLine: 'npm run test',
        status: 'FAIL' as const,
        stdout: 'Tests run: 1, Failures: 1\nAssertionError: expected 2 to be 3',
        stderr: 'compilation warning: deprecated API used',
        errorMsg: 'AssertionError: expected 2 to be 3'
      }
    ],
    stats: { passed: 0, failed: 1, skipped: 0, blocked: 0 }
  };

  const prompt = buildTestCriticPrompt({
    diff: '+ added lines',
    verificationResult,
    taskContract: contract
  });

  assert.ok(prompt.includes('AssertionError: expected 2 to be 3'), 'Contains errorMsg');
  assert.ok(prompt.includes('STDOUT:'), 'Contains STDOUT header');
  assert.ok(prompt.includes('Tests run: 1, Failures: 1'), 'Contains stdout logs');
  assert.ok(prompt.includes('STDERR:'), 'Contains STDERR header');
  assert.ok(prompt.includes('compilation warning: deprecated API used'), 'Contains stderr logs');
  assert.ok(prompt.includes('BAD_GENERATED_TEST'), 'Contains JSON schema verdicts instructions');
});

test('prompt-builder - buildPatchProposalPrompt contains failedDiff and detailed verification logs', () => {
  const contract = generateLocalContract('Fix division', DEFAULT_CONFIG, ['math.js']);
  const verificationResult = {
    projectName: 'test-project',
    date: new Date().toISOString(),
    mode: 'strict' as const,
    overallStatus: 'FAIL' as const,
    results: [
      {
        commandKey: 'test',
        commandLine: 'npm run test',
        status: 'FAIL' as const,
        stdout: 'Failed test details',
        stderr: 'Error details',
        errorMsg: 'Failure'
      }
    ],
    stats: { passed: 0, failed: 1, skipped: 0, blocked: 0 }
  };

  const prompt = buildPatchProposalPrompt({
    taskContract: contract,
    allowedFiles: contract.filesLikelyNeeded,
    repoContext: 'some context',
    verificationResult,
    failedDiff: 'diff --git a/math.js b/math.js\n+ const broken = true;'
  });

  assert.ok(prompt.includes('Proposed Diff that failed verification:'), 'Contains failed diff section header');
  assert.ok(prompt.includes('+ const broken = true;'), 'Contains failed diff');
  assert.ok(prompt.includes('STDOUT:'), 'Contains detailed stdout log section');
  assert.ok(prompt.includes('Failed test details'), 'Contains detailed stdout logs');
});

