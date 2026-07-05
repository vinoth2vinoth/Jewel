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
const loader_1 = require("../plugins/loader");
const runner_1 = require("../plugins/runner");
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
    executeDocker(args, cwd, env, onChunk) {
        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';
            let error;
            let completed = false;
            const child = cp.spawn('docker', args, { cwd, env });
            child.stdout.on('data', (data) => {
                const str = data.toString();
                stdout += str;
                if (onChunk)
                    onChunk(str, 'stdout');
            });
            child.stderr.on('data', (data) => {
                const str = data.toString();
                stderr += str;
                if (onChunk)
                    onChunk(str, 'stderr');
            });
            child.on('error', (err) => {
                error = err;
                if (!completed) {
                    completed = true;
                    resolve({ status: null, signal: null, stdout, stderr, error });
                }
            });
            child.on('close', (status, signal) => {
                if (!completed) {
                    completed = true;
                    resolve({ status, signal, stdout, stderr, error });
                }
            });
        });
    }
};
function executeHost(cmdLine, cwd, env, onChunk) {
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let error;
        let completed = false;
        const child = cp.spawn(cmdLine, [], { cwd, env, shell: true });
        child.stdout.on('data', (data) => {
            const str = data.toString();
            stdout += str;
            if (onChunk)
                onChunk(str, 'stdout');
        });
        child.stderr.on('data', (data) => {
            const str = data.toString();
            stderr += str;
            if (onChunk)
                onChunk(str, 'stderr');
        });
        child.on('error', (err) => {
            error = err;
            if (!completed) {
                completed = true;
                resolve({ status: null, signal: null, stdout, stderr, error });
            }
        });
        child.on('close', (status, signal) => {
            if (!completed) {
                completed = true;
                resolve({ status, signal, stdout, stderr, error });
            }
        });
    });
}
async function runVerification(config, cwd = process.cwd(), onProgress) {
    // Validate and pre-create write paths if sandbox is enabled
    if (config.useSandbox && config.sandboxReadOnlyRoot && config.sandboxWritePaths) {
        const realCwd = fs.realpathSync(cwd);
        for (const wp of config.sandboxWritePaths) {
            const absWritePath = path.resolve(cwd, wp);
            // Verify type if host path exists
            if (fs.existsSync(absWritePath)) {
                if (!fs.statSync(absWritePath).isDirectory()) {
                    throw new Error(`Invalid sandboxWritePath: "${wp}" exists on host but is a file, not a directory.`);
                }
            }
            else {
                // Host pre-creation of writable directory
                try {
                    fs.mkdirSync(absWritePath, { recursive: true });
                }
                catch { }
            }
            // Resolve realpath with user-friendly error wrapping
            let realWritePath;
            try {
                realWritePath = fs.realpathSync(absWritePath);
            }
            catch (err) {
                throw new Error(`Invalid sandboxWritePath: "${wp}" could not be resolved or created on the host. Error: ${err.message}`);
            }
            // Symlink escape validation via path.relative checks
            const relative = path.relative(realCwd, realWritePath);
            const normalizedRelative = relative.replace(/\\/g, '/');
            const isOutsideOrSame = normalizedRelative === '' || normalizedRelative === '..' || normalizedRelative.startsWith('../') || path.isAbsolute(relative);
            if (isOutsideOrSame) {
                throw new Error(`Security Violation: sandboxWritePath "${wp}" resolves outside the workspace root.`);
            }
        }
    }
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
            if (onProgress) {
                onProgress({ key, stdout: '', stderr: '', status: 'SKIPPED' });
            }
            continue;
        }
        // Check policy
        const policyResult = (0, policy_1.checkCommandPolicy)(cmdLine, config);
        if (!policyResult.allowed) {
            const errorMsg = policyResult.reason || 'Command blocked by policy.';
            results.push({
                commandKey: key,
                commandLine: cmdLine,
                status: 'BLOCKED',
                stdout: '',
                stderr: '',
                errorMsg
            });
            if (onProgress) {
                onProgress({ key, stdout: '', stderr: errorMsg, status: 'BLOCKED' });
            }
            continue;
        }
        if (onProgress) {
            onProgress({ key, stdout: '', stderr: '', status: 'RUNNING' });
        }
        // Execute command
        try {
            let stdout = '';
            let stderr = '';
            let exitCode = 0;
            const handleChunk = (chunk, type) => {
                if (type === 'stdout') {
                    stdout += chunk;
                }
                else {
                    stderr += chunk;
                }
                if (onProgress) {
                    onProgress({ key, stdout, stderr, status: 'RUNNING' });
                }
            };
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
                        const res = await executeHost(cmdLine, cwd, execEnv, handleChunk);
                        if (res.error) {
                            exitCode = 99;
                            stderr += (stderr ? '\n' : '') + `Execution error: ${res.error.message}`;
                        }
                        else {
                            exitCode = res.status !== null ? res.status : 1;
                        }
                        stderr = fallbackWarning + stderr;
                    }
                    else {
                        // sandbox fallback is false -> FAIL immediately
                        exitCode = 1;
                        stderr = "Sandbox verification failed: Docker is not available or daemon is not running, and sandboxFallbackToHost is disabled.";
                        if (onProgress) {
                            onProgress({ key, stdout: '', stderr, status: 'FAIL' });
                        }
                    }
                }
                else {
                    // Docker is available
                    const dockerArgs = [
                        'run',
                        '--rm',
                        '-i'
                    ];
                    // Mount workspace based on read-only setting
                    const resolvedCwd = path.resolve(cwd).replace(/\\/g, '/');
                    if (config.sandboxReadOnlyRoot) {
                        dockerArgs.push('-v', `${resolvedCwd}:/workspace:ro`);
                        // Add read-write mounts
                        if (config.sandboxWritePaths) {
                            for (const wp of config.sandboxWritePaths) {
                                const absWritePath = path.resolve(cwd, wp);
                                const resolvedWritePath = absWritePath.replace(/\\/g, '/');
                                const containerWritePath = wp.replace(/\\/g, '/');
                                dockerArgs.push('-v', `${resolvedWritePath}:/workspace/${containerWritePath}:rw`);
                            }
                        }
                    }
                    else {
                        dockerArgs.push('-v', `${resolvedCwd}:/workspace`);
                    }
                    dockerArgs.push('-w', '/workspace');
                    // Network restriction configuration
                    const net = config.sandboxNetwork || 'none';
                    dockerArgs.push('--network', net);
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
                    const spawnResult = await exports.dockerUtils.executeDocker(dockerArgs, cwd, execEnv, handleChunk);
                    if (spawnResult.error) {
                        exitCode = 1;
                        stderr += (stderr ? '\n' : '') + `Docker execution error: ${spawnResult.error.message}`;
                    }
                    else if (spawnResult.status === null || spawnResult.status === undefined) {
                        exitCode = 1;
                        let errMsg = '';
                        if (spawnResult.signal) {
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
                const res = await executeHost(cmdLine, cwd, execEnv, handleChunk);
                if (res.error) {
                    exitCode = 99;
                    stderr += (stderr ? '\n' : '') + `Execution error: ${res.error.message}`;
                }
                else {
                    exitCode = res.status !== null ? res.status : 1;
                }
            }
            const status = exitCode === 0 ? 'PASS' : 'FAIL';
            results.push({
                commandKey: key,
                commandLine: cmdLine,
                status,
                exitCode,
                stdout: (0, secret_redactor_1.redactSecrets)(stdout),
                stderr: (0, secret_redactor_1.redactSecrets)(stderr)
            });
            if (onProgress) {
                onProgress({ key, stdout, stderr, status });
            }
        }
        catch (err) {
            const errorMsg = err.message || 'Execution error.';
            results.push({
                commandKey: key,
                commandLine: cmdLine,
                status: 'FAIL',
                exitCode: 99,
                stdout: '',
                stderr: (0, secret_redactor_1.redactSecrets)(errorMsg)
            });
            if (onProgress) {
                onProgress({ key, stdout: '', stderr: errorMsg, status: 'FAIL' });
            }
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
    if (config.pluginsEnabled !== false) {
        const verifierPlugins = (0, loader_1.loadPluginsByType)(cwd, 'verifier');
        for (const entry of (0, runner_1.runPlugins)(verifierPlugins, { cwd, verification: { overallStatus, results } })) {
            const pluginFailed = entry.result.status === 'FAIL' || entry.result.status === 'BLOCK';
            results.push({
                commandKey: `plugin:${entry.plugin.name}`,
                commandLine: entry.plugin.command,
                status: pluginFailed ? 'FAIL' : 'PASS',
                stdout: entry.result.findings.join('\n'),
                stderr: ''
            });
            if (pluginFailed) {
                failed++;
                if (entry.plugin.blockOnFail || entry.result.status === 'BLOCK') {
                    overallStatus = 'FAIL';
                }
            }
            else {
                passed++;
            }
        }
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
