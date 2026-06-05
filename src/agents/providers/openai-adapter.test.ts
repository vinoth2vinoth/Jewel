import test from 'node:test';
import assert from 'node:assert';
import { OpenAIAdapter } from './openai-adapter';
import { DEFAULT_CONFIG } from '../../core/config';
import { generateLocalContract } from '../../core/session';

test('openai-adapter - plan throws when API key is missing', async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const adapter = new OpenAIAdapter();
    await assert.rejects(async () => {
      await adapter.plan({
        task: 'Add hello world',
        repoSummary: 'Test repo',
        config: DEFAULT_CONFIG,
        skills: []
      });
    }, /OPENAI_API_KEY is not set in the environment/);
  } finally {
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
});

test('openai-adapter - mocked fetch successfully generates plan', async () => {
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
        choices: [
          {
            message: {
              content: JSON.stringify({
                task: 'Add hello world',
                understanding: 'mock plan from OpenAI',
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
          }
        ]
      })
    };
  }) as any;

  process.env.OPENAI_API_KEY = 'sk-mock-key-12345678901234567890';

  try {
    const adapter = new OpenAIAdapter();
    const config = { ...DEFAULT_CONFIG, provider: 'openai' as const };
    const plan = await adapter.plan({
      task: 'Add hello world',
      repoSummary: 'Test repo',
      config,
      skills: []
    });

    assert.ok(fetchCalled);
    assert.strictEqual(requestHeaders['Authorization'], 'Bearer sk-mock-key-12345678901234567890');
    assert.strictEqual(requestBody.model, 'gpt-4o-mini');
    assert.strictEqual(plan.understanding, 'mock plan from OpenAI');

  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

test('openai-adapter - mocked fetch successfully proposes patch', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = (async (url: string, options: any) => {
    fetchCalled = true;
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
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
          }
        ]
      })
    };
  }) as any;

  process.env.OPENAI_API_KEY = 'sk-mock-key-12345678901234567890';

  try {
    const adapter = new OpenAIAdapter();
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
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

test('openai-adapter - handles http non-200 cleanly', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string, options: any) => {
    return {
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    };
  }) as any;

  process.env.OPENAI_API_KEY = 'sk-mock-key-12345678901234567890';

  try {
    const adapter = new OpenAIAdapter();
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
    delete process.env.OPENAI_API_KEY;
  }
});

test('openai-adapter - request includes json_schema response format', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: any = null;

  globalThis.fetch = (async (url: string, options: any) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              task: 'task',
              understanding: 'plan',
              assumptions: [],
              filesLikelyNeeded: ['src/index.ts'],
              forbiddenActions: [],
              successCriteria: ['compile'],
              riskLevel: 'low',
              requiresApproval: false,
              createdAt: new Date().toISOString(),
              mode: 'strict'
            })
          }
        }]
      })
    };
  }) as any;

  process.env.OPENAI_API_KEY = 'sk-mock-key';

  try {
    const adapter = new OpenAIAdapter();
    const config = { ...DEFAULT_CONFIG, provider: 'openai' as const, model: 'gpt-4o' };
    await adapter.plan({
      task: 'task',
      repoSummary: 'summary',
      config,
      skills: []
    });

    assert.ok(requestBody);
    assert.strictEqual(requestBody.response_format?.type, 'json_schema');
    assert.strictEqual(requestBody.response_format?.json_schema?.name, 'TaskContract');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

test('openai-adapter - blocks unsupported models by default', async () => {
  process.env.OPENAI_API_KEY = 'sk-mock-key';
  try {
    const adapter = new OpenAIAdapter();
    // Default config has allowUnstructuredProviderFallback = false
    const config = { ...DEFAULT_CONFIG, provider: 'openai' as const, model: 'gpt-3.5-turbo' };
    
    await assert.rejects(async () => {
      await adapter.plan({
        task: 'task',
        repoSummary: 'summary',
        config,
        skills: []
      });
    }, /does not support structured output, and allowUnstructuredProviderFallback is false/);
  } finally {
    delete process.env.OPENAI_API_KEY;
  }
});

test('openai-adapter - permits unsupported models when fallback is allowed', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = (async (url: string, options: any) => {
    fetchCalled = true;
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              task: 'task',
              understanding: 'plan',
              assumptions: [],
              filesLikelyNeeded: ['src/index.ts'],
              forbiddenActions: [],
              successCriteria: ['compile'],
              riskLevel: 'low',
              requiresApproval: false,
              createdAt: new Date().toISOString(),
              mode: 'strict'
            })
          }
        }]
      })
    };
  }) as any;

  process.env.OPENAI_API_KEY = 'sk-mock-key';

  try {
    const adapter = new OpenAIAdapter();
    const config = {
      ...DEFAULT_CONFIG,
      provider: 'openai' as const,
      model: 'gpt-3.5-turbo',
      allowUnstructuredProviderFallback: true
    };
    
    await adapter.plan({
      task: 'task',
      repoSummary: 'summary',
      config,
      skills: []
    });

    assert.ok(fetchCalled);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

test('openai-adapter - throws error when maxSessionCost is exceeded', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  globalThis.fetch = (async (url: string, options: any) => {
    fetchCount++;
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                task: 'Add hello world',
                understanding: 'mock plan from OpenAI',
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
          }
        ],
        usage: {
          prompt_tokens: 1000000,
          completion_tokens: 1000000,
          total_tokens: 2000000
        }
      })
    };
  }) as any;

  process.env.OPENAI_API_KEY = 'sk-mock-key';

  try {
    const adapter = new OpenAIAdapter();
    const config = { ...DEFAULT_CONFIG, provider: 'openai' as const, maxSessionCost: 0.50 };
    
    await assert.rejects(async () => {
      await adapter.plan({
        task: 'Add hello world',
        repoSummary: 'Test repo',
        config,
        skills: []
      });
    }, /\[Jewel Budget Guard\] Session cost limit exceeded/);

    assert.strictEqual(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  }
});

