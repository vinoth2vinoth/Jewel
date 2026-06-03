import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { loadConfig } from '../../core/config';
import { loadSkills } from '../../skills/loader';
import { createSession, TaskContract } from '../../core/session';
import { createCheckpoint, rollbackCheckpoint, CheckpointMetadata } from '../../storage/git';
import { runDiffGuard } from '../../safety/diff-guard';
import { runVerification, VerificationReport } from '../../verification/runner';
import { runCriticReview } from '../../safety/critic';
import { MockAgentAdapter } from '../../agents/adapter';

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

export async function runTask(task: string, filesNeeded: string[] = [], useMock: boolean = false, cwd: string = process.cwd()): Promise<void> {
  if (!task || task.trim() === '') {
    console.error('Error: Task description cannot be empty.');
    process.exit(1);
  }

  console.log(`Starting Jewel Harness for task: "${task}"`);

  // 1. Load config & skills
  let config;
  try {
    config = loadConfig(cwd);
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }

  const skills = loadSkills(cwd);
  console.log(`[+] Loaded ${skills.length} skills from .jewel/skills`);

  const agentsMd = path.join(cwd, 'AGENTS.md');
  if (fs.existsSync(agentsMd)) {
    console.log('[+] Detected AGENTS.md rules file.');
  }

  // 2. Initialize Session & Task Contract
  const { sessionId, sessionPath, contractPath } = createSession(task, config, filesNeeded, cwd);
  const contract: TaskContract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

  console.log(`\n--- Enforced Task Contract (Session: ${sessionId}) ---`);
  console.log(`Task: ${contract.task}`);
  console.log(`Risk Level: ${contract.riskLevel}`);
  console.log(`Allowed Files Scope: ${contract.filesLikelyNeeded.join(', ')}`);
  console.log('Success Criteria:');
  contract.successCriteria.forEach(c => console.log(`  - ${c}`));

  // 3. Create Checkpoint
  console.log('\nCreating checkpoint...');
  const checkpoint = createCheckpoint(sessionId, cwd);
  fs.writeFileSync(path.join(sessionPath, 'checkpoint.json'), JSON.stringify(checkpoint, null, 2), 'utf8');
  console.log(`[+] Checkpoint created. strategy: ${checkpoint.isGit ? 'Git commit' : 'Backup copy'}`);

  // 4. Apply changes (Mock adapter or User edit)
  let changedFilesCount = 0;
  if (useMock) {
    console.log('\n[Adapter] Running mock agent adapter to apply changes...');
    const adapter = new MockAgentAdapter();
    const patch = await adapter.proposePatch({
      taskContract: contract,
      allowedFiles: contract.filesLikelyNeeded,
      repoContext: 'Mock context',
      verificationResult: null
    });

    for (const file of patch.files) {
      const fullFilePath = path.join(cwd, file.filePath);
      const dirName = path.dirname(fullFilePath);
      if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName, { recursive: true });
      }
      fs.writeFileSync(fullFilePath, file.content, 'utf8');
      console.log(`  [+] Applied patch to: ${file.filePath}`);
    }
    changedFilesCount = patch.files.length;
  } else {
    console.log('\n>>> Jewel is now in SAFE SLEEP mode.');
    console.log('>>> Please make your edits in the workspace.');
    console.log('>>> When you are done editing, return here.');
    await askQuestion('\nPress [ENTER] to verify and finalize your changes...');
  }

  // 5. Verify & Retries loop
  let retries = 0;
  const maxRetries = config.maxRetries;
  let verification: VerificationReport | null = null;
  let diffAnalysis = null;
  let critic = null;
  let passedAll = false;

  while (retries <= maxRetries) {
    if (retries > 0) {
      console.log(`\n[Retry ${retries}/${maxRetries}] Retrying verification checks...`);
    }

    // A. Inspect changes via Diff Guard
    diffAnalysis = runDiffGuard(checkpoint, config, cwd);
    console.log(`\n--- Diff Guard Summary (Status: ${diffAnalysis.status}) ---`);
    console.log(`Changed files: ${diffAnalysis.changedFilesCount}`);
    console.log(`Lines added: ${diffAnalysis.addedLinesCount}, removed: ${diffAnalysis.removedLinesCount}`);
    if (diffAnalysis.findings.length > 0) {
      console.log('Findings:');
      diffAnalysis.findings.forEach(f => console.log(`  - ${f}`));
    }

    // B. Run verification commands
    console.log('\nRunning verification tests...');
    verification = runVerification(config, cwd);
    console.log(`[Verification] Overall: ${verification.overallStatus} (Pass: ${verification.stats.passed}, Fail: ${verification.stats.failed})`);

    // C. Run Critic Review
    critic = runCriticReview(contract, diffAnalysis, verification, config);
    console.log(`\n--- Critic Review (Status: ${critic.status}, Confidence: ${critic.confidence}) ---`);
    if (critic.findings.length > 0) {
      console.log('Findings:');
      critic.findings.forEach(f => console.log(`  - ${f}`));
    }
    if (critic.requiredActions.length > 0) {
      console.log('Required Actions:');
      critic.requiredActions.forEach(a => console.log(`  - ${a}`));
    }

    if (critic.status === 'PASS') {
      passedAll = true;
      break;
    }

    // If verification/critic failed, allow interactive fix or automatic failure
    if (useMock) {
      // Mock mode does not support interactive debugging loop, so break immediately
      console.log('Mock mode: Failures detected. Bypassing interactive retry.');
      break;
    } else {
      console.log('\n[!] Checks failed. Please fix the problems in your code.');
      console.log(`Remaining retries: ${maxRetries - retries}`);
      const answer = await askQuestion('Would you like to re-run verification now? (y/n): ');
      if (answer.toLowerCase().trim() !== 'y') {
        break;
      }
      retries++;
    }
  }

  // 6. Finalize (Success or Rollback)
  const reportStatus = passedAll ? 'PASS' : (diffAnalysis?.status === 'BLOCK' || critic?.status === 'BLOCK' ? 'BLOCKED' : 'FAIL');

  const finalReport = {
    sessionId,
    task,
    status: reportStatus,
    date: new Date().toISOString(),
    diffSummary: diffAnalysis ? {
      filesChanged: diffAnalysis.changedFilesCount,
      linesAdded: diffAnalysis.addedLinesCount,
      linesRemoved: diffAnalysis.removedLinesCount,
      files: diffAnalysis.changedFiles
    } : null,
    verification: verification ? {
      overall: verification.overallStatus,
      passed: verification.stats.passed,
      failed: verification.stats.failed,
      blocked: verification.stats.blocked,
      skipped: verification.stats.skipped
    } : null,
    critic: critic ? {
      status: critic.status,
      confidence: critic.confidence,
      findings: critic.findings
    } : null
  };

  // Save report
  const reportsDir = path.join(cwd, '.jewel', 'reports');
  fs.writeFileSync(path.join(reportsDir, 'latest-run.json'), JSON.stringify(finalReport, null, 2), 'utf8');
  fs.writeFileSync(path.join(sessionPath, 'run-report.json'), JSON.stringify(finalReport, null, 2), 'utf8');

  // Markdown run report
  let md = `# Jewel Run Report: ${passedAll ? 'PASS' : 'FAIL'}\n\n`;
  md += `**Session:** ${sessionId}\n`;
  md += `**Task:** ${task}\n`;
  md += `**Result:** ${reportStatus}\n`;
  md += `**Date:** ${finalReport.date}\n\n`;

  if (diffAnalysis) {
    md += `## Changes Summary\n\n`;
    md += `- Files changed: ${diffAnalysis.changedFilesCount}\n`;
    md += `- Lines added: ${diffAnalysis.addedLinesCount}\n`;
    md += `- Lines removed: ${diffAnalysis.removedLinesCount}\n\n`;
    md += `Modified files: \n` + diffAnalysis.changedFiles.map(f => ` - \`${f}\``).join('\n') + '\n\n';
  }

  if (critic) {
    md += `## Critic Findings\n\n`;
    md += `Status: **${critic.status}**\n`;
    md += critic.findings.map(f => ` - ${f}`).join('\n') + '\n\n';
  }

  fs.writeFileSync(path.join(reportsDir, 'latest-run.md'), md, 'utf8');
  fs.writeFileSync(path.join(sessionPath, 'run-report.md'), md, 'utf8');

  if (passedAll) {
    console.log(`\n[+] Success! Task verified and finalized. Report written to .jewel/reports/latest-run.md`);
    process.exit(0);
  } else {
    console.error(`\n[-] Safety or verification check failed. Status: ${reportStatus}`);
    console.log('Rolling back changes to restore original state...');
    try {
      rollbackCheckpoint(checkpoint, cwd);
      console.log('[+] Rollback completed. Working files restored safely.');
    } catch (err: any) {
      console.error(`[-] Rollback failed: ${err.message}`);
    }
    process.exit(1);
  }
}
