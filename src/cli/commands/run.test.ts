import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { runTask } from './run';

function createTempWorkspace(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-run-test-'));
  
  // Initialize Git repo
  execSync('git init', { cwd: tempDir, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' });
  
  // Write a basic package.json
  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      scripts: {
        test: 'echo "tests pass"'
      }
    }, null, 2),
    'utf8'
  );

  // Write .gitignore to prevent git clean from deleting report outputs
  fs.writeFileSync(path.join(tempDir, '.gitignore'), '.jewel\nnode_modules\ndist\n', 'utf8');
  
  execSync('git add package.json .gitignore', { cwd: tempDir, stdio: 'ignore' });
  execSync('git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

  // Write jewel.config.json
  fs.writeFileSync(
    path.join(tempDir, 'jewel.config.json'),
    JSON.stringify({
      projectName: 'test-project',
      mode: 'strict',
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0,
      maxOutputTokens: 4000,
      llmTimeoutMs: 60000,
      llmMaxRetries: 1,
      llmStrictJson: true,
      commands: {
        test: 'npm run test'
      },
      requireHumanDiffApproval: false,
      requireVerificationBeforeDone: false
    }, null, 2),
    'utf8'
  );

  return tempDir;
}

function cleanupWorkspace(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

test('run command - OpenAI integration safe patch writes successfully', async () => {
  const tempDir = createTempWorkspace();
  const originalExit = process.exit;
  const originalFetch = globalThis.fetch;
  
  let exitCode: number | null = null;
  process.exit = ((code?: number) => {
    exitCode = code !== undefined ? code : 0;
    throw new Error(`exit-${exitCode}`);
  }) as any;

  // Mock fetch to simulate plan and patch
  globalThis.fetch = (async (url: string, options: any) => {
    const body = JSON.parse(options.body);
    const lastMessage = body.messages[body.messages.length - 1].content;

    if (lastMessage.includes('TaskContract')) {
      // Return a valid plan
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                task: 'Fix math',
                understanding: 'math plan',
                assumptions: [],
                filesLikelyNeeded: ['math.js'],
                forbiddenActions: [],
                successCriteria: ['compile'],
                riskLevel: 'low',
                requiresApproval: false,
                createdAt: new Date().toISOString(),
                mode: 'lax'
              })
            }
          }]
        })
      };
    } else {
      // Return a valid safe patch
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: 'safe patch',
                files: [{ filePath: 'math.js', content: 'console.log("math content");', reason: 'math content reason' }],
                notes: [],
                riskLevel: 'low'
              })
            }
          }]
        })
      };
    }
  }) as any;

  process.env.OPENAI_API_KEY = 'sk-mock-key-12345678901234567890';

  try {
    try {
      await runTask('Fix math', ['math.js'], false, tempDir, true, true, true);
    } catch (err: any) {
      if (!err.message.includes('exit-0')) {
        throw err;
      }
    }

    assert.strictEqual(exitCode, 0);
    assert.strictEqual(fs.readFileSync(path.join(tempDir, 'math.js'), 'utf8'), 'console.log("math content");');

    // Verify report details
    const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
    assert.ok(fs.existsSync(reportPath));
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.strictEqual(report.provider, 'openai');
    assert.strictEqual(report.model, 'gpt-4o-mini');
    assert.strictEqual(report.status, 'PASS');

    // Confirm no API key is written in the report
    const rawReportContent = fs.readFileSync(reportPath, 'utf8');
    assert.ok(!rawReportContent.includes('sk-mock-key'));

  } finally {
    process.exit = originalExit;
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
    cleanupWorkspace(tempDir);
  }
});

