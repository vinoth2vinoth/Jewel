import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { runReleaseCheck } from './release-check';

function createMockReleaseWorkspace(version = '0.7.0', withDocs = true, withFiles = true): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-release-check-test-'));

  // Git init
  execSync('git init', { cwd: tempDir, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' });

  // package.json
  const filesList = withFiles ? ['bin', 'dist', 'docs'] : ['bin'];
  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify({
      name: 'jewel-cli-mock',
      version,
      files: filesList
    }, null, 2),
    'utf8'
  );

  // bin/jewel.js
  fs.mkdirSync(path.join(tempDir, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'bin', 'jewel.js'), '// mock binary', 'utf8');

  // dist/cli/index.js
  fs.mkdirSync(path.join(tempDir, 'dist', 'cli'), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, 'dist', 'cli', 'index.js'),
    `
    const args = process.argv.slice(2);
    if (args[0] === 'version') {
      console.log('Jewel version: ${version}');
    } else if (args[0] === '--help') {
      console.log('AI Coding Safety Harness - Help Menu');
    }
    `,
    'utf8'
  );

  // README.md
  fs.writeFileSync(path.join(tempDir, 'README.md'), '# Mock README', 'utf8');

  // docs
  if (withDocs) {
    fs.mkdirSync(path.join(tempDir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'docs', 'windows-smoke-test.md'), '# Windows Smoke Test', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'docs', 'real-provider-dogfood.md'), '# Real Provider Dogfood', 'utf8');
  }

  // commit so git status clean
  execSync('git add .', { cwd: tempDir, stdio: 'ignore' });
  execSync('git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

  return tempDir;
}

function cleanupWorkspace(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

test('release-check - successful validation on compliant workspace', async () => {
  const originalExit = process.exit;
  const originalLog = console.log;

  let exitCode: number | undefined;
  process.exit = ((code?: number) => {
    exitCode = code;
    return undefined as never;
  }) as any;

  const logs: string[] = [];
  console.log = (...args: any[]) => {
    logs.push(args.join(' '));
  };

  const workspace = createMockReleaseWorkspace('0.7.0', true, true);

  try {
    runReleaseCheck(workspace);
    assert.strictEqual(exitCode, 0);
    assert.ok(logs.some(log => log.includes('[PASS] Package version exists')));
    assert.ok(logs.some(log => log.includes('[PASS] bin/jewel.js exists')));
    assert.ok(logs.some(log => log.includes('[PASS] dist/ directory exists')));
    assert.ok(logs.some(log => log.includes('[PASS] README file exists')));
    assert.ok(logs.some(log => log.includes('[PASS] docs/ directory exists')));
    assert.ok(logs.some(log => log.includes('Release Readiness Checklist finished with 0 Failures')));
  } finally {
    process.exit = originalExit;
    console.log = originalLog;
    cleanupWorkspace(workspace);
  }
});

test('release-check - warns on missing docs and below version target', async () => {
  const originalExit = process.exit;
  const originalLog = console.log;

  let exitCode: number | undefined;
  process.exit = ((code?: number) => {
    exitCode = code;
    return undefined as never;
  }) as any;

  const logs: string[] = [];
  console.log = (...args: any[]) => {
    logs.push(args.join(' '));
  };

  // version 0.6.0 is below current release target, and withDocs = false
  const workspace = createMockReleaseWorkspace('0.6.0', false, true);

  try {
    runReleaseCheck(workspace);
    // Since missing docs produces warnings (not failures), it should still exit with 0!
    assert.strictEqual(exitCode, 0);
    assert.ok(logs.some(log => log.includes('[WARN] Package version 0.6.0 is below current target 0.7.0.')));
    assert.ok(logs.some(log => log.includes('[WARN] docs/ directory is missing.')));
  } finally {
    process.exit = originalExit;
    console.log = originalLog;
    cleanupWorkspace(workspace);
  }
});
