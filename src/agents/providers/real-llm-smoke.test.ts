import test from 'node:test';
import assert from 'node:assert';
import { OpenAIAdapter } from './openai-adapter';
import { GeminiAdapter } from './gemini-adapter';
import { AnthropicAdapter } from './anthropic-adapter';
import { OpenRouterAdapter } from './openrouter-adapter';
import { DEFAULT_CONFIG } from '../../core/config';

test('real provider smoke tests - only runs when JEWEL_RUN_REAL_LLM_TESTS is true', async () => {
  if (process.env.JEWEL_RUN_REAL_LLM_TESTS !== 'true') {
    return;
  }

  const task = 'Add a comment to main.js';
  const repoSummary = 'Files:\n- main.js';

  // 1. OpenAI
  if (process.env.OPENAI_API_KEY) {
    const adapter = new OpenAIAdapter();
    const plan = await adapter.plan({
      task,
      repoSummary,
      config: { ...DEFAULT_CONFIG, model: 'gpt-4o-mini' },
      skills: []
    });
    assert.ok(plan.task);
    assert.ok(plan.understanding);
  }

  // 2. Gemini
  if (process.env.GEMINI_API_KEY) {
    const adapter = new GeminiAdapter();
    const plan = await adapter.plan({
      task,
      repoSummary,
      config: { ...DEFAULT_CONFIG, model: 'gemini-1.5-flash' },
      skills: []
    });
    assert.ok(plan.task);
    assert.ok(plan.understanding);
  }

  // 3. Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    const adapter = new AnthropicAdapter();
    const plan = await adapter.plan({
      task,
      repoSummary,
      config: { ...DEFAULT_CONFIG, model: 'claude-3-5-haiku-20241022' },
      skills: []
    });
    assert.ok(plan.task);
    assert.ok(plan.understanding);
  }

  // 4. OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    const adapter = new OpenRouterAdapter();
    const plan = await adapter.plan({
      task,
      repoSummary,
      config: { ...DEFAULT_CONFIG, model: 'meta-llama/llama-3.1-8b-instruct:free' },
      skills: []
    });
    assert.ok(plan.task);
    assert.ok(plan.understanding);
  }
});
