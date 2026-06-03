import test from 'node:test';
import assert from 'node:assert';
import { createAgentAdapter } from './provider-factory';
import { DEFAULT_CONFIG } from '../core/config';
import { MockAgentAdapter } from './adapter';
import { OpenAIAdapter } from './providers/openai-adapter';
import { GeminiAdapter } from './providers/gemini-adapter';
import { AnthropicAdapter } from './providers/anthropic-adapter';
import { OpenRouterAdapter } from './providers/openrouter-adapter';

test('provider-factory - createAgentAdapter cases', () => {
  // 1. none returns MockAgentAdapter
  const adapterNone = createAgentAdapter({ ...DEFAULT_CONFIG, provider: 'none' });
  assert.ok(adapterNone instanceof MockAgentAdapter);

  // 2. openai returns OpenAIAdapter
  const adapterOpenAI = createAgentAdapter({ ...DEFAULT_CONFIG, provider: 'openai' });
  assert.ok(adapterOpenAI instanceof OpenAIAdapter);

  // 3. gemini returns GeminiAdapter
  const adapterGemini = createAgentAdapter({ ...DEFAULT_CONFIG, provider: 'gemini' });
  assert.ok(adapterGemini instanceof GeminiAdapter);

  // 4. anthropic returns AnthropicAdapter
  const adapterAnthropic = createAgentAdapter({ ...DEFAULT_CONFIG, provider: 'anthropic' });
  assert.ok(adapterAnthropic instanceof AnthropicAdapter);

  // 5. openrouter returns OpenRouterAdapter
  const adapterOpenRouter = createAgentAdapter({ ...DEFAULT_CONFIG, provider: 'openrouter' });
  assert.ok(adapterOpenRouter instanceof OpenRouterAdapter);

  // 6. unknown provider throws validation error
  assert.throws(() => {
    createAgentAdapter({ ...DEFAULT_CONFIG, provider: 'unknown' as any });
  }, /Unknown or invalid provider/);
});
