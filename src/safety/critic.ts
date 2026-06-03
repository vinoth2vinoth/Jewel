import { JewelConfig } from '../core/config';
import { TaskContract } from '../core/session';
import { DiffAnalysis } from './diff-guard';
import { VerificationReport } from '../verification/runner';

export interface CriticResult {
  status: 'PASS' | 'WARN' | 'BLOCK';
  findings: string[];
  requiredActions: string[];
  confidence: 'low' | 'medium' | 'high';
}

export function runCriticReview(
  contract: TaskContract,
  diffAnalysis: DiffAnalysis,
  verification: VerificationReport | null,
  config: JewelConfig
): CriticResult {
  const findings: string[] = [];
  const requiredActions: string[] = [];
  let status: CriticResult['status'] = 'PASS';

  // 1. Verify Verification report status
  if (config.requireVerificationBeforeDone) {
    if (!verification) {
      status = 'BLOCK';
      findings.push('Verification report is completely missing.');
      requiredActions.push('Execute the verification commands (jewel verify) to obtain proof.');
    } else if (verification.overallStatus === 'FAIL') {
      status = 'BLOCK';
      findings.push('Verification commands failed.');
      requiredActions.push('Fix failing tests/commands highlighted in the verification report.');
    } else if (verification.overallStatus === 'BLOCKED') {
      status = 'BLOCK';
      findings.push('Some verification commands were blocked due to safety policy.');
      requiredActions.push('Review the command policy blocks or adjust commands configuration.');
    } else if (verification.overallStatus === 'SKIPPED') {
      findings.push('Verification commands were skipped (none configured).');
      // If verification commands are empty, we warned, but if config requires verification, we might need a warning/block
      // Let's add a warning if requireVerificationBeforeDone is true but nothing is configured
      findings.push('No verification commands are configured in jewel.config.json.');
      status = 'WARN';
      requiredActions.push('Configure at least a test or build verification command in jewel.config.json.');
    }
  } else {
    if (!verification) {
      findings.push('Verification was skipped because requireVerificationBeforeDone is false.');
      status = 'WARN';
    }
  }

  // 2. Verify Diff Guard analysis
  if (diffAnalysis.status === 'BLOCK') {
    status = 'BLOCK';
    findings.push(...diffAnalysis.findings.map(f => `Diff Guard block: ${f}`));
  } else if (diffAnalysis.status === 'WARN') {
    if (status !== 'BLOCK') status = 'WARN';
    findings.push(...diffAnalysis.findings.map(f => `Diff Guard warning: ${f}`));
  }

  // 3. File scope inspection (Karpathy principle: surgical changes, never edit unrelated files)
  const allowedFiles = contract.filesLikelyNeeded.map(f => f.replace(/\\/g, '/'));
  const changedUnplannedFiles: string[] = [];

  for (const file of diffAnalysis.changedFiles) {
    const normFile = file.replace(/\\/g, '/');
    // If it's a new or modified file that wasn't declared in the contract
    if (!allowedFiles.includes(normFile) && normFile !== 'package.json' && normFile !== 'package-lock.json') {
      changedUnplannedFiles.push(file);
    }
  }

  if (changedUnplannedFiles.length > 0) {
    findings.push(`Changed files not declared in task contract: ${changedUnplannedFiles.join(', ')}`);
    if (config.mode === 'strict') {
      status = 'BLOCK';
      requiredActions.push('Update the task contract file list to include all affected files, or revert edits to unplanned files.');
    } else {
      if (status !== 'BLOCK') status = 'WARN';
      requiredActions.push('Declare all modified files in the plan (filesLikelyNeeded) for clean tracing.');
    }
  }

  // 4. Test coverage changes
  // Let's look for test files changed. If riskLevel is high but no test files are changed, warn.
  const hasTestChanges = diffAnalysis.changedFiles.some(f => 
    f.includes('.test.') || f.includes('.spec.') || f.startsWith('test/') || f.startsWith('tests/')
  );

  if (contract.riskLevel === 'high' && !hasTestChanges) {
    findings.push('Task is High Risk, but no changes to test suites were detected.');
    if (status !== 'BLOCK') status = 'WARN';
    requiredActions.push('Add new test coverage verifying the high-risk modifications.');
  }

  // Calculate confidence based on diff size vs risk level
  let confidence: CriticResult['confidence'] = 'high';
  if (diffAnalysis.changedFilesCount > 5 && contract.riskLevel === 'high') {
    confidence = 'medium'; // high complexity changes reduce certainty
  }
  if (status === 'BLOCK') {
    confidence = 'low';
  }

  return {
    status,
    findings,
    requiredActions,
    confidence
  };
}
