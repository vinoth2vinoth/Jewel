import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { runDiffGuard } from './diff-guard';
import { DEFAULT_CONFIG, JewelConfig } from '../core/config';
import { CheckpointMetadata } from '../storage/git';

const sandboxDir = path.join(__dirname, '../../sandbox-test-diff');

function cleanupSandbox() {
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
}

test('diff guard - non-git file comparisons', () => {
  cleanupSandbox();
  
  const originalDir = path.join(sandboxDir, 'backup');
  const currentDir = path.join(sandboxDir, 'current');

  fs.mkdirSync(originalDir, { recursive: true });
  fs.mkdirSync(currentDir, { recursive: true });

  // Baseline files
  fs.writeFileSync(path.join(originalDir, 'file1.txt'), 'hello world\nline 2\n');
  fs.writeFileSync(path.join(originalDir, 'package.json'), JSON.stringify({ dependencies: { lodash: '^1.0.0' } }));

  // Working copy changes
  fs.writeFileSync(path.join(currentDir, 'file1.txt'), 'hello world\nline 2 modified\nline 3 added\n');
  fs.writeFileSync(path.join(currentDir, 'package.json'), JSON.stringify({ dependencies: { lodash: '^1.0.0' } })); // no dependency change

  const checkpoint: CheckpointMetadata = {
    timestamp: '123',
    isGit: false,
    backupPath: originalDir
  };

  const passConfig: JewelConfig = {
    ...DEFAULT_CONFIG,
    maxFilesChanged: 5,
    maxLinesChanged: 50
  };

  // Test 1: Normal small diff passes
  const analysis1 = runDiffGuard(checkpoint, passConfig, currentDir);
  assert.strictEqual(analysis1.status, 'PASS');
  assert.strictEqual(analysis1.changedFilesCount, 1); // package.json should not count as modified since content matches
  assert.ok(analysis1.addedLinesCount > 0);

  // Test 2: Protected file change blocks
  fs.writeFileSync(path.join(currentDir, '.env'), 'SECRET=123'); // protected file added
  const analysis2 = runDiffGuard(checkpoint, passConfig, currentDir);
  assert.strictEqual(analysis2.status, 'BLOCK'); // because allowProtectedFileChanges is false by default
  assert.ok(analysis2.protectedFilesChanged.includes('.env'));

  // Test 3: Dependency change blocks
  fs.writeFileSync(path.join(currentDir, '.env'), ''); // clear it
  fs.writeFileSync(path.join(currentDir, 'package.json'), JSON.stringify({ dependencies: { lodash: '^1.0.0', axios: '^2.0.0' } })); // axios added
  const analysis3 = runDiffGuard(checkpoint, passConfig, currentDir);
  assert.strictEqual(analysis3.status, 'BLOCK'); // because allowNewDependencies is false by default
  assert.strictEqual(analysis3.dependenciesChanged, true);

  // Test 4: Too many files changed blocks
  const strictFilesConfig: JewelConfig = {
    ...DEFAULT_CONFIG,
    maxFilesChanged: 1
  };
  fs.writeFileSync(path.join(currentDir, 'file2.txt'), 'new file');
  const analysis4 = runDiffGuard(checkpoint, strictFilesConfig, currentDir);
  assert.strictEqual(analysis4.status, 'BLOCK');
  assert.ok(analysis4.findings.some(f => f.includes('Too many files changed')));

  cleanupSandbox();
});
