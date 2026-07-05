import test from 'node:test';
import assert from 'node:assert';
import { DeepSeekAdapter } from './deepseek-adapter';
import { DEFAULT_CONFIG } from '../../core/config';
import { generateLocalContract } from '../../core/session';

test('deepseek-adapter - plan throws when API key is missing', async () => {
  const originalKey = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;

  try {
    const adapter = new DeepSeekAdapter();
    await assert.rejects(async () => {
      await adapter.plan({
        task: 'Add hello world',
        repoSummary: 'Test repo',
        config: DEFAULT_CONFIG,
        skills: []
      });
    }, /DEEPSEEK_API_KEY is not set in the environment/);
  } finally {
    if (originalKey) {
      process.env.DEEPSEEK_API_KEY = originalKey;
    }
  }
});

test('deepseek-adapter - mocked fetch generates plan with json_object mode', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestHeaders: any = {};
  let requestBody: any = null;

  globalThis.fetch = (async (url: string, options: any) => {
    requestUrl = url;
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
                understanding: 'mock plan from DeepSeek',
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
          prompt_tokens: 120,
          completion_tokens: 60,
          total_tokens: 180
        }
      })
    };
  }) as any;

  process.env.DEEPSEEK_API_KEY = 'deepseek-mock-key';

  try {
    const adapter = new DeepSeekAdapter();
    const config = { ...DEFAULT_CONFIG, provider: 'deepseek' as const, model: 'deepseek-v4-flash' };
    const plan = await adapter.plan({
      task: 'Add hello world',
      repoSummary: 'Test repo',
      config,
      skills: []
    });

    assert.strictEqual(requestUrl, 'https://api.deepseek.com/chat/completions');
    assert.strictEqual(requestHeaders['Authorization'], 'Bearer deepseek-mock-key');
    assert.strictEqual(requestBody.model, 'deepseek-v4-flash');
    assert.deepStrictEqual(requestBody.response_format, { type: 'json_object' });
    assert.strictEqual(plan.understanding, 'mock plan from DeepSeek');
    assert.strictEqual(adapter.usage?.totalTokens, 180);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.DEEPSEEK_API_KEY;
  }
});

test('deepseek-adapter - mocked fetch proposes patch', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => ({
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
      ],
      usage: { prompt_tokens: 150, completion_tokens: 75, total_tokens: 225 }
    })
  })) as any;

  process.env.DEEPSEEK_API_KEY = 'deepseek-mock-key';

  try {
    const adapter = new DeepSeekAdapter();
    const contract = generateLocalContract('task', DEFAULT_CONFIG, ['src/index.ts']);
    const patch = await adapter.proposePatch({
      taskContract: contract,
      allowedFiles: contract.filesLikelyNeeded,
      repoContext: '',
      verificationResult: null
    });

    assert.strictEqual(patch.summary, 'implement greeting');
    assert.strictEqual(patch.files[0]?.filePath, 'src/index.ts');
    assert.strictEqual(adapter.usage?.totalTokens, 225);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.DEEPSEEK_API_KEY;
  }
});

test('deepseek-adapter - generateMilestones returns milestone array', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              milestones: ['Build the API endpoints', 'Build the frontend page', 'Add integration tests']
            })
          }
        }
      ],
      usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 }
    })
  })) as any;

  process.env.DEEPSEEK_API_KEY = 'deepseek-mock-key';

  try {
    const adapter = new DeepSeekAdapter();
    const milestones = await adapter.generateMilestones({ goal: 'todo app', maxMilestones: 8 });
    assert.ok(Array.isArray(milestones));
    assert.strictEqual((milestones as string[]).length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.DEEPSEEK_API_KEY;
  }
});

test('deepseek-adapter - handles http non-200 cleanly', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => ({
    ok: false,
    status: 500,
    text: async () => 'Internal Server Error'
  })) as any;

  process.env.DEEPSEEK_API_KEY = 'deepseek-mock-key';

  try {
    const adapter = new DeepSeekAdapter();
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
    delete process.env.DEEPSEEK_API_KEY;
  }
});