test('run command - OpenAI integration blocked for parent traversal', async () => {
  const tempDir = createTempWorkspace();
  const originalExit = process.exit;
  const originalFetch = globalThis.fetch;
  
  let exitCode: number | null = null;
  process.exit = ((code?: number) => {
    exitCode = code !== undefined ? code : 0;
    throw new Error(`exit-${exitCode}`);
  }) as any;

  globalThis.fetch = (async (url: string, options: any) => {
    const body = JSON.parse(options.body);
    const lastMessage = body.messages[body.messages.length - 1].content;

    if (lastMessage.includes('TaskContract')) {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                task: 'Unsafe traversal task',
                understanding: 'math plan',
                assumptions: [],
                filesLikelyNeeded: ['math.js'],
                forbiddenActions: [],
                successCriteria: ['compile'],
                riskLevel: 'low',
                requiresApproval: false,
                createdAt: new Date().toISOString(),
                mode: 'lax'
              })
            }
          }]
        })
      };
    } else {
      // Propose traversal path
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: 'unsafe patch',
                files: [{ filePath: '../outside.txt', content: 'hack content', reason: 'exploit' }],
                notes: [],
                riskLevel: 'low'
              })
            }
          }]
        })
      };
    }
  }) as any;

  process.env.OPENAI_API_KEY = 'sk-mock-key-12345678901234567890';

  try {
    try {
      await runTask('Unsafe traversal task', ['math.js'], false, tempDir, true, true, true);
    } catch (err: any) {
      if (!err.message.includes('exit-1')) {
        throw err;
      }
    }

    assert.strictEqual(exitCode, 1);
    assert.ok(!fs.existsSync(path.join(tempDir, '../outside.txt')));

    const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
    assert.ok(fs.existsSync(reportPath));
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.strictEqual(report.status, 'BLOCKED');

  } finally {
    process.exit = originalExit;
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
    cleanupWorkspace(tempDir);
  }
});

test('run command - OpenAI integration blocked for absolute path', async () => {
  const tempDir = createTempWorkspace();
  const originalExit = process.exit;
  const originalFetch = globalThis.fetch;
  
  let exitCode: number | null = null;
  process.exit = ((code?: number) => {
    exitCode = code !== undefined ? code : 0;
    throw new Error(`exit-${exitCode}`);
  }) as any;

  globalThis.fetch = (async (url: string, options: any) => {
    const body = JSON.parse(options.body);
    const lastMessage = body.messages[body.messages.length - 1].content;

    if (lastMessage.includes('TaskContract')) {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                task: 'Unsafe absolute task',
                understanding: 'math plan',
                assumptions: [],
                filesLikelyNeeded: ['math.js'],
                forbiddenActions: [],
                successCriteria: ['compile'],
                riskLevel: 'low',
                requiresApproval: false,
                createdAt: new Date().toISOString(),
                mode: 'lax'
              })
            }
          }]
        })
      };
    } else {
      // Propose Windows drive absolute path
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: 'unsafe patch',
                files: [{ filePath: 'C:\\Users\\test\\outside.txt', content: 'hack content', reason: 'exploit' }],
                notes: [],
                riskLevel: 'low'
              })
            }
          }]
        })
      };
    }
  }) as any;

  process.env.OPENAI_API_KEY = 'sk-mock-key-12345678901234567890';

  try {
    try {
      await runTask('Unsafe absolute task', ['math.js'], false, tempDir, true, true, true);
    } catch (err: any) {
      if (!err.message.includes('exit-1')) {
        throw err;
      }
    }

    assert.strictEqual(exitCode, 1);

    const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
    assert.ok(fs.existsSync(reportPath));
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.strictEqual(report.status, 'BLOCKED');

  } finally {
    process.exit = originalExit;
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
    cleanupWorkspace(tempDir);
  }
});

