import * as fs from 'fs';
import * as path from 'path';
import { redactSecrets } from '../../safety/secret-redactor';

export function getPackageVersion(_cwd: string): string {
  try {
    const pkgPath = path.join(__dirname, '../../../package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version || '0.5.0-dev';
    }
    const devPkgPath = path.join(__dirname, '../../package.json');
    if (fs.existsSync(devPkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(devPkgPath, 'utf8'));
      return pkg.version || '0.5.0-dev';
    }
  } catch {}
  return '0.5.0-dev';
}

export interface RunReportOptions {
  error?: string;
  noChangeNeeded?: boolean;
  noChangeReason?: string;
  patchBlocked?: boolean;
  blockReasons?: string[];
  diffAnalysis?: {
    status: string;
    changedFiles: string[];
    changedFilesCount: number;
    addedLinesCount: number;
    removedLinesCount: number;
  };
  verification?: {
    overallStatus: string;
    results: Array<{ status: string; commandLine?: string }>;
    stats: { passed: number; failed: number; blocked: number; skipped: number };
  } | null;
  critic?: { status: string; confidence: string; findings: string[] };
  reviewRequired?: boolean;
  approved?: boolean;
  keepFailed?: boolean;
  testChangeFindings?: string[];
  preserveExistingTests?: boolean;
}

