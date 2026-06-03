import test from 'node:test';
import assert from 'node:assert';
import { validateAndMergeConfig, DEFAULT_CONFIG } from './config';

test('config loader - default config', () => {
  const result = validateAndMergeConfig({});
  assert.deepStrictEqual(result, DEFAULT_CONFIG);
});

test('config loader - valid partial config overrides defaults', () => {
  const result = validateAndMergeConfig({
    projectName: 'MyTestProject',
    maxRetries: 5,
    commands: {
      test: 'npm run test-ci'
    }
  });
  assert.strictEqual(result.projectName, 'MyTestProject');
  assert.strictEqual(result.maxRetries, 5);
  assert.strictEqual(result.commands.test, 'npm run test-ci');
  assert.strictEqual(result.commands.build, ''); // should fall back to default
});

test('config loader - invalid types throw error', () => {
  assert.throws(() => {
    validateAndMergeConfig({ projectName: 123 });
  }, /projectName.*must be a string/);

  assert.throws(() => {
    validateAndMergeConfig({ mode: 'unsafe' });
  }, /mode.*must be "strict" or "lax"/);

  assert.throws(() => {
    validateAndMergeConfig({ maxRetries: -1 });
  }, /maxRetries.*must be a non-negative number/);

  assert.throws(() => {
    validateAndMergeConfig({ requirePlanBeforeEdit: 'yes' });
  }, /requirePlanBeforeEdit.*must be a boolean/);
});
