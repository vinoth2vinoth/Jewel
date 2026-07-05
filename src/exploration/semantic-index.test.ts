import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildSemanticIndex, scoreFilesBySemanticIndex, ensureSemanticIndex } from './semantic-index';

test('semantic index - scores task-related files higher', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-semantic-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'math.ts'), 'export function divide(a: number, b: number) { return a / b; }\n');
  fs.writeFileSync(path.join(dir, 'src', 'utils.ts'), 'export function noop() {}\n');
  try {
    const index = buildSemanticIndex(dir);
    const scores = scoreFilesBySemanticIndex(index, 'fix divide by zero in math');
    assert.ok((scores.get('src/math.ts') || 0) > (scores.get('src/utils.ts') || 0));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('semantic index - ensure persists index file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-semantic-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'function main() { return 1; }\n');
  try {
    ensureSemanticIndex(dir);
    assert.ok(fs.existsSync(path.join(dir, '.jewel', 'index', 'semantic.json')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
