import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { runSmokeProvider } from './smoke-provider';

test('smoke-provider - provider none is invalid', async () => {
  const originalExit = process.exit;
  const originalError = console.error;
  const originalLog = console.log;

  let exitCode: number | undefined;
  process.exit = ((code?: number) => {
    exitCode = code;
    return undefined as never;
  }) as any;

  let consoleErrors: string[] = [];
  console.error = (...args: any[]) => {
    consoleErrors.push(args.join(' '));
  };
  console.log = () => {};

  try {
    await runSmokeProvider('none');
    assert.strictEqual(exitCode, 1);
    assert.ok(consoleErrors.some(err => err.toLowerCase().includes('provider "none" is invalid')));
  } finally {
    process.exit = originalExit;
    console.error = originalError;
    console.log = originalLog;
  }
});

test('smoke-provider - missing API key fails cleanly', async () => {
  const originalExit = process.exit;
  const originalError = console.error;
  const originalLog = console.log;
  const originalApiKey = process.env.OPENAI_API_KEY;

  delete process.env.OPENAI_API_KEY;

  let exitCode: number | undefined;
  process.exit = ((code?: number) => {
    exitCode = code;
    return undefined as never;
  }) as any;

  let consoleErrors: string[] = [];
  console.error = (...args: any[]) => {
    consoleErrors.push(args.join(' '));
  };
  console.log = () => {};

  try {
    await runSmokeProvider('openai');
    assert.strictEqual(exitCode, 1);
    assert.ok(consoleErrors.some(err => err.includes('Missing API key environment variable "OPENAI_API_KEY"')));
  } finally {
    process.exit = originalExit;
    console.error = originalError;
    console.log = originalLog;
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  }
});

test('smoke-provider - mocked smoke test passes', async () => {
  const originalExit = process.exit;
  const originalError = console.error;
  const originalLog = console.log;
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;

  process.env.OPENAI_API_KEY = 'sk-mock-key';

  let exitCode: number | undefined;
  process.exit = ((code?: number) => {
    exitCode = code;
    return undefined as never;
  }) as any;

  console.error = () => {};
  console.log = () => {};

  // Mock global fetch for OpenAI ReviewResult format
  globalThis.fetch = (async (url: string, options: any) => {
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                status: 'PASS',
                findings: ['Smoke test passed from mock OpenAI']
              })
            }
          }
        ],
        usage: {
          prompt_tokens: 42,
          completion_tokens: 12,
          total_tokens: 54
        }
      })
    };
  }) as any;

  const tempDir = path.join(__dirname, `../../../tmp-smoke-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    await runSmokeProvider('openai', 'gpt-4o-mini', true, false, tempDir);
    assert.strictEqual(exitCode, 0);

    // Verify report was written
    const jsonPath = path.join(tempDir, '.jewel', 'reports', 'provider-smoke.json');
    const mdPath = path.join(tempDir, '.jewel', 'reports', 'provider-smoke.md');

    assert.ok(fs.existsSync(jsonPath), 'JSON report should exist');
    assert.ok(fs.existsSync(mdPath), 'Markdown report should exist');

    const jsonReport = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert.strictEqual(jsonReport.provider, 'openai');
    assert.strictEqual(jsonReport.schemaMode, true);
    assert.strictEqual(jsonReport.status, 'PASS');
    assert.strictEqual(jsonReport.usage.totalTokens, 54);
  } finally {
    process.exit = originalExit;
    console.error = originalError;
    console.log = originalLog;
    globalThis.fetch = originalFetch;
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
});

test('smoke-provider - no-write flag skips writing report', async () => {
  const originalExit = process.exit;
  const originalError = console.error;
  const originalLog = console.log;
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;

  process.env.OPENAI_API_KEY = 'sk-mock-key';

  let exitCode: number | undefined;
  process.exit = ((code?: number) => {
    exitCode = code;
    return undefined as never;
  }) as any;

  console.error = () => {};
  console.log = () => {};

  globalThis.fetch = (async (url: string, options: any) => {
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                status: 'PASS',
                findings: ['Smoke test passed from mock OpenAI']
              })
            }
          }
        ]
      })
    };
  }) as any;

  const tempDir = path.join(__dirname, `../../../tmp-smoke-nowrite-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    await runSmokeProvider('openai', 'gpt-4o-mini', true, true, tempDir);
    assert.strictEqual(exitCode, 0);

    const jsonPath = path.join(tempDir, '.jewel', 'reports', 'provider-smoke.json');
    assert.ok(!fs.existsSync(jsonPath), 'JSON report should NOT exist when no-write is enabled');
  } finally {
    process.exit = originalExit;
    console.error = originalError;
    console.log = originalLog;
    globalThis.fetch = originalFetch;
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
});
