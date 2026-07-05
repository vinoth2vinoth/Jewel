import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { resolveFilesForTask, buildEnrichedRepoSummary } from './context-builder';

test('context-builder - resolveFilesForTask prefers user files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-context-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'a.ts'), 'a');
  fs.writeFileSync(path.join(dir, 'src', 'b.ts'), 'b');
  try {
    const resolved = resolveFilesForTask(dir, 'fix something', ['src/a.ts']);
    assert.deepStrictEqual(resolved, ['src/a.ts']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('context-builder - auto-discovers files when user scope is empty', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-context-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'math.ts'), 'export function divide(a: number, b: number) { return a / b; }\n');
  try {
    const resolved = resolveFilesForTask(dir, 'fix divide by zero in math', []);
    assert.ok(resolved.includes('src/math.ts'));
    const summary = buildEnrichedRepoSummary(dir, 'fix divide by zero in math');
    assert.ok(summary.includes('src/math.ts'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
