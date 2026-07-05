#!/usr/bin/env node
/**
 * Jewel benchmark harness — runs curated tasks and reports pass/fail metrics.
 * Usage: node scripts/run-benchmark.js [--mock]
 */
const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.join(__dirname, '..');
const manifestPath = path.join(rootDir, 'benchmarks', 'manifest.json');
const useMock = process.argv.includes('--mock');
const cliEntry = path.join(rootDir, 'dist', 'cli', 'index.js');

if (!fs.existsSync(cliEntry)) {
  console.error('[benchmark] dist/cli/index.js not found. Run npm run build first.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const results = [];
let passed = 0;
let failed = 0;

console.log(`\nJewel Benchmark Harness (${manifest.version})\n${'='.repeat(50)}`);

for (const task of manifest.tasks) {
  const taskDir = path.join(rootDir, task.projectPath);
  const label = task.id;
  process.stdout.write(`\n[${label}] ${task.description} ... `);

  if (task.preCheck === 'broken-tests') {
    try {
      execSync('npm test', { cwd: taskDir, stdio: 'ignore' });
      console.log('SKIP (fixture not broken)');
      results.push({ id: label, status: 'SKIP', reason: 'fixture not broken' });
      continue;
    } catch {
      // expected
    }
  }

  const args = [
    cliEntry,
    'run',
    task.task,
    '--yes',
    '--no-review'
  ];
  if (useMock || task.useMock) {
    args.push('--mock');
  }
  if (task.files && task.files.length > 0) {
    args.push('--files', task.files.join(','));
  }

  const env = { ...process.env };
  const run = spawnSync(process.execPath, args, { cwd: taskDir, env, encoding: 'utf8' });
  const runOk = run.status === 0;

  let verifyOk = false;
  if (runOk && task.verifyCommand) {
    try {
      execSync(task.verifyCommand, { cwd: taskDir, stdio: 'ignore' });
      verifyOk = true;
    } catch {
      verifyOk = false;
    }
  } else if (runOk && !task.verifyCommand) {
    verifyOk = true;
  }

  if (runOk && verifyOk) {
    console.log('PASS');
    passed++;
    results.push({ id: label, status: 'PASS' });
  } else {
    console.log('FAIL');
    failed++;
    results.push({
      id: label,
      status: 'FAIL',
      exitCode: run.status,
      stderr: (run.stderr || '').slice(-500)
    });
  }

  if (task.cleanup) {
    for (const rel of task.cleanup) {
      const target = path.join(taskDir, rel);
      try {
        if (fs.existsSync(target)) {
          fs.rmSync(target, { recursive: true, force: true });
        }
      } catch {}
    }
  }
}

const summary = {
  date: new Date().toISOString(),
  total: manifest.tasks.length,
  passed,
  failed,
  skipped: results.filter(r => r.status === 'SKIP').length,
  results
};

const outDir = path.join(rootDir, '.jewel', 'benchmarks');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify(summary, null, 2));

console.log(`\n${'='.repeat(50)}`);
console.log(`Benchmark complete: ${passed} passed, ${failed} failed, ${summary.skipped} skipped (${manifest.tasks.length} total)`);

process.exit(failed > 0 ? 1 : 0);
