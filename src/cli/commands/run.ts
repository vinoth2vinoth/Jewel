import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { execSync } from 'child_process';
import { loadConfig } from '../../core/config';
import { loadSkills } from '../../skills/loader';
import { createSession, TaskContract, validateContract, generateLocalContract } from '../../core/session';
import { createCheckpoint, rollbackCheckpoint, CheckpointMetadata } from '../../storage/git';
import { runDiffGuard } from '../../safety/diff-guard';
import { runVerification, VerificationReport } from '../../verification/runner';
import { runCriticReview } from '../../safety/critic';
import { createAgentAdapter } from '../../agents/provider-factory';
import { applyPatchProposalSafely } from '../../safety/safe-patch-writer';
import { validateTaskContractJson, validatePatchProposalJson } from '../../agents/json-response';
import { redactSecrets } from '../../safety/secret-redactor';
import { JewelError, toJewelError } from '../errors';

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

function generateRepoSummary(cwd: string): string {
  const files: string[] = [];
  try {
    const listFilesRecursive = (dir: string, depth = 0) => {
      if (depth > 3) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.jewel') {
          continue;
        }
        const rel = path.relative(cwd, path.join(dir, entry.name)).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          listFilesRecursive(path.join(dir, entry.name), depth + 1);
        } else {
          files.push(rel);
        }
      }
    };
    listFilesRecursive(cwd);
  } catch {}
  return `Project Structure:\n${files.map(f => `- ${f}`).join('\n')}`;
}

