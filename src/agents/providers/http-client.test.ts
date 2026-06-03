import test from 'node:test';
import assert from 'node:assert';
import { postJsonWithRetry } from './http-client';

test('http-client - 429 status code retries and succeeds on next attempt', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = (async (url: string, options: any) => {
    callCount++;
    if (callCount === 1) {
      return {
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    };
  }) as any;

  try {
    const tracker = { count: 0 };
    const res = await postJsonWithRetry('https://api.test.com', {
      headers: {},
      body: {},
      timeoutMs: 1000,
      maxRetries: 2,
      providerName: 'test',
      methodName: 'testMethod',
      retryTracker: tracker
    });

    assert.strictEqual(callCount, 2);
    assert.strictEqual(tracker.count, 1);
    assert.deepStrictEqual(res, { success: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('http-client - 500 status code retries and fails after maxRetries', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = (async (url: string, options: any) => {
    callCount++;
    return {
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    };
  }) as any;

  try {
    const tracker = { count: 0 };
    await assert.rejects(
      postJsonWithRetry('https://api.test.com', {
        headers: {},
        body: {},
        timeoutMs: 1000,
        maxRetries: 2,
        providerName: 'test',
        methodName: 'testMethod',
        retryTracker: tracker
      }),
      /Error: FAIL: LLM request failed after 3 attempts/
    );

    assert.strictEqual(callCount, 3); // initial + 2 retries
    assert.strictEqual(tracker.count, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('http-client - 401 status code does not retry and fails immediately', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = (async (url: string, options: any) => {
    callCount++;
    return {
      ok: false,
      status: 401,
      text: async () => 'Unauthorized'
    };
  }) as any;

  try {
    const tracker = { count: 0 };
    await assert.rejects(
      postJsonWithRetry('https://api.test.com', {
        headers: {},
        body: { secret: 'secret-key-12345' },
        timeoutMs: 1000,
        maxRetries: 2,
        providerName: 'test',
        methodName: 'testMethod',
        retryTracker: tracker
      }),
      /Non-retryable error/
    );

    assert.strictEqual(callCount, 1);
    assert.strictEqual(tracker.count, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('http-client - secrets are redacted from error outputs', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (url: string, options: any) => {
    return {
      ok: false,
      status: 400,
      text: async () => 'Bad Request containing OpenAI API key sk-proj-12345678901234567890'
    };
  }) as any;

  try {
    await assert.rejects(
      postJsonWithRetry('https://api.test.com', {
        headers: {},
        body: {},
        timeoutMs: 1000,
        maxRetries: 1,
        providerName: 'test',
        methodName: 'testMethod'
      }),
      (err: Error) => {
        assert.ok(!err.message.includes('sk-proj-12345678901234567890'));
        assert.ok(err.message.includes('[REDACTED'));
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
