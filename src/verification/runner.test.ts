import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { runVerification } from './runner';
import { DEFAULT_CONFIG, JewelConfig } from '../core/config';

const sandboxDir = path.join(__dirname, '../../sandbox-test-verification');

function cleanupSandbox() {
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
}

test('verification runner - full cycle', () => {
  cleanupSandbox();
  fs.mkdirSync(sandboxDir, { recursive: true });

  // 1. Set up a config with mixed commands
  const config: JewelConfig = {
    ...DEFAULT_CONFIG,
    commands: {
      lint: 'node -e "console.log(\'Linting passed\')"', // Passing
      typecheck: 'node -e "console.error(\'Typecheck warning\'); process.exit(0)"', // Passing with stderr
      test: 'node -e "console.log(\'Tests failed\'); process.exit(1)"', // Failing
      build: '', // Skipped
      e2e: 'git push origin main' // Blocked (due to default git push policy)
    }
  };

  const report = runVerification(config, sandboxDir);

  // Check stats
  assert.strictEqual(report.overallStatus, 'FAIL'); // because test command failed
  assert.strictEqual(report.stats.passed, 2); // lint, typecheck
  assert.strictEqual(report.stats.failed, 1); // test
  assert.strictEqual(report.stats.skipped, 1); // build
  assert.strictEqual(report.stats.blocked, 1); // e2e (due to policy check)

  // Verify command details
  const lintResult = report.results.find(r => r.commandKey === 'lint');
  assert.ok(lintResult);
  assert.strictEqual(lintResult.status, 'PASS');
  assert.strictEqual(lintResult.exitCode, 0);
  assert.ok(lintResult.stdout.includes('Linting passed'));

  const testResult = report.results.find(r => r.commandKey === 'test');
  assert.ok(testResult);
  assert.strictEqual(testResult.status, 'FAIL');
  assert.strictEqual(testResult.exitCode, 1);
  assert.ok(testResult.stdout.includes('Tests failed'));

  const buildResult = report.results.find(r => r.commandKey === 'build');
  assert.ok(buildResult);
  assert.strictEqual(buildResult.status, 'SKIPPED');

  const e2eResult = report.results.find(r => r.commandKey === 'e2e');
  assert.ok(e2eResult);
  assert.strictEqual(e2eResult.status, 'BLOCKED');

  // Verify files generated
  const reportsDir = path.join(sandboxDir, '.jewel', 'reports');
  assert.ok(fs.existsSync(path.join(reportsDir, 'latest.json')));
  assert.ok(fs.existsSync(path.join(reportsDir, 'latest.md')));

  const jsonContent = JSON.parse(fs.readFileSync(path.join(reportsDir, 'latest.json'), 'utf8'));
  assert.strictEqual(jsonContent.overallStatus, 'FAIL');

  const mdContent = fs.readFileSync(path.join(reportsDir, 'latest.md'), 'utf8');
  assert.ok(mdContent.includes('# Jewel Verification Report'));
  assert.ok(mdContent.includes('| lint | `node -e "console.log(\'Linting passed\')"` | **PASS** | 0 |'));

  cleanupSandbox();
});
