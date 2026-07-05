import test from 'node:test';
import assert from 'node:assert';
import { shouldUseFastPath, applyFastPathConfig } from './risk-path';
import { DEFAULT_CONFIG } from './config';
import { TaskContract } from './session';

const baseContract: TaskContract = {
  task: 'fix typo',
  understanding: 'fix',
  assumptions: [],
  filesLikelyNeeded: ['src/a.ts'],
  forbiddenActions: [],
  successCriteria: ['pass'],
  riskLevel: 'low',
  requiresApproval: false,
  createdAt: new Date().toISOString(),
  mode: 'strict'
};

test('risk path - enables fast path for low risk single file', () => {
  const decision = shouldUseFastPath(DEFAULT_CONFIG, baseContract, ['src/a.ts']);
  assert.strictEqual(decision.enabled, true);
});

test('risk path - disables for high risk', () => {
  const high = { ...baseContract, riskLevel: 'high' as const };
  const decision = shouldUseFastPath(DEFAULT_CONFIG, high, ['src/a.ts']);
  assert.strictEqual(decision.enabled, false);
});

test('risk path - disables for continuation', () => {
  const decision = shouldUseFastPath(DEFAULT_CONFIG, baseContract, ['src/a.ts'], {
    parentSessionId: 'session-1',
    continuationFeedback: 'also fix tests'
  });
  assert.strictEqual(decision.enabled, false);
});

test('risk path - applyFastPathConfig reduces critics', () => {
  const config = {
    ...DEFAULT_CONFIG,
    critics: ['security', 'linter', 'architect'] as ('security' | 'linter' | 'architect')[]
  };
  const applied = applyFastPathConfig(config);
  assert.deepStrictEqual(applied.critics, ['security']);
});