test('run command - CLI provider overrides and validation', async () => {
  const tempDir = createTempWorkspace();
  const originalExit = process.exit;
  const originalFetch = globalThis.fetch;
  
  let exitCode: number | null = null;
  process.exit = ((code?: number) => {
    exitCode = code !== undefined ? code : 0;
    throw new Error(`exit-${exitCode}`);
  }) as any;

  // 1. Invalid provider override exits immediately before checkpoint
  try {
    await runTask('Test invalid provider', [], false, tempDir, true, true, true, { provider: 'invalid-provider' });
  } catch (err: any) {
    assert.ok(err.message.includes('exit-1'));
  }
  assert.strictEqual(exitCode, 1);
  // Verify no session folder exists
  const sessionsDir = path.join(tempDir, '.jewel', 'sessions');
  assert.ok(!fs.existsSync(sessionsDir));

  // Reset exitCode
  exitCode = null;

  // Mock fetch for planning/patching
  globalThis.fetch = (async (url: string, options: any) => {
    const body = JSON.parse(options.body);
    const lastMessage = body.messages[body.messages.length - 1].content;

    if (lastMessage.includes('TaskContract')) {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                task: 'Override test',
                understanding: 'override plan',
                assumptions: [],
                filesLikelyNeeded: ['math.js'],
                forbiddenActions: [],
                successCriteria: ['compile'],
                riskLevel: 'low',
                requiresApproval: false,
                createdAt: new Date().toISOString(),
                mode: 'lax'
              })
            }
          }],
          usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 }
        })
      };
    } else {
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: 'override patch',
                files: [{ filePath: 'math.js', content: 'console.log("override");', reason: 'override' }],
                notes: [],
                riskLevel: 'low'
              })
            }
          }],
          usage: { prompt_tokens: 60, completion_tokens: 30, total_tokens: 90 }
        })
      };
    }
  }) as any;

  process.env.OPENAI_API_KEY = 'sk-mock-key-12345678901234567890';

  try {
    // 2. OpenAI provider override executes successfully
    try {
      await runTask('Override test', ['math.js'], false, tempDir, true, true, true, {
        provider: 'openai',
        model: 'gpt-4-custom',
        temperature: 0.1,
        maxOutputTokens: 2500
      });
    } catch (err: any) {
      if (!err.message.includes('exit-0')) throw err;
    }

    assert.strictEqual(exitCode, 0);
    const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
    assert.ok(fs.existsSync(reportPath));
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.strictEqual(report.provider, 'openai');
    assert.strictEqual(report.model, 'gpt-4-custom');
    assert.strictEqual(report.status, 'PASS');
    assert.strictEqual(report.usage.totalTokens, 165); // 75 + 90
  } finally {
    process.exit = originalExit;
    globalThis.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
    cleanupWorkspace(tempDir);
  }
});

test('run command - Gemini integration safe patch and unsafe blocking', async () => {
  const tempDir = createTempWorkspace();
  const originalExit = process.exit;
  const originalFetch = globalThis.fetch;
  
  let exitCode: number | null = null;
  process.exit = ((code?: number) => {
    exitCode = code !== undefined ? code : 0;
    throw new Error(`exit-${exitCode}`);
  }) as any;

  process.env.GEMINI_API_KEY = 'gemini-mock-key';

  let returnUnsafe = false;

  globalThis.fetch = (async (url: string, options: any) => {
    const body = JSON.parse(options.body);
    const lastMessage = body.contents?.[body.contents.length - 1]?.parts?.[0]?.text || '';

    if (lastMessage.includes('TaskContract')) {
      // Plan phase
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  task: 'gemini task',
                  understanding: 'gemini plan',
                  assumptions: [],
                  filesLikelyNeeded: ['math.js'],
                  forbiddenActions: [],
                  successCriteria: ['compile'],
                  riskLevel: 'low',
                  requiresApproval: false,
                  createdAt: new Date().toISOString(),
                  mode: 'lax'
                })
              }]
            }
          }]
        })
      };
    } else {
      // Patch phase
      const patchContent = returnUnsafe 
        ? {
            summary: 'unsafe patch',
            files: [{ filePath: '../outside.txt', content: 'hack', reason: 'exploit' }],
            notes: [],
            riskLevel: 'low'
          }
        : {
            summary: 'safe patch',
            files: [{ filePath: 'math.js', content: 'console.log("gemini math");', reason: 'gemini math' }],
            notes: [],
            riskLevel: 'low'
          };

      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify(patchContent)
              }]
            }
          }]
        })
      };
    }
  }) as any;

  try {
    // 1. Safe patch execution
    try {
      await runTask('gemini task', ['math.js'], false, tempDir, true, true, true, { provider: 'gemini', model: 'gemini-test' });
    } catch (err: any) {
      if (!err.message.includes('exit-0')) throw err;
    }
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(fs.readFileSync(path.join(tempDir, 'math.js'), 'utf8'), 'console.log("gemini math");');

    // Verify report
    const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.strictEqual(report.provider, 'gemini');
    assert.strictEqual(report.model, 'gemini-test');
    assert.strictEqual(report.status, 'PASS');

    // 2. Unsafe patch blocking
    returnUnsafe = true;
    exitCode = null;
    try {
      await runTask('gemini task', ['math.js'], false, tempDir, true, true, true, { provider: 'gemini', model: 'gemini-test' });
    } catch (err: any) {
      if (!err.message.includes('exit-1')) throw err;
    }
    assert.strictEqual(exitCode, 1);
    assert.ok(!fs.existsSync(path.join(tempDir, '../outside.txt')));

    const report2 = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.strictEqual(report2.status, 'BLOCKED');

  } finally {
    process.exit = originalExit;
    globalThis.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
    cleanupWorkspace(tempDir);
  }
});

