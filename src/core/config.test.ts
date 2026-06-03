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

  // v0.3 LLM Config validation
  assert.throws(() => {
    validateAndMergeConfig({ provider: 'invalid_provider' });
  }, /provider.*must be one of/);

  assert.throws(() => {
    validateAndMergeConfig({ llmTimeoutMs: -10 });
  }, /llmTimeoutMs.*must be a non-negative number/);

  assert.throws(() => {
    validateAndMergeConfig({ llmMaxRetries: 'invalid' });
  }, /llmMaxRetries.*must be a non-negative number/);

  assert.throws(() => {
    validateAndMergeConfig({ llmStrictJson: 'not_bool' });
  }, /llmStrictJson.*must be a boolean/);

  // Check valid LLM fields work
  const valid = validateAndMergeConfig({
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    maxOutputTokens: 2000,
    llmTimeoutMs: 30000,
    llmMaxRetries: 3,
    llmStrictJson: false
  });
  assert.strictEqual(valid.provider, 'openai');
  assert.strictEqual(valid.model, 'gpt-4o');
  assert.strictEqual(valid.temperature, 0.7);
  assert.strictEqual(valid.maxOutputTokens, 2000);
  assert.strictEqual(valid.llmTimeoutMs, 30000);
  assert.strictEqual(valid.llmMaxRetries, 3);
  assert.strictEqual(valid.llmStrictJson, false);
});
