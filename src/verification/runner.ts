import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { JewelConfig } from '../core/config';
import { checkCommandPolicy, redactSecrets } from '../safety/policy';

export interface CommandResult {
  commandKey: string;
  commandLine: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
  exitCode?: number;
  stdout: string;
  stderr: string;
  errorMsg?: string;
}

export interface VerificationReport {
  projectName: string;
  date: string;
  mode: 'strict' | 'lax';
  overallStatus: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
  stats: {
    passed: number;
    failed: number;
    skipped: number;
    blocked: number;
  };
  results: CommandResult[];
}

export function runVerification(config: JewelConfig, cwd: string = process.cwd()): VerificationReport {
  const results: CommandResult[] = [];
  const commands = config.commands;

  const orderKeys: (keyof typeof commands)[] = ['lint', 'typecheck', 'test', 'build', 'e2e'];

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
    const policyResult = checkCommandPolicy(cmdLine, config);
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
        const output = execSync(cmdLine, { cwd, stdio: 'pipe', encoding: 'utf8' });
        stdout = output;
      } catch (err: any) {
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
        stdout: redactSecrets(stdout),
        stderr: redactSecrets(stderr)
      });
    } catch (err: any) {
      results.push({
        commandKey: key,
        commandLine: cmdLine,
        status: 'FAIL',
        exitCode: 99,
        stdout: '',
        stderr: redactSecrets(err.message || 'Execution error.')
      });
    }
  }

  // Calculate stats
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let blocked = 0;

  for (const r of results) {
    if (r.status === 'PASS') passed++;
    else if (r.status === 'FAIL') failed++;
    else if (r.status === 'SKIPPED') skipped++;
    else if (r.status === 'BLOCKED') blocked++;
  }

  // Determine overall status
  let overallStatus: VerificationReport['overallStatus'] = 'PASS';
  if (failed > 0) {
    overallStatus = 'FAIL';
  } else if (blocked > 0) {
    overallStatus = 'BLOCKED';
  } else if (passed === 0 && skipped > 0) {
    overallStatus = 'SKIPPED';
  }

  const report: VerificationReport = {
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

export function saveVerificationReports(report: VerificationReport, cwd: string, formats: ('markdown' | 'json')[]) {
  const reportsDir = path.join(cwd, '.jewel', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  if (formats.includes('json')) {
    const jsonPath = path.join(reportsDir, 'latest.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  }

  if (formats.includes('markdown')) {
    const mdPath = path.join(reportsDir, 'latest.md');
    fs.writeFileSync(mdPath, generateMarkdownReport(report), 'utf8');
  }
}

function generateMarkdownReport(report: VerificationReport): string {
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
    if (r.status === 'SKIPPED') continue;
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
