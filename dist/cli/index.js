"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const init_1 = require("./commands/init");
const verify_1 = require("./commands/verify");
const status_1 = require("./commands/status");
const rollback_1 = require("./commands/rollback");
const doctor_1 = require("./commands/doctor");
const audit_1 = require("./commands/audit");
const run_1 = require("./commands/run");
const version_1 = require("./commands/version");
const tui_1 = require("./commands/tui");
const watch_1 = require("./commands/watch");
const mcp_1 = require("./commands/mcp");
const lsp_1 = require("./commands/lsp");
const benchmark_1 = require("./commands/benchmark");
const continue_1 = require("./commands/continue");
const ship_1 = require("./commands/ship");
const session_history_1 = require("../core/session-history");
const errors_1 = require("./errors");
function printHelp() {
    console.log(`
Jewel CLI - AI Coding Safety Harness (Karpathy-inspired)

Usage:
  jewel <command> [arguments] [options]

Commands:
  init                       Initialize Jewel configuration, AGENTS.md, and skills in the current folder.
  run "<task>"               Execute a task protected by Jewel rules and verification checks.
  verify                     Run all configured verification commands.
  status                     Display the current session, checkpoint, and repository status.
  rollback [session-id]      Roll back the workspace to a session checkpoint state.
  diff [session-id]          Show proposed changes and diff preview for a session.
  audit                      Perform a safety and repository quality check.
  doctor                     Run local environment health and configuration checks.
  smoke-provider             Run provider validation smoke tests.
  provider-ready             Verify provider configuration, capability registry, and run connection checks.
  release-check              Verify public package and release readiness checklist.
  watch                      Run verification continuously when source files change.
  resume [session-id]        Re-run a previous session task from history.
  continue [session-id] "<feedback>"  Continue a prior session with follow-up feedback.
  ship [session-id]          Commit session changes to a branch with PR body template.
  benchmark                  Run curated benchmark tasks (use --mock for deterministic runs).
  mcp                        Start Jewel MCP server on stdio (Cursor / Claude Desktop).
  lsp                        Start Jewel Language Server on stdio (VS Code extension).
  version                    Print the version info.

Options:
  -f, --files <file1,file2>  Declare files likely needed for the task contract (used with 'run').
  -m, --mock                 Use the mock agent adapter to automatically apply deterministic patches (used with 'run').
  --yes                      Bypass interactive human diff approval review.
  --no-review                Disable diff approval review (ignored if config requires it).
  --keep-failed              Do not roll back changes if verification or review fails.
  --provider <provider>      Override provider (none, openai, gemini, anthropic, openrouter).
  --model <model>            Override model name.
  --temperature <temp>       Override temperature.
  --max-output-tokens <n>    Override max output tokens.
  --dry-run                  Preview the task contract and files scope without creating a session or applying changes.
  --plan-only                Generate and preview plan (creates session metadata, no patch/verify).
  --ui                       Start a local HTTP server for interactive dashboard.
  -h, --help                 Print this help menu.
`);
}
async function main() {
    const args = process.argv.slice(2);
    if (args.includes('-h') || args.includes('--help')) {
        printHelp();
        process.exit(0);
    }
    if (args.length === 0) {
        await (0, tui_1.runTui)();
        process.exit(0);
    }
    const command = args[0];
    try {
        switch (command) {
            case 'init': {
                (0, init_1.runInit)();
                break;
            }
            case 'version': {
                (0, version_1.runVersion)();
                break;
            }
            case 'verify': {
                await (0, verify_1.runVerify)();
                break;
            }
            case 'status': {
                (0, status_1.runStatus)();
                break;
            }
            case 'rollback': {
                const targetSession = args[1] && !args[1].startsWith('-') ? args[1] : undefined;
                (0, rollback_1.runRollback)(targetSession);
                break;
            }
            case 'diff': {
                const targetSession = args[1] && !args[1].startsWith('-') ? args[1] : undefined;
                const { runDiff } = require('./commands/diff');
                runDiff(targetSession);
                break;
            }
            case 'doctor': {
                (0, doctor_1.runDoctor)();
                break;
            }
            case 'release-check': {
                const { runReleaseCheck } = require('./commands/release-check');
                runReleaseCheck();
                break;
            }
            case 'watch': {
                let intervalMs = 2000;
                let debounceMs = 1000;
                let once = false;
                const remainingArgs = args.slice(1);
                for (let i = 0; i < remainingArgs.length; i++) {
                    const arg = remainingArgs[i];
                    if (arg === '--interval') {
                        const val = remainingArgs[i + 1];
                        if (val && !val.startsWith('-')) {
                            intervalMs = parseInt(val, 10);
                            i++;
                        }
                    }
                    else if (arg === '--debounce') {
                        const val = remainingArgs[i + 1];
                        if (val && !val.startsWith('-')) {
                            debounceMs = parseInt(val, 10);
                            i++;
                        }
                    }
                    else if (arg === '--once') {
                        once = true;
                    }
                }
                await (0, watch_1.runWatch)(process.cwd(), { intervalMs, debounceMs, once });
                break;
            }
            case 'smoke-provider': {
                let providerOverride;
                let modelOverride;
                let schemaFlag = false;
                let noWriteFlag = false;
                const remainingArgs = args.slice(1);
                for (let i = 0; i < remainingArgs.length; i++) {
                    const arg = remainingArgs[i];
                    if (arg === '--provider') {
                        const val = remainingArgs[i + 1];
                        if (val && !val.startsWith('-')) {
                            providerOverride = val;
                            i++;
                        }
                    }
                    else if (arg === '--model') {
                        const val = remainingArgs[i + 1];
                        if (val && !val.startsWith('-')) {
                            modelOverride = val;
                            i++;
                        }
                    }
                    else if (arg === '--schema') {
                        schemaFlag = true;
                    }
                    else if (arg === '--no-write') {
                        noWriteFlag = true;
                    }
                }
                const { runSmokeProvider } = require('./commands/smoke-provider');
                await runSmokeProvider(providerOverride, modelOverride, schemaFlag, noWriteFlag);
                break;
            }
            case 'provider-ready': {
                let providerOverride;
                let modelOverride;
                const remainingArgs = args.slice(1);
                for (let i = 0; i < remainingArgs.length; i++) {
                    const arg = remainingArgs[i];
                    if (arg === '--provider') {
                        const val = remainingArgs[i + 1];
                        if (val && !val.startsWith('-')) {
                            providerOverride = val;
                            i++;
                        }
                    }
                    else if (arg === '--model') {
                        const val = remainingArgs[i + 1];
                        if (val && !val.startsWith('-')) {
                            modelOverride = val;
                            i++;
                        }
                    }
                }
                const { runProviderReady } = require('./commands/provider-ready');
                await runProviderReady(providerOverride || '', modelOverride);
                break;
            }
            case 'audit': {
                (0, audit_1.runAudit)();
                break;
            }
            case 'ship': {
                let sessionId;
                let branch;
                let message;
                const remaining = args.slice(1);
                for (let i = 0; i < remaining.length; i++) {
                    const arg = remaining[i];
                    if (arg === '--branch') {
                        branch = remaining[i + 1];
                        i++;
                    }
                    else if (arg === '--message') {
                        message = remaining[i + 1];
                        i++;
                    }
                    else if (!arg.startsWith('-') && !sessionId) {
                        sessionId = arg;
                    }
                }
                (0, ship_1.runShip)({ sessionId, branch, message, cwd: process.cwd() });
                break;
            }
            case 'continue': {
                let sessionId;
                let feedback;
                let argStart = 1;
                if (args[1] && !args[1].startsWith('-') && !args[1].startsWith('"')) {
                    sessionId = args[1];
                    argStart = 2;
                }
                feedback = args[argStart];
                if (feedback && (feedback.startsWith('"') || feedback.startsWith("'"))) {
                    feedback = feedback.slice(1, -1);
                }
                let useMock = false;
                let yesFlag = false;
                let noReview = false;
                let keepFailed = false;
                let dryRun = false;
                let uiFlag = false;
                let providerOverride;
                let modelOverride;
                let temperatureOverride;
                let maxOutputTokensOverride;
                for (let i = argStart + (feedback ? 1 : 0); i < args.length; i++) {
                    const arg = args[i];
                    if (arg === '-m' || arg === '--mock')
                        useMock = true;
                    else if (arg === '--yes')
                        yesFlag = true;
                    else if (arg === '--no-review')
                        noReview = true;
                    else if (arg === '--keep-failed')
                        keepFailed = true;
                    else if (arg === '--dry-run')
                        dryRun = true;
                    else if (arg === '--ui')
                        uiFlag = true;
                    else if (arg === '--provider') {
                        providerOverride = args[++i];
                    }
                    else if (arg === '--model') {
                        modelOverride = args[++i];
                    }
                    else if (arg === '--temperature') {
                        temperatureOverride = parseFloat(args[++i]);
                    }
                    else if (arg === '--max-output-tokens') {
                        maxOutputTokensOverride = parseInt(args[++i], 10);
                    }
                    else if (!feedback && !arg.startsWith('-')) {
                        feedback = arg;
                    }
                }
                if (!feedback) {
                    console.error('Error: Feedback required. Example: jewel continue "Handle edge case when input is zero"');
                    process.exit(1);
                }
                await (0, continue_1.runContinueCommand)(feedback, sessionId, useMock, process.cwd(), yesFlag, noReview, keepFailed, {
                    provider: providerOverride,
                    model: modelOverride,
                    temperature: temperatureOverride,
                    maxOutputTokens: maxOutputTokensOverride
                }, dryRun, uiFlag);
                break;
            }
            case 'benchmark': {
                const useMock = args.includes('--mock') || !args.includes('--live');
                (0, benchmark_1.runBenchmarkCommand)(useMock);
                break;
            }
            case 'mcp': {
                (0, mcp_1.runMcp)(process.cwd());
                break;
            }
            case 'lsp': {
                (0, lsp_1.runLsp)(process.cwd());
                break;
            }
            case 'resume': {
                let sessionId;
                let argStart = 1;
                if (args[1] && !args[1].startsWith('-')) {
                    sessionId = args[1];
                    argStart = 2;
                }
                const payload = (0, session_history_1.getSessionForResume)(process.cwd(), sessionId);
                if (!payload) {
                    console.error('Error: No session found to resume. Run jewel status to see recent sessions.');
                    process.exit(1);
                }
                let useMock = false;
                let yesFlag = false;
                let noReview = false;
                let keepFailed = false;
                let providerOverride;
                let modelOverride;
                let temperatureOverride;
                let maxOutputTokensOverride;
                let dryRun = false;
                let uiFlag = false;
                for (let i = argStart; i < args.length; i++) {
                    const arg = args[i];
                    if (arg === '-m' || arg === '--mock')
                        useMock = true;
                    else if (arg === '--yes')
                        yesFlag = true;
                    else if (arg === '--no-review')
                        noReview = true;
                    else if (arg === '--keep-failed')
                        keepFailed = true;
                    else if (arg === '--dry-run')
                        dryRun = true;
                    else if (arg === '--ui')
                        uiFlag = true;
                    else if (arg === '--provider') {
                        const val = args[i + 1];
                        if (val && !val.startsWith('-')) {
                            providerOverride = val;
                            i++;
                        }
                    }
                    else if (arg === '--model') {
                        const val = args[i + 1];
                        if (val && !val.startsWith('-')) {
                            modelOverride = val;
                            i++;
                        }
                    }
                    else if (arg === '--temperature') {
                        const val = args[i + 1];
                        if (val && !val.startsWith('-')) {
                            temperatureOverride = parseFloat(val);
                            i++;
                        }
                    }
                    else if (arg === '--max-output-tokens') {
                        const val = args[i + 1];
                        if (val && !val.startsWith('-')) {
                            maxOutputTokensOverride = parseInt(val, 10);
                            i++;
                        }
                    }
                }
                console.log(`[+] Resuming session ${payload.sessionId}: "${payload.task}"`);
                await (0, run_1.runTask)(payload.task, payload.files, useMock, process.cwd(), yesFlag, noReview, keepFailed, {
                    provider: providerOverride,
                    model: modelOverride,
                    temperature: temperatureOverride,
                    maxOutputTokens: maxOutputTokensOverride
                }, dryRun, uiFlag);
                break;
            }
            case 'run': {
                const taskText = args[1];
                if (!taskText || taskText.startsWith('-')) {
                    console.error('Error: You must provide a task description. Example: jewel run "Fix styling bug"');
                    process.exit(1);
                }
                // Parse options
                let filesNeeded = [];
                let useMock = false;
                let yesFlag = false;
                let noReview = false;
                let keepFailed = false;
                let providerOverride;
                let modelOverride;
                let temperatureOverride;
                let maxOutputTokensOverride;
                let dryRun = false;
                let uiFlag = false;
                let planOnly = false;
                const remainingArgs = args.slice(2);
                for (let i = 0; i < remainingArgs.length; i++) {
                    const arg = remainingArgs[i];
                    if (arg === '-f' || arg === '--files') {
                        const fileVal = remainingArgs[i + 1];
                        if (fileVal && !fileVal.startsWith('-')) {
                            filesNeeded = fileVal.split(',').map(s => s.trim()).filter(Boolean);
                            i++;
                        }
                    }
                    else if (arg === '-m' || arg === '--mock') {
                        useMock = true;
                    }
                    else if (arg === '--yes') {
                        yesFlag = true;
                    }
                    else if (arg === '--no-review') {
                        noReview = true;
                    }
                    else if (arg === '--keep-failed') {
                        keepFailed = true;
                    }
                    else if (arg === '--provider') {
                        const val = remainingArgs[i + 1];
                        if (val && !val.startsWith('-')) {
                            providerOverride = val;
                            i++;
                        }
                    }
                    else if (arg === '--model') {
                        const val = remainingArgs[i + 1];
                        if (val && !val.startsWith('-')) {
                            modelOverride = val;
                            i++;
                        }
                    }
                    else if (arg === '--temperature') {
                        const val = remainingArgs[i + 1];
                        if (val && !val.startsWith('-')) {
                            temperatureOverride = parseFloat(val);
                            i++;
                        }
                    }
                    else if (arg === '--max-output-tokens') {
                        const val = remainingArgs[i + 1];
                        if (val && !val.startsWith('-')) {
                            maxOutputTokensOverride = parseInt(val, 10);
                            i++;
                        }
                    }
                    else if (arg === '--dry-run') {
                        dryRun = true;
                    }
                    else if (arg === '--plan-only') {
                        planOnly = true;
                    }
                    else if (arg === '--ui') {
                        uiFlag = true;
                    }
                }
                const overrides = {
                    provider: providerOverride,
                    model: modelOverride,
                    temperature: temperatureOverride,
                    maxOutputTokens: maxOutputTokensOverride
                };
                await (0, run_1.runTask)(taskText, filesNeeded, useMock, process.cwd(), yesFlag, noReview, keepFailed, overrides, dryRun, uiFlag, { planOnly, approvePlan: yesFlag });
                break;
            }
            default: {
                console.error(`Error: Unknown command "${command}".`);
                printHelp();
                process.exit(1);
            }
        }
    }
    catch (err) {
        const jewelErr = (0, errors_1.toJewelError)(err);
        console.error(`\n======================================`);
        console.error(`Status: ${jewelErr.status}`);
        console.error(`Error: ${jewelErr.message}`);
        console.error(`Next Action: ${jewelErr.nextAction}`);
        console.error(`======================================\n`);
        process.exit(1);
    }
}
// Execute main if called directly
if (require.main === module) {
    main().catch(err => {
        console.error('Unhandled CLI error:', err);
        process.exit(1);
    });
}
