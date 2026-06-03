import test from 'node:test';
import assert from 'node:assert';
import { runCriticReview } from './critic';
import { DEFAULT_CONFIG, JewelConfig } from '../core/config';
import { TaskContract } from '../core/session';
import { DiffAnalysis } from './diff-guard';
import { VerificationReport } from '../verification/runner';

const mockContract: TaskContract = {
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

const mockDiffAnalysisPass: DiffAnalysis = {
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

const mockVerificationPass: VerificationReport = {
  projectName: 'test',
  date: '123',
  mode: 'strict',
  overallStatus: 'PASS',
  stats: { passed: 1, failed: 0, skipped: 0, blocked: 0 },
  results: []
};

test('critic - clean diff with passing verification passes', () => {
  // We mock a test file change so it matches high risk need
  const diff = { ...mockDiffAnalysisPass, changedFiles: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
  const contract = { ...mockContract, filesLikelyNeeded: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
  
  const result = runCriticReview(contract, diff, mockVerificationPass, DEFAULT_CONFIG);
  assert.strictEqual(result.status, 'PASS');
});

test('critic - missing verification blocks when required', () => {
  const result = runCriticReview(mockContract, mockDiffAnalysisPass, null, DEFAULT_CONFIG);
  assert.strictEqual(result.status, 'BLOCK');
  assert.ok(result.findings.some(f => f.includes('missing')));
});

test('critic - failing verification blocks', () => {
  const mockVerificationFail: VerificationReport = {
    ...mockVerificationPass,
    overallStatus: 'FAIL',
    stats: { passed: 0, failed: 1, skipped: 0, blocked: 0 }
  };
  const result = runCriticReview(mockContract, mockDiffAnalysisPass, mockVerificationFail, DEFAULT_CONFIG);
  assert.strictEqual(result.status, 'BLOCK');
  assert.ok(result.findings.some(f => f.includes('Verification commands failed')));
});

test('critic - unplanned file edits block in strict mode', () => {
  const diffUnplanned: DiffAnalysis = {
    ...mockDiffAnalysisPass,
    changedFiles: ['src/auth/session.ts', 'src/unrelated.ts'] // unrelated.ts was not in filesLikelyNeeded
  };
  const result = runCriticReview(mockContract, diffUnplanned, mockVerificationPass, DEFAULT_CONFIG);
  assert.strictEqual(result.status, 'BLOCK');
  assert.ok(result.findings.some(f => f.includes('Changed files not declared')));
});
