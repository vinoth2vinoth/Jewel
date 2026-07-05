import test from 'node:test';
import assert from 'node:assert';
import { FallbackAgentAdapter, isConnectionFailure } from './fallback-adapter';
import { AgentAdapter, PlanInput } from './adapter';
import { DEFAULT_CONFIG } from '../core/config';
import { generateLocalContract, TaskContract } from '../core/session';

function makeAdapter(name: string, behavior: 'ok' | 'connection-error' | 'schema-error'): AgentAdapter {
  return {
    name,
    usage: { totalTokens: 10, estimatedCostUsd: 0.001 },
    async plan(input: PlanInput): Promise<TaskContract> {
      if (behavior === 'connection-error') throw new Error('fetch failed: ECONNREFUSED 1.2.3.4:443');
      if (behavior === 'schema-error') throw new Error('BLOCKED: Invalid JSON in LLM response: bad');
      const contract = generateLocalContract(input.task, input.config, ['src/index.ts']);
      contract.understanding = `planned by ${name} with provider ${input.config.provider} model ${input.config.model}`;
      return contract;
    },
    async proposePatch() {
      throw new Error('not used in this test');
    },
    async reviewDiff() {
      return { status: 'PASS' as const, findings: [] };
    }
  };
}

test('fallback-adapter - isConnectionFailure classification', () => {
  assert.strictEqual(isConnectionFailure(new Error('fetch failed')), true);
  assert.strictEqual(isConnectionFailure(new Error('Request timed out after 60000ms')), true);
  assert.strictEqual(isConnectionFailure(new Error('FAIL: LLM request failed with HTTP 503')), true);
  assert.strictEqual(isConnectionFailure(new Error('HTTP 429 rate limit exceeded')), true);
  assert.strictEqual(isConnectionFailure(new Error('BLOCKED: Invalid JSON in LLM response')), false);
  assert.strictEqual(isConnectionFailure(new Error('DEEPSEEK_API_KEY is not set in the environment.')), false);
});

test('fallback-adapter - falls back to next provider on connection failure', async () => {
  const adapter = new FallbackAgentAdapter([
    { provider: 'deepseek', create: () => makeAdapter('deepseek', 'connection-error') },
    { provider: 'gemini', create: () => makeAdapter('gemini', 'ok') }
  ]);

  const config = { ...DEFAULT_CONFIG, provider: 'deepseek' as const, model: 'deepseek-v4-flash' };
  const plan = await adapter.plan({ task: 'do something', repoSummary: '', config, skills: [] });

  assert.ok(plan.understanding?.includes('planned by gemini'));
  // Fallback provider gets its own default model, not the primary's
  assert.ok(plan.understanding?.includes('provider gemini'));
  assert.ok(!plan.understanding?.includes('deepseek-v4-flash'));
});

test('fallback-adapter - does NOT fall back on schema/safety errors', async () => {
  let secondCreated = false;
  const adapter = new FallbackAgentAdapter([
    { provider: 'deepseek', create: () => makeAdapter('deepseek', 'schema-error') },
    { provider: 'gemini', create: () => { secondCreated = true; return makeAdapter('gemini', 'ok'); } }
  ]);

  const config = { ...DEFAULT_CONFIG, provider: 'deepseek' as const };
  await assert.rejects(
    () => adapter.plan({ task: 'do something', repoSummary: '', config, skills: [] }),
    /BLOCKED: Invalid JSON/
  );
  assert.strictEqual(secondCreated, false);
});

test('fallback-adapter - throws last error when all providers are down', async () => {
  const adapter = new FallbackAgentAdapter([
    { provider: 'deepseek', create: () => makeAdapter('deepseek', 'connection-error') },
    { provider: 'gemini', create: () => makeAdapter('gemini', 'connection-error') }
  ]);

  const config = { ...DEFAULT_CONFIG, provider: 'deepseek' as const };
  await assert.rejects(
    () => adapter.plan({ task: 'do something', repoSummary: '', config, skills: [] }),
    /ECONNREFUSED/
  );
});

test('fallback-adapter - merges usage across chain instances', async () => {
  const adapter = new FallbackAgentAdapter([
    { provider: 'deepseek', create: () => makeAdapter('deepseek', 'connection-error') },
    { provider: 'gemini', create: () => makeAdapter('gemini', 'ok') }
  ]);

  const config = { ...DEFAULT_CONFIG, provider: 'deepseek' as const };
  await adapter.plan({ task: 'do something', repoSummary: '', config, skills: [] });

  // Both instances were created and each reports 10 tokens
  assert.strictEqual(adapter.usage?.totalTokens, 20);
  assert.ok(adapter.name.includes('deepseek -> gemini'));
});