test('run command - Anthropic integration safe patch and unsafe blocking', async () => {
  const tempDir = createTempWorkspace();
  const originalExit = process.exit;
  const originalFetch = globalThis.fetch;
  
  let exitCode: number | null = null;
  process.exit = ((code?: number) => {
    exitCode = code !== undefined ? code : 0;
    throw new Error(`exit-${exitCode}`);
  }) as any;

  process.env.ANTHROPIC_API_KEY = 'anthropic-mock-key';

  let returnUnsafe = false;

  globalThis.fetch = (async (url: string, options: any) => {
    const body = JSON.parse(options.body);

    if (body.system && body.system.includes('planning assistant')) {
      // Plan phase
      return {
        ok: true,
        json: async () => ({
          content: [{
            type: 'text',
            text: JSON.stringify({
              task: 'anthropic task',
              understanding: 'anthropic plan',
              assumptions: [],
              filesLikelyNeeded: ['math.js'],
              forbiddenActions: [],
              successCriteria: ['compile'],
              riskLevel: 'low',
              requiresApproval: false,
              createdAt: new Date().toISOString(),
              mode: 'lax'
            })
          }]
        })
      };
    } else {
      // Patch phase
      const patchContent = returnUnsafe 
        ? {
            summary: 'unsafe patch',
            files: [{ filePath: '../outside.txt', content: 'hack', reason: 'exploit' }],
            notes: [],
            riskLevel: 'low'
          }
        : {
            summary: 'safe patch',
            files: [{ filePath: 'math.js', content: 'console.log("anthropic math");', reason: 'anthropic math' }],
            notes: [],
            riskLevel: 'low'
          };

      return {
        ok: true,
        json: async () => ({
          content: [{
            type: 'text',
            text: JSON.stringify(patchContent)
          }]
        })
      };
    }
  }) as any;

  try {
    // 1. Safe patch execution
    try {
      await runTask('anthropic task', ['math.js'], false, tempDir, true, true, true, { provider: 'anthropic', model: 'claude-test' });
    } catch (err: any) {
      if (!err.message.includes('exit-0')) throw err;
    }
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(fs.readFileSync(path.join(tempDir, 'math.js'), 'utf8'), 'console.log("anthropic math");');

    // Verify report
    const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.strictEqual(report.provider, 'anthropic');
    assert.strictEqual(report.model, 'claude-test');
    assert.strictEqual(report.status, 'PASS');

    // 2. Unsafe patch blocking
    returnUnsafe = true;
    exitCode = null;
    try {
      await runTask('anthropic task', ['math.js'], false, tempDir, true, true, true, { provider: 'anthropic', model: 'claude-test' });
    } catch (err: any) {
      if (!err.message.includes('exit-1')) throw err;
    }
    assert.strictEqual(exitCode, 1);
    assert.ok(!fs.existsSync(path.join(tempDir, '../outside.txt')));

    const report2 = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.strictEqual(report2.status, 'BLOCKED');

  } finally {
    process.exit = originalExit;
    globalThis.fetch = originalFetch;
    delete process.env.ANTHROPIC_API_KEY;
    cleanupWorkspace(tempDir);
  }
});

