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

  // Critics validation tests
  assert.throws(() => {
    validateAndMergeConfig({ critics: 'not_an_array' });
  }, /critics.*must be an array/);

  assert.throws(() => {
    validateAndMergeConfig({ critics: ['invalid_critic'] });
  }, /critics\[0\].*must be one of "security", "linter", or "architect"/);

  const configWithCritics = validateAndMergeConfig({
    critics: ['security', 'linter', 'architect']
  });
  assert.deepStrictEqual(configWithCritics.critics, ['security', 'linter', 'architect']);
});

test('config loader - sandbox parameters validation', () => {
  const defaults = validateAndMergeConfig({});
  assert.strictEqual(defaults.useSandbox, false);
  assert.strictEqual(defaults.sandboxFallbackToHost, false);
  assert.strictEqual(defaults.sandboxImage, 'node:18-slim');
  assert.deepStrictEqual(defaults.sandboxVolumes, {});
  assert.deepStrictEqual(defaults.sandboxEnv, {});

  const valid = validateAndMergeConfig({
    useSandbox: true,
    sandboxFallbackToHost: true,
    sandboxImage: 'node:20',
    sandboxVolumes: { './my-host': '/my-container' },
    sandboxEnv: { 'API_KEY': '$API_KEY' }
  });
  assert.strictEqual(valid.useSandbox, true);
  assert.strictEqual(valid.sandboxFallbackToHost, true);
  assert.strictEqual(valid.sandboxImage, 'node:20');
  assert.deepStrictEqual(valid.sandboxVolumes, { './my-host': '/my-container' });
  assert.deepStrictEqual(valid.sandboxEnv, { 'API_KEY': '$API_KEY' });

  // Invalid types
  assert.throws(() => {
    validateAndMergeConfig({ useSandbox: 'not-a-bool' });
  }, /useSandbox.*must be a boolean/);

  assert.throws(() => {
    validateAndMergeConfig({ sandboxFallbackToHost: 'not-a-bool' });
  }, /sandboxFallbackToHost.*must be a boolean/);

  assert.throws(() => {
    validateAndMergeConfig({ sandboxImage: 123 });
  }, /sandboxImage.*must be a string/);

  assert.throws(() => {
    validateAndMergeConfig({ sandboxVolumes: 'not-an-object' });
  }, /sandboxVolumes.*must be an object/);

  assert.throws(() => {
    validateAndMergeConfig({ sandboxVolumes: [] }); // array is an object in JS
  }, /sandboxVolumes.*must be an object/);

  assert.throws(() => {
    validateAndMergeConfig({ sandboxVolumes: { '/host': 'relative/container' } });
  }, /sandboxVolumes.*destination path.*must be absolute/);

  assert.throws(() => {
    validateAndMergeConfig({ sandboxEnv: 'not-an-object' });
  }, /sandboxEnv.*must be an object/);
});