export async function runTask(
  task: string,
  filesNeeded: string[] = [],
  useMock: boolean = false,
  cwd: string = process.cwd(),
  yesFlag: boolean = false,
  noReview: boolean = false,
  keepFailed: boolean = false,
  cliOverrides?: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
  },
  dryRun: boolean = false
): Promise<void> {
  try {
    if (!task || task.trim() === '') {
      throw new JewelError('INVALID_INPUT', 'Task description cannot be empty.', 'Provide a non-empty task description.');
    }

  console.log(`Starting Jewel Harness for task: "${task}"`);

  let reviewRequired = false;
  let approved = true;

  // 1. Load config & skills
  let config;
  try {
    config = loadConfig(cwd);
  } catch (err: any) {
    throw new JewelError('CONFIG_ERROR', `Failed to load configuration: ${err.message}`, 'Check jewel.config.json formatting and paths.', err);
  }

  if (cliOverrides) {
    if (cliOverrides.provider !== undefined) {
      if (!['none', 'openai', 'anthropic', 'gemini', 'openrouter'].includes(cliOverrides.provider)) {
        throw new JewelError('INVALID_INPUT', 'Invalid provider override. Must be one of "none", "openai", "anthropic", "gemini", or "openrouter".', 'Provide a valid provider name.');
      }
      config.provider = cliOverrides.provider as any;
    }
    if (cliOverrides.model !== undefined) {
      config.model = cliOverrides.model;
    }
    if (cliOverrides.temperature !== undefined) {
      config.temperature = cliOverrides.temperature;
    }
    if (cliOverrides.maxOutputTokens !== undefined) {
      config.maxOutputTokens = cliOverrides.maxOutputTokens;
    }
  }

  if (dryRun) {
    const contract = generateLocalContract(task, config, filesNeeded);
    console.log('\n======================================');
    console.log('   JEWEL RUN DRY-RUN PREVIEW          ');
    console.log('======================================');
    console.log(`Task: "${task}"`);
    console.log(`Provider: ${config.provider}`);
    console.log(`Model: ${config.model || 'N/A'}`);
    console.log(`Allowed Files Scope: ${contract.filesLikelyNeeded.join(', ')}`);
    console.log(`Risk Level: ${contract.riskLevel}`);
    console.log('Success Criteria:');
    contract.successCriteria.forEach((c: string) => console.log(`  - ${c}`));
    console.log('\n[Dry-Run] No checkpoints will be created, no LLM provider will be called, and no files will be written or verified.');
    console.log('======================================\n');
    process.exit(0);
  }

  const skills = loadSkills(cwd);
  console.log(`[+] Loaded ${skills.length} skills from .jewel/skills`);

  const agentsMd = path.join(cwd, 'AGENTS.md');
  if (fs.existsSync(agentsMd)) {
    console.log('[+] Detected AGENTS.md rules file.');
  }

  // Determine if we are running an agent or manual human edits
  const isAgentMode = useMock || config.provider !== 'none';

  // 2. Initialize Session & Task Contract
  const { sessionId, sessionPath, contractPath } = createSession(task, config, filesNeeded, cwd);

  let adapter: any = null;
  if (isAgentMode) {
    const adapterConfig = useMock ? { ...config, provider: 'none' as const } : config;
    try {
      adapter = createAgentAdapter(adapterConfig);
    } catch (err: any) {
      throw new JewelError('ADAPTER_INSTANTIATION_FAILED', `Error instantiating agent adapter: ${err.message}`, 'Verify provider settings and environment.', err);
    }

    console.log(`\n[Adapter] Asking agent "${adapter.name}" for plan...`);
    const repoSummary = generateRepoSummary(cwd);
    let contractFromAdapter;
    try {
      contractFromAdapter = await adapter.plan({
        task,
        repoSummary,
        config,
        skills,
        sessionPath,
        filesNeeded
      });
    } catch (err: any) {
      writeRunReport(cwd, sessionPath, sessionId, task, 'FAIL', config, adapter, { error: err.message });
      throw toJewelError(err);
    }

    try {
      validateTaskContractJson(contractFromAdapter);
    } catch (err: any) {
      writeRunReport(cwd, sessionPath, sessionId, task, 'BLOCKED', config, adapter, { error: `Task contract validation failed: ${err.message}` });
      throw new JewelError('SCHEMA_VALIDATION_FAILURE', `Task contract validation failed: ${err.message}`, 'Retry the task or check model temperature/prompt settings.', err);
    }

    fs.writeFileSync(contractPath, JSON.stringify(contractFromAdapter, null, 2), 'utf8');
  }

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

  // 4. Apply changes (LLM adapter or User edit)
  let changedFilesCount = 0;
  let patchBlocked = false;
  let noChangeNeeded = false;
  let blockReasons: string[] = [];
  let noChangeReason = '';

  if (isAgentMode) {
    console.log(`\n[Adapter] Running agent adapter "${adapter.name}" to propose patch...`);
    let repoContext = '';
    for (const filePath of contract.filesLikelyNeeded) {
      const fullPath = path.resolve(cwd, filePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        repoContext += `=== File: ${filePath} ===\n${content}\n\n`;
      } else {
        repoContext += `=== File: ${filePath} ===\n(File does not exist yet)\n\n`;
      }
    }

    let patch: any;
    try {
      patch = await adapter.proposePatch({
        taskContract: contract,
        allowedFiles: contract.filesLikelyNeeded,
        repoContext,
        verificationResult: null,
        config,
        sessionPath
      });
    } catch (err: any) {
      console.error(`[-] Patch proposal failed: ${err.message}`);
      patchBlocked = true;
      blockReasons = [`Patch proposal failed: ${err.message}`];
      patch = { summary: '', files: [], notes: [], riskLevel: contract.riskLevel };
    }

    if (!patchBlocked) {
      try {
        validatePatchProposalJson(patch);
      } catch (err: any) {
        patchBlocked = true;
        blockReasons = [`Patch proposal validation failed: ${err.message}`];
      }
    }

    if (!patchBlocked) {
      if (patch.noChangeNeeded === true) {
        noChangeNeeded = true;
        noChangeReason = patch.noChangeReason || 'No changes needed indicated by LLM.';
        console.log(`\n[Adapter] Adapter indicated no changes are needed. Reason: "${noChangeReason}"`);
      }
    }

    if (!patchBlocked && !noChangeNeeded) {
      const patchResult = applyPatchProposalSafely(patch, contract, config, cwd, sessionPath);
      if (!patchResult.success) {
        patchBlocked = true;
        blockReasons = patchResult.blockedFiles.map(b => `${b.filePath}: ${b.reason}`);
        
        fs.writeFileSync(
          path.join(sessionPath, 'blocked-patch-proposal.json'),
          redactSecrets(JSON.stringify(patch, null, 2)),
          'utf8'
        );
      } else {
        for (const filePath of patchResult.appliedFiles) {
          console.log(`  [+] Applied patch to: ${filePath}`);
        }
        changedFilesCount = patchResult.appliedFiles.length;
      }
    }

    if (patchBlocked) {
      console.error(`\n[-] PATCH BLOCKED BY SAFE PATCH WRITER OR VALIDATOR:\n${blockReasons.map(r => `  - ${r}`).join('\n')}`);
    }
  } else {
    console.log('\n>>> Jewel is now in SAFE SLEEP mode.');
    console.log('>>> Please make your edits in the workspace.');
    console.log('>>> When you are done editing, return here.');
    await askQuestion('\nPress [ENTER] to verify and finalize your changes...');
  }

  // HUMAN DIFF APPROVAL loop
  if (!patchBlocked && !noChangeNeeded) {
    const diffAnalysisForReview = runDiffGuard(checkpoint, config, cwd);
    
    approved = true;
    reviewRequired = config.requireHumanDiffApproval;
    if (noReview) {
      if (config.requireHumanDiffApproval) {
        console.log('[!] --no-review is ignored because requireHumanDiffApproval is enabled in configuration.');
      } else {
        reviewRequired = false;
      }
    }
    if (yesFlag) {
      reviewRequired = false;
    }
    
    if (reviewRequired) {
      console.log('\n======================================');
      console.log('   PROPOSED PATCH DIFF PREVIEW        ');
      console.log('======================================');
      console.log(`Changed Files (${diffAnalysisForReview.changedFiles.length}):`);
      for (const file of diffAnalysisForReview.changedFiles) {
        console.log(`  - ${file}`);
      }
      console.log(`Total Added Lines: ${diffAnalysisForReview.addedLinesCount}`);
      console.log(`Total Removed Lines: ${diffAnalysisForReview.removedLinesCount}`);
      
      if (diffAnalysisForReview.protectedFilesChanged.length > 0) {
        console.warn(`\n[WARNING] Protected files modified:`);
        for (const file of diffAnalysisForReview.protectedFilesChanged) {
          console.warn(`  ! ${file}`);
        }
      }
      
      console.log('\nGit Diff Preview:');
      if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
        try {
          execSync(`git diff ${checkpoint.gitCheckpointSha}`, {
            cwd,
            stdio: 'inherit',
            env: { ...process.env, PAGER: 'cat' }
          });
        } catch (err: any) {
          console.log(`(Failed to print git diff: ${err.message})`);
        }
      } else {
        console.log('(Git diff preview is not available in non-Git backup mode)');
      }
      console.log('======================================\n');

      const response = await askQuestion('Do you approve these proposed changes? (y/n): ');
      if (response.toLowerCase().trim() !== 'y') {
        approved = false;
      }
    }
    
    if (!approved) {
      console.error('\n[-] Patch proposal rejected by human reviewer.');
      const reportStatus = 'REJECTED';
      
      writeRunReport(cwd, sessionPath, sessionId, task, reportStatus, config, adapter, {
        diffAnalysis: diffAnalysisForReview,
        reviewRequired,
        approved,
        keepFailed
      });
      
      let rolledBack = false;
      if (!keepFailed) {
        console.log('Rolling back changes to restore original state...');
        try {
          rollbackCheckpoint(checkpoint, cwd);
          console.log('[+] Rollback completed.');
          rolledBack = true;
        } catch (err: any) {
          console.error(`[-] Rollback failed: ${err.message}`);
        }
      } else {
        console.log('[+] --keep-failed was specified. Changes kept in workspace.');
      }
      if (rolledBack) {
        throw new JewelError(
          'ROLLBACK_COMPLETED',
          'Patch proposal rejected by human reviewer and changes rolled back successfully.',
          'Refine your task description or modify the source code to guide the LLM to the desired state.'
        );
      } else {
        throw new JewelError(
          'HUMAN_REVIEW_REJECTED',
          'Patch proposal rejected by human reviewer.',
          'Refine your task description or modify the source code to guide the LLM to the desired state.'
        );
      }
    }
  }

  // 5. Verify & Retries loop
  let retries = 0;
  const maxRetries = config.maxRetries;
  let verification: VerificationReport | null = null;
  let diffAnalysis = null;
  let critic = null;
  let passedAll = false;

  if (!patchBlocked && !noChangeNeeded) {
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
  }

  // 6. Finalize (Success or Rollback)
  const reportStatus = patchBlocked 
    ? 'BLOCKED' 
    : (noChangeNeeded 
        ? 'NO_CHANGES_DETECTED' 
        : (passedAll ? 'PASS' : (diffAnalysis?.status === 'BLOCK' || critic?.status === 'BLOCK' ? 'BLOCKED' : 'FAIL'))
      );

  writeRunReport(cwd, sessionPath, sessionId, task, reportStatus, config, adapter, {
    noChangeNeeded,
    noChangeReason,
    patchBlocked,
    blockReasons,
    diffAnalysis,
    verification,
    critic,
    reviewRequired,
    approved,
    keepFailed
  });

  if (passedAll || (noChangeNeeded && !patchBlocked)) {
    console.log(`\n[+] Success! Task verified and finalized. Report written to .jewel/reports/latest-run.md`);
    process.exit(0);
  } else {
    console.error(`\n[-] Safety or verification check failed. Status: ${reportStatus}`);
    let rolledBack = false;
    if (!keepFailed) {
      console.log('Rolling back changes to restore original state...');
      try {
        rollbackCheckpoint(checkpoint, cwd);
        console.log('[+] Rollback completed. Working files restored safely.');
        rolledBack = true;
      } catch (err: any) {
        console.error(`[-] Rollback failed: ${err.message}`);
      }
    } else {
      console.log('[+] --keep-failed was specified. Changes kept in workspace.');
    }

    if (patchBlocked) {
      const isUnsafePath = blockReasons.some(r => r.includes('policy') || r.includes('scope') || r.includes('not in allowed list') || r.includes('Unsafe patch path') || r.includes('Unsafe patch'));
      if (isUnsafePath) {
        throw new JewelError(
          'UNSAFE_PATH_FROM_PROVIDER',
          `PATCH BLOCKED BY SAFE PATCH WRITER: ${blockReasons.join('; ')}`,
          'The proposed patch attempted to modify files outside the allowed scope. Adjust the files list in your command (-f/--files) or verify that the model is scoped correctly.'
        );
      } else {
        const hasApiKey = blockReasons.some(r => r.includes('API_KEY') || r.includes('key is missing'));
        if (hasApiKey) {
          throw new JewelError(
            'MISSING_API_KEY',
            blockReasons.join('; '),
            'Set the appropriate API key environment variable (e.g. export OPENAI_API_KEY="your-key" or set it in .env) and run the command again.'
          );
        } else {
          throw new JewelError(
            'SCHEMA_VALIDATION_FAILURE',
            `Patch proposal validation failed: ${blockReasons.join('; ')}`,
            'The LLM provider response did not match the expected schema. Retry the task or check model temperature/prompt settings.'
          );
        }
      }
    }

    if (rolledBack) {
      throw new JewelError(
        'ROLLBACK_COMPLETED',
        'Verification or safety check failed and rollback completed successfully.',
        'The workspace was restored to the pre-run checkpoint. Review your changes or task instructions, adjust settings, and try again.'
      );
    } else {
      throw new JewelError(
        'VERIFICATION_COMMAND_FAILED',
        'Verification or safety check failed. Workspace kept as is.',
        'Fix the failing tests in your code, or run the verification command manually to diagnose. You can bypass rollback using --keep-failed.'
      );
    }
  } } catch (err: any) {
    if (err && err.message && err.message.startsWith('exit-')) {
      throw err;
    }
    const jewelErr = toJewelError(err);
    console.error(`\n======================================`);
    console.error(`Status: ${jewelErr.status}`);
    console.error(`Error: ${jewelErr.message}`);
    console.error(`Next Action: ${jewelErr.nextAction}`);
    console.error(`======================================\n`);
    process.exit(1);
  }
}

