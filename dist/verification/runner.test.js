"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const node_assert_1 = __importDefault(require("node:assert"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const runner_1 = require("./runner");
const config_1 = require("../core/config");
const sandboxDir = path.join(__dirname, '../../sandbox-test-verification');
function cleanupSandbox() {
    if (fs.existsSync(sandboxDir)) {
        fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
}
(0, node_test_1.default)('verification runner - full cycle', () => {
    cleanupSandbox();
    fs.mkdirSync(sandboxDir, { recursive: true });
    // 1. Set up a config with mixed commands
    const config = {
        ...config_1.DEFAULT_CONFIG,
        commands: {
            lint: 'node -e "console.log(\'Linting passed\')"', // Passing
            typecheck: 'node -e "console.error(\'Typecheck warning\'); process.exit(0)"', // Passing with stderr
            test: 'node -e "console.log(\'Tests failed\'); process.exit(1)"', // Failing
            build: '', // Skipped
            e2e: 'git push origin main' // Blocked (due to default git push policy)
        }
    };
    const report = (0, runner_1.runVerification)(config, sandboxDir);
    // Check stats
    node_assert_1.default.strictEqual(report.overallStatus, 'FAIL'); // because test command failed
    node_assert_1.default.strictEqual(report.stats.passed, 2); // lint, typecheck
    node_assert_1.default.strictEqual(report.stats.failed, 1); // test
    node_assert_1.default.strictEqual(report.stats.skipped, 1); // build
    node_assert_1.default.strictEqual(report.stats.blocked, 1); // e2e (due to policy check)
    // Verify command details
    const lintResult = report.results.find(r => r.commandKey === 'lint');
    node_assert_1.default.ok(lintResult);
    node_assert_1.default.strictEqual(lintResult.status, 'PASS');
    node_assert_1.default.strictEqual(lintResult.exitCode, 0);
    node_assert_1.default.ok(lintResult.stdout.includes('Linting passed'));
    const testResult = report.results.find(r => r.commandKey === 'test');
    node_assert_1.default.ok(testResult);
    node_assert_1.default.strictEqual(testResult.status, 'FAIL');
    node_assert_1.default.strictEqual(testResult.exitCode, 1);
    node_assert_1.default.ok(testResult.stdout.includes('Tests failed'));
    const buildResult = report.results.find(r => r.commandKey === 'build');
    node_assert_1.default.ok(buildResult);
    node_assert_1.default.strictEqual(buildResult.status, 'SKIPPED');
    const e2eResult = report.results.find(r => r.commandKey === 'e2e');
    node_assert_1.default.ok(e2eResult);
    node_assert_1.default.strictEqual(e2eResult.status, 'BLOCKED');
    // Verify files generated
    const reportsDir = path.join(sandboxDir, '.jewel', 'reports');
    node_assert_1.default.ok(fs.existsSync(path.join(reportsDir, 'latest.json')));
    node_assert_1.default.ok(fs.existsSync(path.join(reportsDir, 'latest.md')));
    const jsonContent = JSON.parse(fs.readFileSync(path.join(reportsDir, 'latest.json'), 'utf8'));
    node_assert_1.default.strictEqual(jsonContent.overallStatus, 'FAIL');
    const mdContent = fs.readFileSync(path.join(reportsDir, 'latest.md'), 'utf8');
    node_assert_1.default.ok(mdContent.includes('# Jewel Verification Report'));
    node_assert_1.default.ok(mdContent.includes('| lint | `node -e "console.log(\'Linting passed\')"` | **PASS** | 0 |'));
    cleanupSandbox();
});
(0, node_test_1.default)('verification runner - coverage validation', () => {
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
    const configPass = {
        ...config_1.DEFAULT_CONFIG,
        minCoverage: { lines: 80, branches: 75 },
        coverageReportPath: './coverage/coverage-summary.json',
        commands: {
            ...config_1.DEFAULT_CONFIG.commands,
            test: 'node -e "process.exit(0)"'
        }
    };
    const reportPass = (0, runner_1.runVerification)(configPass, sandboxDir);
    node_assert_1.default.strictEqual(reportPass.overallStatus, 'PASS');
    const covResultPass = reportPass.results.find(r => r.commandKey === 'coverage');
    node_assert_1.default.ok(covResultPass);
    node_assert_1.default.strictEqual(covResultPass.status, 'PASS');
    // Case B: Coverage below thresholds
    const mockCoverageFail = {
        total: {
            lines: { pct: 75 }, // below 80
            branches: { pct: 80 }
        }
    };
    fs.writeFileSync(reportPath, JSON.stringify(mockCoverageFail), 'utf8');
    const reportFail = (0, runner_1.runVerification)(configPass, sandboxDir);
    node_assert_1.default.strictEqual(reportFail.overallStatus, 'COVERAGE_THRESHOLD_VIOLATION');
    const covResultFail = reportFail.results.find(r => r.commandKey === 'coverage');
    node_assert_1.default.ok(covResultFail);
    node_assert_1.default.strictEqual(covResultFail.status, 'FAIL');
    node_assert_1.default.ok(covResultFail.stderr.includes('"lines" (75%) is below'));
    // Case C: Missing coverage report file
    fs.unlinkSync(reportPath);
    const reportMissing = (0, runner_1.runVerification)(configPass, sandboxDir);
    node_assert_1.default.strictEqual(reportMissing.overallStatus, 'COVERAGE_THRESHOLD_VIOLATION');
    const covResultMissing = reportMissing.results.find(r => r.commandKey === 'coverage');
    node_assert_1.default.ok(covResultMissing);
    node_assert_1.default.strictEqual(covResultMissing.status, 'FAIL');
    node_assert_1.default.ok(covResultMissing.stderr.includes('Coverage report file not found'));
    cleanupSandbox();
});
(0, node_test_1.default)('verification runner - process auditing', () => {
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
    const configWithAudit = {
        ...config_1.DEFAULT_CONFIG,
        auditSpawnedProcesses: true,
        commands: {
            ...config_1.DEFAULT_CONFIG.commands,
            test: 'node trigger.js'
        }
    };
    const reportWithAudit = (0, runner_1.runVerification)(configWithAudit, sandboxDir);
    node_assert_1.default.strictEqual(reportWithAudit.overallStatus, 'FAIL');
    const testResult = reportWithAudit.results.find(r => r.commandKey === 'test');
    node_assert_1.default.ok(testResult);
    node_assert_1.default.strictEqual(testResult.status, 'FAIL');
    node_assert_1.default.ok(testResult.stderr.includes('Jewel Process Auditor') || testResult.stderr.includes('Command blocked'));
    // 2. Config with process auditing disabled
    const configWithoutAudit = {
        ...config_1.DEFAULT_CONFIG,
        auditSpawnedProcesses: false,
        commands: {
            ...config_1.DEFAULT_CONFIG.commands,
            test: 'node trigger.js'
        }
    };
    const reportWithoutAudit = (0, runner_1.runVerification)(configWithoutAudit, sandboxDir);
    const testResultNoAudit = reportWithoutAudit.results.find(r => r.commandKey === 'test');
    node_assert_1.default.ok(testResultNoAudit);
    node_assert_1.default.ok(!testResultNoAudit.stderr.includes('Jewel Process Auditor'));
    cleanupSandbox();
});
