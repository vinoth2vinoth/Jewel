import { runInit } from './commands/init';
import { runVerify } from './commands/verify';
import { runStatus } from './commands/status';
import { runRollback } from './commands/rollback';
import { runDoctor } from './commands/doctor';
import { runAudit } from './commands/audit';
import { runTask } from './commands/run';
import { runVersion } from './commands/version';
import { runTui } from './commands/tui';
import { runWatch } from './commands/watch';
import { getSessionForResume } from '../core/session-history';
import { toJewelError } from './errors';

function printHelp(): void {
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
  --ui                       Start a local HTTP server for interactive dashboard.
  -h, --help                 Print this help menu.
`);
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  if (args.length === 0) {
    await runTui();
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      case 'init': {
        runInit();
        break;
      }

      case 'version': {
        runVersion();
        break;
      }

      case 'verify': {
        await runVerify();
        break;
      }

      case 'status': {
        runStatus();
        break;
      }

      case 'rollback': {
        const targetSession = args[1] && !args[1].startsWith('-') ? args[1] : undefined;
        runRollback(targetSession);
        break;
      }

      case 'diff': {
        const targetSession = args[1] && !args[1].startsWith('-') ? args[1] : undefined;
        const { runDiff } = require('./commands/diff');
        runDiff(targetSession);
        break;
      }

      case 'doctor': {
        runDoctor();
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
          } else if (arg === '--debounce') {
            const val = remainingArgs[i + 1];
            if (val && !val.startsWith('-')) {
              debounceMs = parseInt(val, 10);
              i++;
            }
          } else if (arg === '--once') {
            once = true;
          }
        }
        await runWatch(process.cwd(), { intervalMs, debounceMs, once });
        break;
      }

      case 'smoke-provider': {
        let providerOverride: string | undefined;
        let modelOverride: string | undefined;
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
          } else if (arg === '--model') {
            const val = remainingArgs[i + 1];
            if (val && !val.startsWith('-')) {
              modelOverride = val;
              i++;
            }
          } else if (arg === '--schema') {
            schemaFlag = true;
          } else if (arg === '--no-write') {
            noWriteFlag = true;
          }
        }

        const { runSmokeProvider } = require('./commands/smoke-provider');
        await runSmokeProvider(providerOverride, modelOverride, schemaFlag, noWriteFlag);
        break;
      }

      case 'provider-ready': {
        let providerOverride: string | undefined;
        let modelOverride: string | undefined;

        const remainingArgs = args.slice(1);
        for (let i = 0; i < remainingArgs.length; i++) {
          const arg = remainingArgs[i];
          if (arg === '--provider') {
            const val = remainingArgs[i + 1];
            if (val && !val.startsWith('-')) {
              providerOverride = val;
              i++;
            }
          } else if (arg === '--model') {
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
        runAudit();
        break;
      }

      case 'resume': {
        let sessionId: string | undefined;
        let argStart = 1;
        if (args[1] && !args[1].startsWith('-')) {
          sessionId = args[1];
          argStart = 2;
        }

        const payload = getSessionForResume(process.cwd(), sessionId);
        if (!payload) {
          console.error('Error: No session found to resume. Run jewel status to see recent sessions.');
          process.exit(1);
        }

        let useMock = false;
        let yesFlag = false;
        let noReview = false;
        let keepFailed = false;
        let providerOverride: string | undefined;
        let modelOverride: string | undefined;
        let temperatureOverride: number | undefined;
        let maxOutputTokensOverride: number | undefined;
        let dryRun = false;
        let uiFlag = false;

        for (let i = argStart; i < args.length; i++) {
          const arg = args[i];
          if (arg === '-m' || arg === '--mock') useMock = true;
          else if (arg === '--yes') yesFlag = true;
          else if (arg === '--no-review') noReview = true;
          else if (arg === '--keep-failed') keepFailed = true;
          else if (arg === '--dry-run') dryRun = true;
          else if (arg === '--ui') uiFlag = true;
          else if (arg === '--provider') {
            const val = args[i + 1];
            if (val && !val.startsWith('-')) { providerOverride = val; i++; }
          } else if (arg === '--model') {
            const val = args[i + 1];
            if (val && !val.startsWith('-')) { modelOverride = val; i++; }
          } else if (arg === '--temperature') {
            const val = args[i + 1];
            if (val && !val.startsWith('-')) { temperatureOverride = parseFloat(val); i++; }
          } else if (arg === '--max-output-tokens') {
            const val = args[i + 1];
            if (val && !val.startsWith('-')) { maxOutputTokensOverride = parseInt(val, 10); i++; }
          }
        }

        console.log(`[+] Resuming session ${payload.sessionId}: "${payload.task}"`);
        await runTask(
          payload.task,
          payload.files,
          useMock,
          process.cwd(),
          yesFlag,
          noReview,
          keepFailed,
          {
            provider: providerOverride,
            model: modelOverride,
            temperature: temperatureOverride,
            maxOutputTokens: maxOutputTokensOverride
          },
          dryRun,
          uiFlag
        );
        break;
      }

      case 'run': {
        const taskText = args[1];
        if (!taskText || taskText.startsWith('-')) {
          console.error('Error: You must provide a task description. Example: jewel run "Fix styling bug"');
          process.exit(1);
        }

        // Parse options
        let filesNeeded: string[] = [];
        let useMock = false;
        let yesFlag = false;
        let noReview = false;
        let keepFailed = false;
        let providerOverride: string | undefined;
        let modelOverride: string | undefined;
        let temperatureOverride: number | undefined;
        let maxOutputTokensOverride: number | undefined;
        let dryRun = false;
        let uiFlag = false;

        const remainingArgs = args.slice(2);
        for (let i = 0; i < remainingArgs.length; i++) {
          const arg = remainingArgs[i];
          if (arg === '-f' || arg === '--files') {
            const fileVal = remainingArgs[i + 1];
            if (fileVal && !fileVal.startsWith('-')) {
              filesNeeded = fileVal.split(',').map(s => s.trim()).filter(Boolean);
              i++;
            }
          } else if (arg === '-m' || arg === '--mock') {
            useMock = true;
          } else if (arg === '--yes') {
            yesFlag = true;
          } else if (arg === '--no-review') {
            noReview = true;
          } else if (arg === '--keep-failed') {
            keepFailed = true;
          } else if (arg === '--provider') {
            const val = remainingArgs[i + 1];
            if (val && !val.startsWith('-')) {
              providerOverride = val;
              i++;
            }
          } else if (arg === '--model') {
            const val = remainingArgs[i + 1];
            if (val && !val.startsWith('-')) {
              modelOverride = val;
              i++;
            }
          } else if (arg === '--temperature') {
            const val = remainingArgs[i + 1];
            if (val && !val.startsWith('-')) {
              temperatureOverride = parseFloat(val);
              i++;
            }
          } else if (arg === '--max-output-tokens') {
            const val = remainingArgs[i + 1];
            if (val && !val.startsWith('-')) {
              maxOutputTokensOverride = parseInt(val, 10);
              i++;
            }
          } else if (arg === '--dry-run') {
            dryRun = true;
          } else if (arg === '--ui') {
            uiFlag = true;
          }
        }

        const overrides = {
          provider: providerOverride,
          model: modelOverride,
          temperature: temperatureOverride,
          maxOutputTokens: maxOutputTokensOverride
        };

        await runTask(taskText, filesNeeded, useMock, process.cwd(), yesFlag, noReview, keepFailed, overrides, dryRun, uiFlag);
        break;
      }

      default: {
        console.error(`Error: Unknown command "${command}".`);
        printHelp();
        process.exit(1);
      }
    }
  } catch (err: any) {
    const jewelErr = toJewelError(err);
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