function getPackageVersion(cwd: string): string {
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

function writeRunReport(
  cwd: string,
  sessionPath: string,
  sessionId: string,
  task: string,
  status: string,
  config: any,
  adapter: any,
  options: {
    error?: string;
    noChangeNeeded?: boolean;
    noChangeReason?: string;
    patchBlocked?: boolean;
    blockReasons?: string[];
    diffAnalysis?: any;
    verification?: any;
    critic?: any;
    reviewRequired?: boolean;
    approved?: boolean;
    keepFailed?: boolean;
  }
) {
  const version = getPackageVersion(cwd);
  const provider = config.provider || 'none';
  const model = provider === 'none' ? 'mock' : (config.model || 'N/A');
  const adapterName = provider === 'none' ? 'mock-agent' : (adapter?.name || 'N/A');
  const verificationCommandsRun = options.verification 
    ? options.verification.results.filter((r: any) => r.status !== 'SKIPPED').map((r: any) => r.commandLine)
    : [];
  
  const diffGuardStatus = options.diffAnalysis ? options.diffAnalysis.status : 'N/A';
  const safePatchWriterStatus = options.patchBlocked ? 'BLOCKED' : (options.noChangeNeeded ? 'SKIPPED' : (options.diffAnalysis ? 'PASS' : 'N/A'));
  
  let humanReviewStatus = 'SKIPPED';
  if (options.reviewRequired) {
    humanReviewStatus = options.approved ? 'APPROVED' : 'REJECTED';
  }
  
  let rollbackStatus = 'N/A';
  if (status === 'REJECTED' || status === 'FAIL' || status === 'BLOCKED') {
    if (options.diffAnalysis || options.patchBlocked || status === 'REJECTED') {
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

  const finalReport: any = {
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
    md += `**Verification Commands Run:**\n` + verificationCommandsRun.map((c: string) => ` - \`${c}\``).join('\n') + '\n';
  } else {
    md += `**Verification Commands Run:** None\n`;
  }

  md += `**Diff Guard Status:** ${diffGuardStatus}\n`;
  md += `**Safe Patch Writer Status:** ${safePatchWriterStatus}\n`;
  md += `**Human Review Status:** ${humanReviewStatus}\n`;
  md += `**Rollback Status:** ${rollbackStatus}\n`;
  
  if (filesChanged.length > 0) {
    md += `**Files Changed:**\n` + filesChanged.map((f: string) => ` - \`${f}\``).join('\n') + '\n';
  } else {
    md += `**Files Changed:** None\n`;
  }

  if (filesProposedButBlocked.length > 0) {
    md += `**Files Proposed But Blocked:**\n` + filesProposedButBlocked.map((f: string) => ` - ${f}`).join('\n') + '\n';
  } else {
    md += `**Files Proposed But Blocked:** None\n`;
  }

  md += `**Token Usage:** ${tokenUsage}\n`;
  md += `**Date:** ${finalReport.date}\n\n`;

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
    md += options.blockReasons.map((r: string) => ` - ${r}`).join('\n') + '\n\n';
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
    md += options.critic.findings.map((f: string) => ` - ${f}`).join('\n') + '\n\n';
  }

  fs.writeFileSync(path.join(reportsDir, 'latest-run.md'), redactSecrets(md), 'utf8');
  fs.writeFileSync(path.join(sessionPath, 'run-report.md'), redactSecrets(md), 'utf8');
}