export function writeRunReport(
  cwd: string,
  sessionPath: string,
  sessionId: string,
  task: string,
  status: string,
  config: { provider?: string; model?: string },
  adapter: { name?: string; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; estimatedCostUsd?: number } } | null,
  options: RunReportOptions
) {
  const version = getPackageVersion(cwd);
  const provider = config.provider || 'none';
  const model = provider === 'none' ? 'mock' : (config.model || 'N/A');
  const adapterName = provider === 'none' ? 'mock-agent' : (adapter?.name || 'N/A');
  const verificationCommandsRun = options.verification
    ? options.verification.results.filter((r) => r.status !== 'SKIPPED').map((r) => r.commandLine)
    : [];

  const diffGuardStatus = options.diffAnalysis ? options.diffAnalysis.status : 'N/A';
  const safePatchWriterStatus = options.patchBlocked ? 'BLOCKED' : (options.noChangeNeeded ? 'SKIPPED' : (options.diffAnalysis ? 'PASS' : 'N/A'));

  let humanReviewStatus = 'SKIPPED';
  if (options.reviewRequired) {
    humanReviewStatus = options.approved ? 'APPROVED' : 'REJECTED';
  }

  let rollbackStatus = 'N/A';
  if (status === 'REJECTED' || status === 'FAIL' || status === 'BLOCKED' || status === 'GENERATED_TEST_SUSPECT' || status === 'EXISTING_TEST_MODIFIED' || status === 'RETRY_LIMIT_REACHED' || status === 'NEEDS_HUMAN_REVIEW') {
    if (options.diffAnalysis || options.patchBlocked || status === 'REJECTED' || status === 'GENERATED_TEST_SUSPECT' || status === 'EXISTING_TEST_MODIFIED') {
      rollbackStatus = options.keepFailed ? 'KEPT_FAILED' : 'ROLLED_BACK';
    }
  }

  const filesChanged = options.diffAnalysis ? options.diffAnalysis.changedFiles : [];
  const filesProposedButBlocked = options.patchBlocked ? (options.blockReasons || []) : [];

  let tokenUsage = 'usage unavailable';
  if (provider === 'none') {
    tokenUsage = 'usage unavailable (mock)';
  } else if (adapter?.usage) {
    tokenUsage = `Input: ${adapter.usage.inputTokens ?? 0}, Output: ${adapter.usage.outputTokens ?? 0}, Total: ${adapter.usage.totalTokens ?? 0}`;
  }

  const finalReport: Record<string, unknown> = {
    sessionId,
    task,
    status,
    date: new Date().toISOString(),
    jewelVersion: version,
    provider,
    model,
    adapterName,
    verificationCommandsRun,
    diffGuardStatus,
    safePatchWriterStatus,
    humanReviewStatus,
    rollbackStatus,
    filesChanged,
    filesProposedButBlocked,
    preserveExistingTests: options.preserveExistingTests || false,
    testChangeFindings: options.testChangeFindings || [],
    usage: provider === 'none' ? 'usage unavailable (mock)' : (adapter?.usage ? {
      inputTokens: adapter.usage.inputTokens,
      outputTokens: adapter.usage.outputTokens,
      totalTokens: adapter.usage.totalTokens,
      estimatedCostUsd: adapter.usage.estimatedCostUsd
    } : 'usage unavailable'),
    error: options.error,
    blockReasons: options.patchBlocked ? options.blockReasons : undefined,
    noChangeReason: options.noChangeNeeded ? options.noChangeReason : undefined,
    diffSummary: options.diffAnalysis ? {
      filesChanged: options.diffAnalysis.changedFilesCount,
      linesAdded: options.diffAnalysis.addedLinesCount,
      linesRemoved: options.diffAnalysis.removedLinesCount,
      files: options.diffAnalysis.changedFiles
    } : null,
    verification: options.verification ? {
      overall: options.verification.overallStatus,
      passed: options.verification.stats.passed,
      failed: options.verification.stats.failed,
      blocked: options.verification.stats.blocked,
      skipped: options.verification.stats.skipped
    } : null,
    critic: options.critic ? {
      status: options.critic.status,
      confidence: options.critic.confidence,
      findings: options.critic.findings
    } : null
  };

  const reportsDir = path.join(cwd, '.jewel', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  fs.writeFileSync(path.join(reportsDir, 'latest-run.json'), redactSecrets(JSON.stringify(finalReport, null, 2)), 'utf8');
  fs.writeFileSync(path.join(sessionPath, 'run-report.json'), redactSecrets(JSON.stringify(finalReport, null, 2)), 'utf8');

  let md = `# Jewel Run Report: ${status}\n\n`;
  md += `**Jewel Version:** ${version}\n`;
  md += `**Session:** ${sessionId}\n`;
  md += `**Task:** ${task}\n`;
  md += `**Result:** ${status}\n`;
  md += `**Provider:** ${provider}\n`;
  md += `**Model:** ${model}\n`;
  md += `**Adapter Name:** ${adapterName}\n`;

  if (verificationCommandsRun.length > 0) {
    md += `**Verification Commands Run:**\n` + verificationCommandsRun.map((c) => ` - \`${c}\``).join('\n') + '\n';
  } else {
    md += `**Verification Commands Run:** None\n`;
  }

  md += `**Diff Guard Status:** ${diffGuardStatus}\n`;
  md += `**Safe Patch Writer Status:** ${safePatchWriterStatus}\n`;
  md += `**Human Review Status:** ${humanReviewStatus}\n`;
  md += `**Rollback Status:** ${rollbackStatus}\n`;
  md += `**Preserve Existing Tests Enforced:** ${options.preserveExistingTests ? 'Yes' : 'No'}\n`;

  if (filesChanged.length > 0) {
    md += `**Files Changed:**\n` + filesChanged.map((f) => ` - \`${f}\``).join('\n') + '\n';
  } else {
    md += `**Files Changed:** None\n`;
  }

  if (filesProposedButBlocked.length > 0) {
    md += `**Files Proposed But Blocked:**\n` + filesProposedButBlocked.map((f) => ` - ${f}`).join('\n') + '\n';
  } else {
    md += `**Files Proposed But Blocked:** None\n`;
  }

  if (fs.existsSync(path.join(reportsDir, 'test-provenance.md'))) {
    md += `**Test Provenance Report:** [test-provenance.md](file:///${path.join(reportsDir, 'test-provenance.md').replace(/\\/g, '/')})\n`;
  }

  md += `**Token Usage:** ${tokenUsage}\n`;
  md += `**Date:** ${finalReport.date}\n\n`;

  if (options.testChangeFindings && options.testChangeFindings.length > 0) {
    md += `## Test Modification Policy Violations\n\n`;
    md += options.testChangeFindings.map((f) => ` - ${f}`).join('\n') + '\n\n';
  }

  if (options.error) {
    md += `## Error Details\n\n${options.error}\n\n`;
  }

  if (options.noChangeNeeded) {
    md += `## No Changes Needed\n\n`;
    md += `The LLM adapter indicated that no changes are needed for this task.\n`;
    md += `**Reason:** ${options.noChangeReason}\n\n`;
  }

  if (options.patchBlocked && options.blockReasons) {
    md += `## Blocked Patch Details\n\n`;
    md += `The patch proposed by the adapter was blocked for the following safety reasons:\n\n`;
    md += options.blockReasons.map((r) => ` - ${r}`).join('\n') + '\n\n';
  }

  if (options.diffAnalysis) {
    md += `## Changes Details\n\n`;
    md += `- Files changed: ${options.diffAnalysis.changedFilesCount}\n`;
    md += `- Lines added: ${options.diffAnalysis.addedLinesCount}\n`;
    md += `- Lines removed: ${options.diffAnalysis.removedLinesCount}\n\n`;
  }

  if (options.critic) {
    md += `## Critic Findings\n\n`;
    md += `Status: **${options.critic.status}**\n`;
    md += options.critic.findings.map((f) => ` - ${f}`).join('\n') + '\n\n';
  }

  fs.writeFileSync(path.join(reportsDir, 'latest-run.md'), redactSecrets(md), 'utf8');
  fs.writeFileSync(path.join(sessionPath, 'run-report.md'), redactSecrets(md), 'utf8');
}
