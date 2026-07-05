import test from 'node:test';
import assert from 'node:assert';
import { MockAgentAdapter } from './adapter';
import { DEFAULT_CONFIG } from '../core/config';

test('agent adapter - mock adapter runs plan and proposePatch', async () => {
  const adapter = new MockAgentAdapter();

  const contract = await adapter.plan({
    task: 'Add hello world endpoint',
    repoSummary: 'Test repo',
    config: DEFAULT_CONFIG,
    skills: []
  });

  assert.strictEqual(contract.task, 'Add hello world endpoint');
  assert.ok(contract.understanding.includes('Mock understanding'));

  const patch = await adapter.proposePatch({
    taskContract: contract,
    allowedFiles: contract.filesLikelyNeeded,
    repoContext: 'File contents...',
    verificationResult: null
  });

  const firstFile = patch.files[0];
  assert.ok(firstFile);
  assert.ok(firstFile.content.includes('Task executed successfully'));

  const review = await adapter.reviewDiff({
    diff: 'diff content',
    verificationResult: null,
    taskContract: contract
  });

  assert.strictEqual(review.status, 'PASS');
});
