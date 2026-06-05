import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runVersion } from './version';

function createTempSandbox(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-version-test-'));
}

test('version command prints package and node version info', () => {
  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (...args: any[]) => {
    logs.push(args.join(' '));
  };

  const sandboxDir = createTempSandbox();

  try {
    runVersion(sandboxDir);
    
    // Assert version outputs something like "Jewel version: ..."
    const hasJewel = logs.some(log => log.includes('Jewel version:'));
    const hasNode = logs.some(log => log.includes('Node.js version:'));
    const hasPlatform = logs.some(log => log.includes('Platform:'));
    const hasConfig = logs.some(log => log.includes('Default configuration:'));
    const hasActiveConfig = logs.some(log => log.includes('Active configuration: none (using defaults)'));

    assert.ok(hasJewel, 'Should print Jewel version');
    assert.ok(hasNode, 'Should print Node.js version');
    assert.ok(hasPlatform, 'Should print Platform');
    assert.ok(hasConfig, 'Should print Config details');
    assert.ok(hasActiveConfig, 'Should print active configuration');
  } finally {
    console.log = originalLog;
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
});

test('version command - prints config status when present', () => {
  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (...args: any[]) => {
    logs.push(args.join(' '));
  };

  const sandboxDir = createTempSandbox();
  fs.writeFileSync(
    path.join(sandboxDir, 'jewel.config.json'),
    JSON.stringify({ projectName: 'my-cool-project' }),
    'utf8'
  );

  try {
    runVersion(sandboxDir);
    const hasActiveConfig = logs.some(log => log.includes('Active configuration: found (project: "my-cool-project")'));
    assert.ok(hasActiveConfig, 'Should print active configuration project name');
  } finally {
    console.log = originalLog;
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
});

test('version command - falls back gracefully on malformed config or missing name', () => {
  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (...args: any[]) => {
    logs.push(args.join(' '));
  };

  const sandboxDir = createTempSandbox();
  fs.writeFileSync(
    path.join(sandboxDir, 'jewel.config.json'),
    '{invalid-json}',
    'utf8'
  );

  try {
    runVersion(sandboxDir);
    const hasActiveConfig = logs.some(log => log.includes('Active configuration: none (using defaults)'));
    assert.ok(hasActiveConfig, 'Should fall back to none on invalid JSON');
  } finally {
    console.log = originalLog;
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
});
