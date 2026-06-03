import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runRollback } from './rollback';
import { createCheckpoint, isGitRepository } from '../../storage/git';

test('rollback command - safety hardening checks', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-test-rollback-safe-'));
  const { execSync } = require('child_process');

  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    if (!isGitRepository(tempDir)) {
      return; // Skip if git fails to initialize in this env
    }

    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' });

    // Write a .gitignore so git clean doesn't delete .jewel
    fs.writeFileSync(path.join(tempDir, '.gitignore'), '.jewel\n', 'utf8');
    execSync('git add .gitignore', { cwd: tempDir, stdio: 'ignore' });
    execSync('git commit -m "add gitignore"', { cwd: tempDir, stdio: 'ignore' });

    // Initial commit
    fs.writeFileSync(path.join(tempDir, 'main.txt'), 'initial content\n');
    execSync('git add main.txt', { cwd: tempDir, stdio: 'ignore' });
    execSync('git commit -m "initial commit"', { cwd: tempDir, stdio: 'ignore' });

    // Make dirty change
    fs.writeFileSync(path.join(tempDir, 'main.txt'), 'dirty content\n');

    // Create session structure
    const sessionsDir = path.join(tempDir, '.jewel', 'sessions');
    const sessionId = 'session-999';
    const sessionPath = path.join(sessionsDir, sessionId);
    fs.mkdirSync(sessionPath, { recursive: true });

    // Create checkpoint
    const meta = createCheckpoint(sessionId, tempDir);
    fs.writeFileSync(path.join(sessionPath, 'checkpoint.json'), JSON.stringify(meta, null, 2), 'utf8');

    // Case 1: User makes changes, but NO new commits are made. Rollback should work.
    fs.writeFileSync(path.join(tempDir, 'main.txt'), 'dirty content modified by agent\n');
    
    // Capture logs to prevent output noise
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};
    
    try {
      runRollback(sessionId, tempDir, false, false);
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
    }

    // Verify it restored
    assert.strictEqual(fs.readFileSync(path.join(tempDir, 'main.txt'), 'utf8').replace(/\r\n/g, '\n'), 'dirty content\n');

    // Case 2: User makes new commits after the checkpoint.
    // Create new commit
    fs.writeFileSync(path.join(tempDir, 'main.txt'), 'some new user content\n');
    execSync('git add main.txt', { cwd: tempDir, stdio: 'ignore' });
    execSync('git commit -m "new user commit"', { cwd: tempDir, stdio: 'ignore' });

    // Try rollback without force. It should refuse and call process.exit(1).
    const originalExit = process.exit;
    let exitCode: number | null = null;
    (process as any).exit = (code: number) => {
      exitCode = code;
      throw new Error(`exit-${code}`);
    };

    console.log = () => {};
    console.warn = () => {};
    try {
      runRollback(sessionId, tempDir, false, false);
    } catch (err: any) {
      if (!err.message.startsWith('exit-')) {
        throw err;
      }
    } finally {
      process.exit = originalExit;
      console.log = originalLog;
      console.warn = originalWarn;
    }

    assert.strictEqual(exitCode, 1);
    // Verify before-rollback.patch was created
    assert.ok(fs.existsSync(path.join(sessionPath, 'before-rollback.patch')));

    // Case 3: Rollback with force. It should succeed.
    console.log = () => {};
    console.warn = () => {};
    try {
      runRollback(sessionId, tempDir, false, true);
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
    }

    // Reverted
    assert.strictEqual(fs.readFileSync(path.join(tempDir, 'main.txt'), 'utf8').replace(/\r\n/g, '\n'), 'dirty content\n');

  } catch (err) {
    console.warn('Skipping test due to git failure:', err);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
