import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { handleToolCall } from './tools';

function withTempRepo(fn: (dir: string) => Promise<void> | void): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-mcp-'));
  fs.writeFileSync(path.join(dir, 'sample.md'), 'hello jewel grep target', 'utf8');
  fs.mkdirSync(path.join(dir, '.jewel', 'sessions', 'session-test-1'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.jewel', 'sessions', 'session-test-1', 'task-contract.json'), JSON.stringify({
    task: 'test task',
    riskLevel: 'low',
    createdAt: new Date().toISOString(),
    filesLikelyNeeded: []
  }), 'utf8');
  fs.writeFileSync(path.join(dir, 'jewel.config.json'), JSON.stringify({
    verificationCommands: [],
    requireVerificationBeforeDone: false
  }), 'utf8');

  return Promise.resolve(fn(dir)).finally(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });
}

test('mcp tools - jewel_grep finds matches', async () => {
  await withTempRepo(async dir => {
    const result = await handleToolCall('jewel_grep', { query: 'grep target' }, dir) as Array<{ file: string }>;
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 1);
  });
});

test('mcp tools - jewel_read_file returns content', async () => {
  await withTempRepo(async dir => {
    const result = await handleToolCall('jewel_read_file', { path: 'sample.md' }, dir) as { content?: string };
    assert.strictEqual(result.content, 'hello jewel grep target');
  });
});

test('mcp tools - jewel_status lists sessions', async () => {
  await withTempRepo(async dir => {
    const result = await handleToolCall('jewel_status', { limit: 5 }, dir) as unknown[];
    assert.ok(Array.isArray(result));
  });
});

test('mcp tools - unknown tool throws', async () => {
  await assert.rejects(() => handleToolCall('nope', {}, process.cwd()), /Unknown tool/);
});
