import test from 'node:test';
import assert from 'node:assert';
import { runCriticReview, runMultiAgentCriticReview } from './critic';
import { DEFAULT_CONFIG, JewelConfig } from '../core/config';
import { TaskContract } from '../core/session';
import { DiffAnalysis } from './diff-guard';
import { VerificationReport } from '../verification/runner';
import { MockAgentAdapter } from '../agents/adapter';

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

test('multi-agent critic - passing run aggregates critics', async () => {
  const config: JewelConfig = {
    ...DEFAULT_CONFIG,
    critics: ['security', 'linter']
  };
  const adapter = new MockAgentAdapter();
  const diff = { ...mockDiffAnalysisPass, changedFiles: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
  const contract = { ...mockContract, filesLikelyNeeded: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
  
  const result = await runMultiAgentCriticReview(
    contract,
    diff,
    mockVerificationPass,
    config,
    adapter,
    '/tmp',
    'diff content'
  );
  
  assert.strictEqual(result.status, 'PASS');
  assert.ok(result.findings.some(f => f.includes('[Critic: security] Mock agent review (security) passed successfully.')));
  assert.ok(result.findings.some(f => f.includes('[Critic: linter] Mock agent review (linter) passed successfully.')));
});

test('multi-agent critic - block result from one critic blocks overall', async () => {
  const config: JewelConfig = {
    ...DEFAULT_CONFIG,
    critics: ['security', 'linter']
  };
  const diff = { ...mockDiffAnalysisPass, changedFiles: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
  const contract = { ...mockContract, filesLikelyNeeded: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
  
  class BlockingMockAdapter extends MockAgentAdapter {
    async reviewDiff(input: any) {
      if (input.criticType === 'linter') {
        return { status: 'BLOCK' as const, findings: ['Syntax error found'] };
      }
      return { status: 'PASS' as const, findings: ['Security looks good'] };
    }
  }
  const adapter = new BlockingMockAdapter();
  
  const result = await runMultiAgentCriticReview(
    contract,
    diff,
    mockVerificationPass,
    config,
    adapter,
    '/tmp',
    'diff content'
  );
  
  assert.strictEqual(result.status, 'BLOCK');
  assert.ok(result.findings.some(f => f.includes('[Critic: linter] Syntax error found')));
  assert.ok(result.requiredActions.some(a => a.includes('Address blocking findings from the "linter" critic')));
});
 
test('multi-agent critic - error in one critic degrades to warn finding safely without crashing', async () => {
  const config: JewelConfig = {
    ...DEFAULT_CONFIG,
    critics: ['security', 'linter']
  };
  const diff = { ...mockDiffAnalysisPass, changedFiles: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
  const contract = { ...mockContract, filesLikelyNeeded: ['src/auth/session.ts', 'src/auth/session.test.ts'] };
  
  class ErrorMockAdapter extends MockAgentAdapter {
    async reviewDiff(input: any) {
      if (input.criticType === 'linter') {
        throw new Error('Linter crashed connection reset');
      }
      return { status: 'PASS' as const, findings: ['Security looks good'] };
    }
  }
  const adapter = new ErrorMockAdapter();
  
  const result = await runMultiAgentCriticReview(
    contract,
    diff,
    mockVerificationPass,
    config,
    adapter,
    '/tmp',
    'diff content'
  );
  
  assert.strictEqual(result.status, 'WARN');
  assert.ok(result.findings.some(f => f.includes('[Critic: linter] Critic "linter" failed to respond: Linter crashed connection reset')));
});
