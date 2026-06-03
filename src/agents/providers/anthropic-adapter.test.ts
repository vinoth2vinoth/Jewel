import test from 'node:test';
import assert from 'node:assert';
import { AnthropicAdapter } from './anthropic-adapter';
import { DEFAULT_CONFIG } from '../../core/config';
import { generateLocalContract } from '../../core/session';

test('anthropic-adapter - plan throws when API key is missing', async () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  try {
    const adapter = new AnthropicAdapter();
    await assert.rejects(async () => {
      await adapter.plan({
        task: 'Add hello world',
        repoSummary: 'Test repo',
        config: DEFAULT_CONFIG,
        skills: []
      });
    }, /ANTHROPIC_API_KEY is not set in the environment/);
  } finally {
    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  }
});

test('anthropic-adapter - mocked fetch successfully generates plan', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  let requestHeaders: any = {};
  let requestBody: any = null;

  globalThis.fetch = (async (url: string, options: any) => {
    fetchCalled = true;
    requestHeaders = options.headers;
    requestBody = JSON.parse(options.body);

    return {
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              task: 'Add hello world',
              understanding: 'mock plan from Anthropic',
              assumptions: ['none'],
              filesLikelyNeeded: ['src/index.ts'],
              forbiddenActions: ['none'],
              successCriteria: ['compile'],
              riskLevel: 'low',
              requiresApproval: false,
              createdAt: new Date().toISOString(),
              mode: 'strict'
            })
          }
        ],
        usage: {
          input_tokens: 150,
          output_tokens: 75
        }
      })
    };
  }) as any;

  process.env.ANTHROPIC_API_KEY = 'anthropic-mock-key';

  try {
    const adapter = new AnthropicAdapter();
    const config = { ...DEFAULT_CONFIG, provider: 'anthropic' as const };
    const plan = await adapter.plan({
      task: 'Add hello world',
      repoSummary: 'Test repo',
      config,
      skills: []
    });

    assert.ok(fetchCalled);
    assert.strictEqual(requestHeaders['x-api-key'], 'anthropic-mock-key');
    assert.strictEqual(requestHeaders['anthropic-version'], '2023-06-01');
    assert.strictEqual(plan.understanding, 'mock plan from Anthropic');
    assert.strictEqual(adapter.usage?.totalTokens, 225);

  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.ANTHROPIC_API_KEY;
  }
});

test('anthropic-adapter - mocked fetch successfully proposes patch', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = (async (url: string, options: any) => {
    fetchCalled = true;
    return {
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'implement greeting',
              files: [
                {
                  filePath: 'src/index.ts',
                  content: 'console.log("hello");',
                  reason: 'initial endpoint'
                }
              ],
              notes: ['no notes'],
              riskLevel: 'low'
            })
          }
        ],
        usage: {
          input_tokens: 200,
          output_tokens: 100
        }
      })
    };
  }) as any;

  process.env.ANTHROPIC_API_KEY = 'anthropic-mock-key';

  try {
    const adapter = new AnthropicAdapter();
    const contract = generateLocalContract('task', DEFAULT_CONFIG, ['src/index.ts']);
    const patch = await adapter.proposePatch({
      taskContract: contract,
      allowedFiles: contract.filesLikelyNeeded,
      repoContext: '',
      verificationResult: null
    });

    assert.ok(fetchCalled);
    assert.strictEqual(patch.summary, 'implement greeting');
    assert.strictEqual(patch.files[0].filePath, 'src/index.ts');
    assert.strictEqual(patch.files[0].content, 'console.log("hello");');
    assert.strictEqual(adapter.usage?.totalTokens, 300);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.ANTHROPIC_API_KEY;
  }
});

test('anthropic-adapter - handles http non-200 cleanly', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string, options: any) => {
    return {
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    };
  }) as any;

  process.env.ANTHROPIC_API_KEY = 'anthropic-mock-key';

  try {
    const adapter = new AnthropicAdapter();
    await assert.rejects(async () => {
      await adapter.plan({
        task: 'Add hello world',
        repoSummary: 'Test repo',
        config: DEFAULT_CONFIG,
        skills: []
      });
    }, /FAIL: LLM request failed/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.ANTHROPIC_API_KEY;
  }
});

test('anthropic-adapter - handles timeout cleanly', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string, options: any) => {
    const err = new Error('The user aborted a request.');
    err.name = 'AbortError';
    throw err;
  }) as any;

  process.env.ANTHROPIC_API_KEY = 'anthropic-mock-key';

  try {
    const adapter = new AnthropicAdapter();
    await assert.rejects(async () => {
      await adapter.plan({
        task: 'Add hello world',
        repoSummary: 'Test repo',
        config: { ...DEFAULT_CONFIG, llmTimeoutMs: 1 },
        skills: []
      });
    }, /timed out/);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.ANTHROPIC_API_KEY;
  }
});
