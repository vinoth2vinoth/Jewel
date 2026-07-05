import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { loadConfig } from '../../core/config';
import { loadSkills } from '../../skills/loader';
import { createSession, TaskContract, validateContract, generateLocalContract } from '../../core/session';
import { createCheckpoint, rollbackCheckpoint, revertFileToCheckpoint, CheckpointMetadata } from '../../storage/git';
import { runDiffGuard } from '../../safety/diff-guard';
import { runVerification, VerificationReport } from '../../verification/runner';
import { runCriticReview, runMultiAgentCriticReview } from '../../safety/critic';
import { createAgentAdapter } from '../../agents/provider-factory';
import { applyPatchProposalSafely } from '../../safety/safe-patch-writer';
import { validateTaskContractJson, validatePatchProposalJson } from '../../agents/json-response';
import { redactSecrets } from '../../safety/secret-redactor';
import { JewelError, toJewelError } from '../errors';
import { checkTestChangePolicy, getOriginalFileContent } from '../../verification/test-change-policy';
import { createRetryState, recordRetryAttempt, shouldStopRetry, StopDecision } from '../../core/retry-policy';
import { UIServer } from '../ui-server';
import { askQuestion, broadcastState, buildRepoContext, waitForExitAcknowledgment } from './run-helpers';
import { writeRunReport } from './run-report';
import { buildEnrichedRepoSummary, resolveFilesForTask } from '../../exploration/context-builder';
import { runAgentToolLoop } from '../../agents/tool-loop';

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
  dryRun: boolean = false,
  useUI: boolean = false
): Promise<void> {
  let config: any = null;
  let adapter: any = null;
  let sessionId = '';
  let sessionPath = '';
  let contractPath = '';
  let checkpoint: any = null;
  let uiServer: UIServer | null = null;

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  let accumulatedLogs = '';

  try {
    if (!task || task.trim() === '') {
      throw new JewelError('INVALID_INPUT', 'Task description cannot be empty.', 'Provide a non-empty task description.');
    }

  console.log(`\x1b[36m
   💎  ___    _____   \\\\ \\    /  \\\\    / /   _____    _     
      |_  |  |  ___|   \\\\ \\  / /\\\\ \\  / /   |  ___|  | |    
        | |  | |__      \\\\ \\/ /  \\\\ \\/ /    | |__    | |    
     _  | |  | |___     \\\\  /    \\\\  /      | |___   | |___ 
    \\__/ |  |_____|    \\\\/      \\\\/        |_____|  |_____|
\x1b[35m              Strict AI Coding Safety Harness CLI\x1b[0m
`);
  console.log(`Starting Jewel Harness for task: "${task}"`);

  let reviewRequired = false;
  let approved = true;

  // 1. Load config & skills
  try {
    config = loadConfig(cwd);
  } catch (err: any) {
    throw new JewelError('CONFIG_ERROR', `Failed to load configuration: ${err.message}`, 'Check jewel.config.json formatting and paths.', err);
  }

  if (useUI) {
    uiServer = new UIServer({ startPort: 3000 });
    await uiServer.start();
    console.log(`\n[+] Dashboard server started. View live progress at: ${uiServer.getUrl()}`);

    (process.stdout as any).write = (chunk: any, encoding?: any, callback?: any) => {
      const str = chunk.toString();
      accumulatedLogs += str;
      if (uiServer) {
        uiServer.updateState({ terminalLogs: accumulatedLogs });
      }
      return originalStdoutWrite(chunk, encoding, callback);
    };

    (process.stderr as any).write = (chunk: any, encoding?: any, callback?: any) => {
      const str = chunk.toString();
      accumulatedLogs += str;
      if (uiServer) {
        uiServer.updateState({ terminalLogs: accumulatedLogs });
      }
      return originalStderrWrite(chunk, encoding, callback);
    };

    uiServer.updateState({
      stage: 'init',
      task,
      overrides: {
        provider: config.provider,
        model: config.model
      }
    });
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

  let resolvedFiles = resolveFilesForTask(cwd, task, filesNeeded);

  if (dryRun) {
    const contract = generateLocalContract(task, config, resolvedFiles);
    console.log('\n======================================');
    console.log('   JEWEL RUN DRY-RUN PREVIEW          ');
    console.log('======================================');
    console.log(`Task: "${task}"`);
    console.log(`Provider: ${config.provider}`);
    console.log(`Model: ${config.model || 'N/A'}`);
    console.log(`Allowed Files Scope: ${contract.filesLikelyNeeded.join(', ')}`);
    if (filesNeeded.length === 0 && resolvedFiles.length > 0) {
      console.log(`Auto-discovered Files: ${resolvedFiles.join(', ')}`);
    }
    console.log(`Risk Level: ${contract.riskLevel}`);
    console.log('Success Criteria:');
    contract.successCriteria.forEach((c: string) => console.log(`  - ${c}`));
    console.log('\n[Dry-Run] No checkpoints will be created, no LLM provider will be called, and no files will be written or verified.');
    console.log('======================================\n');
    process.exit(0);
  }

  if (filesNeeded.length === 0 && resolvedFiles.length > 0) {
    console.log(`[+] Auto-discovered ${resolvedFiles.length} relevant file(s): ${resolvedFiles.join(', ')}`);
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
  const sessionData = createSession(task, config, resolvedFiles, cwd);
  sessionId = sessionData.sessionId;
  sessionPath = sessionData.sessionPath;
  contractPath = sessionData.contractPath;

  if (uiServer) {
    broadcastState(uiServer, {
      sessionId,
      files: resolvedFiles,
      overrides: {
        provider: config.provider,
        model: config.model
      }
    }, config, adapter);
  }

  adapter = null;
  if (isAgentMode) {
    const adapterConfig = useMock ? { ...config, provider: 'none' as const } : config;
    try {
      adapter = createAgentAdapter(adapterConfig);
    } catch (err: any) {
      throw new JewelError('ADAPTER_INSTANTIATION_FAILED', `Error instantiating agent adapter: ${err.message}`, 'Verify provider settings and environment.', err);
    }

    if (uiServer) {
      broadcastState(uiServer, { stage: 'exploring' }, config, adapter);
    }

    const exploration = await runAgentToolLoop({
      task,
      cwd,
      config,
      adapter,
      sessionPath,
      initialFiles: resolvedFiles,
      onStep: uiServer
        ? (record) => {
            const prev = uiServer!.getState().explorationSteps || [];
            uiServer!.updateState({
              stage: 'exploring',
              explorationStep: record.step,
              explorationTool: record.decision.tool || 'done',
              explorationSteps: [
                ...prev,
                {
                  step: record.step,
                  tool: record.decision.tool || 'done',
                  reason: record.decision.reason,
                  success: record.success,
                  preview: record.result.slice(0, 400)
                }
              ]
            });
          }
        : undefined
    });

    if (exploration.discoveredFiles.length > 0) {
      const merged = new Set([...resolvedFiles, ...exploration.discoveredFiles]);
      resolvedFiles = Array.from(merged);
    }

    if (uiServer) {
      broadcastState(uiServer, { stage: 'planning' }, config, adapter);
    }

    console.log(`\n[Adapter] Asking agent "${adapter.name}" for plan...`);
    let repoSummary = buildEnrichedRepoSummary(cwd, task);
    if (exploration.context) {
      repoSummary += `\n\n--- Agent Tool Loop Exploration ---\n${exploration.summary}\n\n${exploration.context}`;
    }
    let contractFromAdapter;
    try {
      contractFromAdapter = await adapter.plan({
        task,
        repoSummary,
        config,
        skills,
        sessionPath,
        filesNeeded: resolvedFiles
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
  // Preflight Scope Estimator
  const estimatedFiles = typeof contract.estimatedFilesChangedCount === 'number' 
    ? contract.estimatedFilesChangedCount 
    : contract.filesLikelyNeeded.length;
  const estimatedLines = typeof contract.estimatedLinesChangedCount === 'number'
    ? contract.estimatedLinesChangedCount
    : 0;

  if (estimatedFiles > config.maxFilesChanged || estimatedLines > config.maxLinesChanged) {
    console.warn(`\n[!] Preflight warning: Estimated scope exceeds configured limits.`);
    console.warn(`    Estimated files: ${estimatedFiles} (limit: ${config.maxFilesChanged})`);
    console.warn(`    Estimated lines: ${estimatedLines} (limit: ${config.maxLinesChanged})`);
    
    if (yesFlag || useMock) {
      console.log(`[+] Auto-approving scope expansion (automated/yes mode).`);
      config.maxFilesChanged = Math.max(config.maxFilesChanged, estimatedFiles + 1);
      config.maxLinesChanged = Math.max(config.maxLinesChanged, estimatedLines + 50);
    } else {
      let approvedScope = false;
      if (useUI && uiServer) {
        broadcastState(uiServer, { stage: 'review' }, config, adapter);
        const res = await uiServer.waitForApproval('scope-expansion', {
          message: `Estimated scope exceeds limits. Files: ${estimatedFiles}/${config.maxFilesChanged}, Lines: ${estimatedLines}/${config.maxLinesChanged}. Approve to expand limits?`
        });
        if (res.action === 'approve') {
          approvedScope = true;
        }
      } else {
        const response = await askQuestion('Would you like to expand the scope limits to accommodate this task? (y/n): ');
        if (response.toLowerCase().trim() === 'y') {
          approvedScope = true;
        }
      }

      if (approvedScope) {
        config.maxFilesChanged = Math.max(config.maxFilesChanged, estimatedFiles + 1);
        config.maxLinesChanged = Math.max(config.maxLinesChanged, estimatedLines + 50);
        console.log(`[+] Scope expanded. New limits -> Files: ${config.maxFilesChanged}, Lines: ${config.maxLinesChanged}`);
      } else {
        throw new JewelError(
          'NEEDS_APPROVAL_FOR_SCOPE_EXPANSION',
          'Preflight scope check failed: user declined to expand scope limits.',
          'Increase maxFilesChanged or maxLinesChanged in jewel.config.json or approve the scope expansion during CLI execution.'
        );
      }
    }
  }

  // 3. Create Checkpoint
  console.log('\nCreating checkpoint...');
  checkpoint = createCheckpoint(sessionId, cwd);
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
    const repoContext = buildRepoContext(cwd, contract.filesLikelyNeeded);

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
      if (err.message && err.message.includes('[Jewel Budget Guard]')) {
        throw err;
      }
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
    const diffAnalysisForReview = runDiffGuard(checkpoint, config, cwd, contract.allowedSymbolChanges);
    
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
      let diffContent = '';
      if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
        try {
          diffContent = execSync(`git diff ${checkpoint.gitCheckpointSha}`, {
            cwd,
            encoding: 'utf8',
            env: { ...process.env, PAGER: 'cat' }
          });
          console.log(diffContent);
        } catch (err: any) {
          console.log(`(Failed to print git diff: ${err.message})`);
        }
      } else {
        console.log('(Git diff preview is not available in non-Git backup mode)');
      }
      console.log('======================================\n');

      let approvedFiles: string[] = [];
      if (useUI && uiServer) {
        broadcastState(uiServer, { stage: 'review' }, config, adapter);
        const res = await uiServer.waitForApproval('patch-review', {
          diff: diffContent,
          files: diffAnalysisForReview.changedFiles,
          astDiffs: diffAnalysisForReview.astDiffs
        });
        if (res.action === 'approve') {
          approvedFiles = res.approvedFiles || [];
          approved = approvedFiles.length > 0; // Reject if no files approved
        } else {
          approved = false;
        }
      } else {
        const response = await askQuestion('Do you approve these proposed changes? (y/n): ');
        const choice = response.toLowerCase().trim();
        if (choice === 'y') {
          approved = true;
          approvedFiles = diffAnalysisForReview.changedFiles;
        } else {
          approved = false;
        }
      }

      if (approved) {
        const rejectedFiles = diffAnalysisForReview.changedFiles.filter(f => !approvedFiles.includes(f));
        if (rejectedFiles.length > 0) {
          console.log(`Reverting rejected files: ${rejectedFiles.join(', ')}`);
          for (const file of rejectedFiles) {
            revertFileToCheckpoint(file, checkpoint, cwd);
          }
        }
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
  let maxRetries = config.maxRetries;
  let customHint: string | undefined = undefined;
  let verification: VerificationReport | null = null;
  let diffAnalysis: any = null;
  let critic: any = null;
  let passedAll = false;
  let lastTestCriticVerdict: string | undefined;
  let lastTestCriticExplanation: string | undefined;
  let testCriticResult: any = null;

  const retryState = createRetryState(maxRetries);
  let finalStopDecision: StopDecision | null = null;
  let existingTestModified = false;
  const testChangeFindings: string[] = [];
  const testProvenanceRecords: any[] = [];

  if (!patchBlocked && !noChangeNeeded) {
    while (retries <= maxRetries) {
      if (retries > 0) {
        console.log(`\n[Retry ${retries}/${maxRetries}] Retrying verification checks...`);
      }

      // A. Inspect changes via Diff Guard
      diffAnalysis = runDiffGuard(checkpoint, config, cwd, contract.allowedSymbolChanges);
      console.log(`\n--- Diff Guard Summary (Status: ${diffAnalysis.status}) ---`);
      console.log(`Changed files: ${diffAnalysis.changedFilesCount}`);
      console.log(`Lines added: ${diffAnalysis.addedLinesCount}, removed: ${diffAnalysis.removedLinesCount}`);
      if (diffAnalysis.findings.length > 0) {
        console.log('Findings:');
        diffAnalysis.findings.forEach((f: string) => console.log(`  - ${f}`));
      }

      // Check test-change-policy
      existingTestModified = false;
      testChangeFindings.length = 0;
      testProvenanceRecords.length = 0;
      for (const file of diffAnalysis.changedFiles) {
        const isTestFile = file.endsWith('.test.ts') || file.endsWith('.test.js') || 
                           file.endsWith('.spec.ts') || file.endsWith('.spec.js') ||
                           file.includes('/test/') || file.includes('/tests/');
        if (isTestFile) {
          const fullPath = path.resolve(cwd, file);
          const currentContent = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
          const originalContent = getOriginalFileContent(file, checkpoint, cwd);
          
          const policyReport = checkTestChangePolicy(originalContent, currentContent, file, contract.preserveExistingTests ?? false);
          if (policyReport.invasive) {
            existingTestModified = true;
          }
          if (policyReport.findings.length > 0) {
            testChangeFindings.push(...policyReport.findings);
          }
          
          testProvenanceRecords.push({
            testFile: file,
            addedTestNames: policyReport.testProvenance.appendedTestNames,
            modifiedTestNames: policyReport.testProvenance.modifiedTestNames,
            removedTestNames: policyReport.testProvenance.removedTestNames,
            isAppended: policyReport.appendOnly,
            isInvasive: policyReport.invasive,
            existingTestsPreserved: policyReport.success
          });
        }
      }

      if (testChangeFindings.length > 0) {
        console.log(`\n--- Test Modification Policy Findings ---`);
        testChangeFindings.forEach(f => console.log(`  - ${f}`));
      }

      // B. Run verification commands
      console.log('\nRunning verification tests...');
      if (uiServer) {
        broadcastState(uiServer, { stage: 'verification' }, config, adapter);
      }
      verification = await runVerification(config, cwd, (progress) => {
        if (uiServer) {
          const currentResults = uiServer.getState().verificationResults || [];
          const idx = currentResults.findIndex(r => r.commandKey === progress.key);
          const item = {
            commandKey: progress.key,
            commandLine: config.commands[progress.key as any] || '',
            status: progress.status,
            stdout: progress.stdout,
            stderr: progress.stderr
          };
          if (idx >= 0) {
            currentResults[idx] = item;
          } else {
            currentResults.push(item);
          }
          broadcastState(uiServer, { verificationResults: [...currentResults] }, config, adapter);
        }
      });
      console.log(`[Verification] Overall: ${verification.overallStatus} (Pass: ${verification.stats.passed}, Fail: ${verification.stats.failed})`);

      // C. Run Critic Review
      let diffContent = '';
      if (checkpoint.isGit && checkpoint.gitCheckpointSha) {
        try {
          diffContent = execSync(`git diff ${checkpoint.gitCheckpointSha}`, { cwd, encoding: 'utf8', env: { ...process.env, PAGER: 'cat' } });
        } catch {}
      }
      if (uiServer) {
        broadcastState(uiServer, { stage: 'critic' }, config, adapter);
      }
      critic = await runMultiAgentCriticReview(contract, diffAnalysis, verification, config, adapter, sessionPath, diffContent);
      console.log(`\n--- Critic Review (Status: ${critic.status}, Confidence: ${critic.confidence}) ---`);
      if (critic.findings.length > 0) {
        console.log('Findings:');
        critic.findings.forEach((f: string) => console.log(`  - ${f}`));
      }
      if (critic.requiredActions.length > 0) {
        console.log('Required Actions:');
        critic.requiredActions.forEach((a: string) => console.log(`  - ${a}`));
      }

      if (uiServer) {
        const uiFindings = critic.findings.map((f: string) => {
          let type: 'BLOCK' | 'WARN' | 'PASS' = 'WARN';
          if (f.startsWith('[FAIL]') || f.startsWith('[BLOCK]')) type = 'BLOCK';
          else if (f.startsWith('[PASS]')) type = 'PASS';
          return {
            type,
            title: type === 'BLOCK' ? 'Critic Block' : (type === 'PASS' ? 'Critic Pass' : 'Critic Warning'),
            message: f
          };
        });
        uiServer.updateState({ findings: uiFindings });
      }

      if (critic.status === 'PASS' && !((contract.preserveExistingTests ?? false) && existingTestModified)) {
        passedAll = true;
        break;
      }

      // Run Test Correctness Critic if verification failed or test policy failed
      if (((verification && verification.overallStatus === 'FAIL') || existingTestModified) && isAgentMode && adapter && adapter.reviewTestCorrectness) {
        console.log('\n[Critic] Analyzing test failure correctness...');
        try {
          testCriticResult = await adapter.reviewTestCorrectness({
            taskContract: contract,
            diff: diffContent,
            verificationResult: verification!,
            config,
            sessionPath
          });
          lastTestCriticVerdict = testCriticResult.verdict;
          lastTestCriticExplanation = testCriticResult.explanation;
          console.log(`[Critic Verdict] ${lastTestCriticVerdict}: ${lastTestCriticExplanation}`);
          console.log(`[Critic Suggestion] ${testCriticResult.suggestedFix}`);
        } catch (err: any) {
          if (err.message && err.message.includes('[Jewel Budget Guard]')) {
            throw err;
          }
          console.error(`[Critic Error] Failed to run test correctness critic: ${err.message}`);
        }
      }

      // Bounded retry checks
      const verdict = testCriticResult?.verdict || (verification?.overallStatus === 'FAIL' ? 'BAD_IMPLEMENTATION' : 'UNKNOWN');
      const confidence = testCriticResult?.confidence || (verification?.overallStatus === 'FAIL' ? 'high' : 'low');
      const failureLog = verification?.results.map(r => r.errorMsg || r.stderr || r.stdout || '').join('\n') || '';

      finalStopDecision = shouldStopRetry(
        retryState,
        failureLog,
        verdict,
        confidence,
        (contract.preserveExistingTests ?? false) && existingTestModified
      );

      let shouldInteractivePrompt = false;
      let promptReason = '';

      if (finalStopDecision.stop) {
        shouldInteractivePrompt = true;
        promptReason = finalStopDecision.reason || 'Critic stopped retry loop.';
      } else if (retries >= maxRetries) {
        shouldInteractivePrompt = true;
        promptReason = `Maximum retry limit (${maxRetries}) reached.`;
      }

      const isInteractive = !!process.stdout.isTTY && !process.env.CI && config.interactiveRetryMode;

      if (shouldInteractivePrompt && isInteractive) {
        console.log(`\n[!] Safety or verification check failed. Reason: ${promptReason}`);
        console.log('What would you like to do?');
        console.log('  [r] Retry with custom hint');
        console.log('  [o] Override failure and finalize (forces success)');
        console.log('  [a] Abort and rollback (default)');

        let choice = '';
        if (useUI && uiServer) {
          uiServer.updateState({ stage: 'review' });
          const res = await uiServer.waitForApproval('retry-choice', {
            message: `Safety or verification check failed. Reason: ${promptReason}`
          });
          choice = res.action;
          customHint = res.comment;
        } else {
          while (choice !== 'r' && choice !== 'o' && choice !== 'a') {
            const answer = await askQuestion('Choice [r/o/a]: ');
            choice = answer.toLowerCase().trim();
            if (choice === '') {
              choice = 'a'; // default to abort
            }
            if (choice !== 'r' && choice !== 'o' && choice !== 'a') {
              console.log('Invalid choice. Please enter "r", "o", or "a".');
            }
          }
        }

        if (choice === 'r' || choice === 'retry') {
          if (!useUI || !customHint) {
            const hint = await askQuestion('Enter hint/guidance for the AI: ');
            customHint = hint;
          }
          maxRetries++;
          if (config.maxRetries !== undefined) {
            config.maxRetries++;
          }
          finalStopDecision = null;
          retryState.seenFailures.clear();
          console.log(`\n[+] Retry registered. Continuing with custom hint...`);
        } else if (choice === 'o' || choice === 'override') {
          console.log('\n[+] Overriding failure. Finalizing task...');
          passedAll = true;
          approved = true;
          break;
        } else {
          console.log('\n[-] Aborting execution...');
          passedAll = false;
          break;
        }
      } else if (finalStopDecision.stop) {
        console.log(`\n[Retry Stop] ${finalStopDecision.reason}`);
        passedAll = false;
        break;
      }

      recordRetryAttempt(retryState, failureLog, verdict);

      if (retries >= maxRetries) {
        break;
      }

      if (isAgentMode && adapter) {
        console.log(`\n[Retry ${retries + 1}/${maxRetries}] AI Adapter is auto-fixing the changes based on verification/critic feedback...`);
        // Rollback current modifications to checkpoint to start with a clean workspace
        console.log('Rolling back changes to checkpoint before re-proposing...');
        try {
          rollbackCheckpoint(checkpoint, cwd);
        } catch (err: any) {
          console.error(`[-] Pre-retry rollback failed: ${err.message}`);
        }

        const repoContext = buildRepoContext(cwd, contract.filesLikelyNeeded);
        try {
          const patch = await adapter.proposePatch({
            taskContract: contract,
            allowedFiles: contract.filesLikelyNeeded,
            repoContext,
            verificationResult: verification,
            testCriticResult: testCriticResult || undefined,
            criticResult: critic || undefined,
            config,
            sessionPath,
            customHint,
            failedDiff: diffContent
          });

          validatePatchProposalJson(patch);

          if (patch.noChangeNeeded === true) {
            console.log(`\n[Adapter] Adapter indicated no changes are needed on retry.`);
            break;
          }

          const patchResult = applyPatchProposalSafely(patch, contract, config, cwd, sessionPath);
          if (!patchResult.success) {
            console.error(`[-] Proposed patch was blocked by Safe Patch Writer on retry.`);
            break;
          } else {
            for (const filePath of patchResult.appliedFiles) {
              console.log(`  [+] Applied patch to: ${filePath}`);
            }
          }
        } catch (err: any) {
          if (err.message && err.message.includes('[Jewel Budget Guard]')) {
            throw err;
          }
          console.error(`[-] Auto-fix patch proposal failed: ${err.message}`);
          break;
        }

        retries++;
      } else {
        if (useMock) {
          console.log('Mock mode: Failures detected. Bypassing interactive retry.');
          break;
        } else {
          console.log('\n[!] Checks failed. Please fix the problems in your code.');
          console.log(`Remaining retries: ${maxRetries - retries}`);
          let answer = '';
          if (useUI && uiServer) {
            uiServer.updateState({ stage: 'review' });
            const res = await uiServer.waitForApproval('retry-choice', {
              message: `Verification checks failed. Remaining retries: ${maxRetries - retries}. Select action:`
            });
            answer = res.action === 'retry' ? 'y' : 'n';
          } else {
            const response = await askQuestion('Would you like to re-run verification now? (y/n): ');
            answer = response.toLowerCase().trim();
          }
          if (answer !== 'y') {
            break;
          }
          retries++;
        }
      }
    }
  }

  // Write provenance report if any test files were checked
  if (testProvenanceRecords.length > 0) {
    try {
      const { writeTestProvenanceReport } = require('../../verification/test-provenance');
      writeTestProvenanceReport(testProvenanceRecords.map(r => ({
        ...r,
        provider: adapter?.name || 'none',
        criticVerdict: testCriticResult?.verdict || 'UNKNOWN',
        verificationStatus: verification?.overallStatus || 'UNKNOWN'
      })), cwd);
      console.log(`[+] Test provenance report written to .jewel/reports/test-provenance.md`);
    } catch (err: any) {
      console.error(`[-] Failed to write test provenance report: ${err.message}`);
    }
  }

  // 6. Finalize (Success or Rollback)
  let reportStatus: string;
  if (passedAll) {
    reportStatus = 'PASS';
  } else if (patchBlocked) {
    reportStatus = 'BLOCKED';
  } else if (noChangeNeeded) {
    reportStatus = 'NO_CHANGES_DETECTED';
  } else if (contract.preserveExistingTests && existingTestModified) {
    reportStatus = 'EXISTING_TEST_MODIFIED';
  } else if (finalStopDecision && finalStopDecision.status && finalStopDecision.status !== 'RETRY_LIMIT_REACHED') {
    reportStatus = finalStopDecision.status;
  } else if (lastTestCriticVerdict === 'BAD_GENERATED_TEST') {
    reportStatus = 'GENERATED_TEST_SUSPECT';
  } else if (finalStopDecision && finalStopDecision.status) {
    reportStatus = finalStopDecision.status;
  } else if (diffAnalysis?.status === 'BLOCK' || critic?.status === 'BLOCK') {
    reportStatus = 'BLOCKED';
  } else if (retries >= maxRetries) {
    reportStatus = 'RETRY_LIMIT_REACHED';
  } else {
    reportStatus = 'FAIL';
  }

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
    keepFailed,
    testChangeFindings,
    preserveExistingTests: contract.preserveExistingTests
  });

  if (passedAll || (noChangeNeeded && !patchBlocked)) {
    console.log(`\n[+] Success! Task verified and finalized. Report written to .jewel/reports/latest-run.md`);
    if (useUI && uiServer) {
      uiServer.updateState({ stage: 'completed' });
      console.log(`\nDashboard execution finished. Open ${uiServer.getUrl()} to stop the server and inspect results, or press [ENTER] in this terminal to exit.`);
      await waitForExitAcknowledgment(uiServer);
    }
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

    if (reportStatus === 'EXISTING_TEST_MODIFIED') {
      if (rolledBack) {
        throw new JewelError(
          'EXISTING_TEST_MODIFIED',
          'Verification failed because existing tests were modified or renamed, and changes were rolled back successfully.',
          'Do not modify existing tests. You can append new tests if required.'
        );
      } else {
        throw new JewelError(
          'EXISTING_TEST_MODIFIED',
          'Verification failed because existing tests were modified or renamed. Workspace kept as is.',
          'Do not modify existing tests. You can append new tests if required.'
        );
      }
    }

    if (reportStatus === 'COVERAGE_THRESHOLD_VIOLATION') {
      if (rolledBack) {
        throw new JewelError(
          'COVERAGE_THRESHOLD_VIOLATION',
          'Verification failed because code coverage fell below the required threshold, and changes were rolled back successfully.',
          'Increase test coverage for your modifications or adjust minCoverage requirements in jewel.config.json.'
        );
      } else {
        throw new JewelError(
          'COVERAGE_THRESHOLD_VIOLATION',
          'Verification failed because code coverage fell below the required threshold. Workspace kept as is.',
          'Increase test coverage for your modifications or adjust minCoverage requirements in jewel.config.json.'
        );
      }
    }

    if (reportStatus === 'NEEDS_HUMAN_REVIEW') {
      if (rolledBack) {
        throw new JewelError(
          'NEEDS_HUMAN_REVIEW',
          'Verification failed and critic has low confidence or verdict is UNKNOWN. Rolled back successfully.',
          'Please review the logs and proposed changes manually.'
        );
      } else {
        throw new JewelError(
          'NEEDS_HUMAN_REVIEW',
          'Verification failed and critic has low confidence or verdict is UNKNOWN. Workspace kept as is.',
          'Please review the logs and proposed changes manually.'
        );
      }
    }

    if (reportStatus === 'RETRY_LIMIT_REACHED') {
      if (rolledBack) {
        throw new JewelError(
          'RETRY_LIMIT_REACHED',
          'Verification failed and retry limit was reached. Rolled back successfully.',
          'Refine the task explanation or fix implementation errors before retrying.'
        );
      } else {
        throw new JewelError(
          'RETRY_LIMIT_REACHED',
          'Verification failed and retry limit was reached. Workspace kept as is.',
          'Refine the task explanation or fix implementation errors before retrying.'
        );
      }
    }

    if (reportStatus === 'GENERATED_TEST_SUSPECT') {
      if (rolledBack) {
        throw new JewelError(
          'GENERATED_TEST_SUSPECT',
          'Verification failed because the generated tests contain logical errors, and changes were rolled back successfully.',
          'Review the generated test logic, refine success criteria, or adjust constraints and try again.'
        );
      } else {
        throw new JewelError(
          'GENERATED_TEST_SUSPECT',
          'Verification failed because the generated tests contain logical errors. Workspace kept as is.',
          'Review the generated test logic, refine success criteria, or adjust constraints and try again.'
        );
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
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;

    if (useUI && uiServer) {
      const jewelErr = toJewelError(err);
      uiServer.updateState({
        stage: 'failed',
        findings: [
          ...(uiServer.getState().findings || []),
          {
            type: 'BLOCK',
            title: jewelErr.status || 'Error',
            message: jewelErr.message
          }
        ]
      });
      console.log(`\n[!] Execution failed: ${jewelErr.message}`);
      console.log(`Open ${uiServer.getUrl()} to stop the server and exit, or press [ENTER] in this terminal to exit.`);
      await waitForExitAcknowledgment(uiServer);
    }

    if (err && err.message && err.message.startsWith('exit-')) {
      throw err;
    }
    const jewelErr = toJewelError(err);
    if (jewelErr.status === 'BUDGET_EXCEEDED') {
      if (sessionPath && sessionId) {
        writeRunReport(cwd, sessionPath, sessionId, task, 'BUDGET_EXCEEDED', config, adapter, { error: err.message });
      }
      if (checkpoint && !keepFailed) {
        console.log('Rolling back changes due to budget limit breach...');
        try {
          rollbackCheckpoint(checkpoint, cwd);
          console.log('[+] Rollback completed. Working files restored safely.');
        } catch (rollbackErr: any) {
          console.error(`[-] Rollback failed: ${rollbackErr.message}`);
        }
      }
    }
    console.error(`\n======================================`);
    console.error(`Status: ${jewelErr.status}`);
    console.error(`Error: ${jewelErr.message}`);
    console.error(`Next Action: ${jewelErr.nextAction}`);
    console.error(`======================================\n`);
    process.exit(1);
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    if (uiServer) {
      await uiServer.close();
    }
  }
}

