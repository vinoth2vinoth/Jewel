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

  // Mock process.exit to prevent the test runner itself from exiting
  const originalExit = process.exit;
  let exitCode: number | undefined;
  (process as any).exit = (code?: number) => {
    exitCode = code;
  };

  try {
    // Run doctor inside sandbox
    runDoctor(sandboxDir);
    
    // Doctor should execute and call process.exit (0 or 1)
    assert.ok(exitCode === 0 || exitCode === 1);
  } finally {
    process.exit = originalExit;
    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  }
});
