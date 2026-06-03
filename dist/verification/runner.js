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
exports.runVerification = runVerification;
exports.saveVerificationReports = saveVerificationReports;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const policy_1 = require("../safety/policy");
function runVerification(config, cwd = process.cwd()) {
    const results = [];
    const commands = config.commands;
    const orderKeys = ['lint', 'typecheck', 'test', 'build', 'e2e'];
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
            // Run with combined stdout & stderr or capture separately
            // Using execSync is simple and captures stdout directly. 
            // To capture both stdout and stderr, we can pass stdio: 'pipe' or similar.
            let stdout = '';
            let stderr = '';
            let exitCode = 0;
            try {
                const output = (0, child_process_1.execSync)(cmdLine, { cwd, stdio: 'pipe', encoding: 'utf8' });
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
    if (failed > 0) {
        overallStatus = 'FAIL';
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
