import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { runVerification, dockerUtils } from './runner';
import { DEFAULT_CONFIG, JewelConfig } from '../core/config';

const sandboxDir = path.join(__dirname, '../../sandbox-test-verification');

function cleanupSandbox() {
  if (fs.existsSync(sandboxDir)) {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
}

test('verification runner - full cycle', async () => {
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

  const report = await runVerification(config, sandboxDir);

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

test('verification runner - coverage validation', async () => {
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

  const reportPass = await runVerification(configPass, sandboxDir);
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

  const reportFail = await runVerification(configPass, sandboxDir);
  assert.strictEqual(reportFail.overallStatus, 'COVERAGE_THRESHOLD_VIOLATION');
  
  const covResultFail = reportFail.results.find(r => r.commandKey === 'coverage');
  assert.ok(covResultFail);
  assert.strictEqual(covResultFail.status, 'FAIL');
  assert.ok(covResultFail.stderr.includes('"lines" (75%) is below'));

  // Case C: Missing coverage report file
  if (fs.existsSync(reportPath)) {
    fs.unlinkSync(reportPath);
  }
  const reportMissing = await runVerification(configPass, sandboxDir);
  assert.strictEqual(reportMissing.overallStatus, 'COVERAGE_THRESHOLD_VIOLATION');
  
  const covResultMissing = reportMissing.results.find(r => r.commandKey === 'coverage');
  assert.ok(covResultMissing);
  assert.strictEqual(covResultMissing.status, 'FAIL');
  assert.ok(covResultMissing.stderr.includes('Coverage report file not found'));

  cleanupSandbox();
});

test('verification runner - process auditing', async () => {
  cleanupSandbox();
  fs.mkdirSync(sandboxDir, { recursive: true });

  // Create a trigger script that attempts to run a blocked command
  const triggerPath = path.join(sandboxDir, 'trigger.js');
  fs.writeFileSync(triggerPath, `
    const { execSync } = require('child_process');
    try {
      execSync('git push origin main');
    } catch (err) {
      console.error('TRIGGER_ERR:' + err.message);
      process.exit(1);
    }
  `);

  // 1. Config with process auditing enabled
  const configWithAudit: JewelConfig = {
    ...DEFAULT_CONFIG,
    auditSpawnedProcesses: true,
    commands: {
      ...DEFAULT_CONFIG.commands,
      test: 'node trigger.js'
    }
  };

  const reportWithAudit = await runVerification(configWithAudit, sandboxDir);
  assert.strictEqual(reportWithAudit.overallStatus, 'FAIL');
  
  const testResult = reportWithAudit.results.find(r => r.commandKey === 'test');
  assert.ok(testResult);
  assert.strictEqual(testResult.status, 'FAIL');
  assert.ok(testResult.stderr.includes('Jewel Process Auditor') || testResult.stderr.includes('Command blocked'));

  // 2. Config with process auditing disabled
  const configWithoutAudit: JewelConfig = {
    ...DEFAULT_CONFIG,
    auditSpawnedProcesses: false,
    commands: {
      ...DEFAULT_CONFIG.commands,
      test: 'node trigger.js'
    }
  };

  const reportWithoutAudit = await runVerification(configWithoutAudit, sandboxDir);
  const testResultNoAudit = reportWithoutAudit.results.find(r => r.commandKey === 'test');
  assert.ok(testResultNoAudit);
  assert.ok(!testResultNoAudit.stderr.includes('Jewel Process Auditor'));

  cleanupSandbox();
});

test('verification runner - sandbox fallback to host when docker is unavailable', async (t) => {
  cleanupSandbox();
  fs.mkdirSync(sandboxDir, { recursive: true });

  // 1. Stub isDockerAvailable to return false
  t.mock.method(dockerUtils, 'isDockerAvailable', () => false);

  // Case A: fallback is allowed (sandboxFallbackToHost: true)
  const configFallback: JewelConfig = {
    ...DEFAULT_CONFIG,
    useSandbox: true,
    sandboxFallbackToHost: true,
    commands: {
      ...DEFAULT_CONFIG.commands,
      test: 'node -e "console.log(\'host ran\'); process.exit(0)"'
    }
  };

  const reportFallback = await runVerification(configFallback, sandboxDir);
  assert.strictEqual(reportFallback.overallStatus, 'PASS');
  const testResultFallback = reportFallback.results.find(r => r.commandKey === 'test');
  assert.ok(testResultFallback);
  assert.strictEqual(testResultFallback.status, 'PASS');
  assert.ok(testResultFallback.stderr.includes('Docker not available'));
  assert.ok(testResultFallback.stdout.includes('host ran'));

  // Case B: fallback is blocked (sandboxFallbackToHost: false)
  const configNoFallback: JewelConfig = {
    ...DEFAULT_CONFIG,
    useSandbox: true,
    sandboxFallbackToHost: false,
    commands: {
      ...DEFAULT_CONFIG.commands,
      test: 'node -e "console.log(\'should not run\')"'
    }
  };

  const reportNoFallback = await runVerification(configNoFallback, sandboxDir);
  assert.strictEqual(reportNoFallback.overallStatus, 'FAIL');
  const testResultNoFallback = reportNoFallback.results.find(r => r.commandKey === 'test');
  assert.ok(testResultNoFallback);
  assert.strictEqual(testResultNoFallback.status, 'FAIL');
  assert.strictEqual(testResultNoFallback.exitCode, 1);
  assert.ok(testResultNoFallback.stderr.includes('sandboxFallbackToHost is disabled'));

  cleanupSandbox();
});

test('verification runner - sandbox docker execution and command assembly', async (t) => {
  cleanupSandbox();
  fs.mkdirSync(sandboxDir, { recursive: true });

  // 1. Stub isDockerAvailable to return true
  t.mock.method(dockerUtils, 'isDockerAvailable', () => true);

  // 2. Stub executeDocker to capture arguments and environment, returning success mock
  let capturedArgs: string[] = [];
  let capturedCwd = '';
  let capturedEnv: any = null;

  t.mock.method(dockerUtils, 'executeDocker', async (args: string[], cwd: string, env: any, onChunk?: any) => {
    capturedArgs = args;
    capturedCwd = cwd;
    capturedEnv = env;
    if (onChunk) {
      onChunk('Docker command output', 'stdout');
      onChunk('Docker warnings', 'stderr');
    }
    return {
      status: 0,
      signal: null,
      stdout: 'Docker command output',
      stderr: 'Docker warnings',
      error: undefined
    };
  });

  process.env.TEST_HOST_SECRET = 'my_super_secret_value';

  const config: JewelConfig = {
    ...DEFAULT_CONFIG,
    useSandbox: true,
    sandboxImage: 'node:custom',
    sandboxVolumes: { './my-host-data': '/opt/data' },
    sandboxEnv: {
      'SECRET': '$TEST_HOST_SECRET',
      'STATIC_VAL': 'hello-sandbox'
    },
    auditSpawnedProcesses: true,
    commands: {
      ...DEFAULT_CONFIG.commands,
      test: 'npm run test'
    }
  };

  const report = await runVerification(config, sandboxDir);

  // Check verification report status
  assert.strictEqual(report.overallStatus, 'PASS');
  const testResult = report.results.find(r => r.commandKey === 'test');
  assert.ok(testResult);
  assert.strictEqual(testResult.status, 'PASS');
  assert.strictEqual(testResult.stdout, 'Docker command output');

  // Verify command line parameters assembly
  assert.strictEqual(capturedCwd, sandboxDir);
  
  // Docker run parameters
  assert.ok(capturedArgs.includes('run'));
  assert.ok(capturedArgs.includes('--rm'));
  assert.ok(capturedArgs.includes('-i'));

  // Host mount directory normalized to use forward slashes
  const expectedCwdMount = path.resolve(sandboxDir).replace(/\\/g, '/');
  assert.ok(capturedArgs.includes(`${expectedCwdMount}:/workspace`));

  // Custom volumes
  const expectedCustomHostMount = path.resolve(sandboxDir, './my-host-data').replace(/\\/g, '/');
  assert.ok(capturedArgs.includes(`${expectedCustomHostMount}:/opt/data`));

  // Default slim node image override
  assert.ok(capturedArgs.includes('node:custom'));

  // Commands passed inside container sh -c shell wrapping
  assert.strictEqual(capturedArgs[capturedArgs.length - 3], 'sh');
  assert.strictEqual(capturedArgs[capturedArgs.length - 2], '-c');
  assert.strictEqual(capturedArgs[capturedArgs.length - 1], 'npm run test');

  // Secret environment variable mapping and export without exposing in command line arguments list
  assert.ok(capturedArgs.includes('SECRET'));
  assert.ok(capturedArgs.includes('STATIC_VAL'));
  assert.ok(capturedArgs.includes('HOME'));
  
  // Verify that secrets are NOT exposed as KEY=VALUE on the command line arguments
  assert.ok(!capturedArgs.some(arg => arg.includes('my_super_secret_value')));
  assert.ok(!capturedArgs.some(arg => arg.includes('hello-sandbox')));

  // Verify that env values are correctly bound in the execution env object
  assert.strictEqual(capturedEnv.SECRET, 'my_super_secret_value');
  assert.strictEqual(capturedEnv.STATIC_VAL, 'hello-sandbox');
  assert.strictEqual(capturedEnv.HOME, '/tmp');
  assert.ok(capturedEnv.JEWEL_AUDIT_CONFIG);
  assert.strictEqual(capturedEnv.NODE_OPTIONS, '--require /opt/jewel/dist/verification/preload.js');

  delete process.env.TEST_HOST_SECRET;
  cleanupSandbox();
});

test('verification runner - sandbox process error and signal handling', async (t) => {
  cleanupSandbox();
  fs.mkdirSync(sandboxDir, { recursive: true });

  t.mock.method(dockerUtils, 'isDockerAvailable', () => true);

  // Case A: spawnSync fails with error (status: null, error info present)
  t.mock.method(dockerUtils, 'executeDocker', async () => {
    return {
      status: null,
      signal: null,
      stdout: '',
      stderr: '',
      error: new Error('Docker daemon connection refused')
    };
  });

  const configErr: JewelConfig = {
    ...DEFAULT_CONFIG,
    useSandbox: true,
    commands: {
      ...DEFAULT_CONFIG.commands,
      test: 'npm test'
    }
  };

  const reportErr = await runVerification(configErr, sandboxDir);
  assert.strictEqual(reportErr.overallStatus, 'FAIL');
  const testResultErr = reportErr.results.find(r => r.commandKey === 'test');
  assert.ok(testResultErr);
  assert.strictEqual(testResultErr.status, 'FAIL');
  assert.strictEqual(testResultErr.exitCode, 1);
  assert.ok(testResultErr.stderr.includes('Docker daemon connection refused'));

  // Case B: process terminated by signal (status: null, signal present)
  t.mock.method(dockerUtils, 'executeDocker', async () => {
    return {
      status: null,
      signal: 'SIGKILL',
      stdout: '',
      stderr: '',
      error: undefined
    };
  });

  const reportSig = await runVerification(configErr, sandboxDir);
  assert.strictEqual(reportSig.overallStatus, 'FAIL');
  const testResultSig = reportSig.results.find(r => r.commandKey === 'test');
  assert.ok(testResultSig);
  assert.strictEqual(testResultSig.status, 'FAIL');
  assert.strictEqual(testResultSig.exitCode, 1);
  assert.ok(testResultSig.stderr.includes('SIGKILL'));

  cleanupSandbox();
});
