import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  loadContinuationContext,
  buildContinuationTask,
  writeSessionLinkMetadata
} from './session-continue';

test('session continue - builds continuation task with feedback', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-continue-'));
  const sessionId = 'session-test-1';
  const sessionPath = path.join(dir, '.jewel', 'sessions', sessionId);
  fs.mkdirSync(sessionPath, { recursive: true });
  fs.writeFileSync(path.join(sessionPath, 'task-contract.json'), JSON.stringify({
    task: 'Fix divide function',
    filesLikelyNeeded: ['src/math.ts']
  }), 'utf8');
  fs.writeFileSync(path.join(sessionPath, 'run-report.json'), JSON.stringify({
    status: 'FAIL',
    criticFindings: ['tests still failing']
  }), 'utf8');

  try {
    const ctx = loadContinuationContext(dir, 'handle b equals zero', sessionId);
    assert.ok(ctx);
    assert.strictEqual(ctx!.parentSessionId, sessionId);
    const task = buildContinuationTask(ctx!);
    assert.ok(task.includes('Fix divide function'));
    assert.ok(task.includes('handle b equals zero'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('session continue - writes link metadata', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-continue-'));
  const sessionPath = path.join(dir, '.jewel', 'sessions', 'session-new');
  fs.mkdirSync(sessionPath, { recursive: true });
  try {
    writeSessionLinkMetadata(sessionPath, 'session-old', 'follow up');
    const meta = JSON.parse(fs.readFileSync(path.join(sessionPath, 'continuation.json'), 'utf8'));
    assert.strictEqual(meta.parentSessionId, 'session-old');
    assert.strictEqual(meta.feedback, 'follow up');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
