import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { JewelConfig } from '../core/config';
import { checkCommandPolicy } from '../safety/policy';

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
  overallStatus: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED' | 'COVERAGE_THRESHOLD_VIOLATION';
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
        const output = execSync(cmdLine, { cwd, stdio: 'pipe', encoding: 'utf8', env: execEnv });
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
    } else {
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
    if (r.status === 'PASS') passed++;
    else if (r.status === 'FAIL') failed++;
    else if (r.status === 'SKIPPED') skipped++;
    else if (r.status === 'BLOCKED') blocked++;
  }

  // Determine overall status
  let overallStatus: VerificationReport['overallStatus'] = 'PASS';
  const hasCoverageFail = results.some(r => r.commandKey === 'coverage' && r.status === 'FAIL');

  if (failed > 0) {
    overallStatus = hasCoverageFail ? 'COVERAGE_THRESHOLD_VIOLATION' : 'FAIL';
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

interface CoverageSummary {
  total?: {
    [key: string]: {
      pct?: number | string;
    };
  };
}

function checkCoverage(config: JewelConfig, cwd: string): { success: boolean; findings: string[] } {
  const findings: string[] = [];
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
    const data = JSON.parse(content) as CoverageSummary;
    const total = data.total;
    if (!total) {
      findings.push('Invalid coverage report: "total" field missing.');
      return { success: false, findings };
    }

    const metrics = ['lines', 'statements', 'functions', 'branches'] as const;
    let failed = false;

    for (const metric of metrics) {
      const threshold = config.minCoverage[metric];
      if (threshold === undefined) continue;

      const metricData = total[metric];
      if (!metricData) {
        findings.push(`Coverage metric "${metric}" missing from report.`);
        failed = true;
        continue;
      }

      const pctVal = metricData.pct;
      const pct = typeof pctVal === 'number' ? pctVal : parseFloat(pctVal as string);

      if (isNaN(pct)) {
        findings.push(`Coverage metric "${metric}" has invalid percentage: ${pctVal}`);
        failed = true;
      } else if (pct < threshold) {
        findings.push(`Coverage for "${metric}" (${pct}%) is below the configured threshold (${threshold}%).`);
        failed = true;
      }
    }

    return { success: !failed, findings };
  } catch (err: any) {
    findings.push(`Failed to parse coverage report: ${err.message}`);
    return { success: false, findings };
  }
}

import { redactSecrets } from '../safety/secret-redactor';

export function saveVerificationReports(report: VerificationReport, cwd: string, formats: ('markdown' | 'json')[]) {
  const reportsDir = path.join(cwd, '.jewel', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  if (formats.includes('json')) {
    const jsonPath = path.join(reportsDir, 'latest.json');
    fs.writeFileSync(jsonPath, redactSecrets(JSON.stringify(report, null, 2)), 'utf8');
  }

  if (formats.includes('markdown')) {
    const mdPath = path.join(reportsDir, 'latest.md');
    fs.writeFileSync(mdPath, redactSecrets(generateMarkdownReport(report)), 'utf8');
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
