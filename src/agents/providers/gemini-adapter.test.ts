import test from 'node:test';
import assert from 'node:assert';
import { GeminiAdapter } from './gemini-adapter';
import { DEFAULT_CONFIG } from '../../core/config';
import { generateLocalContract } from '../../core/session';

test('gemini-adapter - plan throws when API key is missing', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    const adapter = new GeminiAdapter();
    await assert.rejects(async () => {
      await adapter.plan({
        task: 'Add hello world',
        repoSummary: 'Test repo',
        config: DEFAULT_CONFIG,
        skills: []
      });
    }, /GEMINI_API_KEY is not set in the environment/);
  } finally {
    if (originalKey) {
      process.env.GEMINI_API_KEY = originalKey;
    }
  }
});

test('gemini-adapter - mocked fetch successfully generates plan', async () => {
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
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    task: 'Add hello world',
                    understanding: 'mock plan from Gemini',
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
              ]
            }
          }
        ],
        usageMetadata: {
          promptTokenCount: 120,
          candidatesTokenCount: 60,
          totalTokenCount: 180
        }
      })
    };
  }) as any;

  process.env.GEMINI_API_KEY = 'ai-mock-key';

  try {
    const adapter = new GeminiAdapter();
    const config = { ...DEFAULT_CONFIG, provider: 'gemini' as const };
    const plan = await adapter.plan({
      task: 'Add hello world',
      repoSummary: 'Test repo',
      config,
      skills: []
    });

    assert.ok(fetchCalled);
    assert.strictEqual(requestHeaders['x-goog-api-key'], 'ai-mock-key');
    assert.strictEqual(plan.understanding, 'mock plan from Gemini');
    assert.strictEqual(adapter.usage?.totalTokens, 180);

  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
  }
});

test('gemini-adapter - mocked fetch successfully proposes patch', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = (async (url: string, options: any) => {
    fetchCalled = true;
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
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
              ]
            }
          }
        ],
        usageMetadata: {
          promptTokenCount: 150,
          candidatesTokenCount: 90,
          totalTokenCount: 240
        }
      })
    };
  }) as any;

  process.env.GEMINI_API_KEY = 'ai-mock-key';

  try {
    const adapter = new GeminiAdapter();
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
    assert.strictEqual(adapter.usage?.totalTokens, 240);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
  }
});

test('gemini-adapter - handles http non-200 cleanly', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string, options: any) => {
    return {
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    };
  }) as any;

  process.env.GEMINI_API_KEY = 'ai-mock-key';

  try {
    const adapter = new GeminiAdapter();
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
    delete process.env.GEMINI_API_KEY;
  }
});

test('gemini-adapter - handles timeout cleanly', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string, options: any) => {
    const err = new Error('The user aborted a request.');
    err.name = 'AbortError';
    throw err;
  }) as any;

  process.env.GEMINI_API_KEY = 'ai-mock-key';

  try {
    const adapter = new GeminiAdapter();
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
    delete process.env.GEMINI_API_KEY;
  }
});

test('gemini-adapter - request includes JSON schema config', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: any = null;

  globalThis.fetch = (async (url: string, options: any) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
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
            }]
          }
        }]
      })
    };
  }) as any;

  process.env.GEMINI_API_KEY = 'ai-mock-key';

  try {
    const adapter = new GeminiAdapter();
    const config = { ...DEFAULT_CONFIG, provider: 'gemini' as const, model: 'gemini-1.5-flash' };
    await adapter.plan({
      task: 'task',
      repoSummary: 'summary',
      config,
      skills: []
    });

    assert.ok(requestBody);
    assert.strictEqual(requestBody.generationConfig?.responseMimeType, 'application/json');
    assert.ok(requestBody.generationConfig?.responseSchema);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
  }
});

test('gemini-adapter - blocks unsupported models by default', async () => {
  process.env.GEMINI_API_KEY = 'ai-mock-key';
  try {
    const adapter = new GeminiAdapter();
    // Default config has allowUnstructuredProviderFallback = false
    const config = { ...DEFAULT_CONFIG, provider: 'gemini' as const, model: 'unknown-gemini-model' };
    
    await assert.rejects(async () => {
      await adapter.plan({
        task: 'task',
        repoSummary: 'summary',
        config,
        skills: []
      });
    }, /does not support structured output, and allowUnstructuredProviderFallback is false/);
  } finally {
    delete process.env.GEMINI_API_KEY;
  }
});

