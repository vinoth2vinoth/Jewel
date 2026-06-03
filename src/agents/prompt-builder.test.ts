import test from 'node:test';
import assert from 'node:assert';
import { buildPlanningPrompt, buildPatchProposalPrompt, buildDiffReviewPrompt } from './prompt-builder';
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
