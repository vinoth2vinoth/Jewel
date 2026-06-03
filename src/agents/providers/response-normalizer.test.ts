import test from 'node:test';
import assert from 'node:assert';
import { normalizeResponse } from './response-normalizer';

test('response normalizer - OpenAI response normalizes', () => {
  const mockResponse = {
    choices: [{
      message: { content: 'hello world' },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30
    }
  };

  const normalized = normalizeResponse(mockResponse, 'openai', 'gpt-4o');
  assert.strictEqual(normalized.text, 'hello world');
  assert.strictEqual(normalized.rawProvider, 'openai');
  assert.strictEqual(normalized.model, 'gpt-4o');
  assert.strictEqual(normalized.finishReason, 'stop');
  assert.deepStrictEqual(normalized.usage, {
    inputTokens: 10,
    outputTokens: 20,
    totalTokens: 30
  });
});

test('response normalizer - Gemini response normalizes', () => {
  const mockResponse = {
    candidates: [{
      content: {
        parts: [{ text: 'gemini content' }]
      },
      finishReason: 'STOP'
    }],
    usageMetadata: {
      promptTokenCount: 15,
      candidatesTokenCount: 25,
      totalTokenCount: 40
    }
  };

  const normalized = normalizeResponse(mockResponse, 'gemini', 'gemini-1.5-pro');
  assert.strictEqual(normalized.text, 'gemini content');
  assert.strictEqual(normalized.rawProvider, 'gemini');
  assert.strictEqual(normalized.model, 'gemini-1.5-pro');
  assert.strictEqual(normalized.finishReason, 'STOP');
  assert.deepStrictEqual(normalized.usage, {
    inputTokens: 15,
    outputTokens: 25,
    totalTokens: 40
  });
});

test('response normalizer - Anthropic response normalizes', () => {
  const mockResponse = {
    content: [{
      type: 'text',
      text: 'anthropic content'
    }],
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 100,
      output_tokens: 50
    }
  };

  const normalized = normalizeResponse(mockResponse, 'anthropic', 'claude-3-5-sonnet');
  assert.strictEqual(normalized.text, 'anthropic content');
  assert.strictEqual(normalized.rawProvider, 'anthropic');
  assert.strictEqual(normalized.model, 'claude-3-5-sonnet');
  assert.strictEqual(normalized.finishReason, 'end_turn');
  assert.deepStrictEqual(normalized.usage, {
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150
  });
});

test('response normalizer - missing usage is handled safely', () => {
  const mockResponse = {
    choices: [{
      message: { content: 'no usage data' }
    }]
  };

  const normalized = normalizeResponse(mockResponse, 'openai', 'gpt-4o');
  assert.strictEqual(normalized.text, 'no usage data');
  assert.deepStrictEqual(normalized.usage, {});
});

test('response normalizer - non-text response throws error', () => {
  const badResponse = {
    choices: [{
      message: { content: null } // non-string
    }]
  };

  assert.throws(() => normalizeResponse(badResponse, 'openai', 'gpt-4o'), /message content is not a string/);
});

test('response normalizer - Anthropic response tool_use normalizes', () => {
  const mockResponse = {
    content: [{
      type: 'tool_use',
      id: 'toolu_0123',
      name: 'submit_task_contract',
      input: { task: 'test', successCriteria: ['ok'] }
    }],
    stop_reason: 'tool_use',
    usage: {
      input_tokens: 10,
      output_tokens: 20
    }
  };

  const normalized = normalizeResponse(mockResponse, 'anthropic', 'claude-3-5-sonnet');
  assert.deepStrictEqual(JSON.parse(normalized.text), { task: 'test', successCriteria: ['ok'] });
  assert.strictEqual(normalized.rawProvider, 'anthropic');
  assert.strictEqual(normalized.model, 'claude-3-5-sonnet');
  assert.strictEqual(normalized.finishReason, 'tool_use');
});