test('run command - OpenRouter integration safe patch and unsafe blocking', async () => {
  const tempDir = createTempWorkspace();
  const originalExit = process.exit;
  const originalFetch = globalThis.fetch;
  
  let exitCode: number | null = null;
  process.exit = ((code?: number) => {
    exitCode = code !== undefined ? code : 0;
    throw new Error(`exit-${exitCode}`);
  }) as any;

  process.env.OPENROUTER_API_KEY = 'openrouter-mock-key';

  let returnUnsafe = false;

  globalThis.fetch = (async (url: string, options: any) => {
    const body = JSON.parse(options.body);
    const lastMessage = body.messages[body.messages.length - 1].content;

    if (lastMessage.includes('TaskContract')) {
      // Plan phase
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                task: 'openrouter task',
                understanding: 'openrouter plan',
                assumptions: [],
                filesLikelyNeeded: ['math.js'],
                forbiddenActions: [],
                successCriteria: ['compile'],
                riskLevel: 'low',
                requiresApproval: false,
                createdAt: new Date().toISOString(),
                mode: 'lax'
              })
            }
          }]
        })
      };
    } else {
      // Patch phase
      const patchContent = returnUnsafe 
        ? {
            summary: 'unsafe patch',
            files: [{ filePath: '../outside.txt', content: 'hack', reason: 'exploit' }],
            notes: [],
            riskLevel: 'low'
          }
        : {
            summary: 'safe patch',
            files: [{ filePath: 'math.js', content: 'console.log("openrouter math");', reason: 'openrouter math' }],
            notes: [],
            riskLevel: 'low'
          };

      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify(patchContent)
            }
          }]
        })
      };
    }
  }) as any;

  try {
    // 1. Safe patch execution
    try {
      await runTask('openrouter task', ['math.js'], false, tempDir, true, true, true, { provider: 'openrouter', model: 'openrouter-test' });
    } catch (err: any) {
      if (!err.message.includes('exit-0')) throw err;
    }
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(fs.readFileSync(path.join(tempDir, 'math.js'), 'utf8'), 'console.log("openrouter math");');

    // Verify report
    const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.strictEqual(report.provider, 'openrouter');
    assert.strictEqual(report.model, 'openrouter-test');
    assert.strictEqual(report.status, 'PASS');

    // 2. Unsafe patch blocking
    returnUnsafe = true;
    exitCode = null;
    try {
      await runTask('openrouter task', ['math.js'], false, tempDir, true, true, true, { provider: 'openrouter', model: 'openrouter-test' });
    } catch (err: any) {
      if (!err.message.includes('exit-1')) throw err;
    }
    assert.strictEqual(exitCode, 1);
    assert.ok(!fs.existsSync(path.join(tempDir, '../outside.txt')));

    const report2 = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.strictEqual(report2.status, 'BLOCKED');

  } finally {
    process.exit = originalExit;
    globalThis.fetch = originalFetch;
    delete process.env.OPENROUTER_API_KEY;
    cleanupWorkspace(tempDir);
  }
});

test('run command - dry-run does not write files, create checkpoints, or call providers', async () => {
  const tempDir = createTempWorkspace();
  const originalExit = process.exit;
  
  let exitCode: number | null = null;
  process.exit = ((code?: number) => {
    exitCode = code !== undefined ? code : 0;
    throw new Error(`exit-${exitCode}`);
  }) as any;

  try {
    try {
      await runTask('dry run task', ['math.js'], false, tempDir, true, true, true, { provider: 'openai', model: 'gpt-4o-mini' }, true);
    } catch (err: any) {
      if (!err.message.includes('exit-0')) {
        throw err;
      }
    }

    assert.strictEqual(exitCode, 0);
    // Verify no files are written
    assert.ok(!fs.existsSync(path.join(tempDir, 'math.js')));
    // Verify no session folder or reports folder is created
    assert.ok(!fs.existsSync(path.join(tempDir, '.jewel')));
  } finally {
    process.exit = originalExit;
    cleanupWorkspace(tempDir);
  }
});

test('run command - provider none metadata is correct in report', async () => {
  const tempDir = createTempWorkspace();
  const originalExit = process.exit;
  
  let exitCode: number | null = null;
  process.exit = ((code?: number) => {
    exitCode = code !== undefined ? code : 0;
    throw new Error(`exit-${exitCode}`);
  }) as any;

  fs.writeFileSync(
    path.join(tempDir, 'jewel.config.json'),
    JSON.stringify({
      projectName: 'test-project',
      mode: 'strict',
      provider: 'none',
      model: 'gpt-4o-mini',
      temperature: 0,
      maxOutputTokens: 4000,
      llmTimeoutMs: 60000,
      llmMaxRetries: 1,
      llmStrictJson: true,
      commands: {
        test: 'npm run test'
      },
      requireHumanDiffApproval: false,
      requireVerificationBeforeDone: false
    }, null, 2),
    'utf8'
  );

  try {
    try {
      await runTask('mock task', ['math.js'], true, tempDir, true, true, true);
    } catch (err: any) {
      if (!err.message.includes('exit-0')) {
        throw err;
      }
    }

    assert.strictEqual(exitCode, 0);
    const reportPath = path.join(tempDir, '.jewel', 'reports', 'latest-run.json');
    assert.ok(fs.existsSync(reportPath));
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

    assert.strictEqual(report.provider, 'none');
    assert.strictEqual(report.model, 'mock');
    assert.strictEqual(report.adapterName, 'mock-agent');
    assert.strictEqual(report.usage, 'usage unavailable (mock)');
  } finally {
    process.exit = originalExit;
    cleanupWorkspace(tempDir);
  }
});

