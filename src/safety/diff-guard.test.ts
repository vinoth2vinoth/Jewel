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

test('diff guard - AST signature changes', () => {
  cleanupSandbox();
  
  const originalDir = path.join(sandboxDir, 'backup');
  const currentDir = path.join(sandboxDir, 'current');

  fs.mkdirSync(originalDir, { recursive: true });
  fs.mkdirSync(currentDir, { recursive: true });

  const checkpoint: CheckpointMetadata = {
    timestamp: '123',
    isGit: false,
    backupPath: originalDir
  };

  const astConfig: JewelConfig = {
    ...DEFAULT_CONFIG,
    useASTDiffGuard: true
  };

  // Test 1: Deleting function signature blocks
  fs.writeFileSync(
    path.join(originalDir, 'math.ts'),
    'export function add(a: number, b: number): number { return a + b; }\nexport function subtract(a: number, b: number): number { return a - b; }\n'
  );
  fs.writeFileSync(
    path.join(currentDir, 'math.ts'),
    'export function add(a: number, b: number): number { return a + b; }\n' // subtract deleted
  );
  const analysis1 = runDiffGuard(checkpoint, astConfig, currentDir);
  assert.strictEqual(analysis1.status, 'BLOCK');
  assert.ok(analysis1.findings.some(f => f.includes("Deleted or modified signature of 'function subtract(a,b)'")));

  // Test 2: Changing parameter signature blocks
  fs.writeFileSync(
    path.join(currentDir, 'math.ts'),
    'export function add(a: number): number { return a; }\nexport function subtract(a: number, b: number): number { return a - b; }\n' // add parameter deleted
  );
  const analysis2 = runDiffGuard(checkpoint, astConfig, currentDir);
  assert.strictEqual(analysis2.status, 'BLOCK');
  assert.ok(analysis2.findings.some(f => f.includes("Deleted or modified signature of 'function add(a,b)'")));

  // Test 3: Changing function body but keeping signature passes
  fs.writeFileSync(
    path.join(currentDir, 'math.ts'),
    'export function add(a: number, b: number): number { console.log("adding"); return a + b; }\nexport function subtract(a: number, b: number): number { return a - b; }\n'
  );
  const analysis3 = runDiffGuard(checkpoint, astConfig, currentDir);
  assert.strictEqual(analysis3.status, 'PASS');

  // Test 4: AST diff guard is skipped if configuration option is false
  const noAstConfig: JewelConfig = {
    ...DEFAULT_CONFIG,
    useASTDiffGuard: false
  };
  fs.writeFileSync(
    path.join(currentDir, 'math.ts'),
    'export function add(a: number): number { return a; }\nexport function subtract(a: number, b: number): number { return a - b; }\n'
  );
  const analysis4 = runDiffGuard(checkpoint, noAstConfig, currentDir);
  assert.strictEqual(analysis4.status, 'PASS'); // skipped AST block, passes standard checks

  cleanupSandbox();
});

test('diff guard - AST semantic dependency checks', () => {
  cleanupSandbox();
  
  const originalDir = path.join(sandboxDir, 'backup');
  const currentDir = path.join(sandboxDir, 'current');

  fs.mkdirSync(originalDir, { recursive: true });
  fs.mkdirSync(currentDir, { recursive: true });

  const checkpoint: CheckpointMetadata = {
    timestamp: '123',
    isGit: false,
    backupPath: originalDir
  };

  const config: JewelConfig = {
    ...DEFAULT_CONFIG,
    useASTDiffGuard: true,
    protectedFiles: ['src/payments/**'],
    allowProtectedFileChanges: true
  };

  // Setup a modified file math.ts
  fs.writeFileSync(path.join(originalDir, 'math.ts'), 'export function add(a: number, b: number) { return a + b; }\n');
  fs.writeFileSync(path.join(currentDir, 'math.ts'), 'export function add(a: number, b: number) { console.log("body change"); return a + b; }\n');

  // Setup a protected file that imports math.ts
  fs.mkdirSync(path.join(currentDir, 'src/payments'), { recursive: true });
  fs.writeFileSync(
    path.join(currentDir, 'src/payments/billing.ts'),
    'import { add } from "../../math";\nconsole.log(add(1, 2));\n'
  );

  const analysis = runDiffGuard(checkpoint, config, currentDir);
  assert.strictEqual(analysis.status, 'WARN');
  assert.ok(analysis.findings.some(f => f.includes("Modified file 'math.ts' is referenced by protected module 'src/payments/billing.ts'")));

  cleanupSandbox();
});

test('diff guard - AST allowed symbol changes bypass block', () => {
  cleanupSandbox();

  const originalDir = path.join(sandboxDir, 'backup');
  const currentDir = path.join(sandboxDir, 'current');

  fs.mkdirSync(originalDir, { recursive: true });
  fs.mkdirSync(currentDir, { recursive: true });

  const checkpoint: CheckpointMetadata = {
    timestamp: '123',
    isGit: false,
    backupPath: originalDir
  };

  const astConfig: JewelConfig = {
    ...DEFAULT_CONFIG,
    useASTDiffGuard: true
  };

  // Original files: math.ts contains add and subtract
  fs.writeFileSync(
    path.join(originalDir, 'math.ts'),
    'export function add(a: number, b: number): number { return a + b; }\nexport function subtract(a: number, b: number): number { return a - b; }\n'
  );

  // Current files: delete subtract
  fs.writeFileSync(
    path.join(currentDir, 'math.ts'),
    'export function add(a: number, b: number): number { return a + b; }\n'
  );

  // 1. Without allowed symbol changes: blocked
  const analysisBlocked = runDiffGuard(checkpoint, astConfig, currentDir);
  assert.strictEqual(analysisBlocked.status, 'BLOCK');
  assert.ok(analysisBlocked.findings.some(f => f.includes("Deleted or modified signature of 'function subtract(a,b)'")));

  // 2. With allowed symbol changes containing 'subtract': passes
  const analysisPassed = runDiffGuard(checkpoint, astConfig, currentDir, ['subtract']);
  assert.strictEqual(analysisPassed.status, 'PASS');

  // 3. With config-level allowed symbol changes containing 'subtract': passes
  const configWithAllowed: JewelConfig = {
    ...astConfig,
    allowedSymbolChanges: ['subtract']
  };
  const analysisPassedConfig = runDiffGuard(checkpoint, configWithAllowed, currentDir);
  assert.strictEqual(analysisPassedConfig.status, 'PASS');

  cleanupSandbox();
});
