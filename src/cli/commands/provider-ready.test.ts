import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { runProviderReady } from './provider-ready';

test('provider-ready - provider none is invalid', async () => {
  const originalExit = process.exit;
  const originalError = console.error;
  let exitCode: number | undefined;

  process.exit = ((code?: number) => {
    exitCode = code;
    return undefined as never;
  }) as any;

  console.error = () => {};

  try {
    await runProviderReady('none');
    assert.strictEqual(exitCode, 1);
  } finally {
    process.exit = originalExit;
    console.error = originalError;
  }
});

test('provider-ready - missing key fails cleanly', async () => {
  const originalExit = process.exit;
  const originalError = console.error;
  const originalApiKey = process.env.GEMINI_API_KEY;

  delete process.env.GEMINI_API_KEY;

  let exitCode: number | undefined;
  process.exit = ((code?: number) => {
    exitCode = code;
    return undefined as never;
  }) as any;

  console.error = () => {};

  try {
    await runProviderReady('gemini', 'gemini-1.5-flash');
    assert.strictEqual(exitCode, 1);
  } finally {
    process.exit = originalExit;
    console.error = originalError;
    if (originalApiKey) {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  }
});

test('provider-ready - mocked gemini readiness check passes', async () => {
  const originalExit = process.exit;
  const originalError = console.error;
  const originalLog = console.log;
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;

  process.env.GEMINI_API_KEY = 'AIzaSyMockKey';

  let exitCode: number | undefined;
  process.exit = ((code?: number) => {
    exitCode = code;
    return undefined as never;
  }) as any;

  console.error = () => {};
  console.log = () => {};

  // Mock global fetch for Gemini ReviewResult response
  globalThis.fetch = (async (url: string, options: any) => {
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    status: 'PASS',
                    findings: ['Smoke test passed from mock Gemini']
                  })
                }
              ]
            }
          }
        ],
        usageMetadata: {
          promptTokenCount: 15,
          candidatesTokenCount: 10,
          totalTokenCount: 25
        }
      })
    };
  }) as any;

  const tempDir = path.join(__dirname, `../../../tmp-ready-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    await runProviderReady('gemini', 'gemini-1.5-flash', tempDir);
    assert.strictEqual(exitCode, 0);

    const jsonPath = path.join(tempDir, '.jewel', 'reports', 'provider-readiness.json');
    const mdPath = path.join(tempDir, '.jewel', 'reports', 'provider-readiness.md');

    assert.ok(fs.existsSync(jsonPath), 'JSON readiness report should exist');
    assert.ok(fs.existsSync(mdPath), 'Markdown readiness report should exist');

    const jsonReport = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.strictEqual(jsonReport.provider, 'gemini');
    assert.strictEqual(jsonReport.model, 'gemini-1.5-flash');
    assert.strictEqual(jsonReport.apiKeyPresent, true);
    assert.strictEqual(jsonReport.supportsStructuredOutput, true);
    assert.strictEqual(jsonReport.smokeTestStatus, 'PASS');
  } finally {
    process.exit = originalExit;
    console.error = originalError;
    console.log = originalLog;
    globalThis.fetch = originalFetch;
    if (originalApiKey) {
      process.env.GEMINI_API_KEY = originalApiKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
});
