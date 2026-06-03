import test from 'node:test';
import assert from 'node:assert';
import { OpenAIAdapter } from './openai-adapter';
import { GeminiAdapter } from './gemini-adapter';
import { AnthropicAdapter } from './anthropic-adapter';
import { OpenRouterAdapter } from './openrouter-adapter';
import { DEFAULT_CONFIG } from '../../core/config';
import { redactSecrets } from '../../safety/secret-redactor';

test('real provider smoke tests - only runs when JEWEL_RUN_REAL_LLM_TESTS is true', async () => {
  if (process.env.JEWEL_RUN_REAL_LLM_TESTS !== 'true') {
    console.log('Skipping real LLM provider tests (JEWEL_RUN_REAL_LLM_TESTS is not set to true).');
    return;
  }

  const task = 'Return a JSON object conforming to TaskContract schema for a dummy task.';
  const repoSummary = 'Files:\n- dummy.txt';

  // 1. OpenAI
  if (process.env.OPENAI_API_KEY) {
    console.log('Running real OpenAI smoke test...');
    try {
      const adapter = new OpenAIAdapter();
      const plan = await adapter.plan({
        task,
        repoSummary,
        config: { ...DEFAULT_CONFIG, model: 'gpt-4o-mini' },
        skills: []
      });
      assert.ok(plan.task);
      assert.ok(plan.understanding);
    } catch (err: any) {
      throw new Error(`OpenAI test failed: ${redactSecrets(err.message)}`);
    }
  } else {
    console.log('Skipping OpenAI real provider test (OPENAI_API_KEY missing).');
  }

  // 2. Gemini
  if (process.env.GEMINI_API_KEY) {
    console.log('Running real Gemini smoke test...');
    try {
      const adapter = new GeminiAdapter();
      const plan = await adapter.plan({
        task,
        repoSummary,
        config: { ...DEFAULT_CONFIG, model: 'gemini-1.5-flash' },
        skills: []
      });
      assert.ok(plan.task);
      assert.ok(plan.understanding);
    } catch (err: any) {
      throw new Error(`Gemini test failed: ${redactSecrets(err.message)}`);
    }
  } else {
    console.log('Skipping Gemini real provider test (GEMINI_API_KEY missing).');
  }

  // 3. Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('Running real Anthropic smoke test...');
    try {
      const adapter = new AnthropicAdapter();
      const plan = await adapter.plan({
        task,
        repoSummary,
        config: { ...DEFAULT_CONFIG, model: 'claude-3-5-haiku-20241022' },
        skills: []
      });
      assert.ok(plan.task);
      assert.ok(plan.understanding);
    } catch (err: any) {
      throw new Error(`Anthropic test failed: ${redactSecrets(err.message)}`);
    }
  } else {
    console.log('Skipping Anthropic real provider test (ANTHROPIC_API_KEY missing).');
  }

  // 4. OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    console.log('Running real OpenRouter smoke test...');
    try {
      const adapter = new OpenRouterAdapter();
      const plan = await adapter.plan({
        task,
        repoSummary,
        config: { ...DEFAULT_CONFIG, model: 'openai/gpt-4o-mini' },
        skills: []
      });
      assert.ok(plan.task);
      assert.ok(plan.understanding);
    } catch (err: any) {
      throw new Error(`OpenRouter test failed: ${redactSecrets(err.message)}`);
    }
  } else {
    console.log('Skipping OpenRouter real provider test (OPENROUTER_API_KEY missing).');
  }
});
