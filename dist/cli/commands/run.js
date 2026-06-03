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
exports.runTask = runTask;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const config_1 = require("../../core/config");
const loader_1 = require("../../skills/loader");
const session_1 = require("../../core/session");
const git_1 = require("../../storage/git");
const diff_guard_1 = require("../../safety/diff-guard");
const runner_1 = require("../../verification/runner");
const critic_1 = require("../../safety/critic");
const adapter_1 = require("../../agents/adapter");
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}
async function runTask(task, filesNeeded = [], useMock = false, cwd = process.cwd()) {
    if (!task || task.trim() === '') {
        console.error('Error: Task description cannot be empty.');
        process.exit(1);
    }
    console.log(`Starting Jewel Harness for task: "${task}"`);
    // 1. Load config & skills
    let config;
    try {
        config = (0, config_1.loadConfig)(cwd);
    }
    catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
    const skills = (0, loader_1.loadSkills)(cwd);
    console.log(`[+] Loaded ${skills.length} skills from .jewel/skills`);
    const agentsMd = path.join(cwd, 'AGENTS.md');
    if (fs.existsSync(agentsMd)) {
        console.log('[+] Detected AGENTS.md rules file.');
    }
    // 2. Initialize Session & Task Contract
    const { sessionId, sessionPath, contractPath } = (0, session_1.createSession)(task, config, filesNeeded, cwd);
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    console.log(`\n--- Enforced Task Contract (Session: ${sessionId}) ---`);
    console.log(`Task: ${contract.task}`);
    console.log(`Risk Level: ${contract.riskLevel}`);
    console.log(`Allowed Files Scope: ${contract.filesLikelyNeeded.join(', ')}`);
    console.log('Success Criteria:');
    contract.successCriteria.forEach(c => console.log(`  - ${c}`));
    // 3. Create Checkpoint
    console.log('\nCreating checkpoint...');
    const checkpoint = (0, git_1.createCheckpoint)(sessionId, cwd);
    fs.writeFileSync(path.join(sessionPath, 'checkpoint.json'), JSON.stringify(checkpoint, null, 2), 'utf8');
    console.log(`[+] Checkpoint created. strategy: ${checkpoint.isGit ? 'Git commit' : 'Backup copy'}`);
    // 4. Apply changes (Mock adapter or User edit)
    let changedFilesCount = 0;
    if (useMock) {
        console.log('\n[Adapter] Running mock agent adapter to apply changes...');
        const adapter = new adapter_1.MockAgentAdapter();
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
    }
    else {
        console.log('\n>>> Jewel is now in SAFE SLEEP mode.');
        console.log('>>> Please make your edits in the workspace.');
        console.log('>>> When you are done editing, return here.');
        await askQuestion('\nPress [ENTER] to verify and finalize your changes...');
    }
    // 5. Verify & Retries loop
    let retries = 0;
    const maxRetries = config.maxRetries;
    let verification = null;
    let diffAnalysis = null;
    let critic = null;
    let passedAll = false;
    while (retries <= maxRetries) {
        if (retries > 0) {
            console.log(`\n[Retry ${retries}/${maxRetries}] Retrying verification checks...`);
        }
        // A. Inspect changes via Diff Guard
        diffAnalysis = (0, diff_guard_1.runDiffGuard)(checkpoint, config, cwd);
        console.log(`\n--- Diff Guard Summary (Status: ${diffAnalysis.status}) ---`);
        console.log(`Changed files: ${diffAnalysis.changedFilesCount}`);
        console.log(`Lines added: ${diffAnalysis.addedLinesCount}, removed: ${diffAnalysis.removedLinesCount}`);
        if (diffAnalysis.findings.length > 0) {
            console.log('Findings:');
            diffAnalysis.findings.forEach(f => console.log(`  - ${f}`));
        }
        // B. Run verification commands
        console.log('\nRunning verification tests...');
        verification = (0, runner_1.runVerification)(config, cwd);
        console.log(`[Verification] Overall: ${verification.overallStatus} (Pass: ${verification.stats.passed}, Fail: ${verification.stats.failed})`);
        // C. Run Critic Review
        critic = (0, critic_1.runCriticReview)(contract, diffAnalysis, verification, config);
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
        }
        else {
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
    }
    else {
        console.error(`\n[-] Safety or verification check failed. Status: ${reportStatus}`);
        console.log('Rolling back changes to restore original state...');
        try {
            (0, git_1.rollbackCheckpoint)(checkpoint, cwd);
            console.log('[+] Rollback completed. Working files restored safely.');
        }
        catch (err) {
            console.error(`[-] Rollback failed: ${err.message}`);
        }
        process.exit(1);
    }
}
