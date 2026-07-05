import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { grep, globFiles, listDir, readFile, discoverRelevantFiles } from './repo-explorer';

function createFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jewel-explorer-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'math.ts'), 'export function divide(a: number, b: number) { return a / b; }\n');
  fs.writeFileSync(path.join(dir, 'src', 'math.test.ts'), 'test("divide by zero", () => { divide(1, 0); });\n');
  fs.writeFileSync(path.join(dir, 'README.md'), '# demo\n');
  return dir;
}

test('repo-explorer - listDir and globFiles', () => {
  const dir = createFixture();
  try {
    const entries = listDir(dir, '.', { maxDepth: 2 });
    assert.ok(entries.some(e => e === 'src/math.ts'));
    const tsFiles = globFiles(dir, 'src/**/*.ts');
    assert.ok(tsFiles.includes('src/math.ts'));
    assert.ok(tsFiles.includes('src/math.test.ts'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('repo-explorer - grep finds matching lines', () => {
  const dir = createFixture();
  try {
    const hits = grep(dir, 'divide', { maxMatches: 10 });
    assert.ok(hits.length >= 2);
    assert.ok(hits.some(h => h.file === 'src/math.ts'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('repo-explorer - readFile with truncation flag', () => {
  const dir = createFixture();
  try {
    const result = readFile(dir, 'src/math.ts');
    assert.ok(result);
    assert.ok(result!.content.includes('divide'));
    assert.strictEqual(result!.truncated, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('repo-explorer - discoverRelevantFiles for math task', () => {
  const dir = createFixture();
  try {
    const files = discoverRelevantFiles(dir, 'fix the failing math divide test', 5);
    assert.ok(files.includes('src/math.ts'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
