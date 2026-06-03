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

test('provider-ready - missing key fails cleanly and writes report', async () => {
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

  const tempDir = path.join(__dirname, `../../../tmp-ready-missing-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    await runProviderReady('gemini', 'gemini-2.5-flash', tempDir);
    assert.strictEqual(exitCode, 1);

    const jsonPath = path.join(tempDir, '.jewel', 'reports', 'provider-ready.json');
    const mdPath = path.join(tempDir, '.jewel', 'reports', 'provider-ready.md');

    assert.ok(fs.existsSync(jsonPath), 'JSON readiness report should exist even on missing key');
    assert.ok(fs.existsSync(mdPath), 'Markdown readiness report should exist even on missing key');

    const jsonReport = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.strictEqual(jsonReport.provider, 'gemini');
    assert.strictEqual(jsonReport.model, 'gemini-2.5-flash');
    assert.strictEqual(jsonReport.apiKeyPresent, 'No');
    assert.strictEqual(jsonReport.smokeResult, 'FAIL');
    assert.ok(jsonReport.nextAction.includes('Set the GEMINI_API_KEY'));
  } finally {
    process.exit = originalExit;
    console.error = originalError;
    if (originalApiKey) {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
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

  // Mock global fetch for Gemini response
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

  const tempDir = path.join(__dirname, `../../../tmp-ready-gemini-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    await runProviderReady('gemini', 'gemini-2.5-flash', tempDir);
    assert.strictEqual(exitCode, 0);

    const jsonPath = path.join(tempDir, '.jewel', 'reports', 'provider-ready.json');
    const mdPath = path.join(tempDir, '.jewel', 'reports', 'provider-ready.md');

    assert.ok(fs.existsSync(jsonPath), 'JSON readiness report should exist');
    assert.ok(fs.existsSync(mdPath), 'Markdown readiness report should exist');

    const jsonReport = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.strictEqual(jsonReport.provider, 'gemini');
    assert.strictEqual(jsonReport.model, 'gemini-2.5-flash');
    assert.strictEqual(jsonReport.apiKeyPresent, 'Yes');
    assert.strictEqual(jsonReport.structuredOutputSupported, 'Yes');
    assert.strictEqual(jsonReport.smokeResult, 'PASS');
    assert.strictEqual(jsonReport.retryCount, 0);
    assert.ok(jsonReport.usage !== null);
    assert.strictEqual(jsonReport.usage.totalTokens, 25);
    assert.strictEqual(jsonReport.redactionStatus, 'COMPLIANT');
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

test('provider-ready - mocked openrouter readiness check passes', async () => {
  const originalExit = process.exit;
  const originalError = console.error;
  const originalLog = console.log;
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENROUTER_API_KEY;

  process.env.OPENROUTER_API_KEY = 'sk-or-v1-MockKey';

  let exitCode: number | undefined;
  process.exit = ((code?: number) => {
    exitCode = code;
    return undefined as never;
  }) as any;

  console.error = () => {};
  console.log = () => {};

  // Mock global fetch for OpenRouter response
  globalThis.fetch = (async (url: string, options: any) => {
    // Assert response_format is included
    const bodyObj = JSON.parse(options.body);
    assert.strictEqual(bodyObj.response_format?.type, 'json_schema');

    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: 'PASS',
                findings: ['Smoke test passed from mock OpenRouter']
              })
            }
          }
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 15,
          total_tokens: 35
        }
      })
    };
  }) as any;

  const tempDir = path.join(__dirname, `../../../tmp-ready-openrouter-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    await runProviderReady('openrouter', 'openai/gpt-4o-mini', tempDir);
    assert.strictEqual(exitCode, 0);

    const jsonPath = path.join(tempDir, '.jewel', 'reports', 'provider-ready.json');
    const jsonReport = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.strictEqual(jsonReport.provider, 'openrouter');
    assert.strictEqual(jsonReport.model, 'openai/gpt-4o-mini');
    assert.strictEqual(jsonReport.apiKeyPresent, 'Yes');
    assert.strictEqual(jsonReport.structuredOutputSupported, 'Yes');
    assert.strictEqual(jsonReport.smokeResult, 'PASS');
    assert.strictEqual(jsonReport.usage.totalTokens, 35);
  } finally {
    process.exit = originalExit;
    console.error = originalError;
    console.log = originalLog;
    globalThis.fetch = originalFetch;
    if (originalApiKey) {
      process.env.OPENROUTER_API_KEY = originalApiKey;
    } else {
      delete process.env.OPENROUTER_API_KEY;
    }

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
});
