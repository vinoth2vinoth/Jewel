import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { runDoctor } from './doctor';

const sandboxDir = path.join(__dirname, '../../../sandbox-test-doctor');

test('doctor checks - execution with mock exit', () => {
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
  fs.mkdirSync(sandboxDir, { recursive: true });

  const originalExit = process.exit;
  let exitCode: number | undefined;
  (process as any).exit = (code?: number) => {
    exitCode = code;
  };

  try {
    runDoctor(sandboxDir);
    assert.ok(exitCode === 0 || exitCode === 1);
  } finally {
    process.exit = originalExit;
    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  }
});

test('doctor checks - provider-specific API key warnings', () => {
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
  fs.mkdirSync(sandboxDir, { recursive: true });

  const originalExit = process.exit;
  (process as any).exit = (code?: number) => {};

  const originalLog = console.log;
  const originalWarn = console.warn;

  try {
    const runDoctorWithProvider = (provider: string, envVal?: string, envKey?: string) => {
      const logs: string[] = [];
      console.log = (...args: any[]) => logs.push(args.join(' '));
      console.warn = (...args: any[]) => logs.push(args.join(' '));

      const oldEnv = envKey ? process.env[envKey] : undefined;
      if (envKey) {
        if (envVal !== undefined) {
          process.env[envKey] = envVal;
        } else {
          delete process.env[envKey];
        }
      }

      const config = { provider };
      fs.writeFileSync(path.join(sandboxDir, 'jewel.config.json'), JSON.stringify(config, null, 2), 'utf8');

      runDoctor(sandboxDir);

      if (envKey) {
        if (oldEnv !== undefined) {
          process.env[envKey] = oldEnv;
        } else {
          delete process.env[envKey];
        }
      }

      return logs.join('\n');
    };

    // 1. None provider
    const logNone = runDoctorWithProvider('none');
    assert.ok(logNone.includes('set to "none"'));
    assert.ok(!logNone.includes('missing from environment'));

    // 2. OpenAI provider - missing key
    const logOpenAiMissing = runDoctorWithProvider('openai', undefined, 'OPENAI_API_KEY');
    assert.ok(logOpenAiMissing.includes('OPENAI_API_KEY is missing'));

    // 3. OpenAI provider - present key
    const logOpenAiPresent = runDoctorWithProvider('openai', 'sk-test', 'OPENAI_API_KEY');
    assert.ok(logOpenAiPresent.includes('OPENAI_API_KEY present'));

    // 4. Anthropic provider - missing key
    const logAnthropicMissing = runDoctorWithProvider('anthropic', undefined, 'ANTHROPIC_API_KEY');
    assert.ok(logAnthropicMissing.includes('ANTHROPIC_API_KEY is missing'));

    // 5. Gemini provider - missing key
    const logGeminiMissing = runDoctorWithProvider('gemini', undefined, 'GEMINI_API_KEY');
    assert.ok(logGeminiMissing.includes('GEMINI_API_KEY is missing'));

    // 6. OpenRouter provider - missing key
    const logOpenrouterMissing = runDoctorWithProvider('openrouter', undefined, 'OPENROUTER_API_KEY');
    assert.ok(logOpenrouterMissing.includes('OPENROUTER_API_KEY is missing'));

  } finally {
    process.exit = originalExit;
    console.log = originalLog;
    console.warn = originalWarn;
    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  }
});
