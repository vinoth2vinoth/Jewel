import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runDiff } from './diff';

test('diff command - print diff statistics from session', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-test-diff-'));
  
  // Set up mock session
  const sessionsDir = path.join(tempDir, '.jewel', 'sessions');
  const sessionId = 'session-2026-06-03T15-00-00-000Z';
  const sessionPath = path.join(sessionsDir, sessionId);
  fs.mkdirSync(sessionPath, { recursive: true });
  
  // Create checkpoint file
  const checkpoint = {
    isGit: false,
    backupPath: path.join(sessionPath, 'backup')
  };
  fs.writeFileSync(path.join(sessionPath, 'checkpoint.json'), JSON.stringify(checkpoint, null, 2), 'utf8');

  // Capture console.log
  const originalLog = console.log;
  const originalWarn = console.warn;
  const logs: string[] = [];
  console.log = (...args: any[]) => {
    logs.push(args.join(' '));
  };
  console.warn = (...args: any[]) => {
    logs.push(args.join(' '));
  };

  try {
    // Run diff
    runDiff(sessionId, tempDir);
    
    // Restore logs
    console.log = originalLog;
    console.warn = originalWarn;

    const output = logs.join('\n');
    assert.ok(output.includes('Jewel Diff'));
    assert.ok(output.includes(sessionId));
    assert.ok(output.includes('Changed Files'));
  } catch (err) {
    console.log = originalLog;
    console.warn = originalWarn;
    throw err;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
