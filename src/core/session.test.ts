import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { validateContract, assessRiskLevel, generateLocalContract, createSession } from './session';
import { DEFAULT_CONFIG } from './config';

const sandboxDir = path.join(__dirname, '../../sandbox-test-session');

function cleanupSandbox() {
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
}

test('session - validate contract schema', () => {
  const valid = {
    task: 'Fix a typo',
    successCriteria: ['Typo is fixed'],
    riskLevel: 'low'
  };
  assert.strictEqual(validateContract(valid).length, 0);

  const invalidEmpty = {
    task: '',
    successCriteria: [],
    riskLevel: 'unknown'
  };
  const errors = validateContract(invalidEmpty);
  assert.ok(errors.length >= 3);
  assert.ok(errors.some(e => e.includes('Task description')));
  assert.ok(errors.some(e => e.includes('Success criteria')));
  assert.ok(errors.some(e => e.includes('Risk level')));
});

test('session - risk assessment', () => {
  // Low risk
  assert.strictEqual(assessRiskLevel('Fix typo in docs', [], DEFAULT_CONFIG), 'low');

  // Medium risk (dependencies)
  assert.strictEqual(assessRiskLevel('install axios library', [], DEFAULT_CONFIG), 'medium');
  assert.strictEqual(assessRiskLevel('update dependencies', [], DEFAULT_CONFIG), 'medium');

  // High risk (auth/payments keywords)
  assert.strictEqual(assessRiskLevel('fix login session expiry issue', [], DEFAULT_CONFIG), 'high');
  assert.strictEqual(assessRiskLevel('setup Stripe checkout billing', [], DEFAULT_CONFIG), 'high');
  assert.strictEqual(assessRiskLevel('generate database migration', [], DEFAULT_CONFIG), 'high');

  // High risk (protected files)
  assert.strictEqual(assessRiskLevel('update config', ['.env'], DEFAULT_CONFIG), 'high');
  assert.strictEqual(assessRiskLevel('update authentication', ['src/auth/helper.ts'], DEFAULT_CONFIG), 'high');
  assert.strictEqual(assessRiskLevel('modify schema file', ['schema.prisma'], DEFAULT_CONFIG), 'high');
});

test('session - create session and save contract', () => {
  cleanupSandbox();
  fs.mkdirSync(sandboxDir, { recursive: true });

  const { sessionId, sessionPath, contractPath } = createSession('Configure payment flow', DEFAULT_CONFIG, ['src/payments/stripe.ts'], sandboxDir);

  assert.ok(sessionId.startsWith('session-'));
  assert.ok(fs.existsSync(sessionPath));
  assert.ok(fs.existsSync(contractPath));

  const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  assert.strictEqual(contractData.task, 'Configure payment flow');
  assert.strictEqual(contractData.riskLevel, 'high'); // since it matches payments/billing context
  assert.strictEqual(contractData.requiresApproval, true);
  assert.deepStrictEqual(contractData.filesLikelyNeeded, ['src/payments/stripe.ts']);

  cleanupSandbox();
});
