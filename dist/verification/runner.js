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
Object.defineProperty(exports, "__esModule", { value: true });
exports.dockerUtils = void 0;
exports.runVerification = runVerification;
exports.saveVerificationReports = saveVerificationReports;
const cp = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const policy_1 = require("../safety/policy");
exports.dockerUtils = {
    isDockerAvailable() {
        try {
            cp.execSync('docker info', { stdio: 'ignore', timeout: 3000 });
            return true;
        }
        catch {
            return false;
        }
    },
    executeDocker(args, cwd, env) {
        return cp.spawnSync('docker', args, { cwd, stdio: 'pipe', encoding: 'utf8', env });
    }
};
function runVerification(config, cwd = process.cwd()) {
    const results = [];
    const commands = config.commands;
    const orderKeys = ['lint', 'typecheck', 'test', 'build', 'e2e'];
    const dockerAvailable = config.useSandbox ? exports.dockerUtils.isDockerAvailable() : false;
    const fallbackWarning = (config.useSandbox && !dockerAvailable)
        ? "Sandbox verification: Docker not available or daemon is not running. Falling back to host execution.\n"
        : "";
    for (const key of orderKeys) {
        const cmdLine = commands[key]?.trim() || '';
        if (!cmdLine) {
            results.push({
                commandKey: key,
                commandLine: '',
                status: 'SKIPPED',
                stdout: '',
                stderr: ''
            });
            continue;
        }
        // Check policy
        const policyResult = (0, policy_1.checkCommandPolicy)(cmdLine, config);
        if (!policyResult.allowed) {
            results.push({
                commandKey: key,
                commandLine: cmdLine,
                status: 'BLOCKED',
                stdout: '',
                stderr: '',
                errorMsg: policyResult.reason || 'Command blocked by policy.'
            });
            continue;
        }
        // Execute command
        try {
            let stdout = '';
            let stderr = '';
            let exitCode = 0;
            if (config.useSandbox) {
                if (!dockerAvailable) {
                    if (config.sandboxFallbackToHost) {
                        // Fallback to host execution
                        const execEnv = { ...process.env };
                        if (config.auditSpawnedProcesses) {
                            const auditConfig = {
                                allowGitPush: config.allowGitPush,
                                allowNewDependencies: config.allowNewDependencies,
                                dangerousCommandPolicy: config.dangerousCommandPolicy,
                                protectedFiles: config.protectedFiles
                            };
                            const preloadPath = path.resolve(__dirname, 'preload.js');
                            execEnv.JEWEL_AUDIT_CONFIG = JSON.stringify(auditConfig);
                            const normalizedPreloadPath = preloadPath.replace(/\\/g, '/');
                            const requireOption = `--require "${normalizedPreloadPath}"`;
                            execEnv.NODE_OPTIONS = execEnv.NODE_OPTIONS
                                ? `${requireOption} ${execEnv.NODE_OPTIONS}`
                                : requireOption;
                        }
                        try {
                            const output = cp.execSync(cmdLine, { cwd, stdio: 'pipe', encoding: 'utf8', env: execEnv });
                            stdout = output;
                        }
                        catch (err) {
                            exitCode = err.status !== undefined ? err.status : 1;
                            stdout = err.stdout || '';
                            stderr = err.stderr || '';
                            if (err.message && !stderr && !stdout) {
                                stderr = err.message;
                            }
                        }
                        stderr = fallbackWarning + stderr;
                    }
                    else {
                        // sandbox fallback is false -> FAIL immediately
                        exitCode = 1;
                        stderr = "Sandbox verification failed: Docker is not available or daemon is not running, and sandboxFallbackToHost is disabled.";
                    }
                }
                else {
                    // Docker is available
                    const dockerArgs = [
                        'run',
                        '--rm',
                        '-i',
                        '-v', `${path.resolve(cwd).replace(/\\/g, '/')}:/workspace`,
                        '-w', '/workspace'
                    ];
                    if (process.getuid && process.getgid) {
                        dockerArgs.push('--user', `${process.getuid()}:${process.getgid()}`);
                    }
                    dockerArgs.push('-e', 'HOME');
                    const execEnv = { ...process.env, HOME: '/tmp' };
                    // Mount Jewel's dist
                    dockerArgs.push('-v', `${path.resolve(__dirname, '..').replace(/\\/g, '/')}:/opt/jewel/dist`);
                    if (config.auditSpawnedProcesses) {
                        const auditConfig = {
                            allowGitPush: config.allowGitPush,
                            allowNewDependencies: config.allowNewDependencies,
                            dangerousCommandPolicy: config.dangerousCommandPolicy,
                            protectedFiles: config.protectedFiles
                        };
                        execEnv.JEWEL_AUDIT_CONFIG = JSON.stringify(auditConfig);
                        execEnv.NODE_OPTIONS = '--require /opt/jewel/dist/verification/preload.js';
                        dockerArgs.push('-e', 'JEWEL_AUDIT_CONFIG', '-e', 'NODE_OPTIONS');
                    }
                    if (config.sandboxVolumes) {
                        for (const [host, container] of Object.entries(config.sandboxVolumes)) {
                            const absHost = path.resolve(cwd, host).replace(/\\/g, '/');
                            dockerArgs.push('-v', `${absHost}:${container}`);
                        }
                    }
                    if (config.sandboxEnv) {
                        for (const [key, val] of Object.entries(config.sandboxEnv)) {
                            let resolvedVal = val;
                            if (val.startsWith('$')) {
                                const hostEnvName = val.slice(1);
                                resolvedVal = process.env[hostEnvName] || '';
                            }
                            execEnv[key] = resolvedVal;
                            dockerArgs.push('-e', key);
                        }
                    }
                    const image = config.sandboxImage || 'node:18-slim';
                    dockerArgs.push(image);
                    dockerArgs.push('sh', '-c', cmdLine);
                    const spawnResult = exports.dockerUtils.executeDocker(dockerArgs, cwd, execEnv);
                    stdout = spawnResult.stdout || '';
                    stderr = spawnResult.stderr || '';
                    if (spawnResult.status === null || spawnResult.status === undefined) {
                        exitCode = 1;
                        let errMsg = '';
                        if (spawnResult.error) {
                            errMsg = spawnResult.error.message;
                        }
                        else if (spawnResult.signal) {
                            errMsg = `Docker process terminated by signal: ${spawnResult.signal}`;
                        }
                        else {
                            errMsg = 'Unknown failure starting docker.';
                        }
                        stderr += (stderr ? '\n' : '') + `Docker execution error: ${errMsg}`;
                    }
                    else {
                        exitCode = spawnResult.status;
                    }
                }
            }
            else {
                // Normal host execution
                const execEnv = { ...process.env };
                if (config.auditSpawnedProcesses) {
                    const auditConfig = {
                        allowGitPush: config.allowGitPush,
                        allowNewDependencies: config.allowNewDependencies,
                        dangerousCommandPolicy: config.dangerousCommandPolicy,
                        protectedFiles: config.protectedFiles
                    };
                    const preloadPath = path.resolve(__dirname, 'preload.js');
                    execEnv.JEWEL_AUDIT_CONFIG = JSON.stringify(auditConfig);
                    const normalizedPreloadPath = preloadPath.replace(/\\/g, '/');
                    const requireOption = `--require "${normalizedPreloadPath}"`;
                    execEnv.NODE_OPTIONS = execEnv.NODE_OPTIONS
                        ? `${requireOption} ${execEnv.NODE_OPTIONS}`
                        : requireOption;
                }
                try {
                    const output = cp.execSync(cmdLine, { cwd, stdio: 'pipe', encoding: 'utf8', env: execEnv });
                    stdout = output;
                }
                catch (err) {
                    exitCode = err.status !== undefined ? err.status : 1;
                    stdout = err.stdout || '';
                    stderr = err.stderr || '';
                    if (err.message && !stderr && !stdout) {
                        stderr = err.message;
                    }
                }
            }
            results.push({
                commandKey: key,
                commandLine: cmdLine,
                status: exitCode === 0 ? 'PASS' : 'FAIL',
                exitCode,
                stdout: (0, secret_redactor_1.redactSecrets)(stdout),
                stderr: (0, secret_redactor_1.redactSecrets)(stderr)
            });
        }
        catch (err) {
            results.push({
                commandKey: key,
                commandLine: cmdLine,
                status: 'FAIL',
                exitCode: 99,
                stdout: '',
                stderr: (0, secret_redactor_1.redactSecrets)(err.message || 'Execution error.')
            });
        }
    }
    // Check if everything else passed first before running coverage check
    const initialFail = results.some(r => r.status === 'FAIL');
    const initialBlocked = results.some(r => r.status === 'BLOCKED');
    if (!initialFail && !initialBlocked && config.minCoverage) {
        const covResult = checkCoverage(config, cwd);
        if (!covResult.success) {
            results.push({
                commandKey: 'coverage',
                commandLine: 'Check code coverage',
                status: 'FAIL',
                stdout: '',
                stderr: covResult.findings.join('\n')
            });
        }
        else {
            results.push({
                commandKey: 'coverage',
                commandLine: 'Check code coverage',
                status: 'PASS',
                stdout: 'All configured coverage thresholds satisfied.',
                stderr: ''
            });
        }
    }
    // Calculate stats
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let blocked = 0;
    for (const r of results) {
        if (r.status === 'PASS')
            passed++;
        else if (r.status === 'FAIL')
            failed++;
        else if (r.status === 'SKIPPED')
            skipped++;
        else if (r.status === 'BLOCKED')
            blocked++;
    }
    // Determine overall status
    let overallStatus = 'PASS';
    const hasCoverageFail = results.some(r => r.commandKey === 'coverage' && r.status === 'FAIL');
    if (failed > 0) {
        overallStatus = hasCoverageFail ? 'COVERAGE_THRESHOLD_VIOLATION' : 'FAIL';
    }
    else if (blocked > 0) {
        overallStatus = 'BLOCKED';
    }
    else if (passed === 0 && skipped > 0) {
        overallStatus = 'SKIPPED';
    }
    const report = {
        projectName: config.projectName || path.basename(cwd),
        date: new Date().toISOString(),
        mode: config.mode,
        overallStatus,
        stats: { passed, failed, skipped, blocked },
        results
    };
    saveVerificationReports(report, cwd, config.reportFormat);
    return report;
}
function checkCoverage(config, cwd) {
    const findings = [];
    if (!config.minCoverage) {
        return { success: true, findings };
    }
    const reportPath = config.coverageReportPath
        ? path.resolve(cwd, config.coverageReportPath)
        : path.resolve(cwd, 'coverage/coverage-summary.json');
    if (!fs.existsSync(reportPath)) {
        findings.push(`Coverage report file not found at: ${reportPath}`);
        return { success: false, findings };
    }
    try {
        const content = fs.readFileSync(reportPath, 'utf8');
        const data = JSON.parse(content);
        const total = data.total;
        if (!total) {
            findings.push('Invalid coverage report: "total" field missing.');
            return { success: false, findings };
        }
        const metrics = ['lines', 'statements', 'functions', 'branches'];
        let failed = false;
        for (const metric of metrics) {
            const threshold = config.minCoverage[metric];
            if (threshold === undefined)
                continue;
            const metricData = total[metric];
            if (!metricData) {
                findings.push(`Coverage metric "${metric}" missing from report.`);
                failed = true;
                continue;
            }
            const pctVal = metricData.pct;
            const pct = typeof pctVal === 'number' ? pctVal : parseFloat(pctVal);
            if (isNaN(pct)) {
                findings.push(`Coverage metric "${metric}" has invalid percentage: ${pctVal}`);
                failed = true;
            }
            else if (pct < threshold) {
                findings.push(`Coverage for "${metric}" (${pct}%) is below the configured threshold (${threshold}%).`);
                failed = true;
            }
        }
        return { success: !failed, findings };
    }
    catch (err) {
        findings.push(`Failed to parse coverage report: ${err.message}`);
        return { success: false, findings };
    }
}
const secret_redactor_1 = require("../safety/secret-redactor");
function saveVerificationReports(report, cwd, formats) {
    const reportsDir = path.join(cwd, '.jewel', 'reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }
    if (formats.includes('json')) {
        const jsonPath = path.join(reportsDir, 'latest.json');
        fs.writeFileSync(jsonPath, (0, secret_redactor_1.redactSecrets)(JSON.stringify(report, null, 2)), 'utf8');
    }
    if (formats.includes('markdown')) {
        const mdPath = path.join(reportsDir, 'latest.md');
        fs.writeFileSync(mdPath, (0, secret_redactor_1.redactSecrets)(generateMarkdownReport(report)), 'utf8');
    }
}
function generateMarkdownReport(report) {
    let md = `# Jewel Verification Report\n\n`;
    md += `**Project:** ${report.projectName}\n`;
    md += `**Date:** ${report.date}\n`;
    md += `**Mode:** ${report.mode}\n\n`;
    md += `## Commands\n\n`;
    md += `| Command Key | Command | Status | Exit Code |\n`;
    md += `|---|---|---|---|\n`;
    for (const r of report.results) {
        const cmdStr = r.commandLine ? `\`${r.commandLine}\`` : '*Skipped*';
        const exitCodeStr = r.exitCode !== undefined ? r.exitCode.toString() : '-';
        md += `| ${r.commandKey} | ${cmdStr} | **${r.status}** | ${exitCodeStr} |\n`;
    }
    md += `\n`;
    md += `## Summary\n\n`;
    md += `**Overall status:** **${report.overallStatus}**\n`;
    md += `- Passed: ${report.stats.passed}\n`;
    md += `- Failed: ${report.stats.failed}\n`;
    md += `- Skipped: ${report.stats.skipped}\n`;
    md += `- Blocked: ${report.stats.blocked}\n\n`;
    md += `## Evidence\n\n`;
    for (const r of report.results) {
        if (r.status === 'SKIPPED')
            continue;
        md += `### Command: \`${r.commandKey}\` (${r.status})\n`;
        if (r.errorMsg) {
            md += `*Reason:* ${r.errorMsg}\n`;
        }
        if (r.stdout) {
            md += `**stdout:**\n\`\`\`\n${r.stdout.trim()}\n\`\`\`\n`;
        }
        if (r.stderr) {
            md += `**stderr:**\n\`\`\`\n${r.stderr.trim()}\n\`\`\`\n`;
        }
        if (!r.stdout && !r.stderr && !r.errorMsg) {
            md += `*No output recorded.*\n`;
        }
        md += `\n`;
    }
    return md;
}
