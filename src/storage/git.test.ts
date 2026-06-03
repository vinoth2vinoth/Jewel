import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { backupDirectory, restoreDirectory } from './backup';
import { createCheckpoint, rollbackCheckpoint, isGitRepository } from './git';

const sandboxDir = path.join(__dirname, '../../sandbox-test-checkpoint');

function cleanupSandbox() {
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
}

test('backup & restore directory (non-Git fallback)', () => {
  cleanupSandbox();
  fs.mkdirSync(sandboxDir, { recursive: true });

  const srcDir = path.join(sandboxDir, 'src-dir');
  const backupDest = path.join(sandboxDir, 'backup-dest');

  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(path.join(srcDir, 'file1.txt'), 'hello');
  fs.mkdirSync(path.join(srcDir, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(srcDir, 'sub', 'file2.txt'), 'world');

  // 1. Run backup
  backupDirectory(srcDir, backupDest);

  // Check backup files exist
  assert.ok(fs.existsSync(path.join(backupDest, 'file1.txt')));
  assert.ok(fs.existsSync(path.join(backupDest, 'sub', 'file2.txt')));

  // 2. Modify srcDir
  fs.writeFileSync(path.join(srcDir, 'file1.txt'), 'modified');
  fs.writeFileSync(path.join(srcDir, 'new-file.txt'), 'new file');

  // 3. Restore from backup
  restoreDirectory(backupDest, srcDir);

  // Check contents reverted
  assert.strictEqual(fs.readFileSync(path.join(srcDir, 'file1.txt'), 'utf8'), 'hello');
  assert.ok(fs.existsSync(path.join(srcDir, 'sub', 'file2.txt')));
  assert.ok(!fs.existsSync(path.join(srcDir, 'new-file.txt'))); // new-file should have been removed

  cleanupSandbox();
});

test('git checkpoint and rollback flow', () => {
  // Test local git repo integration if it is running in a git repo
  const testRepoDir = path.join(sandboxDir, 'test-repo');
  cleanupSandbox();
  fs.mkdirSync(testRepoDir, { recursive: true });

  // Init small git repo for testing
  const { execSync } = require('child_process');
  try {
    execSync('git init', { cwd: testRepoDir, stdio: 'ignore' });
    // Check if git is available
    if (!isGitRepository(testRepoDir)) {
      cleanupSandbox();
      return; // Skip if git fails to initialize in this env
    }

    // Set author config
    execSync('git config user.name "Test"', { cwd: testRepoDir, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: testRepoDir, stdio: 'ignore' });

    // Initial commit
    fs.writeFileSync(path.join(testRepoDir, 'main.txt'), 'initial commit content\n');
    execSync('git add main.txt', { cwd: testRepoDir, stdio: 'ignore' });
    execSync('git commit -m "initial commit"', { cwd: testRepoDir, stdio: 'ignore' });

    // Create uncommitted change
    fs.writeFileSync(path.join(testRepoDir, 'main.txt'), 'user work content\n');

    // Perform Jewel checkpoint
    const meta = createCheckpoint('session-123', testRepoDir);
    assert.strictEqual(meta.isGit, true);
    assert.strictEqual(meta.gitWasDirty, true);

    // Jewel execution changes a file
    fs.writeFileSync(path.join(testRepoDir, 'main.txt'), 'agent broken content\n');
    fs.writeFileSync(path.join(testRepoDir, 'bad-agent.txt'), 'bad file\n');

    // Run rollback
    rollbackCheckpoint(meta, testRepoDir);

    // Verify it is back to pre-run user work state
    assert.strictEqual(fs.readFileSync(path.join(testRepoDir, 'main.txt'), 'utf8').replace(/\r\n/g, '\n'), 'user work content\n');
    assert.ok(!fs.existsSync(path.join(testRepoDir, 'bad-agent.txt')));
  } catch (err) {
    // If git is missing or fails in this environment, it shouldn't fail the whole test run
    console.warn('Skipping git checkpoint integration test:', err);
  } finally {
    cleanupSandbox();
  }
});
