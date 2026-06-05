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

test('verification runner - coverage validation', () => {
  cleanupSandbox();
  fs.mkdirSync(sandboxDir, { recursive: true });

  const coverageDir = path.join(sandboxDir, 'coverage');
  fs.mkdirSync(coverageDir, { recursive: true });
  const reportPath = path.join(coverageDir, 'coverage-summary.json');

  // Case A: Coverage satisfies thresholds
  const mockCoveragePass = {
    total: {
      lines: { pct: 85 },
      branches: { pct: 80 }
    }
  };
  fs.writeFileSync(reportPath, JSON.stringify(mockCoveragePass), 'utf8');

  const configPass: JewelConfig = {
    ...DEFAULT_CONFIG,
    minCoverage: { lines: 80, branches: 75 },
    coverageReportPath: './coverage/coverage-summary.json',
    commands: {
      ...DEFAULT_CONFIG.commands,
      test: 'node -e "process.exit(0)"'
    }
  };

  const reportPass = runVerification(configPass, sandboxDir);
  assert.strictEqual(reportPass.overallStatus, 'PASS');
  
  const covResultPass = reportPass.results.find(r => r.commandKey === 'coverage');
  assert.ok(covResultPass);
  assert.strictEqual(covResultPass.status, 'PASS');

  // Case B: Coverage below thresholds
  const mockCoverageFail = {
    total: {
      lines: { pct: 75 }, // below 80
      branches: { pct: 80 }
    }
  };
  fs.writeFileSync(reportPath, JSON.stringify(mockCoverageFail), 'utf8');

  const reportFail = runVerification(configPass, sandboxDir);
  assert.strictEqual(reportFail.overallStatus, 'COVERAGE_THRESHOLD_VIOLATION');
  
  const covResultFail = reportFail.results.find(r => r.commandKey === 'coverage');
  assert.ok(covResultFail);
  assert.strictEqual(covResultFail.status, 'FAIL');
  assert.ok(covResultFail.stderr.includes('"lines" (75%) is below'));

  // Case C: Missing coverage report file
  fs.unlinkSync(reportPath);
  const reportMissing = runVerification(configPass, sandboxDir);
  assert.strictEqual(reportMissing.overallStatus, 'COVERAGE_THRESHOLD_VIOLATION');
  
  const covResultMissing = reportMissing.results.find(r => r.commandKey === 'coverage');
  assert.ok(covResultMissing);
  assert.strictEqual(covResultMissing.status, 'FAIL');
  assert.ok(covResultMissing.stderr.includes('Coverage report file not found'));

  cleanupSandbox();
});

